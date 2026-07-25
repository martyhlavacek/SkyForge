import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  AssetStudioPackage,
  LevelStudioPackage,
  MusicStudioPackage,
  StudioPackage,
  StudioPackageType,
  StudioWorkspace,
  StudioDependencyLock,
  TuningStudioPackage,
} from '../schemas/studioPackageSchema';
import { StudioPackageSchema } from '../schemas/studioPackageSchema';
import {
  SimulationArenaConfigSchema,
  StudioRuntimeStateSchema,
  type RuntimeTelemetrySeriesPoint,
  type SimulationArenaConfig,
  type StudioRuntimeState,
} from '../schemas/studioSimulationSchema';
import { createBuiltInStudioPackages, createBuiltInWorkspace } from './BuiltInPackages';
import { compileStudioWorkspace } from './ContentCompiler';
import {
  createDependencyLock,
  parseDependencyLock,
  serializeDependencyLock,
} from './DependencyLock';
import {
  compileProductionWorkspace,
  type ProductionCompileResult,
} from './ProductionCompiler';
import {
  parseStudioPackage,
  parseStudioWorkspace,
  serializeStudioPackage,
  serializeStudioWorkspace,
  studioPackageFilename,
} from './PackageCodec';
import { packageTypeOf } from './PackageTypes';
import {
  loadStudioPackages,
  loadStudioWorkspace,
  saveStudioPackages,
  saveStudioWorkspace,
} from './WorkspaceStore';
import { analyzeAttention } from './simulation/AttentionAnalyzer';
import { diffTuningPackages, tuningReviewMarkdown } from './simulation/TuningDiff';
import { compareTelemetry, summarizeTelemetry } from './simulation/TelemetryComparison';
import {
  BuildWorkspace,
  LevelWorkspace,
  TuningWorkspace,
} from './FocusedStudioWorkspaces';
import { AssetStudioWorkspace } from './assets/AssetStudioWorkspace';
import { verifyAssetPackageResources } from './assets/AssetResourceTools';
import { verifyMusicPackageResources } from './music/MusicResourceTools';
import {
  loadMusicPackageFromIndexedDb,
  saveMusicPackageToIndexedDb,
} from './music/MusicPackageStorage';
import type { AssetPreviewContext } from './assets/AssetPreviewCanvas';
import {
  loadAssetPackageFromIndexedDb,
  saveAssetPackageToIndexedDb,
} from './assets/AssetPackageStorage';
import './studio.css';

type StudioTab = 'level' | 'tuning' | 'asset' | 'build';

function download(name: string, text: string): void {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function packageFor<T extends StudioPackage>(
  packages: StudioPackage[],
  type: StudioPackageType,
): T {
  const pkg = packages.find((item) => packageTypeOf(item) === type);
  if (!pkg) throw new Error(`missing ${type} package`);
  return pkg as T;
}

function replacePackage(packages: StudioPackage[], next: StudioPackage): StudioPackage[] {
  const type = packageTypeOf(next);
  return [...packages.filter((item) => packageTypeOf(item) !== type), next];
}

function refFor(pkg: StudioPackage) {
  return {
    type: packageTypeOf(pkg),
    id: pkg.manifest.id,
    version: pkg.manifest.version,
  } as const;
}

function formatTime(seconds: number): string {
  const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const minutes = Math.floor(safe / 60);
  const remainder = safe - minutes * 60;
  return `${minutes}:${remainder.toFixed(1).padStart(4, '0')}`;
}

function RuntimeHeatmap({
  points,
  duration,
}: {
  points: RuntimeTelemetrySeriesPoint[];
  duration: number;
}) {
  const recent = points.slice(-240);
  return (
    <div className="runtime-heatmap">
      <div className="heatmap-bars">
        {recent.length === 0 ? (
          <span className="heatmap-empty">Telemetry appears after playback starts.</span>
        ) : (
          recent.map((point, index) => (
            <span
              key={`${point.time}-${index}`}
              className="heatmap-bar"
              style={{
                height: `${Math.max(4, point.intensity * 100)}%`,
                opacity: 0.35 + point.intensity * 0.65,
              }}
              title={`${formatTime(point.time)} · intensity ${Math.round(point.intensity * 100)}% · ${point.activeEnemies} enemies · ${point.enemyProjectiles} enemy bullets`}
            />
          ))
        )}
      </div>
      <small>
        {recent.length} samples · {formatTime(duration)} authored duration
      </small>
    </div>
  );
}

export function StudioApp() {
  const [packages, setPackages] = useState<StudioPackage[]>(
    () => loadStudioPackages() ?? createBuiltInStudioPackages(),
  );
  const [workspace, setWorkspace] = useState<StudioWorkspace>(() => {
    const stored = loadStudioWorkspace();
    return stored ?? createBuiltInWorkspace();
  });
  const [tab, setTab] = useState<StudioTab>('level');
  const [importMessage, setImportMessage] = useState<string>('');
  const [dependencyLock, setDependencyLock] = useState<StudioDependencyLock | null>(null);
  const [productionResult, setProductionResult] =
    useState<ProductionCompileResult | null>(null);
  const [productionCompiling, setProductionCompiling] = useState(false);
  const [runtimeSrc, setRuntimeSrc] = useState<string | null>(null);
  const [runtimeExpanded, setRuntimeExpanded] = useState(false);
  const [runtimeHidden, setRuntimeHidden] = useState(false);
  const [runtimeState, setRuntimeState] = useState<StudioRuntimeState>({
    snapshots: [],
    telemetry: [],
  });
  const [arena, setArena] = useState<SimulationArenaConfig>({
    type: 'level',
    levelId: workspace.activeLevelId ?? 'level_01',
    autoFire: false,
    repeat: true,
    resetDelaySeconds: 1.5,
  });
  const [timeScale, setTimeScale] = useState(1);
  const [snapshotInterval, setSnapshotInterval] = useState(5);
  const [loopEnabled, setLoopEnabled] = useState(false);
  const [loopIn, setLoopIn] = useState(0);
  const [loopOut, setLoopOut] = useState(30);
  const [telemetryA, setTelemetryA] = useState<RuntimeTelemetrySeriesPoint[]>([]);
  const [telemetryB, setTelemetryB] = useState<RuntimeTelemetrySeriesPoint[]>([]);
  const [seekTime, setSeekTime] = useState(0);
  const [runtimeNonce, setRuntimeNonce] = useState(0);
  const runtimeRef = useRef<HTMLIFrameElement>(null);
  const runtimeSession = useRef(
    globalThis.crypto?.randomUUID?.() ?? `studio-${Date.now()}`,
  );
  const levelEditorRef = useRef<HTMLIFrameElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const pendingLevelRequest = useRef<string | null>(null);

  const levelPack = packageFor<LevelStudioPackage>(packages, 'level');
  const tuningPack = packageFor<TuningStudioPackage>(packages, 'tuning');
  const musicPack = packageFor<MusicStudioPackage>(packages, 'music');
  const assetPack = packageFor<AssetStudioPackage>(packages, 'asset');
  const [baselineTuning, setBaselineTuning] = useState<TuningStudioPackage>(() =>
    structuredClone(packageFor<TuningStudioPackage>(packages, 'tuning')),
  );
  const attention = useMemo(
    () =>
      analyzeAttention(
        levelPack,
        tuningPack,
        workspace.activeLevelId ?? levelPack.payload.levels[0]?.id ?? 'level_01',
      ),
    [levelPack, tuningPack, workspace.activeLevelId],
  );
  const compileResult = useMemo(
    () => compileStudioWorkspace(workspace, packages),
    [workspace, packages],
  );
  const currentLock = useMemo(
    () => createDependencyLock(workspace, packages, workspace.updatedAt),
    [workspace, packages],
  );

  useEffect(() => saveStudioWorkspace(workspace), [workspace]);
  useEffect(() => saveStudioPackages(packages), [packages]);
  useEffect(() => {
    void loadAssetPackageFromIndexedDb().then((stored) => {
      if (!stored) return;
      setPackages((current) => replacePackage(current, stored));
    });
  }, []);
  useEffect(() => {
    void saveAssetPackageToIndexedDb(assetPack);
  }, [assetPack]);

  useEffect(() => {
    void loadMusicPackageFromIndexedDb().then((stored) => {
      if (!stored) return;
      setPackages((current) => replacePackage(current, stored));
    });
  }, []);
  useEffect(() => {
    void saveMusicPackageToIndexedDb(musicPack);
  }, [musicPack]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as {
        type?: string;
        requestId?: string;
        package?: unknown;
        state?: unknown;
        session?: string;
      };
      if (data.type === 'skyforge-studio-level-package' && data.package) {
        if (data.requestId !== pendingLevelRequest.current) return;
        const parsed = StudioPackageSchema.safeParse(data.package);
        if (!parsed.success || parsed.data.format !== 'skyforge-level-pack') return;
        const levelPackage = parsed.data as LevelStudioPackage;
        setPackages((current) => replacePackage(current, levelPackage));
        setWorkspace((current) => ({
          ...current,
          packages: {
            ...current.packages,
            level: refFor(levelPackage) as StudioWorkspace['packages']['level'],
          },
          activeLevelId: levelPackage.payload.levels[0]?.id,
          updatedAt: new Date().toISOString(),
        }));
        setImportMessage(`Captured ${levelPackage.manifest.name} from Level Studio.`);
        pendingLevelRequest.current = null;
      }
      if (
        data.type === 'skyforge-studio-state' &&
        data.session === runtimeSession.current &&
        data.state
      ) {
        const parsedState = StudioRuntimeStateSchema.safeParse(data.state);
        if (!parsedState.success) return;
        setRuntimeState(parsedState.data);
        if (typeof parsedState.data.levelTime === 'number')
          setSeekTime(parsedState.data.levelTime);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const updatePackage = (next: StudioPackage) => {
    setPackages((current) => replacePackage(current, next));
    const type = packageTypeOf(next);
    setWorkspace((current) => ({
      ...current,
      packages: {
        ...current.packages,
        [type]: refFor(next),
      } as StudioWorkspace['packages'],
      updatedAt: new Date().toISOString(),
    }));
  };

  const requestLevelPackage = () => {
    const requestId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`;
    pendingLevelRequest.current = requestId;
    levelEditorRef.current?.contentWindow?.postMessage(
      { type: 'skyforge-studio-request-level-package', requestId },
      window.location.origin,
    );
  };

  const loadLevelPackIntoEditor = () => {
    levelEditorRef.current?.contentWindow?.postMessage(
      { type: 'skyforge-studio-load-level-package', package: levelPack },
      window.location.origin,
    );
  };

  const exportPackage = (type: StudioPackageType) => {
    const pkg = packages.find((item) => packageTypeOf(item) === type);
    if (!pkg) return;
    download(studioPackageFilename(pkg), serializeStudioPackage(pkg));
  };

  const exportAll = () => {
    packages.forEach((pkg, index) => {
      window.setTimeout(
        () => download(studioPackageFilename(pkg), serializeStudioPackage(pkg)),
        index * 100,
      );
    });
    window.setTimeout(
      () => download(`${workspace.id}.sfworkspace`, serializeStudioWorkspace(workspace)),
      packages.length * 100,
    );
    window.setTimeout(
      () => download(`${workspace.id}.sflock`, serializeDependencyLock(currentLock)),
      (packages.length + 1) * 100,
    );
  };

  const importFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    let nextPackages = [...packages];
    let nextWorkspace = workspace;
    const messages: string[] = [];
    for (const file of [...files]) {
      try {
        const text = await file.text();
        const raw = JSON.parse(text) as { format?: string };
        if (raw.format === 'skyforge-lock') {
          const lock = parseDependencyLock(text);
          setDependencyLock(lock);
          messages.push(`lock ${lock.workspace.id}`);
        } else if (raw.format === 'skyforge-workspace') {
          nextWorkspace = parseStudioWorkspace(text);
          messages.push(`workspace ${nextWorkspace.name}`);
        } else {
          const pkg = parseStudioPackage(text);
          if (pkg.format === 'skyforge-asset-pack')
            await verifyAssetPackageResources(pkg.resources);
          if (pkg.format === 'skyforge-music-pack')
            await verifyMusicPackageResources(pkg.resources);
          nextPackages = replacePackage(nextPackages, pkg);
          const type = packageTypeOf(pkg);
          nextWorkspace = {
            ...nextWorkspace,
            packages: {
              ...nextWorkspace.packages,
              [type]: refFor(pkg),
            } as StudioWorkspace['packages'],
            activeLevelId:
              pkg.format === 'skyforge-level-pack'
                ? pkg.payload.levels[0]?.id
                : nextWorkspace.activeLevelId,
            updatedAt: new Date().toISOString(),
          };
          messages.push(`${type} ${pkg.manifest.name}`);
        }
      } catch (error) {
        messages.push(
          `${file.name}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    setPackages(nextPackages);
    setWorkspace(nextWorkspace);
    setImportMessage(`Imported: ${messages.join(', ')}`);
  };

  const startRuntime = () => {
    runtimeSession.current = globalThis.crypto?.randomUUID?.() ?? `studio-${Date.now()}`;
    const base = import.meta.env.BASE_URL || '/';
    const levelId =
      workspace.activeLevelId ?? levelPack.payload.levels[0]?.id ?? 'level_01';
    const query = new URLSearchParams({
      level: levelId,
      preview: '1',
      studio: '1',
      arena: arena.type,
      session: runtimeSession.current,
    });
    if (arena.id) query.set('arenaId', arena.id);
    setRuntimeSrc(`${base}index.html?${query.toString()}`);
    setRuntimeNonce((value) => value + 1);
  };

  const sendRuntime = (command: string, value?: unknown) => {
    runtimeRef.current?.contentWindow?.postMessage(
      {
        type: 'skyforge-studio-command',
        command,
        value,
        session: runtimeSession.current,
      },
      window.location.origin,
    );
  };

  const applyLiveTuning = (next: TuningStudioPackage) => {
    updatePackage(next);
    sendRuntime('applyTuning', next);
  };

  const configureArena = (next: SimulationArenaConfig) => {
    const parsed = SimulationArenaConfigSchema.parse(next);
    setArena(parsed);
    sendRuntime('configureArena', parsed);
  };

  const syncRuntime = () => {
    sendRuntime('applyTuning', tuningPack);
    sendRuntime('applyAssets', assetPack);
    sendRuntime('applyMusic', musicPack);
    sendRuntime('configureArena', arena);
    sendRuntime('setTimeScale', timeScale);
    sendRuntime('setSnapshotInterval', snapshotInterval);
    sendRuntime('setInvulnerable', true);
  };

  useEffect(() => {
    if (!runtimeSrc || !loopEnabled || runtimeState.paused) return;
    const current = runtimeState.levelTime ?? 0;
    if (current >= loopOut && loopOut > loopIn) sendRuntime('seek', loopIn);
  }, [
    runtimeSrc,
    loopEnabled,
    loopIn,
    loopOut,
    runtimeState.levelTime,
    runtimeState.paused,
  ]);

  const tuningDifferences = useMemo(
    () => diffTuningPackages(baselineTuning, tuningPack),
    [baselineTuning, tuningPack],
  );
  const telemetrySummaryA = useMemo(() => summarizeTelemetry(telemetryA), [telemetryA]);
  const telemetrySummaryB = useMemo(() => summarizeTelemetry(telemetryB), [telemetryB]);
  const telemetryDelta = useMemo(
    () => compareTelemetry(telemetrySummaryA, telemetrySummaryB),
    [telemetrySummaryA, telemetrySummaryB],
  );

  return (
    <div
      className={`studio-shell${runtimeExpanded ? ' runtime-expanded' : ''}${runtimeHidden ? ' runtime-hidden' : ''}`}
    >
      <header className="studio-toolbar">
        <div>
          <h1>SKYFORGE GAME DESIGN STUDIO</h1>
          <span>
            {workspace.name} · {workspace.version}
          </span>
        </div>
        <div className="studio-tabs" role="tablist">
          {(['level', 'tuning', 'asset', 'build'] as StudioTab[]).map(
            (value) => (
              <button
                key={value}
                className={tab === value ? 'active' : ''}
                onClick={() => setTab(value)}
              >
                {value === 'asset' ? 'Assets' : value[0].toUpperCase() + value.slice(1)}
              </button>
            ),
          )}
        </div>
        <div className="studio-actions">
          <button onClick={() => setRuntimeHidden((value) => !value)}>
            {runtimeHidden ? 'Show Runtime' : 'Hide Runtime'}
          </button>
          <button onClick={() => fileInput.current?.click()}>Import</button>
          <button
            onClick={() =>
              download(`${workspace.id}.sfworkspace`, serializeStudioWorkspace(workspace))
            }
          >
            Export Workspace
          </button>
          <button className="primary" onClick={exportAll}>
            Export 4 Packs
          </button>
          <input
            ref={fileInput}
            type="file"
            multiple
            hidden
            accept=".sflevelpack,.sftuning,.sfmusic,.sfassetpack,.sfworkspace,.sflock,application/json"
            onChange={(event) => void importFiles(event.target.files)}
          />
        </div>
      </header>

      <main className="studio-main">
        <section className="studio-workspace">
          {tab === 'level' && (
            <LevelWorkspace
              editorRef={levelEditorRef}
              levelPack={levelPack}
              onCapture={requestLevelPackage}
              onLoad={loadLevelPackIntoEditor}
              onExport={() => exportPackage('level')}
            />
          )}
          {tab === 'tuning' && (
            <TuningWorkspace
              pkg={tuningPack}
              baseline={baselineTuning}
              runtimeState={runtimeState}
              arena={arena}
              differences={tuningDifferences}
              telemetryA={telemetrySummaryA}
              telemetryB={telemetrySummaryB}
              telemetryDelta={telemetryDelta}
              onArenaChange={configureArena}
              onChange={applyLiveTuning}
              onSetBaseline={() => setBaselineTuning(structuredClone(tuningPack))}
              onRestoreBaseline={() => {
                const restored = structuredClone(baselineTuning);
                applyLiveTuning(restored);
              }}
              onCaptureA={() => setTelemetryA(structuredClone(runtimeState.telemetry))}
              onCaptureB={() => setTelemetryB(structuredClone(runtimeState.telemetry))}
              onExportReport={() =>
                download(
                  `${tuningPack.manifest.id}-review.md`,
                  tuningReviewMarkdown(baselineTuning, tuningPack, tuningDifferences),
                )
              }
              onExport={() => exportPackage('tuning')}
            />
          )}
          {tab === 'asset' && (
            <AssetStudioWorkspace
              pkg={assetPack}
              tuningPack={tuningPack}
              onChange={updatePackage}
              onTuningChange={applyLiveTuning}
              onExport={() => exportPackage('asset')}
              onPreviewRuntime={(assetId: string, context: AssetPreviewContext) => {
                sendRuntime('applyAssets', assetPack);
                sendRuntime('previewAsset', { assetId, context });
              }}
            />
          )}
          {tab === 'build' && (
            <BuildWorkspace
              packages={packages}
              workspace={workspace}
              result={compileResult}
              onExportAll={exportAll}
              onPackageChange={updatePackage}
              lock={dependencyLock ?? currentLock}
              productionResult={productionResult}
              productionCompiling={productionCompiling}
              onExportLock={() =>
                download(`${workspace.id}.sflock`, serializeDependencyLock(currentLock))
              }
              onCompileProduction={() => {
                setProductionCompiling(true);
                void compileProductionWorkspace(
                  workspace,
                  packages,
                  dependencyLock ?? currentLock,
                  {
                    generatedAt: new Date().toISOString(),
                    baseUrl: import.meta.env.BASE_URL || '/',
                    requireLock: true,
                  },
                )
                  .then(setProductionResult)
                  .finally(() => setProductionCompiling(false));
              }}
              onExportProduction={() => {
                if (!productionResult?.manifest) return;
                download(
                  `${workspace.id}.sfrelease.json`,
                  `${JSON.stringify(productionResult.manifest, null, 2)}\n`,
                );
              }}
              onExportBuild={() => {
                if (!compileResult.build) return;
                download(
                  `${workspace.id}.sfbuild.json`,
                  `${JSON.stringify(compileResult.build, null, 2)}\n`,
                );
              }}
            />
          )}
        </section>

        {!runtimeHidden && (
          <aside className="runtime-dock">
            <div className="panel-heading">
              <div>
                <strong>Simulation Runtime</strong>
                <small>
                  {runtimeState.levelId ?? workspace.activeLevelId ?? 'not started'} ·{' '}
                  {arena.type}
                  {arena.id ? ` / ${arena.id}` : ''}
                </small>
              </div>
              <div className="runtime-heading-actions">
                <button
                  onClick={() => setRuntimeExpanded((value) => !value)}
                  title="Toggle an expanded, uncropped simulation view"
                >
                  {runtimeExpanded ? 'Restore Studio' : 'Expand'}
                </button>
                <button
                  onClick={() => {
                    if (!runtimeSrc) startRuntime();
                    else
                      window.open(
                        runtimeSrc,
                        'skyforge-runtime-preview',
                        'popup,width=720,height=980',
                      );
                  }}
                  title="Open the simulation in a separate window"
                >
                  Pop Out
                </button>
                <button className="primary" onClick={startRuntime}>
                  {runtimeSrc ? 'Reload' : 'Start'}
                </button>
              </div>
            </div>
            <div className="runtime-controls transport-controls">
              <button onClick={() => sendRuntime('step', -0.25)} disabled={!runtimeSrc}>
                ◀ Step
              </button>
              <button
                onClick={() => sendRuntime(runtimeState.paused ? 'resume' : 'pause')}
                disabled={!runtimeSrc}
              >
                {runtimeState.paused ? '▶ Play' : 'Ⅱ Pause'}
              </button>
              <button onClick={() => sendRuntime('step', 0.25)} disabled={!runtimeSrc}>
                Step ▶
              </button>
              <button onClick={() => sendRuntime('restart')} disabled={!runtimeSrc}>
                Restart
              </button>
              <select
                aria-label="Playback speed"
                value={timeScale}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setTimeScale(value);
                  sendRuntime('setTimeScale', value);
                }}
              >
                {[0.25, 0.5, 1, 2, 4].map((value) => (
                  <option key={value} value={value}>
                    {value}×
                  </option>
                ))}
              </select>
              <select
                aria-label="Snapshot interval"
                value={snapshotInterval}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setSnapshotInterval(value);
                  sendRuntime('setSnapshotInterval', value);
                }}
                title="Snapshot interval"
              >
                {[2, 5, 10].map((value) => (
                  <option key={value} value={value}>
                    Snapshot {value}s
                  </option>
                ))}
              </select>
            </div>
            <div className="runtime-timeline">
              <div className="timeline-title">
                <span>
                  {formatTime(seekTime)} / {formatTime(runtimeState.duration ?? 0)}
                </span>
                <span>
                  {runtimeState.snapshots.length} snapshots ·{' '}
                  {runtimeState.snapshotInterval ?? snapshotInterval}s
                </span>
              </div>
              <div className="timeline-track-wrap">
                <input
                  className="timeline-range"
                  type="range"
                  min={0}
                  max={
                    runtimeState.duration ??
                    levelPack.payload.levels.find(
                      (level) => level.id === workspace.activeLevelId,
                    )?.durationTarget ??
                    250
                  }
                  step={0.1}
                  value={seekTime}
                  onChange={(event) => setSeekTime(Number(event.target.value))}
                  onPointerUp={() => sendRuntime('seek', seekTime)}
                  onKeyUp={() => sendRuntime('seek', seekTime)}
                />
                <div className="timeline-markers" aria-hidden="true">
                  {attention.markers.map((marker) => (
                    <span
                      key={marker.id}
                      className={`timeline-marker marker-${marker.kind}`}
                      style={{
                        left: `${Math.min(100, (marker.at / Math.max(1, runtimeState.duration ?? 1)) * 100)}%`,
                      }}
                      title={`${formatTime(marker.at)} ${marker.label}`}
                    />
                  ))}
                </div>
              </div>
              <div className="loop-controls">
                <label>
                  <input
                    type="checkbox"
                    checked={loopEnabled}
                    onChange={(event) => setLoopEnabled(event.target.checked)}
                  />{' '}
                  Loop
                </label>
                <button onClick={() => setLoopIn(seekTime)}>
                  In {formatTime(loopIn)}
                </button>
                <button onClick={() => setLoopOut(seekTime)}>
                  Out {formatTime(loopOut)}
                </button>
              </div>
              <div className="attention-jumps">
                {attention.markers.slice(0, 18).map((marker) => (
                  <button
                    key={marker.id}
                    className={`marker-button marker-${marker.kind}`}
                    onClick={() => {
                      setSeekTime(marker.at);
                      sendRuntime('seek', marker.at);
                    }}
                  >
                    {formatTime(marker.at)} {marker.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="runtime-frame">
              {runtimeSrc ? (
                <iframe
                  key={runtimeNonce}
                  ref={runtimeRef}
                  src={runtimeSrc}
                  title="Skyforge shared runtime"
                  allow="autoplay; gamepad"
                  onLoad={() => window.setTimeout(syncRuntime, 120)}
                />
              ) : (
                <div className="empty-state">
                  Start the embedded runtime, choose a simulation arena, then tune against
                  the real game systems.
                </div>
              )}
            </div>
            <RuntimeHeatmap
              points={runtimeState.telemetry}
              duration={runtimeState.duration ?? 0}
            />
            <div className="runtime-status">
              <span>Scene: {runtimeState.scene ?? '—'}</span>
              <span>Time: {runtimeState.levelTime?.toFixed(1) ?? '—'}</span>
              <span>Enemies: {runtimeState.metrics?.activeEnemies ?? 0}</span>
              <span>
                Bullets:{' '}
                {(runtimeState.metrics?.enemyProjectiles ?? 0) +
                  (runtimeState.metrics?.playerProjectiles ?? 0)}
              </span>
              <span>
                {runtimeState.paused
                  ? 'Paused'
                  : `Running ${runtimeState.timeScale ?? timeScale}×`}
              </span>
            </div>
            <p className="foundation-note">
              Epoch 13 adds live tuning, isolated arenas, snapshot-assisted transport,
              attention markers, telemetry heatmaps, and A/B review using this shared
              runtime.
            </p>
          </aside>
        )}
      </main>

      <footer className="studio-footer">
        <span>
          {importMessage ||
            'Portable JSON package mode · data only · no executable scripts'}
        </span>
        <span className={compileResult.build ? 'ok' : 'error'}>
          {compileResult.build
            ? `Compile OK · ${compileResult.build.fingerprint}`
            : `${compileResult.issues.filter((issue) => issue.severity === 'error').length} compile errors`}
        </span>
      </footer>
    </div>
  );
}
