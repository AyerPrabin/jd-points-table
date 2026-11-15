import { MATCH_COUNT, MAX_SQUAD_NAME_LENGTH, MAX_SQUADS } from './config';
import { emptyResults, type MatchResult } from './scoring';
import { emptyEvent, type EventState } from './storage';

export type Action =
  | { type: 'set-title'; title: string }
  | { type: 'add-squad'; id: string; name: string }
  | { type: 'remove-squad'; id: string }
  | { type: 'set-result'; squadId: string; matchIndex: number; result: MatchResult }
  | { type: 'clear-results' }
  | { type: 'replace'; state: EventState };

export function cleanName(name: string): string {
  return name.replace(/\s+/g, ' ').trim().slice(0, MAX_SQUAD_NAME_LENGTH);
}

/** Returns an error message, or null if the name can be added. */
export function squadNameError(name: string, state: EventState): string | null {
  const clean = cleanName(name);
  if (!clean) return 'Enter a squad name.';
  if (state.squads.length >= MAX_SQUADS)
    return `An event can have up to ${MAX_SQUADS} squads.`;
  const taken = state.squads.find((s) => s.name.toLowerCase() === clean.toLowerCase());
  return taken ? `${taken.name} is already in the list.` : null;
}

export function eventReducer(state: EventState, action: Action): EventState {
  switch (action.type) {
    case 'set-title':
      return { ...state, title: action.title };
    case 'add-squad':
      if (squadNameError(action.name, state)) return state;
      return {
        ...state,
        squads: [
          ...state.squads,
          { id: action.id, name: cleanName(action.name), results: emptyResults() },
        ],
      };
    case 'remove-squad':
      return { ...state, squads: state.squads.filter((s) => s.id !== action.id) };
    case 'set-result':
      if (action.matchIndex < 0 || action.matchIndex >= MATCH_COUNT) return state;
      return {
        ...state,
        squads: state.squads.map((s) =>
          s.id === action.squadId
            ? {
                ...s,
                results: s.results.map((r, i) =>
                  i === action.matchIndex ? action.result : r,
                ),
              }
            : s,
        ),
      };
    case 'clear-results':
      return {
        ...state,
        squads: state.squads.map((s) => ({ ...s, results: emptyResults() })),
      };
    case 'replace':
      return action.state;
    default:
      return state;
  }
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export { emptyEvent };
