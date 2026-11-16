import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { isKapiPreview } from './model.mjs';
import { PREVIEW_KEY } from './session.mjs';

export default function useKapiPreview() {
  const { pathname, search } = useLocation();
  let enabled = false;
  if (import.meta.env.DEV) {
    try { enabled = sessionStorage.getItem(PREVIEW_KEY) === '1'; } catch { /* explicit URL still works */ }
  }
  const active = isKapiPreview({ dev: import.meta.env.DEV, hostname: window.location.hostname, pathname, search, enabled });
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    try {
      if (new URLSearchParams(search).get('kapiDemo') === '0') sessionStorage.removeItem(PREVIEW_KEY);
      else if (active) sessionStorage.setItem(PREVIEW_KEY, '1');
    } catch { /* storage optional */ }
  }, [active, search]);
  return active;
}
