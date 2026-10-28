// Serialized into the production HTML by Vite. Keep this function standalone:
// it runs before React and the Firebase SDK, with only public client identifiers.
export function storefrontBootstrap(projectId, apiKey) {
  const pathname = window.location.pathname.replace(/\/+$/, '') || '/';
  const pageId = { '/': 'home', '/home': 'home', '/tienda': 'tienda' }[pathname];
  if (!pageId || new URLSearchParams(window.location.search).has('t') || window.__walaStorefrontBootstrap) return;

  // This read happens before React/the SDK. Observe the existing response only.
  function report(counts) {
    try {
      const event = { project: projectId, database: '(default)', collection: 'pages', originScreen: pathname, counts };
      if (window.__reportBootstrapFirestoreRead) window.__reportBootstrapFirestoreRead(event);
      else (window.__bootstrapFirestoreReads ||= []).push(event);
    } catch { /* Never delay the storefront for diagnostics. */ }
  }
  report({ readCalls: 1 });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);
  function decode(value) {
    if ('nullValue' in value) return null;
    if ('stringValue' in value) return value.stringValue;
    if ('booleanValue' in value) return value.booleanValue;
    if ('integerValue' in value) return Number(value.integerValue);
    if ('doubleValue' in value) return Number(value.doubleValue);
    if ('arrayValue' in value) return (value.arrayValue.values || []).map(decode);
    if ('mapValue' in value) return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([key, item]) => [key, decode(item)]));
    throw new Error('Unsupported storefront value');
  }

  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/pages/${pageId}?mask.fieldPaths=sections&key=${encodeURIComponent(apiKey)}`;
  let responseReceived = false;
  const promise = fetch(url, { credentials: 'omit', cache: 'no-store', signal: controller.signal })
    .then((response) => {
      responseReceived = true;
      report(response.ok ? { successfulReadCalls: 1, serverDocuments: 1 } : response.status === 404
        ? { successfulReadCalls: 1, missingDocumentResults: 1 } : { failedReadCalls: 1 });
      return response.ok ? response.json() : null;
    })
    .then((data) => {
      if (!data?.fields?.sections) return null;
      const sections = decode(data.fields.sections);
      if (!Array.isArray(sections) || !sections.every((section) => section && typeof section.type === 'string')) return null;
      if ((window.location.pathname.replace(/\/+$/, '') || '/') !== pathname) return sections;
      const mobile = window.matchMedia('(max-width: 768px)').matches;
      let image = '';
      for (const section of [...sections].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))) {
        const settings = section.settings || {};
        if (section.type === 'hero_banner' && settings.mediaType !== 'video') image = settings.mediaUrl || '';
        if (section.type === 'hero_carousel') {
          // La misma cuenta que src/utils/vigencia.mjs (aquí no se puede importar).
          const now = Date.now();
          const live = (slide) => {
            const from = Date.parse(slide.startTime || '');
            const until = Date.parse(slide.endTime || '');
            return !(now < from) && !(now >= until);
          };
          const first = settings.slides?.find((slide) => slide?.imageUrl?.trim() && live(slide));
          if (first) image = (mobile && first.mobileImageUrl?.trim()) || first.imageUrl;
        }
        if (image) break;
      }
      // Drive URLs need the application's URL converter; defer those to React.
      if (/^https?:\/\//.test(image) && !/drive\.google\.com|google\.com\/url/.test(image)) {
        const link = document.createElement('link');
        link.id = 'storefront-hero-preload';
        link.rel = 'preload';
        link.as = 'image';
        link.fetchPriority = 'high';
        link.href = image;
        document.head.appendChild(link);
      }
      return sections;
    })
    .catch(() => { if (!responseReceived) report({ failedReadCalls: 1 }); return null; })
    .finally(() => clearTimeout(timeout));
  window.__walaStorefrontBootstrap = { pageId, promise, consumed: false };
}
