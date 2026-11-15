// Pure scoring logic. No React and no storage in here, so it can be
// tested on its own and reused if I ever move it to the JD backend.

import { MATCH_COUNT, PLACEMENT_POINTS, POINTS_PER_KILL } from './config';

/** One squad's result for one match. */
export type MatchResult =
  | { status: 'pending' }
  | { status: 'played'; placement: number; kills: number }
  | { status: 'missing' };

export interface Squad {
  id: string;
  name: string;
  /** Always MATCH_COUNT long, index 0 is match 1. */
  results: MatchResult[];
}

/** Why a squad is held out of the ranking. */
export type HoldReason = 'missing' | 'invalid';

export interface StandingRow {
  squadId: string;
  name: string;
  /** null for squads that are held back. */
  rank: number | null;
  total: number;
  kills: number;
  /** Points per match, null when that match has no usable result. */
  matchPoints: (number | null)[];
  /** Placement per match, null when not played. */
  placements: (number | null)[];
  bestPlacement: number | null;
  /** 1-based match numbers marked as "result missing". */
  missingMatches: number[];
  /** 1-based match numbers with an invalid placement or kill count. */
  invalidMatches: number[];
  holdReason: HoldReason | null;
}

export interface Standings {
  ranked: StandingRow[];
  held: StandingRow[];
}

export const PENDING: MatchResult = { status: 'pending' };
export const MISSING: MatchResult = { status: 'missing' };

export function played(placement: number, kills: number): MatchResult {
  return { status: 'played', placement, kills };
}

export function emptyResults(): MatchResult[] {
  return Array.from({ length: MATCH_COUNT }, () => PENDING);
}

export function isValidPlacement(placement: number): boolean {
  return Number.isInteger(placement) && placement >= 1;
}

export function isValidKills(kills: number): boolean {
  return Number.isInteger(kills) && kills >= 0;
}

/** Placement points from JD's table. Throws on a placement below 1 or a fraction. */
export function placementPoints(placement: number): number {
  if (!isValidPlacement(placement)) {
    throw new RangeError(`Invalid placement: ${placement}`);
  }
  return PLACEMENT_POINTS[placement - 1] ?? 0;
}

export function killPoints(kills: number): number {
  if (!isValidKills(kills)) {
    throw new RangeError(`Invalid kill count: ${kills}`);
  }
  return kills * POINTS_PER_KILL;
}

export function isValidResult(result: MatchResult): boolean {
  if (result.status !== 'played') return true;
  return isValidPlacement(result.placement) && isValidKills(result.kills);
}

/** Points for one match, or null if there is nothing to score yet. */
export function matchPoints(result: MatchResult): number | null {
  if (result.status !== 'played' || !isValidResult(result)) return null;
  return placementPoints(result.placement) + killPoints(result.kills);
}

export function buildRow(squad: Squad): StandingRow {
  const matchPts: (number | null)[] = [];
  const placements: (number | null)[] = [];
  const missingMatches: number[] = [];
  const invalidMatches: number[] = [];
  let total = 0;
  let kills = 0;

  for (let i = 0; i < MATCH_COUNT; i++) {
    const result = squad.results[i] ?? PENDING;
    if (result.status === 'missing') missingMatches.push(i + 1);
    if (!isValidResult(result)) invalidMatches.push(i + 1);

    const pts = matchPoints(result);
    matchPts.push(pts);
    if (pts !== null && result.status === 'played') {
      placements.push(result.placement);
      total += pts;
      kills += result.kills;
    } else {
      placements.push(null);
    }
  }

  const playedPlacements = placements.filter((p): p is number => p !== null);
  let holdReason: HoldReason | null = null;
  if (invalidMatches.length > 0) holdReason = 'invalid';
  else if (missingMatches.length > 0) holdReason = 'missing';

  return {
    squadId: squad.id,
    name: squad.name,
    rank: null,
    total,
    kills,
    matchPoints: matchPts,
    placements,
    bestPlacement: playedPlacements.length > 0 ? Math.min(...playedPlacements) : null,
    missingMatches,
    invalidMatches,
    holdReason,
  };
}

/** Lower placement is better; a match not played counts as worse than any placement. */
function comparePlacement(a: number | null, b: number | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}

/**
 * Tie-break order:
 * 1. total points (higher first)
 * 2. total kills (higher first)
 * 3. best single-match placement (lower first)
 * 4. last match placement (lower first), going back a match while still equal
 * Returns 0 for a full tie.
 */
export function compareRows(a: StandingRow, b: StandingRow): number {
  if (a.total !== b.total) return b.total - a.total;
  if (a.kills !== b.kills) return b.kills - a.kills;

  const best = comparePlacement(a.bestPlacement, b.bestPlacement);
  if (best !== 0) return best;

  for (let i = MATCH_COUNT - 1; i >= 0; i--) {
    const diff = comparePlacement(a.placements[i] ?? null, b.placements[i] ?? null);
    if (diff !== 0) return diff;
  }
  return 0;
}

/**
 * Builds the table. Squads with a missing or invalid result are kept out of
 * the ranking (in `held`) until the host fills the gap in.
 * Full ties share a rank (1, 2, 2, 4) and are listed by name.
 */
export function computeStandings(squads: readonly Squad[]): Standings {
  const rows = squads.map(buildRow);
  const byName = (a: StandingRow, b: StandingRow) => a.name.localeCompare(b.name);

  const ranked = rows
    .filter((r) => r.holdReason === null)
    .sort((a, b) => compareRows(a, b) || byName(a, b));

  ranked.forEach((row, i) => {
    const prev = ranked[i - 1];
    row.rank = prev && compareRows(prev, row) === 0 ? prev.rank : i + 1;
  });

  const held = rows
    .filter((r) => r.holdReason !== null)
    .sort((a, b) => compareRows(a, b) || byName(a, b));

  return { ranked, held };
}

/** Problems in one match that the host should fix, e.g. two squads both 1st. */
export interface MatchIssue {
  match: number;
  kind:
    'duplicate-placement' | 'placement-too-high' | 'invalid-placement' | 'invalid-kills';
  squadIds: string[];
  message: string;
}

export function findMatchIssues(
  squads: readonly Squad[],
  matchIndex: number,
): MatchIssue[] {
  const match = matchIndex + 1;
  const issues: MatchIssue[] = [];
  const byPlacement = new Map<number, Squad[]>();

  for (const squad of squads) {
    const result = squad.results[matchIndex];
    if (!result || result.status !== 'played') continue;

    if (!isValidPlacement(result.placement)) {
      issues.push({
        match,
        kind: 'invalid-placement',
        squadIds: [squad.id],
        message: `${squad.name}: placement must be a whole number from 1.`,
      });
    } else if (result.placement > squads.length) {
      issues.push({
        match,
        kind: 'placement-too-high',
        squadIds: [squad.id],
        message: `${squad.name}: placed ${result.placement} but only ${squads.length} squads are in the event.`,
      });
    } else {
      const list = byPlacement.get(result.placement) ?? [];
      list.push(squad);
      byPlacement.set(result.placement, list);
    }

    if (!isValidKills(result.kills)) {
      issues.push({
        match,
        kind: 'invalid-kills',
        squadIds: [squad.id],
        message: `${squad.name}: kills must be a whole number, 0 or more.`,
      });
    }
  }

  for (const [placement, list] of [...byPlacement].sort((a, b) => a[0] - b[0])) {
    if (list.length > 1) {
      issues.push({
        match,
        kind: 'duplicate-placement',
        squadIds: list.map((s) => s.id),
        message: `${joinNames(list.map((s) => s.name))} are ${list.length === 2 ? 'both' : 'all'} marked ${ordinal(placement)}.`,
      });
    }
  }
  return issues;
}

function joinNames(names: string[]): string {
  if (names.length <= 2) return names.join(' and ');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

export function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/** How many squads have a result (played or missing) for this match. */
export function matchProgress(squads: readonly Squad[], matchIndex: number): number {
  return squads.filter((s) => (s.results[matchIndex]?.status ?? 'pending') !== 'pending')
    .length;
}
