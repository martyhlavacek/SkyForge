import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from 'react';
import type { EditorProject } from './projectStore';
import type { TerrainMapDef, TerrainObjectDef } from '../schemas/terrainSchema';
import { CARDINAL } from '../game/terrain/Autotile';
import {
  resolveTerrainFrame,
  terrainAssetUrl,
  terrainFrameRect,
} from '../game/terrain/TerrainTileset';

export type ComposerMode =
  | 'select'
  | 'paint'
  | 'autotile'
  | 'collision'
  | 'routes'
  | 'objects'
  | 'analysis';

interface Props {
  project: EditorProject;
  mode: ComposerMode;
  layerId: string;
  selectedTile: number;
  startRow: number;
  soloLayerId: string | null;
  shipRadius: number;
  zoom: number;
  selectedObjectId?: string | null;
  selectedCell?: { x: number; row: number } | null;
  showGrid?: boolean;
  showAllOverlays?: boolean;
  onPaint: (x: number, row: number, tile: number) => void;
  onMoveBoundary: (sampleIndex: number, side: 'left' | 'right', x: number) => void;
  onMoveRoute: (sampleIndex: number, centerX: number) => void;
  onMoveObject: (id: string, x: number, worldY: number) => void;
  onSelectObject?: (id: string | null) => void;
  onSelectCell?: (cell: { x: number; row: number } | null) => void;
  onPickTile?: (tile: number) => void;
  onGestureStart?: () => void;
  onGestureEnd?: () => void;
  onPanRows?: (deltaRows: number) => void;
  onZoom?: (delta: number) => void;
}

export const VIEW_ROWS = 30;
const CANVAS_WIDTH = 544;
const CANVAS_HEIGHT = 960;

type PointerMap = {
  cellX: number;
  row: number;
  worldX: number;
  worldY: number;
  canvasY: number;
};

export function mapPointerToCell(
  clientX: number,
  clientY: number,
  rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>,
  canvasWidth: number,
  canvasHeight: number,
  map: Pick<TerrainMapDef, 'tileSize' | 'worldWidth'>,
  startRow: number,
): { cellX: number; row: number; worldX: number } {
  const worldX = ((clientX - rect.left) / Math.max(1, rect.width)) * canvasWidth;
  const canvasY = ((clientY - rect.top) / Math.max(1, rect.height)) * canvasHeight;
  const columns = Math.max(1, Math.round(map.worldWidth / map.tileSize));
  const cellX = Math.max(0, Math.min(columns - 1, Math.floor(worldX / map.tileSize)));
  const row =
    startRow +
    Math.max(
      0,
      Math.min(VIEW_ROWS - 1, VIEW_ROWS - 1 - Math.floor(canvasY / map.tileSize)),
    );
  return { cellX, row, worldX: Math.max(0, Math.min(map.worldWidth, worldX)) };
}

export function hitTestTerrainObject(
  objects: TerrainObjectDef[],
  worldX: number,
  worldY: number,
): TerrainObjectDef | null {
  for (let index = objects.length - 1; index >= 0; index -= 1) {
    const object = objects[index];
    if (
      worldX >= object.x - object.width / 2 &&
      worldX <= object.x + object.width / 2 &&
      worldY >= object.worldY - object.height / 2 &&
      worldY <= object.worldY + object.height / 2
    ) {
      return object;
    }
  }
  return null;
}

export function MapViewport(props: Props) {
  const selectedObjectId = props.selectedObjectId ?? null;
  const selectedCell = props.selectedCell ?? null;
  const showGrid = props.showGrid ?? true;
  const showAllOverlays = props.showAllOverlays ?? false;
  const onSelectObject = props.onSelectObject ?? (() => undefined);
  const onSelectCell = props.onSelectCell ?? (() => undefined);
  const onPickTile = props.onPickTile ?? (() => undefined);
  const onGestureStart = props.onGestureStart ?? (() => undefined);
  const onGestureEnd = props.onGestureEnd ?? (() => undefined);
  const onPanRows = props.onPanRows ?? (() => undefined);
  const onZoom = props.onZoom ?? (() => undefined);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activePointer = useRef<number | null>(null);
  const pointerAction = useRef<'none' | 'edit' | 'object' | 'pan'>('none');
  const lastApplied = useRef<string | null>(null);
  const panAnchor = useRef<{ clientY: number; startRow: number } | null>(null);
  const spacePressed = useRef(false);
  const [hoverCell, setHoverCell] = useState<{ x: number; row: number } | null>(null);
  const [hoverObjectId, setHoverObjectId] = useState<string | null>(null);
  const [tilesetImage, setTilesetImage] = useState<HTMLImageElement | null>(null);
  const [animationTime, setAnimationTime] = useState(0);
  const materialMap = useMemo(
    () =>
      new Map(
        props.project.biome?.materials.map((material) => [material.tile, material]) ?? [],
      ),
    [props.project.biome],
  );

  useEffect(() => {
    const uri = props.project.biome?.tileset?.uri;
    if (!uri) {
      setTilesetImage(null);
      return;
    }
    let active = true;
    const image = new Image();
    image.onload = () => {
      if (active) setTilesetImage(image);
    };
    image.onerror = () => {
      if (active) setTilesetImage(null);
    };
    image.src = terrainAssetUrl(uri);
    return () => {
      active = false;
    };
  }, [props.project.biome?.tileset?.uri]);

  useEffect(() => {
    if (!props.project.biome?.materials.some((material) => material.animated)) return;
    const started = performance.now();
    const timer = window.setInterval(
      () => setAnimationTime((performance.now() - started) / 1000),
      250,
    );
    return () => window.clearInterval(timer);
  }, [props.project.biome]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space' && !isTypingTarget(event.target)) {
        spacePressed.current = true;
        event.preventDefault();
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') spacePressed.current = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const map = props.project.map;
    if (!canvas || !map) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = toCss(props.project.biome?.backgroundColor ?? 0x101823);
    context.fillRect(0, 0, canvas.width, canvas.height);

    const layers = [...map.layers]
      .filter((layer) => !props.soloLayerId || layer.id === props.soloLayerId)
      .sort((a, b) => a.depth - b.depth);
    for (const layer of layers) {
      if (!layer.visible) continue;
      const isActive = layer.id === props.layerId;
      const layerAlpha = layer.opacity * (isActive || props.soloLayerId ? 1 : 0.72);
      context.globalAlpha = layerAlpha;
      for (const cell of layer.cells) {
        if (cell.row < props.startRow || cell.row >= props.startRow + VIEW_ROWS) continue;
        const material = materialMap.get(cell.tile);
        if (!material || material.alpha <= 0) continue;
        const px = cell.x * map.tileSize;
        const py = canvas.height - (cell.row - props.startRow + 1) * map.tileSize;
        const tileset = props.project.biome?.tileset;
        const frame = props.project.biome
          ? resolveTerrainFrame(
              props.project.biome,
              cell,
              layer.id,
              animationTime,
            )
          : null;
        const canDrawImage = Boolean(tilesetImage && tileset && frame !== null);
        context.globalAlpha = layerAlpha * material.alpha;

        if (canDrawImage && tileset && frame !== null && tilesetImage) {
          const source = terrainFrameRect(frame, tileset.columns, tileset.tileSize);
          context.imageSmoothingEnabled = false;
          context.drawImage(
            tilesetImage,
            source.x,
            source.y,
            source.width,
            source.height,
            px,
            py,
            map.tileSize,
            map.tileSize,
          );
          continue;
        }

        context.fillStyle = toCss(material.color);
        context.fillRect(px, py, map.tileSize, map.tileSize);
        if (layer.kind === 'terrainDetail') {
          context.fillStyle = toCss(material.edgeColor);
          const mask = cell.variant;
          if (mask === undefined || (mask & CARDINAL.WEST) === 0)
            context.fillRect(px, py, 4, map.tileSize);
          if (mask !== undefined && (mask & CARDINAL.EAST) === 0)
            context.fillRect(px + map.tileSize - 4, py, 4, map.tileSize);
          if (mask !== undefined && (mask & CARDINAL.NORTH) === 0)
            context.fillRect(px, py, map.tileSize, 4);
          if (mask !== undefined && (mask & CARDINAL.SOUTH) === 0)
            context.fillRect(px, py + map.tileSize - 4, map.tileSize, 4);
        }
      }
    }
    context.globalAlpha = 1;

    if (showGrid) drawGrid(context, map);
    const showCollision = showAllOverlays || props.mode === 'collision' || props.mode === 'analysis';
    const showRoutes = showAllOverlays || props.mode === 'routes' || props.mode === 'analysis';
    const showObjects =
      showAllOverlays ||
      props.mode === 'select' ||
      props.mode === 'objects' ||
      props.mode === 'analysis';
    if (showCollision) drawCollision(context, props.project, props.startRow, map);
    if (showRoutes) {
      drawNavigationEnvelope(context, props.project, props.startRow, map, props.shipRadius);
      drawRoutes(context, props.project, props.startRow, map);
    }
    if (showObjects)
      drawObjects(
        context,
        props.project,
        props.startRow,
        map,
        selectedObjectId,
        hoverObjectId,
      );

    if (selectedCell) drawCellHighlight(context, map, props.startRow, selectedCell, '#ffd166');
    if (hoverCell) drawCellHighlight(context, map, props.startRow, hoverCell, '#77b4ff');
  }, [
    props.project,
    props.startRow,
    props.soloLayerId,
    props.shipRadius,
    props.layerId,
    props.mode,
    showGrid,
    showAllOverlays,
    selectedCell,
    selectedObjectId,
    materialMap,
    hoverCell,
    hoverObjectId,
    tilesetImage,
    animationTime,
  ]);

  const pointerMap = (event: ReactPointerEvent<HTMLCanvasElement>): PointerMap | null => {
    const map = props.project.map;
    const canvas = canvasRef.current;
    if (!map || !canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const basic = mapPointerToCell(
      event.clientX,
      event.clientY,
      rect,
      canvas.width,
      canvas.height,
      map,
      props.startRow,
    );
    const canvasY = ((event.clientY - rect.top) / Math.max(1, rect.height)) * canvas.height;
    return {
      ...basic,
      canvasY,
      worldY: map.originWorldY + basic.row * map.tileSize,
    };
  };

  const tileAt = (cellX: number, row: number): number => {
    const layer = props.project.map?.layers.find((candidate) => candidate.id === props.layerId);
    return layer?.cells.find((cell) => cell.x === cellX && cell.row === row)?.tile ?? 0;
  };

  const updateHover = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const point = pointerMap(event);
    if (!point) return null;
    setHoverCell({ x: point.cellX, row: point.row });
    const object = hitTestTerrainObject(
      props.project.objects?.objects ?? [],
      point.worldX,
      point.worldY,
    );
    setHoverObjectId(object?.id ?? null);
    return point;
  };

  const applyEdit = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const map = props.project.map;
    const point = updateHover(event);
    if (!map || !point) return;
    event.preventDefault();
    const key = `${props.mode}:${props.layerId}:${point.cellX}:${point.row}:${props.selectedTile}:${selectedObjectId ?? ''}`;
    if (key === lastApplied.current) return;
    lastApplied.current = key;

    if (props.mode === 'paint' || props.mode === 'autotile') {
      props.onPaint(point.cellX, point.row, props.selectedTile);
      onSelectCell({ x: point.cellX, row: point.row });
      return;
    }
    if (props.mode === 'collision' && props.project.collision) {
      const samples = props.project.collision.corridor.samples;
      const index = nearestSample(samples, point.worldY);
      const sample = samples[index];
      props.onMoveBoundary(
        index,
        point.worldX < (sample.left + sample.right) / 2 ? 'left' : 'right',
        point.worldX,
      );
      return;
    }
    if (props.mode === 'routes' && props.project.routes) {
      const samples = props.project.routes.routes[0]?.samples ?? [];
      if (samples.length) props.onMoveRoute(nearestSample(samples, point.worldY), point.worldX);
      return;
    }
    if ((props.mode === 'objects' || props.mode === 'select') && selectedObjectId) {
      props.onMoveObject(selectedObjectId, point.worldX, point.worldY);
    }
  };

  const beginPointer = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const point = updateHover(event);
    if (!point) return;
    activePointer.current = event.pointerId;
    lastApplied.current = null;
    event.currentTarget.setPointerCapture(event.pointerId);

    if (event.button === 1 || spacePressed.current) {
      pointerAction.current = 'pan';
      panAnchor.current = { clientY: event.clientY, startRow: props.startRow };
      event.preventDefault();
      return;
    }

    if (event.button === 2 || event.altKey) {
      onPickTile(tileAt(point.cellX, point.row));
      onSelectCell({ x: point.cellX, row: point.row });
      pointerAction.current = 'none';
      event.preventDefault();
      return;
    }

    if (props.mode === 'select' || props.mode === 'objects') {
      const object = hitTestTerrainObject(
        props.project.objects?.objects ?? [],
        point.worldX,
        point.worldY,
      );
      onSelectObject(object?.id ?? null);
      onSelectCell(object ? null : { x: point.cellX, row: point.row });
      if (object) {
        pointerAction.current = 'object';
        onGestureStart();
        props.onMoveObject(object.id, point.worldX, point.worldY);
      } else {
        pointerAction.current = 'none';
      }
      return;
    }

    if (props.mode === 'analysis') {
      onSelectCell({ x: point.cellX, row: point.row });
      pointerAction.current = 'none';
      return;
    }

    pointerAction.current = 'edit';
    onGestureStart();
    applyEdit(event);
  };

  const movePointer = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const point = updateHover(event);
    if (!point || activePointer.current !== event.pointerId) return;
    if (pointerAction.current === 'pan' && panAnchor.current) {
      const rect = event.currentTarget.getBoundingClientRect();
      const pixelsPerRow = rect.height / VIEW_ROWS;
      const deltaRows = Math.round((event.clientY - panAnchor.current.clientY) / pixelsPerRow);
      onPanRows(panAnchor.current.startRow + deltaRows - props.startRow);
      return;
    }
    if (pointerAction.current === 'edit' || pointerAction.current === 'object') applyEdit(event);
  };

  const endPointer = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (activePointer.current !== event.pointerId) return;
    if (pointerAction.current === 'edit' || pointerAction.current === 'object') onGestureEnd();
    activePointer.current = null;
    pointerAction.current = 'none';
    panAnchor.current = null;
    lastApplied.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const onWheel = (event: ReactWheelEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    if (event.ctrlKey || event.metaKey || event.altKey) {
      onZoom(event.deltaY > 0 ? -0.1 : 0.1);
    } else {
      onPanRows(Math.sign(event.deltaY) * 3);
    }
  };

  if (!props.project.map)
    return <div className="map-empty">This level has no Level Package v2 map.</div>;
  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_WIDTH}
      height={CANVAS_HEIGHT}
      className={`map-canvas mode-${props.mode}`}
      style={{ width: CANVAS_WIDTH * props.zoom, height: CANVAS_HEIGHT * props.zoom }}
      aria-label="Level map painting canvas"
      tabIndex={0}
      onContextMenu={(event) => event.preventDefault()}
      onWheel={onWheel}
      onPointerDown={beginPointer}
      onPointerMove={movePointer}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      onLostPointerCapture={() => {
        if (pointerAction.current === 'edit' || pointerAction.current === 'object') onGestureEnd();
        activePointer.current = null;
        pointerAction.current = 'none';
        panAnchor.current = null;
        lastApplied.current = null;
      }}
      onPointerLeave={() => {
        if (activePointer.current === null) {
          setHoverCell(null);
          setHoverObjectId(null);
        }
      }}
    />
  );
}

function drawCellHighlight(
  context: CanvasRenderingContext2D,
  map: TerrainMapDef,
  startRow: number,
  cell: { x: number; row: number },
  color: string,
): void {
  if (cell.row < startRow || cell.row >= startRow + VIEW_ROWS) return;
  const px = cell.x * map.tileSize;
  const py = CANVAS_HEIGHT - (cell.row - startRow + 1) * map.tileSize;
  context.fillStyle = `${color}22`;
  context.fillRect(px, py, map.tileSize, map.tileSize);
  context.strokeStyle = color;
  context.lineWidth = 2;
  context.strokeRect(px + 1, py + 1, map.tileSize - 2, map.tileSize - 2);
}

function drawGrid(context: CanvasRenderingContext2D, map: TerrainMapDef): void {
  context.strokeStyle = 'rgba(255,255,255,0.07)';
  context.lineWidth = 1;
  for (let x = 0; x <= map.worldWidth; x += map.tileSize) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, CANVAS_HEIGHT);
    context.stroke();
  }
  for (let y = 0; y <= CANVAS_HEIGHT; y += map.tileSize) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(map.worldWidth, y);
    context.stroke();
  }
}

function drawCollision(
  context: CanvasRenderingContext2D,
  project: EditorProject,
  startRow: number,
  map: TerrainMapDef,
): void {
  const samples = project.collision?.corridor.samples;
  if (!samples) return;
  context.strokeStyle = '#ff596d';
  context.lineWidth = 4;
  for (const side of ['left', 'right'] as const) {
    context.beginPath();
    let begun = false;
    for (const sample of samples) {
      const row = (sample.worldY - map.originWorldY) / map.tileSize;
      const y = CANVAS_HEIGHT - (row - startRow) * map.tileSize;
      if (y < -32 || y > CANVAS_HEIGHT + 32) continue;
      const x = sample[side];
      if (!begun) {
        context.moveTo(x, y);
        begun = true;
      } else context.lineTo(x, y);
    }
    context.stroke();
  }
}

function drawNavigationEnvelope(
  context: CanvasRenderingContext2D,
  project: EditorProject,
  startRow: number,
  map: TerrainMapDef,
  shipRadius: number,
): void {
  const route = project.routes?.routes[0];
  if (!route) return;
  context.strokeStyle = 'rgba(124,244,195,0.18)';
  context.lineWidth = shipRadius * 2;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.beginPath();
  let begun = false;
  for (const sample of route.samples) {
    const row = (sample.worldY - map.originWorldY) / map.tileSize;
    const y = CANVAS_HEIGHT - (row - startRow) * map.tileSize;
    if (y < -64 || y > CANVAS_HEIGHT + 64) continue;
    if (!begun) {
      context.moveTo(sample.centerX, y);
      begun = true;
    } else context.lineTo(sample.centerX, y);
  }
  context.stroke();
  context.lineCap = 'butt';
  context.lineJoin = 'miter';
}

function drawRoutes(
  context: CanvasRenderingContext2D,
  project: EditorProject,
  startRow: number,
  map: TerrainMapDef,
): void {
  const route = project.routes?.routes[0];
  if (!route) return;
  context.strokeStyle = '#7cf4c3';
  context.setLineDash([8, 6]);
  context.lineWidth = 3;
  context.beginPath();
  let begun = false;
  for (const sample of route.samples) {
    const row = (sample.worldY - map.originWorldY) / map.tileSize;
    const y = CANVAS_HEIGHT - (row - startRow) * map.tileSize;
    if (y < -32 || y > CANVAS_HEIGHT + 32) continue;
    if (!begun) {
      context.moveTo(sample.centerX, y);
      begun = true;
    } else context.lineTo(sample.centerX, y);
  }
  context.stroke();
  context.setLineDash([]);
}

function drawObjects(
  context: CanvasRenderingContext2D,
  project: EditorProject,
  startRow: number,
  map: TerrainMapDef,
  selectedObjectId: string | null,
  hoverObjectId: string | null,
): void {
  for (const object of project.objects?.objects ?? []) {
    const row = (object.worldY - map.originWorldY) / map.tileSize;
    const y = CANVAS_HEIGHT - (row - startRow) * map.tileSize;
    if (y < -64 || y > CANVAS_HEIGHT + 64) continue;
    context.fillStyle = object.type === 'gate' ? '#b7c7d8' : '#ef9559';
    context.fillRect(
      object.x - object.width / 2,
      y - object.height / 2,
      object.width,
      object.height,
    );
    if (object.id === selectedObjectId || object.id === hoverObjectId) {
      context.strokeStyle = object.id === selectedObjectId ? '#ffd166' : '#77b4ff';
      context.lineWidth = object.id === selectedObjectId ? 4 : 2;
      context.strokeRect(
        object.x - object.width / 2 - 3,
        y - object.height / 2 - 3,
        object.width + 6,
        object.height + 6,
      );
    }
    context.fillStyle = '#ffffff';
    context.font = '12px monospace';
    context.fillText(object.id, object.x - object.width / 2, y - object.height / 2 - 5);
  }
}

function nearestSample(samples: { worldY: number }[], worldY: number): number {
  let best = 0;
  let distance = Number.POSITIVE_INFINITY;
  samples.forEach((sample, index) => {
    const next = Math.abs(sample.worldY - worldY);
    if (next < distance) {
      distance = next;
      best = index;
    }
  });
  return best;
}

function toCss(value: number): string {
  return `#${value.toString(16).padStart(6, '0').slice(-6)}`;
}

function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
}
