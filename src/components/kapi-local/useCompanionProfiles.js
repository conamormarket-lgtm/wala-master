import { useQuery } from '@tanstack/react-query';
import { KAPI_PROFILE } from './companions.mjs';
export default function useCompanionProfiles() {
  const query = useQuery({ queryKey: ['companion-profiles'], staleTime: 60000, refetchOnWindowFocus: true,
    queryFn: async () => {
      const response = await fetch('/__kapi/companions');
      if (!response.ok) throw Error('Mascots unavailable');
      const data = await response.json();
      return Array.isArray(data.profiles) && data.profiles.some(p => p.id === 'kapi') ? data.profiles : [KAPI_PROFILE];
    }, retry: 1,
  });
  // Wait for the registry before restoring a character saved in this session.
  // Otherwise a refresh would briefly replace a brand companion with Kapi.
  return query.data || (query.isPending ? [] : [KAPI_PROFILE]);
}
