import { useState, type FormEvent } from 'react';
import { MAX_SQUAD_NAME_LENGTH } from '../config';
import { squadNameError } from '../eventState';
import type { EventState } from '../storage';

interface Props {
  state: EventState;
  onTitle: (title: string) => void;
  onAdd: (name: string) => void;
  onRemove: (id: string) => void;
  onLoadSample: () => void;
}

export function SquadSetup({ state, onTitle, onAdd, onRemove, onLoadSample }: Props) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    const problem = squadNameError(name, state);
    setError(problem);
    if (problem) return;
    onAdd(name);
    setName('');
  }

  return (
    <section className="card" aria-labelledby="setup-heading">
      <h2 id="setup-heading">Event</h2>

      <div className="field wide">
        <label htmlFor="event-title">Event name</label>
        <input
          id="event-title"
          value={state.title}
          maxLength={60}
          placeholder="e.g. Friday Night Scrim"
          onChange={(e) => onTitle(e.target.value)}
        />
      </div>

      <form className="add-squad" onSubmit={submit} noValidate>
        <div className="field wide">
          <label htmlFor="squad-name">Squad name</label>
          <input
            id="squad-name"
            value={name}
            maxLength={MAX_SQUAD_NAME_LENGTH + 10}
            autoComplete="off"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'squad-name-error' : undefined}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <button type="submit" className="pill">
          Add squad
        </button>
      </form>
      {error && (
        <p id="squad-name-error" className="error" role="alert">
          {error}
        </p>
      )}

      {state.squads.length === 0 ? (
        <div className="empty">
          <p className="muted">
            No squads yet. Add them one by one, or try the sample event.
          </p>
          <button type="button" className="pill ghost" onClick={onLoadSample}>
            Load sample event
          </button>
        </div>
      ) : (
        <>
          <h3 className="squad-count">{state.squads.length} squads</h3>
          <ul className="chips">
            {state.squads.map((squad) => (
              <li key={squad.id} className="chip">
                <span>{squad.name}</span>
                <button
                  type="button"
                  className="chip-remove"
                  aria-label={`Remove ${squad.name}`}
                  onClick={() => {
                    if (window.confirm(`Remove ${squad.name} and their results?`)) {
                      onRemove(squad.id);
                    }
                  }}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
