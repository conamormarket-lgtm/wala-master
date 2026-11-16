// Immediate gestures remain local: never spend a model request on walking or
// replaying an approved animation. Product questions always go to the assistant.
export function localGesture(message) {
  const text = message.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z\s]/g, '').replace(/^kapi\s+/, '').replace(/\s+por favor$/, '').trim();
  if (/^(camina|ven aqui|muevete)$/.test(text)) return { move: true };
  const gestures = {
    saluda: ['wave', '¡Hola! Qué gusto verte.'], saludame: ['wave', '¡Hola! Qué gusto verte.'],
    duerme: ['sleep', 'Una siestita y vuelvo.'], descansa: ['sleep', 'Una siestita y vuelvo.'],
    despierta: ['wake', '¡Ya estoy de vuelta!'], sientate: ['sit', 'Un descansito por aquí.'],
    aplaude: ['clap', '¡Un aplauso!'], celebra: ['celebrate', '¡Un saltito de alegría!'],
  };
  const choice = gestures[text];
  return choice ? { gesture: choice[0], message: choice[1] } : null;
}

export async function askKapi({ message, sessionId, sessionToken = null, currentProductId = null, signal, fetchImpl = fetch }) {
  const response = await fetchImpl('/__kapi/chat', { method: 'POST', signal,
    headers: { 'Content-Type': 'application/json', 'X-Kapi-Local': '1', 'X-Kapi-Client': '1' },
    body: JSON.stringify({ message, sessionId, sessionToken, currentProductId }) });
  const data = await response.json();
  if (!response.ok) throw Object.assign(Error(data.error || 'No pude responder ahora. Puedes usar mis guías.'), { code: data.code });
  return data;
}
