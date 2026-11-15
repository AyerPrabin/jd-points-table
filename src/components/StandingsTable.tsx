import { MATCH_COUNT } from '../config';
import type { StandingRow, Standings } from '../scoring';

interface Props {
  standings: Standings;
  onFillIn: (matchIndex: number) => void;
}

function cell(value: number | null) {
  return value === null ? <span aria-label="no result">-</span> : value;
}

function heldReason(row: StandingRow): string {
  if (row.holdReason === 'invalid') return `Check match ${row.invalidMatches.join(', ')}`;
  const list = row.missingMatches.join(', ');
  return `Match ${list} result missing`;
}

export function StandingsTable({ standings, onFillIn }: Props) {
  const { ranked, held } = standings;
  const matches = Array.from({ length: MATCH_COUNT }, (_, i) => i + 1);

  return (
    <section className="card" aria-labelledby="standings-heading">
      <h2 id="standings-heading">Standings</h2>

      {ranked.length === 0 ? (
        <p className="muted">No ranked squads yet.</p>
      ) : (
        <div className="table-wrap">
          <table className="standings">
            <caption className="sr-only">
              Standings, ordered by points, then kills, then best placement
            </caption>
            <thead>
              <tr>
                <th scope="col">
                  <abbr title="Rank">#</abbr>
                </th>
                <th scope="col" className="name-col">
                  Squad
                </th>
                {matches.map((m) => (
                  <th scope="col" key={m} className="num">
                    <abbr title={`Match ${m} points`}>M{m}</abbr>
                  </th>
                ))}
                <th scope="col" className="num">
                  <abbr title="Total kills">K</abbr>
                </th>
                <th scope="col" className="num">
                  <abbr title="Total points">Pts</abbr>
                </th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((row) => (
                <tr
                  key={row.squadId}
                  className={row.rank !== null && row.rank <= 3 ? 'top' : ''}
                >
                  <td>
                    <span className={`rank rank-${row.rank}`}>{row.rank}</span>
                  </td>
                  <th scope="row" className="name-col">
                    {row.name}
                  </th>
                  {row.matchPoints.map((p, i) => (
                    <td key={i} className="num">
                      {cell(p)}
                    </td>
                  ))}
                  <td className="num">{row.kills}</td>
                  <td className="num total">{row.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {held.length > 0 && (
        <div className="held">
          <h3>Not ranked yet</h3>
          <p className="muted small">
            These squads stay out of the ranking until their result is filled in.
          </p>
          <ul>
            {held.map((row) => {
              const firstGap = row.invalidMatches[0] ?? row.missingMatches[0] ?? 1;
              return (
                <li key={row.squadId} className="held-row">
                  <div>
                    <strong>{row.name}</strong>
                    <span className="badge">{heldReason(row)}</span>
                    <span className="muted small"> {row.total} pts so far</span>
                  </div>
                  <button
                    type="button"
                    className="pill ghost small-pill"
                    aria-label={`Fill in match ${firstGap} for ${row.name}`}
                    onClick={() => onFillIn(firstGap - 1)}
                  >
                    Fill in match {firstGap}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
