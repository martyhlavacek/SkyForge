import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { EditorProject } from './projectStore';
import {
  analyzeRoutes,
  analyzeTerrainCombatPressure,
} from '../game/terrain/TerrainAnalysis';
import {
  boundaryOverlayCells,
  withCardinalVariants,
} from '../game/terrain/Autotile';
import { contentRegistry } from '../game/systems/ContentRegistry';
import { MapViewport, VIEW_ROWS, type ComposerMode } from './MapViewport';
import { LevelMinimap } from './LevelMinimap';
import type { BiomeDef, TerrainLayerDef, TerrainObjectDef } from '../schemas/terrainSchema';
import { resolveTerrainFrame, terrainAssetUrl } from '../game/terrain/TerrainTileset';

const TOOLS: { id: ComposerMode; label: string; key: string; icon: string }[] = [
  { id: 'select', label: 'Select', key: 'V', icon: '↖' },
  { id: 'paint', label: 'Paint', key: 'B', icon: '✎' },
  { id: 'autotile', label: 'Terrain', key: 'T', icon: '▦' },
  { id: 'routes', label: 'Routes', key: 'R', icon: '⌁' },
  { id: 'objects', label: 'Objects', key: 'O', icon: '⬚' },
  { id: 'analysis', label: 'Analysis', key: 'A', icon: '⚠' },
];

export function SpatialComposer({
  project,
  onChange,
}: {
  project: EditorProject;
  onChange: (project: EditorProject) => void;
}) {
  const [displayProject, setDisplayProject] = useState(project);
  const workingRef = useRef<EditorProject | null>(null);
  const [mode, setMode] = useState<ComposerMode>('select');
  const initialLayer =
    project.map?.layers.find((layer) => layer.kind === 'terrainSurface') ?? project.map?.layers[0];
  const [layerId, setLayerId] = useState(initialLayer?.id ?? '');
  const [tile, setTile] = useState(
    initialLayer?.cells.find((cell) => cell.tile > 0)?.tile ??
      project.biome?.materials.find((material) => material.tile > 0)?.tile ??
      1,
  );
  const [startRow, setStartRow] = useState(0);
  const [lockedLayers, setLockedLayers] = useState<Set<string>>(() => new Set());
  const [soloLayerId, setSoloLayerId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(0.85);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [selectedCell, setSelectedCell] = useState<{ x: number; row: number } | null>(null);
  const [leftPanel, setLeftPanel] = useState<'layers' | 'materials'>('layers');
  const [rightPanel, setRightPanel] = useState<'selection' | 'layer' | 'analysis'>('selection');
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [materialQuery, setMaterialQuery] = useState('');
  const [recentTiles, setRecentTiles] = useState<number[]>([]);
  const [showGrid, setShowGrid] = useState(true);
  const [showAllOverlays, setShowAllOverlays] = useState(false);

  useEffect(() => {
    if (!workingRef.current) setDisplayProject(project);
  }, [project]);

  const map = displayProject.map;
  useEffect(() => {
    if (!map) return;
    if (!map.layers.some((layer) => layer.id === layerId)) {
      setLayerId(
        map.layers.find((layer) => layer.kind === 'terrainSurface')?.id ?? map.layers[0]?.id ?? '',
      );
    }
    setStartRow((value) => clampRow(value, map.rows));
  }, [map, layerId]);

  useEffect(() => {
    const materials = displayProject.biome?.materials ?? [];
    if (!materials.some((material) => material.tile === tile) && tile !== 0) {
      setTile(materials.find((material) => material.tile > 0)?.tile ?? 0);
    }
  }, [displayProject.biome, tile]);

  const shipRadius = useMemo(
    () =>
      Math.max(
        18,
        ...[...contentRegistry.equipment.values()]
          .filter((item) => item.category === 'hull')
          .map((item) => item.navigationEnvelope.collisionRadius),
      ),
    [],
  );
  const analysis = useMemo(
    () =>
      displayProject.collision && displayProject.routes
        ? analyzeRoutes(displayProject.collision, displayProject.routes, shipRadius, 18, {
            scrollSpeed: displayProject.level.baseScrollSpeed,
            maxLateralSpeed: 300,
            minimumReactionSeconds: 0.55,
          })
        : null,
    [displayProject.collision, displayProject.routes, displayProject.level.baseScrollSpeed, shipRadius],
  );
  const pressure = useMemo(
    () =>
      displayProject.collision
        ? analyzeTerrainCombatPressure(
            {
              baseScrollSpeed: displayProject.level.baseScrollSpeed,
              scrollProfile: displayProject.level.scrollProfile,
              events: displayProject.level.events.map((working) => working.value),
            },
            displayProject.collision,
            (id) => contentRegistry.encounters.get(id)?.difficulty,
          )
        : [],
    [displayProject.collision, displayProject.level],
  );

  const beginGesture = useCallback(() => {
    workingRef.current = structuredClone(displayProject);
  }, [displayProject]);

  const previewMutation = useCallback(
    (mutator: (next: EditorProject) => void) => {
      const next = workingRef.current ?? structuredClone(displayProject);
      mutator(next);
      workingRef.current = next;
      setDisplayProject(structuredClone(next));
    },
    [displayProject],
  );

  const endGesture = useCallback(() => {
    if (!workingRef.current) return;
    const next = workingRef.current;
    workingRef.current = null;
    setDisplayProject(next);
    onChange(next);
  }, [onChange]);

  const commitImmediate = useCallback(
    (mutator: (next: EditorProject) => void) => {
      const next = structuredClone(displayProject);
      mutator(next);
      setDisplayProject(next);
      onChange(next);
    },
    [displayProject, onChange],
  );

  const finishAutotile = (next: EditorProject, layer: TerrainLayerDef) => {
    const map = next.map;
    if (!map) return;
    const bounds = {
      maxX: Math.round(map.worldWidth / map.tileSize) - 1,
      maxY: map.rows - 1,
      connectExterior: true,
    };
    layer.cells = withCardinalVariants(layer.cells, bounds);
    if (layer.kind !== 'terrainSurface') return;
    const detail = next.map?.layers.find(
      (candidate) => candidate.kind === 'terrainDetail' && candidate.id !== layer.id,
    );
    const edgeTile = next.biome?.materials.find((material) =>
      material.id.toLowerCase().includes('edge'),
    )?.tile;
    if (detail && edgeTile !== undefined)
      detail.cells = boundaryOverlayCells(layer.cells, edgeTile, bounds);
  };

  const applyCell = (layer: TerrainLayerDef, x: number, row: number, selectedTile: number) => {
    const index = layer.cells.findIndex((cell) => cell.x === x && cell.row === row);
    if (selectedTile === 0) {
      if (index >= 0) layer.cells.splice(index, 1);
    } else if (index >= 0) {
      layer.cells[index] = { ...layer.cells[index], tile: selectedTile };
    } else {
      layer.cells.push({ x, row, tile: selectedTile });
    }
  };

  const paint = (x: number, row: number, selectedTile: number) => {
    if (lockedLayers.has(layerId)) return;
    previewMutation((next) => {
      const layer = next.map?.layers.find((candidate) => candidate.id === layerId);
      if (!layer) return;
      layer.visible = true;
      applyCell(layer, x, row, selectedTile);
      if (mode === 'autotile') finishAutotile(next, layer);
    });
  };

  const fillVisible = useCallback(() => {
    if (!map || lockedLayers.has(layerId)) return;
    commitImmediate((next) => {
      const layer = next.map?.layers.find((candidate) => candidate.id === layerId);
      if (!layer) return;
      const lastRow = Math.min(map.rows, startRow + VIEW_ROWS);
      for (let row = startRow; row < lastRow; row += 1) {
        for (let x = 0; x < 17; x += 1) applyCell(layer, x, row, tile);
      }
      if (mode === 'autotile') finishAutotile(next, layer);
    });
  }, [commitImmediate, layerId, lockedLayers, map, mode, startRow, tile]);

  const selectMaterial = (selectedTile: number) => {
    setTile(selectedTile);
    if (selectedTile > 0)
      setRecentTiles((current) => [selectedTile, ...current.filter((value) => value !== selectedTile)].slice(0, 6));
  };

  const toggleLayerVisibility = (id: string) =>
    commitImmediate((next) => {
      const layer = next.map?.layers.find((candidate) => candidate.id === id);
      if (layer) layer.visible = !layer.visible;
    });

  const toggleLayerLock = (id: string) =>
    setLockedLayers((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const moveLayer = (id: string, direction: -1 | 1) =>
    commitImmediate((next) => {
      if (!next.map) return;
      const index = next.map.layers.findIndex((candidate) => candidate.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= next.map.layers.length) return;
      const a = next.map.layers[index];
      const b = next.map.layers[target];
      [a.depth, b.depth] = [b.depth, a.depth];
      [next.map.layers[index], next.map.layers[target]] = [b, a];
    });

  const moveBoundary = (sampleIndex: number, side: 'left' | 'right', x: number) =>
    previewMutation((next) => {
      const sample = next.collision?.corridor.samples[sampleIndex];
      if (!sample || !next.map) return;
      if (side === 'left') sample.left = Math.max(0, Math.min(x, sample.right - 48));
      else sample.right = Math.min(next.map.worldWidth, Math.max(x, sample.left + 48));
    });

  const moveRoute = (sampleIndex: number, centerX: number) =>
    previewMutation((next) => {
      const sample = next.routes?.routes[0]?.samples[sampleIndex];
      if (sample && next.map) sample.centerX = Math.max(0, Math.min(next.map.worldWidth, centerX));
    });

  const moveObject = (id: string, x: number, worldY: number) =>
    previewMutation((next) => {
      const object = next.objects?.objects.find((candidate) => candidate.id === id);
      if (!object || !next.map) return;
      object.x = Math.max(0, Math.min(next.map.worldWidth, x));
      object.worldY = Math.max(next.map.originWorldY, Math.min(next.map.originWorldY + next.map.rows * next.map.tileSize, worldY));
    });

  const updateObject = (id: string, patch: Partial<TerrainObjectDef>) =>
    commitImmediate((next) => {
      const object = next.objects?.objects.find((candidate) => candidate.id === id);
      if (object) Object.assign(object, patch);
    });

  const activeLayer = map?.layers.find((layer) => layer.id === layerId);
  const selectedObject = displayProject.objects?.objects.find((object) => object.id === selectedObjectId);
  const activeMaterial = displayProject.biome?.materials.find((material) => material.tile === tile);
  const visibleMaterials = (displayProject.biome?.materials ?? []).filter((material) =>
    `${material.displayName} ${material.id}`.toLowerCase().includes(materialQuery.toLowerCase()),
  );

  const panRows = useCallback(
    (delta: number) => {
      if (!map) return;
      setStartRow((current) => clampRow(current + delta, map.rows));
    },
    [map],
  );

  const changeZoom = useCallback((delta: number) => {
    setZoom((value) => Math.max(0.45, Math.min(1.4, Math.round((value + delta) * 20) / 20)));
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      const key = event.key.toLowerCase();
      const tool = TOOLS.find((candidate) => candidate.key.toLowerCase() === key);
      if (tool) {
        setMode(tool.id);
        event.preventDefault();
      }
      if (key === 'e') {
        setMode('paint');
        setTile(0);
        event.preventDefault();
      }
      if (key === 'g') {
        fillVisible();
        event.preventDefault();
      }
      if (key === 'f') {
        setZoom(0.85);
        if (map) setStartRow(clampRow(Math.round(map.rows / 2 - VIEW_ROWS / 2), map.rows));
        event.preventDefault();
      }
      if (event.key === 'Escape') {
        setMode('select');
        setSelectedObjectId(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [fillVisible, map]);

  if (!map) return <div className="map-empty">Select a level with a Level Package v2 map.</div>;

  return (
    <div
      className={`spatial-composer ux-redesign ${leftCollapsed ? 'left-collapsed' : ''} ${rightCollapsed ? 'right-collapsed' : ''}`}
    >
      <aside className="composer-left-dock">
        <nav className="tool-rail" aria-label="Map tools">
          {TOOLS.map((tool) => (
            <button
              key={tool.id}
              className={mode === tool.id ? 'active' : ''}
              title={`${tool.label} (${tool.key})`}
              onClick={() => setMode(tool.id)}
            >
              <span>{tool.icon}</span>
              <small>{tool.key}</small>
            </button>
          ))}
          <button
            className={mode === 'paint' && tile === 0 ? 'active' : ''}
            title="Erase (E)"
            onClick={() => {
              setMode('paint');
              setTile(0);
            }}
          >
            <span>⌫</span>
            <small>E</small>
          </button>
        </nav>
        {!leftCollapsed && (
          <div className="composer-resource-panel">
            <div className="dock-tabs">
              <button className={leftPanel === 'layers' ? 'active' : ''} onClick={() => setLeftPanel('layers')}>Layers</button>
              <button className={leftPanel === 'materials' ? 'active' : ''} onClick={() => setLeftPanel('materials')}>Materials</button>
            </div>
            {leftPanel === 'layers' ? (
              <div className="layer-list professional">
                {map.layers.map((layer, index) => (
                  <div key={layer.id} className={`layer-row ${layerId === layer.id ? 'active' : ''}`}>
                    <button className="layer-name" onClick={() => setLayerId(layer.id)}>
                      <span className="layer-color" style={{ background: layer.collisionAligned ? '#ff6472' : '#7ab0ff' }} />
                      {layer.name}
                      <small>{layer.kind} · {layer.scrollRatio.toFixed(2)}× · {Math.round(layer.opacity * 100)}%</small>
                    </button>
                    <div className="layer-actions">
                      <button title="Visibility" onClick={() => toggleLayerVisibility(layer.id)}>{layer.visible ? '◉' : '○'}</button>
                      <button title="Lock" onClick={() => toggleLayerLock(layer.id)}>{lockedLayers.has(layer.id) ? '🔒' : '🔓'}</button>
                      <button title="Solo" className={soloLayerId === layer.id ? 'active' : ''} onClick={() => setSoloLayerId(soloLayerId === layer.id ? null : layer.id)}>S</button>
                      <button aria-label="Move layer up" disabled={index === 0} onClick={() => moveLayer(layer.id, -1)}>↑</button>
                      <button aria-label="Move layer down" disabled={index === map.layers.length - 1} onClick={() => moveLayer(layer.id, 1)}>↓</button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="material-browser">
                {displayProject.biome?.tileset && (
                  <div className="tileset-status">
                    <span className="tileset-status-preview" style={{ backgroundImage: `url(${terrainAssetUrl(displayProject.biome.tileset.uri)})` }} />
                    <span>
                      <b>{displayProject.biome.tileset.displayName}</b>
                      <small>{displayProject.biome.tileset.columns * displayProject.biome.tileset.rows} frames · 32 px · image-backed</small>
                    </span>
                  </div>
                )}
                <input
                  type="search"
                  placeholder="Search materials…"
                  value={materialQuery}
                  onChange={(event) => setMaterialQuery(event.target.value)}
                />
                {recentTiles.length > 0 && (
                  <>
                    <p className="section-title">Recent</p>
                    <div className="material-grid compact">
                      {recentTiles.map((recent) => {
                        const material = displayProject.biome?.materials.find((item) => item.tile === recent);
                        return material ? <MaterialButton key={recent} biome={displayProject.biome} material={material} active={tile === recent} onClick={() => selectMaterial(recent)} /> : null;
                      })}
                    </div>
                  </>
                )}
                <p className="section-title">All materials</p>
                <div className="material-grid visual">
                  {visibleMaterials.map((material) => (
                    <MaterialButton key={material.tile} biome={displayProject.biome} material={material} active={tile === material.tile} onClick={() => selectMaterial(material.tile)} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        <button className="dock-collapse left" onClick={() => setLeftCollapsed((value) => !value)} title="Collapse resource panel">
          {leftCollapsed ? '›' : '‹'}
        </button>
      </aside>

      <section className="composer-stage">
        <div className="composer-toolbar redesigned">
          <div className="tool-summary">
            <b>{TOOLS.find((tool) => tool.id === mode)?.label ?? mode}</b>
            <span>{activeLayer?.name ?? 'No layer'} · {tile === 0 ? 'Eraser' : activeMaterial?.displayName ?? `Tile ${tile}`}</span>
          </div>
          <div className="viewport-actions">
            <button onClick={() => panRows(-VIEW_ROWS)}>Page ↓</button>
            <button onClick={() => panRows(VIEW_ROWS)}>Page ↑</button>
            <button onClick={() => setStartRow(0)}>Start</button>
            <button onClick={() => setStartRow(clampRow(map.rows - VIEW_ROWS, map.rows))}>End</button>
            <button onClick={() => setZoom(0.85)}>Fit</button>
            <button onClick={() => changeZoom(-0.1)}>−</button>
            <span>{Math.round(zoom * 100)}%</span>
            <button onClick={() => changeZoom(0.1)}>+</button>
            <label className="overlay-toggle"><input type="checkbox" checked={showGrid} onChange={(event) => setShowGrid(event.target.checked)} />Grid</label>
            <label className="overlay-toggle"><input type="checkbox" checked={showAllOverlays} onChange={(event) => setShowAllOverlays(event.target.checked)} />All overlays</label>
          </div>
        </div>
        <div className="composer-help redesigned">
          Wheel pans · Ctrl/⌘/Alt + wheel zooms · Space-drag pans · Alt/right-click samples a tile · V returns to Select · one drag = one Undo
        </div>
        <div className="map-work-area">
          <div className="map-scroll-frame">
            <MapViewport
              project={displayProject}
              mode={mode}
              layerId={layerId}
              selectedTile={tile}
              startRow={startRow}
              soloLayerId={soloLayerId}
              shipRadius={shipRadius}
              zoom={zoom}
              selectedObjectId={selectedObjectId}
              selectedCell={selectedCell}
              showGrid={showGrid}
              showAllOverlays={showAllOverlays}
              onPaint={paint}
              onMoveBoundary={moveBoundary}
              onMoveRoute={moveRoute}
              onMoveObject={moveObject}
              onSelectObject={(id) => {
                setSelectedObjectId(id);
                if (id) setRightPanel('selection');
              }}
              onSelectCell={setSelectedCell}
              onPickTile={selectMaterial}
              onGestureStart={beginGesture}
              onGestureEnd={endGesture}
              onPanRows={panRows}
              onZoom={changeZoom}
            />
          </div>
          <div className="minimap-column">
            <LevelMinimap project={displayProject} startRow={startRow} onNavigate={setStartRow} />
            <small>Rows {startRow}–{Math.min(map.rows, startRow + VIEW_ROWS)}</small>
          </div>
        </div>
      </section>

      <aside className="composer-right-dock">
        <button className="dock-collapse right" onClick={() => setRightCollapsed((value) => !value)} title="Collapse inspector">
          {rightCollapsed ? '‹' : '›'}
        </button>
        {!rightCollapsed && (
          <div className="composer-inspector contextual">
            <div className="dock-tabs">
              <button className={rightPanel === 'selection' ? 'active' : ''} onClick={() => setRightPanel('selection')}>Selection</button>
              <button className={rightPanel === 'layer' ? 'active' : ''} onClick={() => setRightPanel('layer')}>Layer</button>
              <button className={rightPanel === 'analysis' ? 'active' : ''} onClick={() => setRightPanel('analysis')}>Analysis</button>
            </div>
            {rightPanel === 'selection' && (
              <SelectionInspector
                object={selectedObject}
                cell={selectedCell}
                layer={activeLayer}
                project={displayProject}
                onObjectChange={updateObject}
              />
            )}
            {rightPanel === 'layer' && activeLayer && (
              <LayerInspector
                layer={activeLayer}
                locked={lockedLayers.has(activeLayer.id)}
                onOpacity={(opacity) => commitImmediate((next) => {
                  const layer = next.map?.layers.find((candidate) => candidate.id === activeLayer.id);
                  if (layer) layer.opacity = opacity;
                })}
                onToggleLock={() => toggleLayerLock(activeLayer.id)}
                onToggleVisibility={() => toggleLayerVisibility(activeLayer.id)}
              />
            )}
            {rightPanel === 'analysis' && (
              <AnalysisInspector analysis={analysis} pressure={pressure} shipRadius={shipRadius} onGoToRow={(worldY) => setStartRow(clampRow(Math.round((worldY - map.originWorldY) / map.tileSize - VIEW_ROWS / 2), map.rows))} />
            )}
          </div>
        )}
      </aside>
    </div>
  );
}

function MaterialButton({
  biome,
  material,
  active,
  onClick,
}: {
  biome: BiomeDef | undefined;
  material: NonNullable<EditorProject['biome']>['materials'][number];
  active: boolean;
  onClick: () => void;
}) {
  const color = `#${material.color.toString(16).padStart(6, '0').slice(-6)}`;
  const edge = `#${material.edgeColor.toString(16).padStart(6, '0').slice(-6)}`;
  const tileset = biome?.tileset;
  const frame = biome
    ? resolveTerrainFrame(biome, { x: 0, row: 0, tile: material.tile }, 'palette')
    : null;
  const column = frame !== null && tileset ? frame % tileset.columns : 0;
  const row = frame !== null && tileset ? Math.floor(frame / tileset.columns) : 0;
  const swatchStyle =
    frame !== null && tileset
      ? {
          backgroundImage: `url(${terrainAssetUrl(tileset.uri)})`,
          backgroundSize: `${tileset.columns * 100}% ${tileset.rows * 100}%`,
          backgroundPosition: `${tileset.columns === 1 ? 0 : (column / (tileset.columns - 1)) * 100}% ${tileset.rows === 1 ? 0 : (row / (tileset.rows - 1)) * 100}%`,
          imageRendering: 'pixelated' as const,
        }
      : { background: `linear-gradient(135deg, ${color} 0 68%, ${edge} 68%)` };
  return (
    <button className={active ? 'active' : ''} title={`${material.displayName} · ${material.collisionRole}`} onClick={onClick}>
      <span className="material-swatch image-backed" style={swatchStyle} />
      <span>{material.displayName}</span>
      <small>#{material.tile} · {material.collisionRole}{material.animated ? ' · animated' : ''}</small>
    </button>
  );
}

function SelectionInspector({
  object,
  cell,
  layer,
  project,
  onObjectChange,
}: {
  object: TerrainObjectDef | undefined;
  cell: { x: number; row: number } | null;
  layer: TerrainLayerDef | undefined;
  project: EditorProject;
  onObjectChange: (id: string, patch: Partial<TerrainObjectDef>) => void;
}) {
  if (object) {
    return (
      <div className="inspector selection-inspector">
        <p className="section-title">{object.type}</p>
        <h3>{object.id}</h3>
        <label>X<input type="number" value={object.x} onChange={(event) => onObjectChange(object.id, { x: Number(event.target.value) })} /></label>
        <label>World Y<input type="number" value={object.worldY} onChange={(event) => onObjectChange(object.id, { worldY: Number(event.target.value) })} /></label>
        <label>Width<input type="number" min={1} value={object.width} onChange={(event) => onObjectChange(object.id, { width: Math.max(1, Number(event.target.value)) })} /></label>
        <label>Height<input type="number" min={1} value={object.height} onChange={(event) => onObjectChange(object.id, { height: Math.max(1, Number(event.target.value)) })} /></label>
        {object.type === 'gate' ? (
          <>
            <label>Opening width<input type="number" min={0} value={object.openingWidth} onChange={(event) => onObjectChange(object.id, { openingWidth: Math.max(0, Number(event.target.value)) })} /></label>
            <label>Initial state<select value={object.initialState} onChange={(event) => onObjectChange(object.id, { initialState: event.target.value as 'open' | 'closed' })}><option value="closed">closed</option><option value="open">open</option></select></label>
          </>
        ) : (
          <>
            <label>Hit points<input type="number" min={1} value={object.hitPoints} onChange={(event) => onObjectChange(object.id, { hitPoints: Math.max(1, Number(event.target.value)) })} /></label>
            <label>Credit value<input type="number" min={0} value={object.creditValue} onChange={(event) => onObjectChange(object.id, { creditValue: Math.max(0, Math.round(Number(event.target.value))) })} /></label>
          </>
        )}
      </div>
    );
  }
  if (cell && layer) {
    const tile = layer.cells.find((candidate) => candidate.x === cell.x && candidate.row === cell.row)?.tile ?? 0;
    const material = project.biome?.materials.find((candidate) => candidate.tile === tile);
    return (
      <div className="selection-summary">
        <p className="section-title">Map cell</p>
        <h3>{cell.x}, {cell.row}</h3>
        <div className="metric"><span>Layer</span><b>{layer.name}</b></div>
        <div className="metric"><span>Tile</span><b>{tile || 'empty'}</b></div>
        <div className="metric"><span>Material</span><b>{material?.displayName ?? 'none'}</b></div>
      </div>
    );
  }
  return <p className="empty-inspector">Use Select (V) and click an object or map cell. Drag selected objects directly on the canvas.</p>;
}

function LayerInspector({
  layer,
  locked,
  onOpacity,
  onToggleLock,
  onToggleVisibility,
}: {
  layer: TerrainLayerDef;
  locked: boolean;
  onOpacity: (opacity: number) => void;
  onToggleLock: () => void;
  onToggleVisibility: () => void;
}) {
  return (
    <div className="inspector layer-inspector">
      <h3>{layer.name}</h3>
      <div className="metric"><span>Kind</span><b>{layer.kind}</b></div>
      <div className="metric"><span>Scroll</span><b>{layer.scrollRatio.toFixed(2)}×</b></div>
      <div className="metric"><span>Depth</span><b>{layer.depth}</b></div>
      <div className="metric"><span>Cells</span><b>{layer.cells.length}</b></div>
      <label>Opacity {Math.round(layer.opacity * 100)}%<input type="range" min={0} max={1} step={0.05} value={layer.opacity} onChange={(event) => onOpacity(Number(event.target.value))} /></label>
      <button onClick={onToggleVisibility}>{layer.visible ? 'Hide layer' : 'Show layer'}</button>
      <button onClick={onToggleLock}>{locked ? 'Unlock layer' : 'Lock layer'}</button>
    </div>
  );
}

function AnalysisInspector({
  analysis,
  pressure,
  shipRadius,
  onGoToRow,
}: {
  analysis: ReturnType<typeof analyzeRoutes> | null;
  pressure: ReturnType<typeof analyzeTerrainCombatPressure>;
  shipRadius: number;
  onGoToRow: (worldY: number) => void;
}) {
  if (!analysis) return <p>No route analysis data.</p>;
  return (
    <>
      <div className="metric"><span>Validation hull</span><b>{shipRadius.toFixed(1)} px</b></div>
      <div className="metric"><span>Minimum width</span><b>{analysis.minimumWidth.toFixed(1)} px</b></div>
      <div className="metric"><span>Minimum clearance</span><b>{analysis.minimumClearance.toFixed(1)} px</b></div>
      <div className="metric"><span>Minimum reaction</span><b>{analysis.minimumReactionTime.toFixed(2)} s</b></div>
      <div className="metric"><span>Errors</span><b>{analysis.issues.filter((issue) => issue.severity === 'error').length}</b></div>
      <div className="metric"><span>Warnings</span><b>{analysis.issues.filter((issue) => issue.severity === 'warning').length}</b></div>
      <div className="metric"><span>Combat pressure</span><b>{pressure.length}</b></div>
      <div className="analysis-list actionable">
        {pressure.slice(0, 8).map((issue, index) => <div key={`pressure-${index}`} className={issue.severity}>{issue.at}s {issue.encounterId}: {issue.message}</div>)}
        {analysis.issues.slice(0, 18).map((issue, index) => (
          <button key={index} className={issue.severity} onClick={() => onGoToRow(issue.worldY)}>
            <b>Go to {Math.round(issue.worldY)}</b><span>{issue.message}</span>
          </button>
        ))}
      </div>
    </>
  );
}

function clampRow(value: number, rows: number): number {
  return Math.max(0, Math.min(Math.max(0, rows - VIEW_ROWS), Math.round(value)));
}

function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
}
