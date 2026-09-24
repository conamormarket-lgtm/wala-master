import { useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getFonts } from '../../../services/fonts';
import { collectFontFamilies } from '../../../services/shared/fontFamilies.mjs';
import { loadFontResources, installFontRule } from '../../../services/shared/fontResources';

export default function CustomFontsInjector({ config, all = false, routeFonts = false }) {
  const { pathname } = useLocation();
  const full = all || (routeFonts && /^\/(admin|editor|carrito|cuenta\/creaciones)(\/|$)/i.test(pathname));
  const signature = JSON.stringify(collectFontFamilies(config));
  const families = useMemo(() => JSON.parse(signature), [signature]);
  const needsCustom = full || families.length > 0;
  const { data: fonts = [] } = useQuery({
    queryKey: ['fonts'],
    queryFn: async () => {
      const { data, error } = await getFonts();
      if (error) throw new Error(error);
      return data || [];
    },
    enabled: needsCustom,
    meta: { segundoPlano: true },
  });

  useEffect(() => {
    if (full || families.length) loadFontResources(families, full).catch(() => {});
  }, [families, full]);

  useEffect(() => {
    if (!needsCustom) return;
    for (const font of fonts) {
      const family = font.family || font.name;
      if (!family || !font.url || (!full && !families.includes(family))) continue;
      installFontRule(family, '@font-face { font-family: ' + JSON.stringify(family) + '; src: url(' + JSON.stringify(font.url) + '); font-display: swap; }');
    }
  }, [fonts, families, full, needsCustom]);
  return null;
}
