import { useState } from 'react';
import type { WorkingLevel } from './levelStore';

export function PreviewPanel({
  level,
  selectedId,
  onPrepare,
}: {
  level: WorkingLevel | null;
  selectedId: string | null;
  onPrepare: (level: WorkingLevel) => void;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const launch = (time: number) => {
    if (!level) return;
    onPrepare(level);
    const base = import.meta.env.BASE_URL || '/';
    setSrc(
      `${base}index.html?level=${encodeURIComponent(level.id)}&t=${time.toFixed(1)}&preview=1&_=${nonce}`,
    );
    setNonce((value) => value + 1);
  };
  const selectedTime = Math.max(
    0,
    (level?.events.find((event) => event.editorId === selectedId)?.value.at ?? 0) - 2,
  );
  return (
    <div>
      <p className="section-title">Preview</p>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        <button className="primary" onClick={() => launch(0)} disabled={!level}>
          ▶ From start
        </button>
        <button onClick={() => launch(selectedTime)} disabled={!level || !selectedId}>
          ▶ From selected
        </button>
        <button onClick={() => src && launch(0)} disabled={!src}>
          ⟲ Restart
        </button>
      </div>
      <div className="preview">
        {src ? (
          <iframe key={nonce} src={src} title="game preview" allow="autoplay" />
        ) : (
          <div className="placeholder">Preview loads here.</div>
        )}
      </div>
    </div>
  );
}
