/**
 * Same Firebase API and results, with passive diagnostic observations.
 * All application SDK reads go through this module. Never issues extra Firebase reads,
 * changes snapshot options, calls data(), or estimates billing from snapshot size.
 * Counter batches use a separate HTTP collector. Writes pass through to the SDK unchanged.
 */
import * as sdk from 'firebase/firestore';
import { firestoreScope, listenerTopology, observe, registerFirestoreDatabase } from '../../observability/firestore-telemetry.mjs';
export * from 'firebase/firestore';
export function getFirestore(...args) {
    const db = sdk.getFirestore(...args);
    registerFirestoreDatabase(db, db.app.options.projectId, typeof args[0] === 'string' ? args[0] : args[1] || '(default)');
    return db;
}
export function initializeFirestore(app, settings, database = '(default)') {
    const db = sdk.initializeFirestore(app, settings, database);
    registerFirestoreDatabase(db, app.options.projectId, database);
    return db;
}
const paths = new WeakMap();
function pathOf(ref) {
    return ref && typeof ref === 'object' ? paths.get(ref) || ref.path || '(query)' : '(unknown)';
}
function scopeOf(ref) { return firestoreScope(ref?.firestore, pathOf(ref)); }
function referenceFactory(name) {
    return (...args) => {
        const ref = sdk[name](...args);
        const path = name === 'query' ? pathOf(args[0]) : ref.path || `**/${args[1]}`;
        if (ref && typeof ref === 'object')
            paths.set(ref, path);
        return ref;
    };
}
export const collection = referenceFactory('collection');
export const doc = referenceFactory('doc');
export const query = referenceFactory('query');
export const collectionGroup = referenceFactory('collectionGroup');
function recordSnapshot(scope, operation, snap, listener = false) {
    try {
        const counts = { snapshots: 1 };
        const add = (name, n = 1) => { counts[name] = (counts[name] || 0) + n; };
        const source = (doc) => doc.metadata?.hasPendingWrites ? 'pendingWriteDocuments'
            : snap.metadata?.fromCache === true ? 'cacheDocuments'
                : snap.metadata?.fromCache === false ? 'serverDocuments' : 'unknownSourceDocuments';
        // QuerySnapshot.docs is a getter that materializes the entire result. Avoid
        // touching it on listener updates: only docChanges() is needed for telemetry.
        if ('docs' in snap) {
            if (!listener && snap.metadata?.hasPendingWrites === false && Number.isInteger(snap.size)) {
                if (snap.size === 0) add('emptyQueryResults');
                else add(source({}), snap.size);
                observe(scope, operation, counts);
                return;
            }
            const changes = listener ? snap.docChanges() : snap.docs.map((doc) => ({ type: 'added', doc }));
            if (!changes.length)
                add(listener ? 'snapshotsWithoutDocumentChanges' : 'emptyQueryResults');
            for (const change of changes) {
                // A removed event is not proof of a billable read (deletion vs filter exit).
                if (change.type === 'removed') {
                    add('removedDocuments');
                    continue;
                }
                add(source(change.doc));
            }
        }
        else if (typeof snap.exists === 'function' && !snap.exists()) {
            add('missingDocumentResults');
        }
        else {
            add(source(snap));
        }
        observe(scope, operation, counts);
    }
    catch { /* Bad metadata must never prevent delivery of the original snapshot. */ }
}
function read(name) {
    return async (ref) => {
        const scope = scopeOf(ref);
        observe(scope, name, { readCalls: 1 });
        try {
            const result = await sdk[name](ref);
            recordSnapshot(scope, name, result);
            observe(scope, name, { successfulReadCalls: 1 });
            return result;
        }
        catch (error) {
            observe(scope, name, { failedReadCalls: 1 });
            throw error;
        }
    };
}
export const getDoc = read('getDoc');
export const getDocs = read('getDocs');
export const getDocFromServer = read('getDocFromServer');
export const getDocsFromServer = read('getDocsFromServer');
export const getDocFromCache = read('getDocFromCache');
export const getDocsFromCache = read('getDocsFromCache');
function aggregate(name) {
    return async (ref, ...args) => {
        const scope = scopeOf(ref);
        observe(scope, name, { aggregationCalls: 1 });
        try {
            const result = await sdk[name](ref, ...args);
            // The client SDK does not expose scanned index entries. A sum is NOT "1 read".
            observe(scope, name, { successfulAggregationCalls: 1 });
            return result;
        }
        catch (error) {
            observe(scope, name, { failedAggregationCalls: 1 });
            throw error;
        }
    };
}
export const getCountFromServer = aggregate('getCountFromServer');
export const getAggregateFromServer = aggregate('getAggregateFromServer');
const groups = new Set();
function equalReference(a, b) {
    if (a.firestore !== b.firestore || (a.type === 'document') !== (b.type === 'document'))
        return false;
    return a.type === 'document' ? sdk.refEqual(a, b) : sdk.queryEqual(a, b);
}
export const onSnapshot = ((ref, ...args) => {
    const scope = scopeOf(ref);
    const first = args[0];
    const hasOptions = first && typeof first === 'object' && ('source' in first || 'includeMetadataChanges' in first);
    const source = hasOptions ? first.source || 'default' : 'default';
    let group = [...groups].find(g => g.source === source && equalReference(g.ref, ref));
    const newGroup = !group;
    if (!group) {
        group = { ref, source, members: new Set() };
        groups.add(group);
    }
    const current = group;
    const member = Symbol();
    current.members.add(member);
    listenerTopology(1, newGroup ? 1 : 0);
    observe(scope, 'onSnapshot', { listenerAttaches: 1 });
    let active = true;
    const release = () => {
        if (!active)
            return;
        active = false;
        current.members.delete(member);
        const empty = !current.members.size;
        if (empty)
            groups.delete(current);
        listenerTopology(-1, empty ? -1 : 0);
    };
    let initial = true;
    const next = (snap) => {
        observe(scope, 'onSnapshot', { listenerCallbacks: 1 });
        if (current.members.values().next().value === member) {
            if (!current.serverSeen && snap.metadata?.fromCache === false) {
                current.serverSeen = true;
                try { observe(scope, 'onSnapshot', { initialServerDocuments: typeof snap.size === 'number' ? snap.size : snap.exists?.() ? 1 : 0 }); } catch { /* passive */ }
            }
            observe(scope, 'onSnapshot', { [initial ? 'initialSnapshots' : 'updateSnapshots']: 1 });
            recordSnapshot(scope, 'onSnapshot', snap, true);
        }
        else
            observe(scope, 'onSnapshot', { sharedObserverCallbacks: 1 });
        initial = false;
    };
    const failed = () => { observe(scope, 'onSnapshot', { listenerErrors: 1 }); release(); };
    // Preserve every overload, options, observer binding, error and completion handler.
    const offset = hasOptions || (first && typeof first === 'object' && !('next' in first || 'error' in first || 'complete' in first) && args.length > 1) ? 1 : 0;
    const observer = args[offset];
    if (typeof observer === 'function') {
        args[offset] = (snap) => { next(snap); observer(snap); };
        const onError = args[offset + 1];
        args[offset + 1] = (error) => { failed(); if (onError)
            onError(error);
        else
            console.error('[Firestore listener]', error); };
        const onComplete = args[offset + 2];
        if (onComplete)
            args[offset + 2] = () => { release(); onComplete(); };
    }
    else {
        args[offset] = {
            next: (snap) => { next(snap); observer?.next?.call(observer, snap); },
            error: (error) => { failed(); if (observer?.error)
                observer.error.call(observer, error);
            else
                console.error('[Firestore listener]', error); },
            complete: () => { release(); observer?.complete?.call(observer); },
        };
    }
    try {
        const unsubscribe = sdk.onSnapshot(ref, ...args);
        return () => { release(); unsubscribe(); };
    }
    catch (error) {
        failed();
        throw error;
    }
});
export const runTransaction = (db, update, options) => sdk.runTransaction(db, (tx) => {
    const transaction = new Proxy(tx, { get(target, key) {
            if (key === 'get')
                return async (ref) => {
                    const scope = scopeOf(ref);
                    observe(scope, 'transaction.get', { readCalls: 1 });
                    try {
                        const result = await target.get(ref);
                        recordSnapshot(scope, 'transaction.get', result);
                        observe(scope, 'transaction.get', { successfulReadCalls: 1 });
                        return result;
                    }
                    catch (error) {
                        observe(scope, 'transaction.get', { failedReadCalls: 1 });
                        throw error;
                    }
                };
            if (['set', 'update', 'delete'].includes(String(key)))
                return (...args) => { target[key](...args); return transaction; };
            return typeof target[key] === 'function' ? target[key].bind(target) : target[key];
        } });
    return update(transaction);
}, options);
