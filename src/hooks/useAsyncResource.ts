import type { DependencyList } from 'react';
import { startTransition, useEffect, useState } from 'react';
import { reportRuntimeError } from '../services/runtimeReportingService';

export function getAsyncResourceErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return 'Unable to load this resource.';
}

export function getAsyncResourceInitialLoading<T>(value: T) {
  if (Array.isArray(value)) {
    return value.length === 0;
  }

  return !Boolean(value);
}

export function useAsyncResource<T>(
  load: () => Promise<T>,
  dependencies: DependencyList,
  initialData: T,
  options?: {
    resetDataOnChange?: boolean;
  },
) {
  const [data, setData] = useState<T>(initialData);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(() => getAsyncResourceInitialLoading(initialData));

  useEffect(() => {
    let alive = true;
    if (options?.resetDataOnChange) {
      startTransition(() => {
        setData(initialData);
      });
      setIsLoading(getAsyncResourceInitialLoading(initialData));
    } else {
      setIsLoading(getAsyncResourceInitialLoading(data));
    }
    setError(null);

    void (async () => {
      try {
        const nextData = await load();
        if (!alive) {
          return;
        }

        startTransition(() => {
          setData(nextData);
        });
      } catch (nextError) {
        reportRuntimeError(nextError, {
          source: 'use-async-resource',
        });

        if (!alive) {
          return;
        }

        setError(getAsyncResourceErrorMessage(nextError));
      } finally {
        if (alive) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller controls refresh dependencies by design.
  }, dependencies);

  return { data, error, isLoading };
}
