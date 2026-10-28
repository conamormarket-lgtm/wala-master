import { readRecorder } from './firestore-read-client.mjs';
const databases = new WeakMap();
let activeListeners = 0, activeQueries = 0;
export function registerFirestoreDatabase(db, project, database = '(default)') { if (db) databases.set(db, { project, database }); }
export function firestoreScope(db, path = '(unknown)') {
  const known = db && databases.get(db);
  const parts = path.split('/');
  if (!path.startsWith('**/') && parts.length % 2 === 0) parts.pop();
  const collection = path.startsWith('**/') ? path : parts.map((part,i) => i % 2 ? '*' : part).join('/');
  return { project: known?.project || db?.app?.options?.projectId || '(unknown)', database: known?.database || '(unregistered)', collection, originScreen: readRecorder.currentScreen() };
}
export const observe = readRecorder.observe;
export function listenerTopology(listeners, queries) { activeListeners += listeners; activeQueries += queries; }
export const topology = () => ({ activeListeners, activeQueries });
