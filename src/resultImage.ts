import { isComplete, type Standings } from './scoring';

const BG = '#0C0C0C';
const SURFACE = '#1C1C1C';
const GOLD = '#D4AF37';
const TEXT = '#E5E5E5';
const SECONDARY = '#C9C9C9';

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Draws the ranked table onto a canvas and returns it as a PNG blob. */
export async function renderResultImage(
  standings: Standings,
  title: string,
  logoUrl: string,
): Promise<Blob | null> {
  const rows = standings.ranked.slice(0, 12);
  const width = 720;
  const rowHeight = 52;
  const top = 170;
  const height = top + Math.max(rows.length, 1) * rowHeight + 70;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, width, height);

  const logo = await loadImage(logoUrl);
  if (logo) ctx.drawImage(logo, 32, 28, 96, 96);

  ctx.fillStyle = GOLD;
  ctx.font = '700 38px Georgia, serif';
  ctx.fillText(title.trim() || 'Event standings', 148, 78, width - 180);
  ctx.fillStyle = SECONDARY;
  ctx.font = '400 20px system-ui, sans-serif';
  ctx.fillText(
    isComplete(standings) ? 'Final standings' : 'Standings so far, not final',
    148,
    112,
  );

  ctx.font = '600 16px system-ui, sans-serif';
  ctx.fillText('#', 48, top - 14);
  ctx.fillText('SQUAD', 100, top - 14);
  ctx.textAlign = 'right';
  ctx.fillText('KILLS', 560, top - 14);
  ctx.fillText('POINTS', 680, top - 14);
  ctx.textAlign = 'left';

  rows.forEach((row, i) => {
    const y = top + i * rowHeight;
    ctx.fillStyle = i % 2 === 0 ? SURFACE : BG;
    ctx.fillRect(32, y, width - 64, rowHeight - 6);
    const mid = y + rowHeight / 2 + 4;
    const podium = row.rank !== null && row.rank <= 3;

    ctx.fillStyle = podium ? GOLD : TEXT;
    ctx.font = '700 22px Georgia, serif';
    ctx.fillText(String(row.rank), 48, mid);
    ctx.font = '500 21px system-ui, sans-serif';
    ctx.fillStyle = TEXT;
    ctx.fillText(row.name, 100, mid, 380);
    ctx.textAlign = 'right';
    ctx.fillText(String(row.kills), 560, mid);
    ctx.fillStyle = GOLD;
    ctx.font = '700 22px system-ui, sans-serif';
    ctx.fillText(String(row.total), 680, mid);
    ctx.textAlign = 'left';
  });

  if (rows.length === 0) {
    ctx.fillStyle = SECONDARY;
    ctx.font = '400 20px system-ui, sans-serif';
    ctx.fillText('No ranked squads yet.', 48, top + 30);
  }

  ctx.fillStyle = SECONDARY;
  ctx.font = '400 15px system-ui, sans-serif';
  const note =
    standings.held.length > 0
      ? `${standings.held.length} squad(s) not ranked yet: result missing.`
      : 'Placement points + 1 point per kill.';
  ctx.fillText(note, 32, height - 28);

  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/png'));
}
