import React from 'react';
import {
  getCanopyEventById,
  listCanopyEvents,
  type ListEventsFilter,
} from '../services/eventsService';
import type { CanopyEvent } from '../types/events';

// Lightweight data hooks for the Travel & Events tab. No external state
// library — Canopy Trove keeps screens self-contained with `useReducer`-
// style local state. Both hooks support pull-to-refresh by exposing
// `reload()`.

type ListState = {
  status: 'idle' | 'loading' | 'success' | 'error';
  items: CanopyEvent[];
  total: number;
  errorText: string | null;
};

const INITIAL_LIST: ListState = {
  status: 'idle',
  items: [],
  total: 0,
  errorText: null,
};

export function useCanopyEvents(filter: ListEventsFilter = 'upcoming') {
  const [state, setState] = React.useState<ListState>(INITIAL_LIST);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const isMountedRef = React.useRef(true);

  React.useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const load = React.useCallback(
    async (mode: 'initial' | 'refresh') => {
      if (mode === 'initial') {
        setState((prev) => ({ ...prev, status: 'loading', errorText: null }));
      } else {
        setIsRefreshing(true);
      }
      try {
        const result = await listCanopyEvents({ filter, limit: 100 });
        if (!isMountedRef.current) return;
        setState({
          status: 'success',
          items: result.items,
          total: result.total,
          errorText: null,
        });
      } catch (err) {
        if (!isMountedRef.current) return;
        const message = err instanceof Error ? err.message : 'Could not load events.';
        setState((prev) => ({
          ...prev,
          status: prev.items.length ? 'success' : 'error',
          errorText: message,
        }));
      } finally {
        if (isMountedRef.current) setIsRefreshing(false);
      }
    },
    [filter],
  );

  React.useEffect(() => {
    void load('initial');
  }, [load]);

  return {
    status: state.status,
    items: state.items,
    total: state.total,
    errorText: state.errorText,
    isRefreshing,
    reload: () => load('refresh'),
  };
}

type DetailState = {
  status: 'idle' | 'loading' | 'success' | 'not_found' | 'error';
  event: CanopyEvent | null;
  errorText: string | null;
};

const INITIAL_DETAIL: DetailState = {
  status: 'idle',
  event: null,
  errorText: null,
};

export function useCanopyEventDetail(eventId: string | null | undefined) {
  const [state, setState] = React.useState<DetailState>(INITIAL_DETAIL);
  const isMountedRef = React.useRef(true);

  React.useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  React.useEffect(() => {
    if (!eventId) {
      setState({ status: 'not_found', event: null, errorText: null });
      return;
    }
    setState({ status: 'loading', event: null, errorText: null });
    let cancelled = false;
    void (async () => {
      try {
        const event = await getCanopyEventById(eventId);
        if (cancelled || !isMountedRef.current) return;
        if (!event) {
          setState({ status: 'not_found', event: null, errorText: null });
          return;
        }
        setState({ status: 'success', event, errorText: null });
      } catch (err) {
        if (cancelled || !isMountedRef.current) return;
        const message = err instanceof Error ? err.message : 'Could not load event.';
        setState({ status: 'error', event: null, errorText: message });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  return state;
}
