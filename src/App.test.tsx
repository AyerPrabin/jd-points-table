import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { STORAGE_KEY } from './storage';

async function addSquads(user: ReturnType<typeof userEvent.setup>, ...names: string[]) {
  for (const name of names) {
    await user.type(screen.getByLabelText('Squad name'), name);
    await user.click(screen.getByRole('button', { name: 'Add squad' }));
  }
}

function standingsRows() {
  const table = screen.getByRole('table', { name: /Standings/ });
  return within(table)
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getByRole('rowheader').textContent);
}

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('App', () => {
  it('adds squads and refuses a duplicate name', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addSquads(user, 'Night Owls', 'night owls');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Night Owls is already in the list.',
    );
    expect(screen.getByText('1 squads')).toBeInTheDocument();
  });

  it('updates the standings as results are typed in', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addSquads(user, 'Squad A', 'Night Owls');

    await user.type(screen.getByLabelText('Place for Squad A, match 1'), '2');
    await user.type(screen.getByLabelText('Place for Night Owls, match 1'), '1');
    await user.type(screen.getByLabelText('Kills for Squad A, match 1'), '7');

    // Squad A: 9 + 7 = 16, Night Owls: 12 + 0 = 12
    expect(standingsRows()).toEqual(['Squad A', 'Night Owls']);
    expect(screen.getByText('16 pts')).toBeInTheDocument();
  });

  it('keeps the kills box locked until a placement is entered', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addSquads(user, 'Squad A');
    const kills = screen.getByLabelText('Kills for Squad A, match 1');
    expect(kills).toBeDisabled();
    await user.type(screen.getByLabelText('Place for Squad A, match 1'), '3');
    expect(kills).toBeEnabled();
  });

  it('moves a squad out of the ranking when its result is missing, and back when filled', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addSquads(user, 'Squad A', 'Squad B');
    await user.type(screen.getByLabelText('Place for Squad B, match 1'), '1');
    await user.click(screen.getByLabelText('Result missing for Squad A, match 1'));

    expect(standingsRows()).toEqual(['Squad B']);
    expect(screen.getByText('Match 1 result missing')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Fill in match 1 for Squad A' }));
    await user.click(screen.getByLabelText('Result missing for Squad A, match 1'));
    await user.type(screen.getByLabelText('Place for Squad A, match 1'), '2');

    expect(standingsRows()).toEqual(['Squad B', 'Squad A']);
    expect(screen.queryByText('Not ranked yet')).not.toBeInTheDocument();
  });

  it('warns when two squads have the same placement', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addSquads(user, 'Squad A', 'Squad B');
    await user.type(screen.getByLabelText('Place for Squad A, match 1'), '1');
    await user.type(screen.getByLabelText('Place for Squad B, match 1'), '1');
    expect(
      screen.getByText('Squad A and Squad B are both marked 1st.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Place for Squad B, match 1')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });

  it('switches between matches', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addSquads(user, 'Squad A');
    const match2 = screen.getByRole('button', { name: /Match 2/ });
    await user.click(match2);
    expect(match2).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('Place for Squad A, match 2')).toBeInTheDocument();
  });

  it('copies WhatsApp text to the clipboard', async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText');
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Load sample event' }));
    await user.click(screen.getByRole('button', { name: 'Copy for WhatsApp' }));

    expect(writeText).toHaveBeenCalledOnce();
    expect(writeText.mock.calls[0]?.[0]).toContain('*Friday Night Scrim*');
    expect(screen.getByRole('status')).toHaveTextContent('Copied');
  });

  it('saves to localStorage and loads it again after a reload', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<App />);
    await addSquads(user, 'Night Owls');
    expect(localStorage.getItem(STORAGE_KEY)).toContain('Night Owls');

    unmount();
    render(<App />);
    expect(
      screen.getByText('Night Owls', { selector: '.chip span' }),
    ).toBeInTheDocument();
  });

  it('removes a squad after confirming', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addSquads(user, 'Squad A', 'Squad B');
    await user.click(screen.getByRole('button', { name: 'Remove Squad A' }));
    expect(
      screen.queryByRole('button', { name: 'Remove Squad A' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('1 squads')).toBeInTheDocument();
  });

  it('clears results but keeps squads', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Load sample event' }));
    await user.click(screen.getByRole('button', { name: 'Clear results' }));
    expect(screen.getByText('8 squads')).toBeInTheDocument();
    // With no results at all, every squad is level on 0 and shares 1st place
    const table = screen.getByRole('table', { name: /Standings/ });
    const ranks = within(table)
      .getAllByRole('row')
      .slice(1)
      .map((row) => row.querySelector('.rank')?.textContent);
    expect(ranks).toEqual(Array(8).fill('1'));
  });
});
