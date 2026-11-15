import { describe, expect, it } from 'vitest';
import { PLACEMENT_POINTS } from './config';
import {
  MISSING,
  PENDING,
  buildRow,
  compareRows,
  computeStandings,
  emptyResults,
  findMatchIssues,
  killPoints,
  matchPoints,
  matchProgress,
  ordinal,
  placementPoints,
  played,
  type MatchResult,
  type Squad,
} from './scoring';

function squad(name: string, results: MatchResult[] = []): Squad {
  const full = emptyResults().map((r, i) => results[i] ?? r);
  return { id: name.toLowerCase().replace(/\s+/g, '-'), name, results: full };
}

function names(rows: { name: string }[]): string[] {
  return rows.map((r) => r.name);
}

describe('placementPoints', () => {
  it('matches the JD table for 1st to 10th', () => {
    const expected = [12, 9, 8, 7, 6, 5, 4, 3, 2, 1];
    expected.forEach((pts, i) => expect(placementPoints(i + 1)).toBe(pts));
  });

  it('gives 0 points for 11th and below', () => {
    expect(placementPoints(11)).toBe(0);
    expect(placementPoints(12)).toBe(0);
    expect(placementPoints(48)).toBe(0);
  });

  it('reads from the config table', () => {
    expect(placementPoints(1)).toBe(PLACEMENT_POINTS[0]);
    expect(PLACEMENT_POINTS).toHaveLength(10);
  });

  it('throws for 0, negative and fractional placements', () => {
    expect(() => placementPoints(0)).toThrow(RangeError);
    expect(() => placementPoints(-3)).toThrow(RangeError);
    expect(() => placementPoints(2.5)).toThrow(RangeError);
    expect(() => placementPoints(Number.NaN)).toThrow(RangeError);
  });
});

describe('killPoints', () => {
  it('gives 1 point per kill', () => {
    expect(killPoints(0)).toBe(0);
    expect(killPoints(7)).toBe(7);
  });

  it('throws for negative or fractional kills', () => {
    expect(() => killPoints(-1)).toThrow(RangeError);
    expect(() => killPoints(1.5)).toThrow(RangeError);
  });
});

describe('matchPoints', () => {
  it('adds placement points and kill points', () => {
    expect(matchPoints(played(1, 8))).toBe(20);
    expect(matchPoints(played(4, 3))).toBe(10);
  });

  it('counts kills even when placement gives nothing', () => {
    expect(matchPoints(played(12, 5))).toBe(5);
  });

  it('returns null for pending, missing and invalid results', () => {
    expect(matchPoints(PENDING)).toBeNull();
    expect(matchPoints(MISSING)).toBeNull();
    expect(matchPoints(played(0, 3))).toBeNull();
    expect(matchPoints(played(2, -1))).toBeNull();
  });
});

describe('buildRow', () => {
  it('totals points and kills across three matches', () => {
    const row = buildRow(
      squad('Night Owls', [played(1, 5), played(3, 2), played(10, 0)]),
    );
    expect(row.total).toBe(17 + 10 + 1);
    expect(row.kills).toBe(7);
    expect(row.matchPoints).toEqual([17, 10, 1]);
    expect(row.placements).toEqual([1, 3, 10]);
    expect(row.bestPlacement).toBe(1);
    expect(row.holdReason).toBeNull();
  });

  it('treats pending matches as not played yet without holding the squad', () => {
    const row = buildRow(squad('Squad A', [played(2, 1)]));
    expect(row.total).toBe(10);
    expect(row.matchPoints).toEqual([10, null, null]);
    expect(row.holdReason).toBeNull();
  });

  it('has no best placement when nothing is played', () => {
    expect(buildRow(squad('Squad A')).bestPlacement).toBeNull();
  });

  it('records missing matches as 1-based numbers and holds the squad', () => {
    const row = buildRow(squad('Squad A', [played(2, 1), played(5, 0), MISSING]));
    expect(row.missingMatches).toEqual([3]);
    expect(row.holdReason).toBe('missing');
    expect(row.total).toBe(9 + 1 + 6);
  });

  it('holds a squad with an invalid result and says which match', () => {
    const row = buildRow(squad('Squad A', [played(0, 1)]));
    expect(row.invalidMatches).toEqual([1]);
    expect(row.holdReason).toBe('invalid');
  });

  it('reports invalid before missing when a squad has both', () => {
    const row = buildRow(squad('Squad A', [MISSING, played(2, -4)]));
    expect(row.holdReason).toBe('invalid');
    expect(row.missingMatches).toEqual([1]);
  });

  it('copes with a squad that has a short results array', () => {
    const row = buildRow({ id: 'x', name: 'Short', results: [played(1, 0)] });
    expect(row.matchPoints).toEqual([12, null, null]);
  });
});

describe('computeStandings ordering', () => {
  it('sorts by total points, highest first', () => {
    const { ranked } = computeStandings([
      squad('Squad A', [played(5, 0)]),
      squad('Squad B', [played(1, 0)]),
      squad('Squad C', [played(3, 0)]),
    ]);
    expect(names(ranked)).toEqual(['Squad B', 'Squad C', 'Squad A']);
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it('can rank a high-kill squad above a better-placed one', () => {
    const { ranked } = computeStandings([
      squad('Campers', [played(1, 0)]),
      squad('Rushers', [played(8, 11)]),
    ]);
    expect(names(ranked)).toEqual(['Rushers', 'Campers']);
  });

  it('returns empty lists for no squads', () => {
    expect(computeStandings([])).toEqual({ ranked: [], held: [] });
  });

  it('does not change the input squads', () => {
    const input = [squad('Squad A', [played(2, 2)]), squad('Squad B', [played(1, 1)])];
    const copy = structuredClone(input);
    computeStandings(input);
    expect(input).toEqual(copy);
  });
});

describe('computeStandings tie-breaks', () => {
  it('breaks a points tie on total kills', () => {
    // Both 15 points: 1st + 3 kills = 15, 4th + 8 kills = 15
    const { ranked } = computeStandings([
      squad('Placers', [played(1, 3)]),
      squad('Fraggers', [played(4, 8)]),
    ]);
    expect(ranked[0]?.total).toBe(ranked[1]?.total);
    expect(names(ranked)).toEqual(['Fraggers', 'Placers']);
  });

  it('breaks a points and kills tie on best single-match placement', () => {
    const a = squad('Squad A', [played(2, 1), played(9, 1)]); // 9+1 + 2+1 = 13, kills 2
    const b = squad('Squad B', [played(3, 1), played(8, 1)]); // 8+1 + 3+1 = 13, kills 2
    const { ranked } = computeStandings([b, a]);
    expect(ranked[0]?.total).toBe(13);
    expect(ranked[1]?.total).toBe(13);
    expect(names(ranked)).toEqual(['Squad A', 'Squad B']);
  });

  it('goes back to match 2 when the last match placement is also equal', () => {
    // Same total (31), kills (6), best placement (1st) and match 3 placement (4th)
    const a = squad('Squad A', [played(1, 2), played(5, 2), played(4, 2)]);
    const b = squad('Squad B', [played(5, 2), played(1, 2), played(4, 2)]);
    const { ranked } = computeStandings([a, b]);
    expect(names(ranked)).toEqual(['Squad B', 'Squad A']);
  });

  it('uses match 3 placement before earlier matches', () => {
    const a = squad('Squad A', [played(1, 0), played(6, 0), played(5, 0)]); // 12+5+6 = 23
    const b = squad('Squad B', [played(1, 0), played(5, 0), played(6, 0)]); // 12+6+5 = 23
    const { ranked } = computeStandings([a, b]);
    expect(names(ranked)).toEqual(['Squad A', 'Squad B']);
  });

  it('ranks a squad that played the last match above one that has not', () => {
    const a = squad('Squad A', [played(2, 0), played(11, 0)]); // 9
    const b = squad('Squad B', [played(2, 0)]); // 9
    const { ranked } = computeStandings([b, a]);
    expect(names(ranked)).toEqual(['Squad A', 'Squad B']);
  });

  it('gives a full tie a shared rank and lists by name', () => {
    const { ranked } = computeStandings([
      squad('Zeta'),
      squad('Alpha'),
      squad('Leaders', [played(1, 1)]),
    ]);
    expect(names(ranked)).toEqual(['Leaders', 'Alpha', 'Zeta']);
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 2]);
  });

  it('skips ranks after a shared place (1, 2, 2, 4)', () => {
    const { ranked } = computeStandings([
      squad('Squad A', [played(1, 0)]),
      squad('Squad B'),
      squad('Squad C'),
      squad('Squad D', [played(12, 0)]),
    ]);
    // B, C and D are all on 0 points; D played (12th), which beats not playing.
    expect(ranked.map((r) => [r.name, r.rank])).toEqual([
      ['Squad A', 1],
      ['Squad D', 2],
      ['Squad B', 3],
      ['Squad C', 3],
    ]);
  });

  it('compareRows returns 0 only for a full tie', () => {
    const a = buildRow(squad('A', [played(3, 2)]));
    const b = buildRow(squad('B', [played(3, 2)]));
    const c = buildRow(squad('C', [played(4, 3)]));
    expect(compareRows(a, b)).toBe(0);
    expect(compareRows(a, c)).not.toBe(0);
  });
});

describe('computeStandings with missing results', () => {
  const event = () => [
    squad('Night Owls', [played(1, 6), played(2, 4), played(1, 5)]),
    squad('Squad A', [played(2, 3), played(1, 7), MISSING]),
    squad('Squad B', [played(3, 1), played(3, 2), played(2, 1)]),
  ];

  it('keeps a squad with a missing match out of the ranking', () => {
    const { ranked, held } = computeStandings(event());
    expect(names(ranked)).toEqual(['Night Owls', 'Squad B']);
    expect(names(held)).toEqual(['Squad A']);
    expect(held[0]?.rank).toBeNull();
    expect(held[0]?.missingMatches).toEqual([3]);
  });

  it('does not let a held squad take a rank number from others', () => {
    const { ranked } = computeStandings(event());
    expect(ranked.map((r) => r.rank)).toEqual([1, 2]);
  });

  it('still shows the partial total for a held squad', () => {
    const { held } = computeStandings(event());
    expect(held[0]?.total).toBe(9 + 3 + 12 + 7);
  });

  it('puts the squad back into the ranking once the result is filled in', () => {
    const squads = event();
    squads[1] = { ...squads[1]!, results: [played(2, 3), played(1, 7), played(3, 0)] };
    const { ranked, held } = computeStandings(squads);
    expect(held).toEqual([]);
    expect(names(ranked)).toEqual(['Night Owls', 'Squad A', 'Squad B']);
  });

  it('holds a squad again if a result is marked missing later', () => {
    const squads = event();
    squads[0] = { ...squads[0]!, results: [played(1, 6), MISSING, played(1, 5)] };
    const { ranked, held } = computeStandings(squads);
    expect(names(ranked)).toEqual(['Squad B']);
    expect(names(held)).toEqual(['Night Owls', 'Squad A']);
  });

  it('can hold every squad when a whole match was lost', () => {
    const squads = [
      squad('Squad A', [played(1, 0), MISSING]),
      squad('Squad B', [played(2, 0), MISSING]),
    ];
    const { ranked, held } = computeStandings(squads);
    expect(ranked).toEqual([]);
    expect(names(held)).toEqual(['Squad A', 'Squad B']);
  });

  it('holds a squad with an invalid result too', () => {
    const { ranked, held } = computeStandings([
      squad('Squad A', [played(1, 2)]),
      squad('Squad B', [played(2, 1.5)]),
    ]);
    expect(names(ranked)).toEqual(['Squad A']);
    expect(held[0]?.holdReason).toBe('invalid');
  });
});

describe('findMatchIssues', () => {
  it('finds no issues in a clean match', () => {
    const squads = [squad('A', [played(1, 2)]), squad('B', [played(2, 0)]), squad('C')];
    expect(findMatchIssues(squads, 0)).toEqual([]);
  });

  it('flags two squads with the same placement', () => {
    const squads = [squad('Squad A', [played(1, 2)]), squad('Squad B', [played(1, 0)])];
    const issues = findMatchIssues(squads, 0);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      match: 1,
      kind: 'duplicate-placement',
      squadIds: ['squad-a', 'squad-b'],
    });
    expect(issues[0]?.message).toBe('Squad A and Squad B are both marked 1st.');
  });

  it('flags a placement higher than the number of squads', () => {
    const squads = [squad('A', [played(5, 0)]), squad('B', [played(1, 0)])];
    const issues = findMatchIssues(squads, 0);
    expect(issues.map((i) => i.kind)).toEqual(['placement-too-high']);
  });

  it('flags invalid placement and kills', () => {
    const squads = [squad('A', [played(0, -2)])];
    const kinds = findMatchIssues(squads, 0).map((i) => i.kind);
    expect(kinds).toEqual(['invalid-placement', 'invalid-kills']);
  });

  it('ignores pending and missing results', () => {
    const squads = [squad('A', [MISSING]), squad('B', [PENDING])];
    expect(findMatchIssues(squads, 0)).toEqual([]);
  });

  it('lists all squads when three share a placement', () => {
    const squads = ['A', 'B', 'C'].map((n) => squad(n, [played(2, 0)]));
    expect(findMatchIssues(squads, 0)[0]?.message).toBe('A, B and C are all marked 2nd.');
  });

  it('only looks at the match it is asked about', () => {
    const squads = [
      squad('A', [played(1, 0), played(1, 0)]),
      squad('B', [played(2, 0), played(1, 0)]),
    ];
    expect(findMatchIssues(squads, 0)).toEqual([]);
    expect(findMatchIssues(squads, 1)).toHaveLength(1);
  });
});

describe('ordinal', () => {
  it.each([
    [1, '1st'],
    [2, '2nd'],
    [3, '3rd'],
    [4, '4th'],
    [11, '11th'],
    [12, '12th'],
    [13, '13th'],
    [21, '21st'],
    [22, '22nd'],
    [112, '112th'],
  ])('%i -> %s', (n, text) => {
    expect(ordinal(n)).toBe(text);
  });
});

describe('matchProgress', () => {
  it('counts played and missing results, not pending ones', () => {
    const squads = [squad('A', [played(1, 0)]), squad('B', [MISSING]), squad('C')];
    expect(matchProgress(squads, 0)).toBe(2);
    expect(matchProgress(squads, 1)).toBe(0);
  });
});
