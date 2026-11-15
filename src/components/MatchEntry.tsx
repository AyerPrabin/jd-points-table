import { forwardRef } from 'react';
import { MATCH_COUNT } from '../config';
import {
  MISSING,
  PENDING,
  findMatchIssues,
  matchPoints,
  matchProgress,
  played,
  type MatchResult,
  type Squad,
} from '../scoring';

interface Props {
  squads: Squad[];
  matchIndex: number;
  onMatchChange: (index: number) => void;
  onResult: (squadId: string, matchIndex: number, result: MatchResult) => void;
}

/** Keeps digits only, so a stray "." or "-" from a phone keyboard is dropped. */
function digits(value: string): string {
  return value.replace(/\D/g, '').slice(0, 2);
}

export const MatchEntry = forwardRef<HTMLHeadingElement, Props>(function MatchEntry(
  { squads, matchIndex, onMatchChange, onResult },
  headingRef,
) {
  const match = matchIndex + 1;
  const issues = findMatchIssues(squads, matchIndex);
  const flagged = new Set(issues.flatMap((i) => i.squadIds));

  function changePlacement(squad: Squad, text: string) {
    const current = squad.results[matchIndex];
    const kills = current?.status === 'played' ? current.kills : 0;
    const clean = digits(text);
    onResult(squad.id, matchIndex, clean === '' ? PENDING : played(Number(clean), kills));
  }

  function changeKills(squad: Squad, text: string) {
    const current = squad.results[matchIndex];
    if (current?.status !== 'played') return;
    const clean = digits(text);
    onResult(
      squad.id,
      matchIndex,
      played(current.placement, clean === '' ? 0 : Number(clean)),
    );
  }

  return (
    <section className="card" aria-labelledby="entry-heading">
      <h2 id="entry-heading" ref={headingRef} tabIndex={-1}>
        Enter results
      </h2>

      <div className="match-tabs" role="group" aria-label="Choose a match">
        {Array.from({ length: MATCH_COUNT }, (_, i) => (
          <button
            key={i}
            type="button"
            className="pill"
            aria-pressed={i === matchIndex}
            onClick={() => onMatchChange(i)}
          >
            Match {i + 1}
            <span className="tab-progress" aria-hidden="true">
              {matchProgress(squads, i)}/{squads.length}
            </span>
            <span className="sr-only">
              {', '}
              {matchProgress(squads, i)} of {squads.length} entered
            </span>
          </button>
        ))}
      </div>

      {squads.length === 0 ? (
        <p className="muted">Add squads above to start entering results.</p>
      ) : (
        <>
          <p className="muted small">
            Type each squad&apos;s placement and kills for match {match}. If a result was
            lost, tick &ldquo;Result missing&rdquo; and the squad is kept out of the
            ranking until you fill it in.
          </p>

          <div aria-live="polite">
            {issues.length > 0 && (
              <ul className="issues">
                {issues.map((issue) => (
                  <li key={`${issue.kind}-${issue.squadIds.join('-')}`}>
                    {issue.message}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <ul className="entry-list">
            {squads.map((squad) => {
              const result = squad.results[matchIndex] ?? PENDING;
              const isMissing = result.status === 'missing';
              const isPlayed = result.status === 'played';
              const pts = matchPoints(result);
              const base = `${squad.id}-m${match}`;
              return (
                <li
                  key={squad.id}
                  className={`entry${isMissing ? ' is-missing' : ''}${
                    flagged.has(squad.id) ? ' has-issue' : ''
                  }`}
                >
                  <div className="entry-head">
                    <span className="entry-name">{squad.name}</span>
                    <span className="entry-points">
                      {isMissing ? 'Missing' : pts === null ? '' : `${pts} pts`}
                    </span>
                  </div>
                  <div className="entry-fields">
                    <div className="field">
                      <label htmlFor={`${base}-place`}>
                        Place
                        <span className="sr-only">
                          {' '}
                          for {squad.name}, match {match}
                        </span>
                      </label>
                      <input
                        id={`${base}-place`}
                        inputMode="numeric"
                        autoComplete="off"
                        placeholder="-"
                        disabled={isMissing}
                        value={isPlayed ? String(result.placement) : ''}
                        aria-invalid={flagged.has(squad.id) || undefined}
                        onChange={(e) => changePlacement(squad, e.target.value)}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor={`${base}-kills`}>
                        Kills
                        <span className="sr-only">
                          {' '}
                          for {squad.name}, match {match}
                        </span>
                      </label>
                      <input
                        id={`${base}-kills`}
                        inputMode="numeric"
                        autoComplete="off"
                        placeholder="0"
                        disabled={!isPlayed}
                        value={isPlayed && result.kills > 0 ? String(result.kills) : ''}
                        onChange={(e) => changeKills(squad, e.target.value)}
                      />
                    </div>
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={isMissing}
                        onChange={(e) =>
                          onResult(
                            squad.id,
                            matchIndex,
                            e.target.checked ? MISSING : PENDING,
                          )
                        }
                      />
                      Result missing
                      <span className="sr-only">
                        {' '}
                        for {squad.name}, match {match}
                      </span>
                    </label>
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="muted small">Kills unlock once a placement is entered.</p>
        </>
      )}
    </section>
  );
});
