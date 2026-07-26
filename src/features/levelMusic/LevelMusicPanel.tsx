import { useMemo, useRef, useState, type ChangeEvent, type ReactElement } from 'react';
import {
  normalizeLevelMusicAssignment,
  type LevelMusicAssignment,
  type MusicAssetRecord,
} from './levelMusicCore';
import './levelMusic.css';

export interface LevelMusicPanelProps {
  tracks: readonly MusicAssetRecord[];
  value: Partial<LevelMusicAssignment> | null | undefined;
  disabled?: boolean;
  onChange: (next: LevelMusicAssignment) => void;
  onImportMp3: (file: File) => Promise<void> | void;
  onPreview: (track: MusicAssetRecord, assignment: LevelMusicAssignment) => Promise<void> | void;
  onStopPreview: () => Promise<void> | void;
  onRevealFolder?: () => Promise<void> | void;
  onRemoveTrack?: (track: MusicAssetRecord) => Promise<void> | void;
}

export function LevelMusicPanel({
  tracks,
  value,
  disabled = false,
  onChange,
  onImportMp3,
  onPreview,
  onStopPreview,
  onRevealFolder,
  onRemoveTrack,
}: LevelMusicPanelProps): ReactElement {
  const assignment = normalizeLevelMusicAssignment(value);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const selectedTrack = useMemo(
    () => tracks.find((track) => track.id === assignment.trackId) ?? null,
    [assignment.trackId, tracks],
  );
  const missing = Boolean(assignment.trackId && !selectedTrack);

  const patch = (next: Partial<LevelMusicAssignment>): void => {
    onChange(normalizeLevelMusicAssignment({ ...assignment, ...next }));
  };

  const runAction = async (
    action: () => Promise<void> | void,
    successMessage?: string,
  ): Promise<void> => {
    setMessage(null);
    try {
      await action();
      if (successMessage) setMessage(successMessage);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Music action failed.');
    }
  };

  const handleFile = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true);
    setMessage(null);
    try {
      await onImportMp3(file);
      setMessage(`Imported ${file.name}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'MP3 import failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="level-music-panel" aria-labelledby="level-music-heading">
      <div className="level-music-panel__heading-row">
        <div>
          <h3 id="level-music-heading">Level music</h3>
          <p>Assign one imported MP3 to this level. Music composition remains external.</p>
        </div>
        <div className="level-music-panel__actions">
          <input
            ref={inputRef}
            type="file"
            accept=".mp3,audio/mpeg,audio/mp3"
            onChange={(event: ChangeEvent<HTMLInputElement>) => void handleFile(event)}
            hidden
          />
          <button
            type="button"
            disabled={disabled || busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? 'Importing…' : 'Import MP3'}
          </button>
          {onRevealFolder ? (
            <button
              type="button"
              disabled={disabled}
              onClick={() => void runAction(onRevealFolder)}
            >
              Reveal folder
            </button>
          ) : null}
        </div>
      </div>

      <label>
        Track
        <select
          value={assignment.trackId ?? ''}
          disabled={disabled}
          onChange={(event: ChangeEvent<HTMLSelectElement>) => patch({ trackId: event.target.value || null })}
        >
          <option value="">No music</option>
          {tracks.map((track) => (
            <option key={track.id} value={track.id}>
              {track.displayName}
            </option>
          ))}
        </select>
      </label>

      {missing ? (
        <p className="level-music-panel__warning" role="alert">
          Assigned track “{assignment.trackId}” is missing. The level will load silently.
        </p>
      ) : null}

      <div className="level-music-panel__grid">
        <label>
          Volume <output>{Math.round(assignment.volume * 100)}%</output>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={assignment.volume}
            disabled={disabled}
            onChange={(event: ChangeEvent<HTMLInputElement>) => patch({ volume: Number(event.target.value) })}
          />
        </label>

        <label className="level-music-panel__checkbox">
          <input
            type="checkbox"
            checked={assignment.loop}
            disabled={disabled}
            onChange={(event: ChangeEvent<HTMLInputElement>) => patch({ loop: event.target.checked })}
          />
          Loop track
        </label>

        <label>
          Start offset (seconds)
          <input
            type="number"
            min="0"
            step="0.1"
            value={assignment.startOffsetSeconds}
            disabled={disabled}
            onChange={(event: ChangeEvent<HTMLInputElement>) => patch({ startOffsetSeconds: Number(event.target.value) })}
          />
        </label>

        <label>
          Fade (seconds)
          <input
            type="number"
            min="0"
            max="10"
            step="0.1"
            value={assignment.fadeSeconds}
            disabled={disabled}
            onChange={(event: ChangeEvent<HTMLInputElement>) => patch({ fadeSeconds: Number(event.target.value) })}
          />
        </label>
      </div>

      <div className="level-music-panel__actions">
        <button
          type="button"
          disabled={disabled || !selectedTrack}
          onClick={() =>
            selectedTrack &&
            void runAction(() => onPreview(selectedTrack, assignment))
          }
        >
          Preview
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => void runAction(onStopPreview)}
        >
          Stop
        </button>
        {selectedTrack && onRemoveTrack ? (
          <button
            type="button"
            className="level-music-panel__danger"
            disabled={disabled}
            onClick={() =>
              void runAction(
                () => onRemoveTrack(selectedTrack),
                `Removed ${selectedTrack.displayName}.`,
              )
            }
          >
            Remove from library
          </button>
        ) : null}
      </div>

      {selectedTrack ? (
        <dl className="level-music-panel__metadata">
          <div><dt>File</dt><dd>{selectedTrack.fileName}</dd></div>
          <div><dt>Source</dt><dd>{selectedTrack.source}</dd></div>
          <div><dt>Size</dt><dd>{Math.ceil(selectedTrack.byteLength / 1024)} KB</dd></div>
          <div><dt>SHA-256</dt><dd><code>{selectedTrack.sha256.slice(0, 16)}…</code></dd></div>
        </dl>
      ) : null}

      {message ? <p role="status">{message}</p> : null}
    </section>
  );
}
