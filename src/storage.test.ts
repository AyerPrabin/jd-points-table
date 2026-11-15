import { describe, expect, it, vi } from 'vitest';
import { MISSING, PENDING, emptyResults, played } from './scoring';
import {
  STORAGE_KEY,
  clearEvent,
  emptyEvent,
  loadEvent,
  parseEvent,
  saveEvent,
  type EventState,
} from './storage';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    data,
  };
}

const sample: EventState = {
  title: 'Friday Scrim',
  squads: [
    { id: 'a', name: 'Squad A', results: [played(1, 4), MISSING, PENDING] },
    { id: 'b', name: 'Night Owls', results: emptyResults() },
  ],
};

describe('storage', () => {
  it('saves and loads the same event', () => {
    const store = memoryStorage();
    expect(saveEvent(sample, store)).toBe(true);
    expect(loadEvent(store)).toEqual(sample);
  });

  it('returns an empty event when nothing is saved', () => {
    expect(loadEvent(memoryStorage())).toEqual(emptyEvent());
  });

  it('returns an empty event for broken JSON', () => {
    expect(loadEvent(memoryStorage({ [STORAGE_KEY]: '{not json' }))).toEqual(
      emptyEvent(),
    );
  });

  it('does not throw when the browser blocks storage', () => {
    const blocked = {
      getItem: vi.fn(() => {
        throw new Error('SecurityError');
      }),
      setItem: vi.fn(() => {
        throw new Error('QuotaExceededError');
      }),
      removeItem: vi.fn(() => {
        throw new Error('SecurityError');
      }),
    };
    expect(loadEvent(blocked)).toEqual(emptyEvent());
    expect(saveEvent(sample, blocked)).toBe(false);
    expect(() => clearEvent(blocked)).not.toThrow();
  });

  it('copes with no storage at all', () => {
    expect(loadEvent(null)).toEqual(emptyEvent());
    expect(saveEvent(sample, null)).toBe(false);
  });

  it('clears the saved event', () => {
    const store = memoryStorage();
    saveEvent(sample, store);
    clearEvent(store);
    expect(store.data.has(STORAGE_KEY)).toBe(false);
  });
});

describe('parseEvent', () => {
  it('rejects data without a squads list', () => {
    expect(parseEvent('{"title":"x"}')).toBeNull();
    expect(parseEvent('null')).toBeNull();
    expect(parseEvent('[]')).toBeNull();
  });

  it('drops squads without an id or name', () => {
    const json = JSON.stringify({
      title: 'x',
      squads: [{ name: 'No id' }, { id: '1', name: 'Ok' }],
    });
    expect(parseEvent(json)?.squads.map((s) => s.name)).toEqual(['Ok']);
  });

  it('pads short result lists and turns unknown results into pending', () => {
    const json = JSON.stringify({
      squads: [{ id: '1', name: 'A', results: [{ status: 'played', placement: '1' }] }],
    });
    expect(parseEvent(json)?.squads[0]?.results).toEqual([PENDING, PENDING, PENDING]);
  });

  it('uses an empty title when the title is not text', () => {
    expect(parseEvent('{"title":5,"squads":[]}')?.title).toBe('');
  });
});
