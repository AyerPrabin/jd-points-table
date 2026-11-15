import { MATCH_COUNT } from './config';
import { PENDING, type MatchResult, type Squad } from './scoring';

export const STORAGE_KEY = 'jd-points-table:v1';

export interface EventState {
  title: string;
  squads: Squad[];
}

export function emptyEvent(): EventState {
  return { title: '', squads: [] };
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function defaultStorage(): StorageLike | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readResult(value: unknown): MatchResult {
  if (typeof value !== 'object' || value === null) return PENDING;
  const r = value as Record<string, unknown>;
  if (r.status === 'missing') return { status: 'missing' };
  if (
    r.status === 'played' &&
    typeof r.placement === 'number' &&
    typeof r.kills === 'number'
  ) {
    return { status: 'played', placement: r.placement, kills: r.kills };
  }
  return PENDING;
}

function readSquad(value: unknown): Squad | null {
  if (typeof value !== 'object' || value === null) return null;
  const s = value as Record<string, unknown>;
  if (typeof s.id !== 'string' || typeof s.name !== 'string') return null;
  const raw = Array.isArray(s.results) ? s.results : [];
  const results = Array.from({ length: MATCH_COUNT }, (_, i) => readResult(raw[i]));
  return { id: s.id, name: s.name, results };
}

/** Checks the shape of saved data, since it may come from an older version or be edited by hand. */
export function parseEvent(json: string): EventState | null {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null) return null;
  const d = data as Record<string, unknown>;
  if (!Array.isArray(d.squads)) return null;
  const squads = d.squads.map(readSquad).filter((s): s is Squad => s !== null);
  return { title: typeof d.title === 'string' ? d.title : '', squads };
}

export function loadEvent(storage: StorageLike | null = defaultStorage()): EventState {
  if (!storage) return emptyEvent();
  try {
    const json = storage.getItem(STORAGE_KEY);
    return (json && parseEvent(json)) || emptyEvent();
  } catch {
    return emptyEvent();
  }
}

/** Returns false if the browser would not save (private mode, storage full). */
export function saveEvent(
  state: EventState,
  storage: StorageLike | null = defaultStorage(),
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function clearEvent(storage: StorageLike | null = defaultStorage()): void {
  try {
    storage?.removeItem(STORAGE_KEY);
  } catch {
    // nothing to do, the page state is reset anyway
  }
}
