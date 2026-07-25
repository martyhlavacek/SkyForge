import { useMemo, useRef, useState } from 'react';
import type { LevelEvent } from '../schemas/levelSchema';
import type { WorkingLevel } from './levelStore';
import { contentRegistry } from '../game/systems/ContentRegistry';

const LANES = ['encounters', 'terrain', 'flow', 'checkpoints'] as const;
type Lane = (typeof LANES)[number];

function laneFor(event: LevelEvent): Lane {
  if ('encounter' in event) return 'encounters';
  if (event.type === 'terrainState') return 'terrain';
  if (event.type === 'checkpoint') return 'checkpoints';
  return 'flow';
}

function labelFor(event: LevelEvent): string {
  if ('encounter' in event) return contentRegistry.encounters.get(event.encounter)?.id ?? event.encounter;
  if (event.type === 'terrainState') return `${event.target} → ${event.state}`;
  if (event.type === 'checkpoint') return event.name;
  return `Recovery ${event.duration}s`;
}

export function TimelineEditor({
  level,
  selectedId,
  onSelect,
  onMove,
}: {
  level: WorkingLevel;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onMove: (id: string, at: number) => void;
}) {
  const [playhead, setPlayhead] = useState(0);
  const [zoom, setZoom] = useState(1);
  const drag = useRef<{ id: string; rect: DOMRect } | null>(null);
  const duration = Math.max(1, level.durationTarget);
  const eventsByLane = useMemo(
    () =>
      Object.fromEntries(
        LANES.map((lane) => [
          lane,
          level.events.filter((working) => laneFor(working.value) === lane),
        ]),
      ) as Record<Lane, typeof level.events>,
    [level.events],
  );

  return (
    <div className="timeline-editor">
      <div className="timeline-transport">
        <button onClick={() => setPlayhead(0)}>⏮</button>
        <button onClick={() => setPlayhead(Math.max(0, playhead - 1))}>◀ 1s</button>
        <button onClick={() => setPlayhead(Math.min(duration, playhead + 1))}>1s ▶</button>
        <label>
          Playhead
          <input
            type="number"
            min={0}
            max={duration}
            step={0.1}
            value={playhead}
            onChange={(event) => setPlayhead(Number(event.target.value))}
          />
        </label>
        <label>
          Timeline zoom
          <input
            type="range"
            min={0.75}
            max={3}
            step={0.25}
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
          />
        </label>
      </div>
      <div className="timeline-scroll">
        <div className="timeline-ruler" style={{ width: `${Math.max(100, zoom * 100)}%` }}>
          {Array.from({ length: Math.ceil(duration / 10) + 1 }, (_, index) => {
            const at = index * 10;
            return (
              <span key={at} style={{ left: `${(at / duration) * 100}%` }}>
                {formatTime(at)}
              </span>
            );
          })}
          <i style={{ left: `${(playhead / duration) * 100}%` }} />
        </div>
        <div className="timeline-lanes" style={{ width: `${Math.max(100, zoom * 100)}%` }}>
          {LANES.map((lane) => (
            <div className="timeline-lane" key={lane}>
              <b>{lane}</b>
              <div className="timeline-lane-track">
                <i className="playhead" style={{ left: `${(playhead / duration) * 100}%` }} />
                {eventsByLane[lane].map((working) => {
                  const event = working.value;
                  const width =
                    'type' in event && event.type === 'recovery'
                      ? Math.max(1.5, (event.duration / duration) * 100)
                      : 1.5;
                  return (
                    <button
                      key={working.editorId}
                      className={`timeline-event ${selectedId === working.editorId ? 'selected' : ''}`}
                      style={{ left: `${(event.at / duration) * 100}%`, width: `${width}%` }}
                      title={`${formatTime(event.at)} · ${labelFor(event)}`}
                      onClick={() => onSelect(working.editorId)}
                      onPointerDown={(pointer) => {
                        pointer.currentTarget.setPointerCapture(pointer.pointerId);
                        drag.current = {
                          id: working.editorId,
                          rect: pointer.currentTarget.parentElement!.getBoundingClientRect(),
                        };
                      }}
                      onPointerMove={(pointer) => {
                        if (!drag.current || drag.current.id !== working.editorId) return;
                        const ratio = Math.max(
                          0,
                          Math.min(1, (pointer.clientX - drag.current.rect.left) / drag.current.rect.width),
                        );
                        setPlayhead(Math.round(ratio * duration * 10) / 10);
                      }}
                      onPointerUp={(pointer) => {
                        if (!drag.current || drag.current.id !== working.editorId) return;
                        const ratio = Math.max(
                          0,
                          Math.min(1, (pointer.clientX - drag.current.rect.left) / drag.current.rect.width),
                        );
                        const at = Math.round(ratio * duration * 2) / 2;
                        onMove(working.editorId, at);
                        setPlayhead(at);
                        drag.current = null;
                        if (pointer.currentTarget.hasPointerCapture(pointer.pointerId))
                          pointer.currentTarget.releasePointerCapture(pointer.pointerId);
                      }}
                    >
                      {labelFor(event)}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${minutes}:${remainder.toString().padStart(2, '0')}`;
}
