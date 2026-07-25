import { contentRegistry } from '../game/systems/ContentRegistry';
import type { WorkingLevel } from './levelStore';

export function IntensityStrip({ level }: { level: WorkingLevel | null }) {
  if (!level) return <div className="intensity" />;
  const sorted = [...level.events].sort((a, b) => a.value.at - b.value.at);
  return (
    <div className="intensity" title="difficulty over time">
      {sorted.map((working) => {
        const event = working.value;
        if ('encounter' in event) {
          const difficulty =
            contentRegistry.encounters.get(event.encounter)?.difficulty ?? 1;
          return (
            <div
              key={working.editorId}
              className={`bar d${difficulty}`}
              style={{ height: `${difficulty * 18 + 6}%` }}
              title={`${event.at}s ${event.encounter} (difficulty ${difficulty})`}
            />
          );
        }
        if (event.type === 'recovery')
          return (
            <div
              key={working.editorId}
              className="bar recovery"
              style={{ height: '15%' }}
              title={`${event.at}s recovery ${event.duration}s`}
            />
          );
        if (event.type === 'terrainState')
          return (
            <div
              key={working.editorId}
              className="bar terrain"
              style={{ height: '55%' }}
              title={`${event.at}s ${event.target} → ${event.state}`}
            />
          );
        return (
          <div
            key={working.editorId}
            className="bar checkpoint"
            title={`${event.at}s checkpoint`}
          />
        );
      })}
    </div>
  );
}
