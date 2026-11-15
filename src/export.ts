import { MATCH_COUNT } from './config';
import type { StandingRow, Standings } from './scoring';

function holdNote(row: StandingRow): string {
  if (row.holdReason === 'invalid') {
    return `Check match ${row.invalidMatches.join(', ')}`;
  }
  return `Result missing: match ${row.missingMatches.join(', ')}`;
}

/** Stops a spreadsheet from running a squad name like "=SUM(...)" as a formula. */
function csvCell(value: string | number): string {
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (/[",\n\r]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function standingsToCsv(standings: Standings): string {
  const matchHeaders = Array.from({ length: MATCH_COUNT }, (_, i) => `Match ${i + 1}`);
  const header = ['Rank', 'Squad', ...matchHeaders, 'Kills', 'Total', 'Status'];
  const rows = [...standings.ranked, ...standings.held].map((row) => [
    row.rank ?? '',
    row.name,
    ...row.matchPoints.map((p) => p ?? ''),
    row.kills,
    row.total,
    row.holdReason ? holdNote(row) : 'Ranked',
  ]);
  return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

/** Plain text for pasting into a WhatsApp group. *text* shows as bold there. */
export function standingsToText(standings: Standings, title: string): string {
  const lines: string[] = [`*${title.trim() || 'Event standings'}*`, ''];

  if (standings.ranked.length === 0) {
    lines.push('No ranked squads yet.');
  }
  for (const row of standings.ranked) {
    const medal = row.rank === 1 ? ' (winner)' : '';
    lines.push(`${row.rank}. ${row.name} - ${row.total} pts, ${row.kills} kills${medal}`);
  }

  if (standings.held.length > 0) {
    lines.push('', '_Not ranked yet:_');
    for (const row of standings.held) {
      lines.push(
        `- ${row.name} - ${row.total} pts so far (${holdNote(row).toLowerCase()})`,
      );
    }
  }

  lines.push('', 'Placement points + 1 point per kill.');
  return lines.join('\n');
}

export function fileSafeName(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return slug || 'standings';
}
