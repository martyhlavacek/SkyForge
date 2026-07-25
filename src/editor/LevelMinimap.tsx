import { useEffect, useRef } from 'react';
import type { EditorProject } from './projectStore';
import { VIEW_ROWS } from './MapViewport';

export function minimapRowFromPointer(
  clientY: number,
  rect: Pick<DOMRect, 'top' | 'height'>,
  rows: number,
  viewRows = VIEW_ROWS,
): number {
  const ratio = Math.max(0, Math.min(1, (clientY - rect.top) / Math.max(1, rect.height)));
  return Math.max(0, Math.min(Math.max(0, rows - viewRows), Math.round((1 - ratio) * rows - viewRows / 2)));
}

export function LevelMinimap({
  project,
  startRow,
  onNavigate,
}: {
  project: EditorProject;
  startRow: number;
  onNavigate: (row: number) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const map = project.map;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !map) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#080b12';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const rowScale = canvas.height / Math.max(1, map.rows);
    for (const layer of [...map.layers].sort((a, b) => a.depth - b.depth)) {
      if (!layer.visible) continue;
      ctx.globalAlpha = Math.min(0.85, Math.max(0.12, layer.opacity));
      for (const cell of layer.cells) {
        const material = project.biome?.materials.find((candidate) => candidate.tile === cell.tile);
        if (!material) continue;
        ctx.fillStyle = `#${material.color.toString(16).padStart(6, '0').slice(-6)}`;
        const x = (cell.x / 17) * canvas.width;
        const y = canvas.height - (cell.row + 1) * rowScale;
        ctx.fillRect(x, y, Math.max(1, canvas.width / 17), Math.max(1, rowScale));
      }
    }
    ctx.globalAlpha = 1;

    for (const object of project.objects?.objects ?? []) {
      const row = (object.worldY - map.originWorldY) / map.tileSize;
      const y = canvas.height - row * rowScale;
      ctx.fillStyle = object.type === 'gate' ? '#dce7f2' : '#ff9b62';
      ctx.fillRect(4, y - 1, canvas.width - 8, 2);
    }

    for (const working of project.level.events) {
      const ratio = working.value.at / Math.max(1, project.level.durationTarget);
      ctx.fillStyle = 'rgba(122,176,255,0.8)';
      ctx.fillRect(canvas.width - 5, canvas.height - ratio * canvas.height, 4, 2);
    }

    const viewportHeight = Math.min(canvas.height, VIEW_ROWS * rowScale);
    const viewportY = canvas.height - (startRow + VIEW_ROWS) * rowScale;
    ctx.fillStyle = 'rgba(122,176,255,0.12)';
    ctx.fillRect(0, viewportY, canvas.width, viewportHeight);
    ctx.strokeStyle = '#7ab0ff';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, viewportY + 1, canvas.width - 2, Math.max(2, viewportHeight - 2));
  }, [map, project, startRow]);

  if (!map) return null;
  const navigate = (clientY: number) => {
    const canvas = ref.current;
    if (!canvas) return;
    onNavigate(minimapRowFromPointer(clientY, canvas.getBoundingClientRect(), map.rows));
  };
  return (
    <canvas
      ref={ref}
      width={86}
      height={520}
      className="level-minimap"
      aria-label="Level minimap"
      title="Click or drag to navigate the level"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        navigate(event.clientY);
      }}
      onPointerMove={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) navigate(event.clientY);
      }}
      onPointerUp={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId))
          event.currentTarget.releasePointerCapture(event.pointerId);
      }}
    />
  );
}
