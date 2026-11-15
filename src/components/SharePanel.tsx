import { useState } from 'react';
import { fileSafeName, standingsToCsv, standingsToText } from '../export';
import { renderResultImage } from '../resultImage';
import type { Standings } from '../scoring';

interface Props {
  standings: Standings;
  title: string;
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older Android browsers: fall back to a hidden textarea
    try {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export function SharePanel({ standings, title }: Props) {
  const [status, setStatus] = useState('');
  const empty = standings.ranked.length + standings.held.length === 0;
  const name = fileSafeName(title);

  async function onCopy() {
    const ok = await copyText(standingsToText(standings, title));
    setStatus(
      ok
        ? 'Copied. Paste it into the WhatsApp group.'
        : 'Could not copy on this browser.',
    );
  }

  function onCsv() {
    download(new Blob([standingsToCsv(standings)], { type: 'text/csv' }), `${name}.csv`);
    setStatus('CSV file saved.');
  }

  async function onImage() {
    const blob = await renderResultImage(
      standings,
      title,
      `${import.meta.env.BASE_URL}jd-logo.png`,
    );
    if (!blob) {
      setStatus('Could not make the image on this browser.');
      return;
    }
    download(blob, `${name}.png`);
    setStatus('Image saved.');
  }

  return (
    <section className="card" aria-labelledby="share-heading">
      <h2 id="share-heading">Share results</h2>
      <div className="actions">
        <button type="button" className="pill" disabled={empty} onClick={onCopy}>
          Copy for WhatsApp
        </button>
        <button type="button" className="pill ghost" disabled={empty} onClick={onCsv}>
          Download CSV
        </button>
        <button type="button" className="pill ghost" disabled={empty} onClick={onImage}>
          Save image
        </button>
      </div>
      <p className="status" role="status">
        {status}
      </p>
    </section>
  );
}
