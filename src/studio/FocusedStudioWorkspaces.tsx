import { useEffect, useMemo, useState } from 'react';
import type {
  LevelStudioPackage,
  MusicStudioPackage,
  StudioDependencyLock,
  StudioPackage,
  StudioWorkspace,
  TuningStudioPackage,
} from '../schemas/studioPackageSchema';
import { LevelMusicPanel } from '../features/levelMusic/LevelMusicPanel';
import {
  createTrackId,
  normalizeLevelMusicAssignment,
  slugifyTrackName,
  type MusicAssetRecord,
} from '../features/levelMusic/levelMusicCore';
import { importAudioFile } from './music/MusicResourceTools';
import type {
  SimulationArenaConfig,
  StudioRuntimeState,
} from '../schemas/studioSimulationSchema';
import { compileStudioWorkspace } from './ContentCompiler';
import {
  createReviewComment,
  resolveReviewComment,
  withReviewComment,
} from './PackageReview';
import { packageTypeOf } from './PackageTypes';
import type { ProductionCompileResult } from './ProductionCompiler';
import { createStableId } from './StableId';
import { buildTunableParameterCatalog, setTunableValue } from './simulation/TunableParameters';
import { diffTuningPackages } from './simulation/TuningDiff';
import { compareTelemetry, summarizeTelemetry } from './simulation/TelemetryComparison';

export function LevelWorkspace({
  editorRef,
  levelPack,
  musicPack,
  activeLevelId,
  onPackagesChange,
  onCapture,
  onLoad,
  onExport,
}: {
  editorRef: React.RefObject<HTMLIFrameElement | null>;
  levelPack: LevelStudioPackage;
  musicPack: MusicStudioPackage;
  activeLevelId?: string;
  onPackagesChange: (level: LevelStudioPackage, music: MusicStudioPackage) => void;
  onCapture: () => void;
  onLoad: () => void;
  onExport: () => void;
}) {
  const base = import.meta.env.BASE_URL || '/';
  const level =
    levelPack.payload.levels.find((item) => item.id === activeLevelId) ??
    levelPack.payload.levels[0];
  const [preview, setPreview] = useState<HTMLAudioElement | null>(null);
  const tracks = musicPack.payload.tracks as MusicAssetRecord[];

  const updateAssignment = (assignment: ReturnType<typeof normalizeLevelMusicAssignment>) => {
    if (!level) return;
    const nextLevel = structuredClone(levelPack);
    const target = nextLevel.payload.levels.find((item) => item.id === level.id);
    if (!target) return;
    target.levelMusic = assignment;
    target.music = target.music || 'none';
    nextLevel.manifest.updatedAt = new Date().toISOString();
    nextLevel.manifest.contentRevision += 1;
    onPackagesChange(nextLevel, musicPack);
  };

  const stopPreview = () => {
    preview?.pause();
    if (preview?.src.startsWith('blob:')) URL.revokeObjectURL(preview.src);
    setPreview(null);
  };

  useEffect(() => () => stopPreview(), [preview]);

  return (
    <div className="workspace-column">
      <div className="workspace-header">
        <div>
          <h2>Level Studio</h2>
          <p>
            {levelPack.manifest.name} · {levelPack.payload.levels.length} levels
          </p>
        </div>
        <div>
          <button onClick={onLoad}>Load Pack into Editor</button>
          <button onClick={onCapture}>Capture Working Copy</button>
          <button className="primary" onClick={onExport}>
            Export .sflevelpack
          </button>
        </div>
      </div>
      <iframe
        ref={editorRef}
        className="level-studio-frame"
        src={`${base}editor.html?embedded=1`}
        title="Skyforge Level Studio"
      />
      {level ? (
        <LevelMusicPanel
          tracks={tracks}
          value={level.levelMusic}
          onChange={updateAssignment}
          onImportMp3={async (file) => {
            if (file.type && file.type !== 'audio/mpeg' && file.type !== 'audio/mp3')
              throw new Error('Level music must be an MP3 file.');
            const resource = await importAudioFile(
              new File([await file.arrayBuffer()], file.name, { type: 'audio/mpeg' }),
            );
            if (!resource.sha256 || !resource.bytes || !resource.embeddedData)
              throw new Error('Imported MP3 did not produce complete integrity metadata.');
            const id = createTrackId(file.name, resource.sha256);
            const existing = musicPack.payload.tracks.find(
              (track) => track.sha256 === resource.sha256,
            );
            const track =
              existing ??
              ({
                id,
                displayName: slugifyTrackName(file.name)
                  .split('-')
                  .map((word) => word[0]?.toUpperCase() + word.slice(1))
                  .join(' '),
                fileName: file.name,
                relativePath: `assets/audio/music/${resource.sha256}.mp3`,
                resourceId: id,
                mimeType: 'audio/mpeg',
                byteLength: resource.bytes,
                sha256: resource.sha256,
                source: 'suno',
                importedAt: new Date().toISOString(),
              } as const);
            const nextMusic = structuredClone(musicPack);
            if (!existing) {
              nextMusic.payload.tracks.push(track);
              nextMusic.resources.push({
                ...resource,
                id,
                uri: track.relativePath,
                mediaType: 'audio/mpeg',
              });
              nextMusic.manifest.updatedAt = new Date().toISOString();
              nextMusic.manifest.contentRevision += 1;
            }
            const nextLevel = structuredClone(levelPack);
            const target = nextLevel.payload.levels.find((item) => item.id === level.id);
            if (!target) return;
            target.levelMusic = {
              ...normalizeLevelMusicAssignment(target.levelMusic),
              trackId: track.id,
            };
            nextLevel.manifest.updatedAt = new Date().toISOString();
            nextLevel.manifest.contentRevision += 1;
            onPackagesChange(nextLevel, nextMusic);
          }}
          onPreview={(track, assignment) => {
            stopPreview();
            const resource = musicPack.resources.find(
              (candidate) => candidate.id === track.id,
            );
            if (!resource?.embeddedData) throw new Error('Track bytes are missing.');
            const binary = atob(resource.embeddedData);
            const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
            const audio = new Audio(
              URL.createObjectURL(new Blob([bytes], { type: 'audio/mpeg' })),
            );
            audio.loop = assignment.loop;
            audio.volume = assignment.volume;
            audio.currentTime = assignment.startOffsetSeconds;
            setPreview(audio);
            return audio.play();
          }}
          onStopPreview={stopPreview}
          onRemoveTrack={(track) => {
            const references = levelPack.payload.levels.filter(
              (candidate) => candidate.levelMusic?.trackId === track.id,
            );
            if (references.length > 0)
              throw new Error(
                `Track is assigned to ${references.map((item) => item.displayName).join(', ')}.`,
              );
            const nextMusic = structuredClone(musicPack);
            nextMusic.payload.tracks = nextMusic.payload.tracks.filter(
              (candidate) => candidate.id !== track.id,
            );
            nextMusic.resources = nextMusic.resources.filter(
              (candidate) => candidate.id !== track.id,
            );
            onPackagesChange(levelPack, nextMusic);
          }}
        />
      ) : null}
    </div>
  );
}

export function TuningWorkspace({
  pkg,
  baseline,
  runtimeState,
  arena,
  differences,
  telemetryA,
  telemetryB,
  telemetryDelta,
  onArenaChange,
  onChange,
  onSetBaseline,
  onRestoreBaseline,
  onCaptureA,
  onCaptureB,
  onExportReport,
  onExport,
}: {
  pkg: TuningStudioPackage;
  baseline: TuningStudioPackage;
  runtimeState: StudioRuntimeState;
  arena: SimulationArenaConfig;
  differences: ReturnType<typeof diffTuningPackages>;
  telemetryA: ReturnType<typeof summarizeTelemetry>;
  telemetryB: ReturnType<typeof summarizeTelemetry>;
  telemetryDelta: ReturnType<typeof compareTelemetry>;
  onArenaChange: (arena: SimulationArenaConfig) => void;
  onChange: (pkg: TuningStudioPackage) => void;
  onSetBaseline: () => void;
  onRestoreBaseline: () => void;
  onCaptureA: () => void;
  onCaptureB: () => void;
  onExportReport: () => void;
  onExport: () => void;
}) {
  const catalog = useMemo(() => buildTunableParameterCatalog(pkg), [pkg]);
  const [category, setCategory] = useState<(typeof catalog)[number]['category']>('enemy');
  const owners = useMemo(
    () => [
      ...new Set(
        catalog.filter((item) => item.category === category).map((item) => item.ownerId),
      ),
    ],
    [catalog, category],
  );
  const [ownerId, setOwnerId] = useState(owners[0] ?? '');
  useEffect(() => {
    if (!owners.includes(ownerId)) setOwnerId(owners[0] ?? '');
  }, [owners, ownerId]);
  const parameters = catalog.filter(
    (item) => item.category === category && item.ownerId === ownerId,
  );

  const arenaOptions = useMemo(() => {
    switch (arena.type) {
      case 'enemy':
        return pkg.payload.enemies.map((item) => ({
          id: item.id,
          label: item.displayName,
        }));
      case 'weapon':
        return pkg.payload.weapons.map((item) => ({
          id: item.id,
          label: item.displayName,
        }));
      case 'formation':
        return pkg.payload.formations.map((item) => ({ id: item.id, label: item.id }));
      case 'encounter':
        return pkg.payload.encounters.map((item) => ({ id: item.id, label: item.id }));
      case 'boss':
        return pkg.payload.bosses.map((item) => ({
          id: item.id,
          label: item.displayName,
        }));
      default:
        return [];
    }
  }, [arena.type, pkg]);

  const changeArenaType = (type: SimulationArenaConfig['type']) => {
    const candidates = (() => {
      switch (type) {
        case 'enemy':
          return pkg.payload.enemies.map((item) => item.id);
        case 'weapon':
          return pkg.payload.weapons.map((item) => item.id);
        case 'formation':
          return pkg.payload.formations.map((item) => item.id);
        case 'encounter':
          return pkg.payload.encounters.map((item) => item.id);
        case 'boss':
          return pkg.payload.bosses.map((item) => item.id);
        default:
          return [];
      }
    })();
    onArenaChange({
      ...arena,
      type,
      id: candidates[0],
      autoFire: type === 'weapon' || type === 'loadout',
    });
  };

  return (
    <div className="workspace-scroll tuning-lab">
      <div className="workspace-header">
        <div>
          <h2>Simulation & Tuning Lab</h2>
          <p>
            {pkg.manifest.name} · live schema controls · {differences.length} changes from
            baseline
          </p>
        </div>
        <div>
          <button onClick={onSetBaseline}>Set A Baseline</button>
          <button onClick={onRestoreBaseline} disabled={differences.length === 0}>
            Restore Baseline
          </button>
          <button onClick={onExportReport}>Export Review</button>
          <button className="primary" onClick={onExport}>
            Export .sftuning
          </button>
        </div>
      </div>

      <div className="simulation-grid">
        <section className="studio-card arena-card">
          <h3>Isolated simulation arena</h3>
          <label className="field-stack">
            <span>Scope</span>
            <select
              value={arena.type}
              onChange={(event) =>
                changeArenaType(event.target.value as SimulationArenaConfig['type'])
              }
            >
              {(
                [
                  'level',
                  'enemy',
                  'weapon',
                  'formation',
                  'encounter',
                  'boss',
                  'route',
                  'loadout',
                ] as const
              ).map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          {arenaOptions.length > 0 && (
            <label className="field-stack">
              <span>Content</span>
              <select
                value={arena.id ?? arenaOptions[0]?.id}
                onChange={(event) => onArenaChange({ ...arena, id: event.target.value })}
              >
                {arenaOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="check-row">
            <input
              type="checkbox"
              checked={arena.repeat}
              onChange={(event) =>
                onArenaChange({ ...arena, repeat: event.target.checked })
              }
            />{' '}
            Repeat when cleared
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              checked={arena.autoFire}
              onChange={(event) =>
                onArenaChange({ ...arena, autoFire: event.target.checked })
              }
            />{' '}
            Auto-fire primary weapon
          </label>
          <TuningNumber
            label="Reset delay"
            value={arena.resetDelaySeconds}
            min={0}
            max={10}
            step={0.1}
            unit="s"
            onChange={(value) => onArenaChange({ ...arena, resetDelaySeconds: value })}
          />
          <button className="primary" onClick={() => onArenaChange({ ...arena })}>
            Reset Arena
          </button>
          <dl className="runtime-metrics">
            <div>
              <dt>Enemies</dt>
              <dd>{runtimeState.metrics?.activeEnemies ?? 0}</dd>
            </div>
            <div>
              <dt>Enemy bullets</dt>
              <dd>{runtimeState.metrics?.enemyProjectiles ?? 0}</dd>
            </div>
            <div>
              <dt>Survivability</dt>
              <dd>{Math.round((runtimeState.metrics?.survivability ?? 1) * 100)}%</dd>
            </div>
            <div>
              <dt>Intensity</dt>
              <dd>{Math.round((runtimeState.metrics?.intensity ?? 0) * 100)}%</dd>
            </div>
          </dl>
        </section>

        <section className="studio-card parameter-card">
          <h3>Schema-generated live controls</h3>
          <div className="parameter-filters">
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value as typeof category)}
            >
              {(
                [
                  'enemy',
                  'difficulty',
                  'projectile',
                  'movement',
                  'weapon',
                  'boss',
                  'encounter',
                ] as const
              ).map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <select value={ownerId} onChange={(event) => setOwnerId(event.target.value)}>
              {owners.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
          <div className="parameter-list">
            {parameters.map((parameter) => (
              <TuningNumber
                key={parameter.id}
                label={parameter.label}
                value={parameter.value}
                min={parameter.minimum}
                max={parameter.maximum}
                step={parameter.step}
                unit={parameter.unit}
                onChange={(value) =>
                  onChange(setTunableValue(pkg, parameter.path, value))
                }
              />
            ))}
            {parameters.length === 0 && (
              <p className="foundation-note">No numeric controls in this selection.</p>
            )}
          </div>
          <p className="live-note">
            Every change is validated, saved in the active tuning package, sent to the
            runtime, and applied on the next arena reset.
          </p>
        </section>

        <section className="studio-card ab-card">
          <h3>A/B runtime comparison</h3>
          <div className="ab-actions">
            <button onClick={onCaptureA}>
              Capture A ({runtimeState.telemetry.length} samples)
            </button>
            <button onClick={onCaptureB}>
              Capture B ({runtimeState.telemetry.length} samples)
            </button>
          </div>
          <table className="metric-table">
            <thead>
              <tr>
                <th>Metric</th>
                <th>A</th>
                <th>B</th>
                <th>Δ</th>
              </tr>
            </thead>
            <tbody>
              <MetricRow
                name="Mean enemies"
                a={telemetryA.meanEnemies}
                b={telemetryB.meanEnemies}
                delta={telemetryDelta.meanEnemies}
              />
              <MetricRow
                name="Peak bullets"
                a={telemetryA.peakEnemyProjectiles}
                b={telemetryB.peakEnemyProjectiles}
                delta={telemetryDelta.peakEnemyProjectiles}
              />
              <MetricRow
                name="Mean intensity"
                a={telemetryA.meanIntensity * 100}
                b={telemetryB.meanIntensity * 100}
                delta={telemetryDelta.meanIntensity * 100}
                suffix="%"
              />
              <MetricRow
                name="Min survivability"
                a={telemetryA.minimumSurvivability * 100}
                b={telemetryB.minimumSurvivability * 100}
                delta={telemetryDelta.minimumSurvivability * 100}
                suffix="%"
              />
              <MetricRow
                name="p95 frame"
                a={telemetryA.p95FrameMs}
                b={telemetryB.p95FrameMs}
                delta={telemetryDelta.p95FrameMs}
                suffix="ms"
              />
            </tbody>
          </table>
        </section>

        <section className="studio-card diff-card">
          <h3>Tuning diff</h3>
          <p>{baseline.manifest.name} → active candidate</p>
          <div className="diff-list">
            {differences.slice(0, 80).map((difference) => (
              <div key={difference.path}>
                <code>{difference.path}</code>
                <span>
                  {String(difference.before)} → {String(difference.after)}
                </span>
                {difference.percent !== undefined && (
                  <strong>
                    {difference.percent >= 0 ? '+' : ''}
                    {difference.percent.toFixed(1)}%
                  </strong>
                )}
              </div>
            ))}
            {differences.length === 0 && (
              <p className="ok">Active tuning matches the A baseline.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function MetricRow({
  name,
  a,
  b,
  delta,
  suffix = '',
}: {
  name: string;
  a: number;
  b: number;
  delta: number;
  suffix?: string;
}) {
  const show = (value: number) =>
    `${Number.isFinite(value) ? value.toFixed(2) : '0.00'}${suffix}`;
  return (
    <tr>
      <th>{name}</th>
      <td>{show(a)}</td>
      <td>{show(b)}</td>
      <td className={delta > 0 ? 'warning' : delta < 0 ? 'ok' : ''}>
        {delta >= 0 ? '+' : ''}
        {show(delta)}
      </td>
    </tr>
  );
}

function TuningNumber({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="tuning-row">
      <span>
        {label}
        {unit ? <small> {unit}</small> : null}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

export function BuildWorkspace({
  packages,
  workspace,
  result,
  onExportAll,
  onExportBuild,
  lock,
  productionResult,
  productionCompiling,
  onExportLock,
  onCompileProduction,
  onExportProduction,
  onPackageChange,
}: {
  packages: StudioPackage[];
  workspace: StudioWorkspace;
  result: ReturnType<typeof compileStudioWorkspace>;
  onExportAll: () => void;
  onExportBuild: () => void;
  lock: StudioDependencyLock;
  productionResult: ProductionCompileResult | null;
  productionCompiling: boolean;
  onExportLock: () => void;
  onCompileProduction: () => void;
  onExportProduction: () => void;
  onPackageChange: (pkg: StudioPackage) => void;
}) {
  const [reviewPackageKey, setReviewPackageKey] = useState(
    `${packageTypeOf(packages[0]!)}:${packages[0]!.manifest.id}`,
  );
  const [reviewPath, setReviewPath] = useState('/');
  const [reviewBody, setReviewBody] = useState('');
  const [reviewSeverity, setReviewSeverity] = useState<
    'note' | 'suggestion' | 'blocking'
  >('note');
  const selectedReviewPackage = packages.find(
    (pkg) => `${packageTypeOf(pkg)}:${pkg.manifest.id}` === reviewPackageKey,
  );
  return (
    <div className="workspace-scroll">
      <div className="workspace-header">
        <div>
          <h2>Package Compiler</h2>
          <p>
            {workspace.id} · resolve, validate, and assemble the active collaborative
            package set.
          </p>
        </div>
        <div>
          <button onClick={onExportBuild} disabled={!result.build}>
            Export Compiled Manifest
          </button>
          <button onClick={onExportLock}>Export Dependency Lock</button>
          <button onClick={onCompileProduction} disabled={productionCompiling}>
            {productionCompiling ? 'Compiling…' : 'Production Compile'}
          </button>
          <button onClick={onExportProduction} disabled={!productionResult?.manifest}>
            Export Release Manifest
          </button>
          <button className="primary" onClick={onExportAll}>
            Export Workspace + 4 Packs
          </button>
        </div>
      </div>
      <div className="package-grid">
        {packages.map((pkg) => (
          <article className="studio-card" key={`${pkg.format}:${pkg.manifest.id}`}>
            <strong>{pkg.manifest.name}</strong>
            <span>
              {packageTypeOf(pkg)} · {pkg.manifest.version}
            </span>
            <small>{pkg.manifest.id}</small>
            <small>
              r{pkg.manifest.contentRevision} · {pkg.manifest.dependencies.length}{' '}
              dependencies · {pkg.resources.length} resources ·{' '}
              {pkg.reviewComments.filter((comment) => comment.status === 'open').length}{' '}
              open comments
            </small>
          </article>
        ))}
      </div>
      <section className="studio-card compile-report">
        <h3>Compile report</h3>
        {result.issues.length === 0 && <p className="ok">No issues.</p>}
        {result.issues.map((issue, index) => (
          <p key={`${issue.code}-${index}`} className={issue.severity}>
            {issue.severity.toUpperCase()}: {issue.message}
          </p>
        ))}
        {result.build && <pre>{JSON.stringify(result.build, null, 2)}</pre>}
      </section>
      <section className="studio-card">
        <h3>Dependency lock</h3>
        <pre>{JSON.stringify(lock, null, 2)}</pre>
      </section>
      <section className="studio-card compile-report">
        <h3>Production compiler</h3>
        {!productionResult && (
          <p>Run production compilation to hash live resources and report dead files.</p>
        )}
        {productionResult?.issues.map((issue, index) => (
          <p key={`production-${issue.code}-${index}`} className={issue.severity}>
            {issue.severity.toUpperCase()}: {issue.message}
          </p>
        ))}
        {productionResult?.manifest && (
          <>
            <p className="ok">
              {productionResult.manifest.resources.length} live resources ·{' '}
              {productionResult.manifest.removedResources.length} removed
            </p>
            <pre>{JSON.stringify(productionResult.manifest, null, 2)}</pre>
          </>
        )}
      </section>
      <section className="studio-card review-panel">
        <h3>Collaborative review comments</h3>
        <div className="review-grid">
          <label>
            Package
            <select
              value={reviewPackageKey}
              onChange={(event) => setReviewPackageKey(event.target.value)}
            >
              {packages.map((pkg) => {
                const key = `${packageTypeOf(pkg)}:${pkg.manifest.id}`;
                return (
                  <option key={key} value={key}>
                    {key}
                  </option>
                );
              })}
            </select>
          </label>
          <label>
            JSON path
            <input
              value={reviewPath}
              onChange={(event) => setReviewPath(event.target.value)}
            />
          </label>
          <label>
            Severity
            <select
              value={reviewSeverity}
              onChange={(event) =>
                setReviewSeverity(event.target.value as typeof reviewSeverity)
              }
            >
              <option value="note">note</option>
              <option value="suggestion">suggestion</option>
              <option value="blocking">blocking</option>
            </select>
          </label>
          <label className="review-body">
            Comment
            <textarea
              value={reviewBody}
              onChange={(event) => setReviewBody(event.target.value)}
            />
          </label>
          <button
            disabled={!selectedReviewPackage || !reviewBody.trim()}
            onClick={() => {
              if (!selectedReviewPackage || !reviewBody.trim()) return;
              onPackageChange(
                withReviewComment(
                  selectedReviewPackage,
                  createReviewComment({
                    id: createStableId('review'),
                    author: 'Marty Hlavacek',
                    body: reviewBody.trim(),
                    targetPath: reviewPath || '/',
                    severity: reviewSeverity,
                  }),
                ),
              );
              setReviewBody('');
            }}
          >
            Add review comment
          </button>
        </div>
        {selectedReviewPackage?.reviewComments.length ? (
          selectedReviewPackage.reviewComments.map((comment) => (
            <div className={`review-comment ${comment.status}`} key={comment.id}>
              <strong>
                {comment.severity.toUpperCase()} · {comment.targetPath}
              </strong>
              <span>{comment.body}</span>
              <small>
                {comment.author} · {comment.status}
              </small>
              {comment.status === 'open' && (
                <button
                  onClick={() =>
                    onPackageChange(
                      resolveReviewComment(selectedReviewPackage, comment.id),
                    )
                  }
                >
                  Resolve
                </button>
              )}
            </div>
          ))
        ) : (
          <p>No review comments for this package.</p>
        )}
      </section>
      <section className="studio-card">
        <h3>Git folder mode</h3>
        <p>Use the repository-safe CLI to unpack or repack any package:</p>
        <pre>
          npm run studio:unpack -- package.sfassetpack ./asset-pack npm run studio:pack --
          ./asset-pack package.sfassetpack
        </pre>
      </section>
    </div>
  );
}
