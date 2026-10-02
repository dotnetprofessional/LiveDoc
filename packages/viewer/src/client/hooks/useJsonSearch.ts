import { useMemo, useState } from 'react';
import { findJsonHits, indexJson, type JsonValue } from '../lib/json-search';

export function useJsonSearch(value: JsonValue, identity: string) {
  const [state, setState] = useState({ identity, query: '', active: 0, revision: 0, open: false });
  const current = state.identity === identity ? state
    : { identity, query: '', active: 0, revision: 0, open: false };
  if (current !== state) setState(current);
  const fields = useMemo(() => indexJson(value), [value]);
  const hits = useMemo(() => findJsonHits(fields, current.query), [fields, current.query]);
  return {
    ...current,
    hits,
    setOpen: (open: boolean) => setState(previous => ({ ...previous, open })),
    search: (query: string) => setState(previous => ({ ...previous, query, active: 0, revision: previous.revision + 1 })),
    navigate: (direction: number) => {
      if (hits.length) setState(previous => ({
        ...previous, active: (previous.active + direction + hits.length) % hits.length, revision: previous.revision + 1,
      }));
    },
  };
}

export type JsonSearch = ReturnType<typeof useJsonSearch>;
