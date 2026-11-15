import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { MATCH_COUNT, PLACEMENT_POINTS, POINTS_PER_KILL } from './config';
import { eventReducer, newId } from './eventState';
import { sampleEvent } from './sample';
import { computeStandings, ordinal } from './scoring';
import { loadEvent, saveEvent, storageWorks } from './storage';
import { MatchEntry } from './components/MatchEntry';
import { SharePanel } from './components/SharePanel';
import { SquadSetup } from './components/SquadSetup';
import { StandingsTable } from './components/StandingsTable';

/** Opens on the first match that still has squads without a result. */
function firstOpenMatch(squads: ReturnType<typeof loadEvent>['squads']): number {
  for (let i = 0; i < MATCH_COUNT; i++) {
    if (squads.some((s) => s.results[i]?.status === 'pending')) return i;
  }
  return 0;
}

export default function App() {
  const [state, dispatch] = useReducer(eventReducer, undefined, () => loadEvent());
  const [matchIndex, setMatchIndex] = useState(() => firstOpenMatch(state.squads));
  const [saveOk] = useState(() => storageWorks());
  const entryHeading = useRef<HTMLHeadingElement>(null);

  const standings = useMemo(() => computeStandings(state.squads), [state.squads]);

  useEffect(() => {
    saveEvent(state);
  }, [state]);

  function fillIn(index: number) {
    setMatchIndex(index);
    entryHeading.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    entryHeading.current?.focus({ preventScroll: true });
  }

  return (
    <>
      <a className="skip" href="#standings-heading">
        Skip to standings
      </a>
      <header className="site-header">
        <img
          src={`${import.meta.env.BASE_URL}jd-logo.png`}
          alt=""
          width="56"
          height="56"
        />
        <div>
          <h1>JD Points Table</h1>
          <p className="tagline">Free Fire squad events, scored the JD way</p>
        </div>
      </header>

      <main>
        {!saveOk && (
          <p className="error banner" role="alert">
            This browser is not saving. Keep this tab open until the event is finished.
          </p>
        )}

        <SquadSetup
          state={state}
          onTitle={(title) => dispatch({ type: 'set-title', title })}
          onAdd={(name) => dispatch({ type: 'add-squad', id: newId(), name })}
          onRemove={(id) => dispatch({ type: 'remove-squad', id })}
          onLoadSample={() => {
            const sample = sampleEvent();
            dispatch({ type: 'replace', state: sample });
            setMatchIndex(firstOpenMatch(sample.squads));
          }}
        />

        <MatchEntry
          ref={entryHeading}
          squads={state.squads}
          matchIndex={matchIndex}
          onMatchChange={setMatchIndex}
          onResult={(squadId, index, result) =>
            dispatch({ type: 'set-result', squadId, matchIndex: index, result })
          }
        />

        <StandingsTable standings={standings} onFillIn={fillIn} />

        <SharePanel standings={standings} title={state.title} />

        <section className="card" aria-labelledby="rules-heading">
          <h2 id="rules-heading">How points work</h2>
          <p className="small">
            Each match: placement points plus {POINTS_PER_KILL} point per kill. Ties are
            broken by total kills, then best single-match placement, then placement in the
            last match.
          </p>
          <details>
            <summary>Placement points table</summary>
            <table className="rules-table">
              <caption className="sr-only">Placement points</caption>
              <thead>
                <tr>
                  <th scope="col">Place</th>
                  <th scope="col">Points</th>
                </tr>
              </thead>
              <tbody>
                {PLACEMENT_POINTS.map((pts, i) => (
                  <tr key={i}>
                    <td>{ordinal(i + 1)}</td>
                    <td>{pts}</td>
                  </tr>
                ))}
                <tr>
                  <td>{ordinal(PLACEMENT_POINTS.length + 1)} and below</td>
                  <td>0</td>
                </tr>
              </tbody>
            </table>
          </details>
          <div className="actions danger-zone">
            <button
              type="button"
              className="pill ghost"
              disabled={state.squads.length === 0}
              onClick={() => {
                if (window.confirm('Clear all results but keep the squads?')) {
                  dispatch({ type: 'clear-results' });
                  setMatchIndex(0);
                }
              }}
            >
              Clear results
            </button>
            <button
              type="button"
              className="pill ghost"
              disabled={state.squads.length === 0 && !state.title}
              onClick={() => {
                if (window.confirm('Remove the whole event, squads and all?')) {
                  dispatch({ type: 'replace', state: { title: '', squads: [] } });
                  setMatchIndex(0);
                }
              }}
            >
              Start over
            </button>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <p>
          Made by Prabin Ayer for hosts on JD Esports Arena.{' '}
          <a href="https://github.com/AyerPrabin/jd-points-table">Source on GitHub</a>
        </p>
      </footer>
    </>
  );
}
