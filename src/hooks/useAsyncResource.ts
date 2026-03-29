import { DependencyList, startTransition, useEffect, useState } from 'react';

export function useAsyncResource<T>(
  load: () => Promise<T>,
  dependencies: DependencyList,
  initialData: T
) {
  const [data, setData] = useState<T>(initialData);
  const [isLoading, setIsLoading] = useState(() => {
    if (Array.isArray(initialData)) {
      return initialData.length === 0;
    }

    return !Boolean(initialData);
  });

  useEffect(() => {
    let alive = true;
    if (Array.isArray(data)) {
      setIsLoading(data.length === 0);
    } else {
      setIsLoading(!Boolean(data));
    }

    void (async () => {
      const nextData = await load();
      if (!alive) {
        return;
      }

      startTransition(() => {
        setData(nextData);
      });
      setIsLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, dependencies);

  return { data, isLoading };
}
