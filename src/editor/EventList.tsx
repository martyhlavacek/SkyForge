import type { WorkingLevel, WorkingEvent } from './levelStore';
import { contentRegistry } from '../game/systems/ContentRegistry';
import type { LevelEvent } from '../schemas/levelSchema';

function describe(event: LevelEvent): {
  type: string;
  label: string;
  difficulty?: number;
} {
  if ('encounter' in event) {
    const encounter = contentRegistry.encounters.get(event.encounter);
    return {
      type: 'encounter',
      label: event.encounter,
      difficulty: encounter?.difficulty,
    };
  }
  if (event.type === 'recovery')
    return { type: 'recovery', label: `${event.duration}s ease` };
  if (event.type === 'terrainState')
    return { type: 'terrain', label: `${event.target} → ${event.state}` };
  return { type: 'checkpoint', label: event.name };
}

export function EventList({
  level,
  selectedId,
  onSelect,
  onDelete,
}: {
  level: WorkingLevel | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  if (!level) return <p style={{ color: 'var(--muted)' }}>No level loaded.</p>;
  const rows = [...level.events].sort((a, b) => a.value.at - b.value.at);
  return (
    <div className="event-list">
      {rows.map((working: WorkingEvent) => {
        const event = working.value;
        const description = describe(event);
        const mins = Math.floor(event.at / 60);
        const secs = Math.floor(event.at % 60);
        return (
          <div
            key={working.editorId}
            className={`event-row ${selectedId === working.editorId ? 'selected' : ''}`}
            onClick={() => onSelect(working.editorId)}
          >
            <span className="time">
              {mins}:{secs.toString().padStart(2, '0')}
            </span>
            <span>
              <span className="type">{description.type}</span>{' '}
              <span className="label">{description.label}</span>
            </span>
            <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {description.difficulty && (
                <span className={`badge d${description.difficulty}`}>
                  D{description.difficulty}
                </span>
              )}
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete(working.editorId);
                }}
                title="delete event"
              >
                ✕
              </button>
            </span>
          </div>
        );
      })}
    </div>
  );
}
