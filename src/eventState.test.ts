import { describe, expect, it } from 'vitest';
import { MAX_SQUADS } from './config';
import { MISSING, PENDING, played } from './scoring';
import { cleanName, emptyEvent, eventReducer, squadNameError } from './eventState';
import type { EventState } from './storage';

function withSquads(...names: string[]): EventState {
  return names.reduce(
    (state, name, i) => eventReducer(state, { type: 'add-squad', id: `id-${i}`, name }),
    emptyEvent(),
  );
}

describe('eventReducer', () => {
  it('adds squads with three pending results', () => {
    const state = withSquads('Night Owls');
    expect(state.squads).toEqual([
      { id: 'id-0', name: 'Night Owls', results: [PENDING, PENDING, PENDING] },
    ]);
  });

  it('tidies spaces in names and ignores blank or duplicate names', () => {
    const state = withSquads('  Night   Owls ', '   ', 'night owls');
    expect(state.squads.map((s) => s.name)).toEqual(['Night Owls']);
  });

  it('stops at the squad limit', () => {
    const names = Array.from({ length: MAX_SQUADS + 1 }, (_, i) => `Squad ${i + 1}`);
    expect(withSquads(...names).squads).toHaveLength(MAX_SQUADS);
  });

  it('sets one result without touching the other matches', () => {
    let state = withSquads('Squad A', 'Squad B');
    state = eventReducer(state, {
      type: 'set-result',
      squadId: 'id-0',
      matchIndex: 2,
      result: MISSING,
    });
    expect(state.squads[0]?.results).toEqual([PENDING, PENDING, MISSING]);
    expect(state.squads[1]?.results).toEqual([PENDING, PENDING, PENDING]);
  });

  it('ignores a match number outside the event', () => {
    const state = withSquads('Squad A');
    const next = eventReducer(state, {
      type: 'set-result',
      squadId: 'id-0',
      matchIndex: 3,
      result: played(1, 1),
    });
    expect(next).toBe(state);
  });

  it('clears results but keeps squads for the next event', () => {
    let state = withSquads('Squad A');
    state = eventReducer(state, {
      type: 'set-result',
      squadId: 'id-0',
      matchIndex: 0,
      result: played(1, 3),
    });
    state = eventReducer(state, { type: 'clear-results' });
    expect(state.squads[0]?.results).toEqual([PENDING, PENDING, PENDING]);
  });

  it('removes a squad', () => {
    const state = eventReducer(withSquads('Squad A', 'Squad B'), {
      type: 'remove-squad',
      id: 'id-0',
    });
    expect(state.squads.map((s) => s.name)).toEqual(['Squad B']);
  });
});

describe('squadNameError', () => {
  it('explains why a name cannot be added', () => {
    const state = withSquads('Squad A');
    expect(squadNameError('', state)).toBe('Enter a squad name.');
    expect(squadNameError('squad a', state)).toBe('Squad A is already in the list.');
    expect(squadNameError('Squad B', state)).toBeNull();
  });

  it('cuts very long names down', () => {
    expect(cleanName('x'.repeat(50))).toHaveLength(24);
  });
});
