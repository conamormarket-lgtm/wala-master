const SYSTEM_FONTS = new Set(['inherit', 'initial', 'unset', 'serif', 'sans-serif', 'monospace', 'system-ui', 'Arial', 'Helvetica', 'Verdana', 'Georgia', 'Times New Roman', 'Courier New', 'Poppins']);

export function collectFontFamilies(config) {
  const families = new Set();
  const add = (value) => String(value).split(',').forEach((family) => {
    const name = family.trim().replace(/^['"]|['"]$/g, '');
    if (name && !SYSTEM_FONTS.has(name)) families.add(name);
  });
  const visit = (value) => {
    if (!value || typeof value !== 'object') return;
    for (const [key, item] of Object.entries(value)) {
      if (/fontFamily$/i.test(key) && typeof item === 'string') add(item);
      else if (item && typeof item === 'object') visit(item);
      else if (typeof item === 'string') {
        for (const match of item.matchAll(/font-family\s*:\s*([^;<>]+)/gi)) add(match[1]);
      }
    }
  };
  visit(config);
  return [...families].sort();
}

export function localFontRules(css, families, all = false) {
  const requested = new Set(families);
  return [...css.matchAll(/@font-face\s*\{([^}]+)\}/g)].flatMap(([rule, body]) => {
    const family = body.match(/font-family:\s*['"]([^'"]+)['"]/)?.[1];
    if (!family || (!all && !requested.has(family))) return [];
    const absolute = rule.replace(/url\(['"]?([^)'"\n]+)['"]?\)/g, (_, url) => `url("/fonts/${url}")`);
    return [{ family, rule: absolute.replace(/\}$/, 'font-display: swap; }') }];
  });
}
