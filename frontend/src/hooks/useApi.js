import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';

// Generic data-fetching hook: useApi('/projects') → { data, loading, error, reload }
export function useApi(path, { immediate = true } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData((await api.get(path)).data); }
    catch (e) { setError(e); }
    finally { setLoading(false); }
  }, [path]);

  useEffect(() => { if (immediate) reload(); }, [immediate, reload]);
  return { data, loading, error, reload };
}
