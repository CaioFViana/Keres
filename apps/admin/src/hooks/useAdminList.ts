import { useEffect, useState } from 'react';

interface Paged<T> {
  items: T[];
  total: number;
}

/**
 * A paged list loaded from the API: loads again whenever `deps` change or `reload()` is called, drops
 * the answer of a request that a newer one has replaced, and reports `loading` and `error`. `setItems`
 * is for pages that edit a row in place after an action instead of loading the whole list again, and
 * `setError` for the failure of such an action.
 */
export function useAdminList<T>(load: () => Promise<Paged<T>>, deps: readonly unknown[]) {
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setError(null);
    load()
      .then((result) => {
        if (ignore) return;
        setItems(result.items);
        setTotal(result.total);
      })
      .catch((err: Error) => {
        if (!ignore) setError(err.message);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `deps` is the caller's list of what the request depends on.
  }, [...deps, reloadToken]);

  return {
    items,
    total,
    loading,
    error,
    setItems,
    setTotal,
    setError,
    reload: () => setReloadToken((token) => token + 1),
  };
}
