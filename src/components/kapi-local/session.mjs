const KEY = 'wala:kapi-local:conversation:v1';
export const PREVIEW_KEY = 'wala:kapi-local:enabled';
export function readConversation(storage) {
  try {
    const data = JSON.parse(storage.getItem(KEY));
    if (!data || Date.now() - data.at > 3600000 || !Array.isArray(data.products)
      || typeof data.chatMessage !== 'string' || typeof data.userMessage !== 'string'
      || (data.sessionId !== null && !/^[a-f0-9-]{36}$/.test(data.sessionId))) return null;
    return data;
  } catch { return null; }
}
export function saveConversation(storage, data) {
  try { storage.setItem(KEY, JSON.stringify({ ...data, at: Date.now() })); } catch { /* Memory still works without storage. */ }
}
export const productIdFromPath = pathname => pathname.match(/^\/producto\/([\w-]{1,160})$/)?.[1] || null;
export const localProductPath = id => `/producto/${encodeURIComponent(id)}?kapiDemo=1`;
