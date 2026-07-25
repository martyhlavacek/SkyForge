import { contentRegistry } from '../game/systems/ContentRegistry';
import type { WorkingLevel } from './levelStore';
import type { LevelEvent } from '../schemas/levelSchema';

export function Inspector({
  level,
  selectedId,
  encounters,
  terrainTargets,
  onEdit,
}: {
  level: WorkingLevel | null;
  selectedId: string | null;
  encounters: string[];
  terrainTargets: string[];
  onEdit: (id: string, patch: Partial<LevelEvent>) => void;
}) {
  const working = level?.events.find((event) => event.editorId === selectedId);
  if (!level || !working)
    return <p style={{ color: 'var(--muted)' }}>Select an event to edit.</p>;
  const event = working.value;
  return (
    <div className="inspector">
      <label>Time (seconds)</label>
      <input
        type="number"
        step="0.5"
        value={event.at}
        onChange={(input) =>
          onEdit(working.editorId, { at: parseFloat(input.target.value) || 0 })
        }
      />
      {'encounter' in event && (
        <>
          <label>Encounter</label>
          <select
            value={event.encounter}
            onChange={(input) =>
              onEdit(working.editorId, {
                encounter: input.target.value,
              } as Partial<LevelEvent>)
            }
          >
            {encounters.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
          <EncounterMeta id={event.encounter} />
        </>
      )}
      {'type' in event && event.type === 'recovery' && (
        <>
          <label>Duration (seconds)</label>
          <input
            type="number"
            step="0.5"
            value={event.duration}
            onChange={(input) =>
              onEdit(working.editorId, {
                duration: parseFloat(input.target.value) || 0,
              } as Partial<LevelEvent>)
            }
          />
        </>
      )}
      {'type' in event && event.type === 'checkpoint' && (
        <>
          <label>Checkpoint name</label>
          <input
            value={event.name}
            onChange={(input) =>
              onEdit(working.editorId, {
                name: input.target.value,
              } as Partial<LevelEvent>)
            }
          />
        </>
      )}
      {'type' in event && event.type === 'terrainState' && (
        <>
          <label>Terrain object</label>
          <select
            value={event.target}
            onChange={(input) =>
              onEdit(working.editorId, {
                target: input.target.value,
              } as Partial<LevelEvent>)
            }
          >
            {terrainTargets.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
          <label>State</label>
          <select
            value={event.state}
            onChange={(input) =>
              onEdit(working.editorId, {
                state: input.target.value as 'open' | 'closed' | 'destroyed',
              } as Partial<LevelEvent>)
            }
          >
            <option value="open">open</option>
            <option value="closed">closed</option>
            <option value="destroyed">destroyed</option>
          </select>
        </>
      )}
    </div>
  );
}

function EncounterMeta({ id }: { id: string }) {
  const encounter = contentRegistry.encounters.get(id);
  if (!encounter)
    return (
      <div className="meta" style={{ color: 'var(--danger)' }}>
        Unknown encounter “{id}”
      </div>
    );
  return (
    <div className="meta">
      <div>
        difficulty <b>{encounter.difficulty}</b> · est.{' '}
        <b>{encounter.estimatedDuration}s</b> · {encounter.events.length} events
      </div>
      <div style={{ color: 'var(--muted)', marginTop: 4 }}>
        skills:{' '}
        {encounter.skillsTested.length ? encounter.skillsTested.join(', ') : '(none)'}
      </div>
      <pre>{JSON.stringify(encounter, null, 2)}</pre>
    </div>
  );
}
