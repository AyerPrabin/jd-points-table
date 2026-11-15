import { expect, test } from '@playwright/test';

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

test('host runs an event where one result goes missing', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'JD Points Table' })).toBeVisible();

  await page.getByLabel('Event name').fill('Test Cup');
  for (const name of ['Night Owls', 'Squad A', 'Red Kites']) {
    await page.getByLabel('Squad name').fill(name);
    await page.getByRole('button', { name: 'Add squad' }).click();
  }

  const results: Record<string, [number, number][]> = {
    'Night Owls': [
      [1, 5],
      [2, 3],
    ],
    'Squad A': [
      [2, 2],
      [1, 6],
    ],
    'Red Kites': [
      [3, 1],
      [3, 0],
    ],
  };

  for (let match = 1; match <= 2; match++) {
    await page.getByRole('button', { name: new RegExp(`^Match ${match}`) }).click();
    for (const [squad, rows] of Object.entries(results)) {
      const [place, kills] = rows[match - 1]!;
      await page.getByLabel(`Place for ${squad}, match ${match}`).fill(String(place));
      await page.getByLabel(`Kills for ${squad}, match ${match}`).fill(String(kills));
    }
  }

  // Match 3: the host's app crashed, Squad A's placement was lost
  await page.getByRole('button', { name: /^Match 3/ }).click();
  await page.getByLabel('Place for Night Owls, match 3').fill('1');
  await page.getByLabel('Place for Red Kites, match 3').fill('2');
  await page.getByLabel('Result missing for Squad A, match 3').check();

  const table = page.getByRole('table', { name: /Standings/ });
  await expect(table.getByRole('rowheader')).toHaveText(['Night Owls', 'Red Kites']);
  await expect(page.getByText('Match 3 result missing')).toBeVisible();

  // Nothing should be wider than the phone screen
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(360);

  // The result turns up later, so fill it in
  await page.getByRole('button', { name: 'Fill in match 3 for Squad A' }).click();
  await page.getByLabel('Result missing for Squad A, match 3').uncheck();
  await page.getByLabel('Place for Squad A, match 3').fill('3');
  await page.getByLabel('Kills for Squad A, match 3').fill('4');

  // Night Owls 12+5 + 9+3 + 12 = 41, Squad A 9+2 + 12+6 + 8+4 = 41, Red Kites 8+1 + 8 + 9 = 26
  // Night Owls and Squad A tie on points; Squad A wins on kills (12 vs 8).
  await expect(table.getByRole('rowheader')).toHaveText([
    'Squad A',
    'Night Owls',
    'Red Kites',
  ]);
  await expect(page.getByText('Not ranked yet')).toHaveCount(0);

  await page.getByRole('button', { name: 'Copy for WhatsApp' }).click();
  await expect(page.getByRole('status')).toContainText('Copied');
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text).toContain('*Test Cup*');
  expect(text).toContain('1. Squad A - 41 pts, 12 kills (winner)');

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download CSV' }).click();
  expect((await download).suggestedFilename()).toBe('test-cup.csv');

  // Results survive a reload
  await page.reload();
  await expect(table.getByRole('rowheader')).toHaveText([
    'Squad A',
    'Night Owls',
    'Red Kites',
  ]);
});
