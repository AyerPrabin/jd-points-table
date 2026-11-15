import { describe, expect, it } from 'vitest';
import { MISSING, computeStandings, emptyResults, played, type Squad } from './scoring';
import { fileSafeName, standingsToCsv, standingsToText } from './export';

function squad(id: string, name: string, results = emptyResults()): Squad {
  return { id, name, results };
}

const standings = computeStandings([
  squad('a', 'Night Owls', [played(1, 6), played(2, 4), played(1, 5)]),
  squad('b', 'Squad B', [played(2, 1), played(1, 2), played(2, 0)]),
  squad('c', 'Squad A', [played(3, 3), played(3, 2), MISSING]),
]);

describe('standingsToCsv', () => {
  it('writes a header and one line per squad, held squads last', () => {
    const lines = standingsToCsv(standings).trimEnd().split('\r\n');
    expect(lines[0]).toBe('Rank,Squad,Match 1,Match 2,Match 3,Kills,Total,Status');
    expect(lines[1]).toBe('1,Night Owls,18,13,17,15,48,Ranked');
    expect(lines[2]).toBe('2,Squad B,10,14,9,3,33,Ranked');
    expect(lines[3]).toBe(',Squad A,11,10,,5,21,Result missing: match 3');
    expect(lines).toHaveLength(4);
  });

  it('quotes names with commas and quotes', () => {
    const csv = standingsToCsv(computeStandings([squad('x', 'Owls, "Night"')]));
    expect(csv).toContain('"Owls, ""Night"""');
  });

  it('stops names being read as spreadsheet formulas', () => {
    const csv = standingsToCsv(computeStandings([squad('x', '=HYPERLINK("x")')]));
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).not.toMatch(/,=HYPERLINK/);
  });
});

describe('standingsToText', () => {
  it('says the table is not final while a result is missing', () => {
    const text = standingsToText(standings, 'Friday Scrim');
    expect(text.split('\n').slice(0, 5)).toEqual([
      '*Friday Scrim*',
      'Standings so far, not final yet',
      '',
      '1. Night Owls - 48 pts, 15 kills',
      '2. Squad B - 33 pts, 3 kills',
    ]);
    expect(text).not.toContain('winner');
  });

  it('names the winner once every result is in', () => {
    const done = computeStandings([
      squad('a', 'Night Owls', [played(1, 6), played(2, 4), played(1, 5)]),
      squad('b', 'Squad B', [played(2, 1), played(1, 2), played(2, 0)]),
    ]);
    const lines = standingsToText(done, 'Friday Scrim').split('\n');
    expect(lines[1]).toBe('Final standings');
    expect(lines[3]).toBe('1. Night Owls - 48 pts, 15 kills (winner)');
  });

  it('lists held squads separately with the missing match', () => {
    const text = standingsToText(standings, 'Friday Scrim');
    expect(text).toContain('_Not ranked yet:_');
    expect(text).toContain('- Squad A - 21 pts so far (result missing: match 3)');
  });

  it('uses a default title and says when nobody is ranked', () => {
    const text = standingsToText(computeStandings([]), '   ');
    expect(text.startsWith('*Event standings*')).toBe(true);
    expect(text).toContain('No ranked squads yet.');
  });
});

describe('fileSafeName', () => {
  it('turns a title into a short file name', () => {
    expect(fileSafeName('Friday Scrim #3!')).toBe('friday-scrim-3');
    expect(fileSafeName('')).toBe('standings');
    expect(fileSafeName('***')).toBe('standings');
  });
});
