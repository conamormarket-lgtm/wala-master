// Infer only explicit WhatsApp destinations; labels can be translated or edited.
export function buttonAction(action, destination) {
  if (action) return action;
  const url = String(destination || '').trim();
  return /^(?:(?:https?:)?\/\/)?(?:www\.)?(?:wa\.me|(?:api|web)\.whatsapp\.com)(?:\/|$)/i.test(url) || /^whatsapp:\/\/send(?:\?|$)/i.test(url) ? 'whatsapp' : undefined;
}
