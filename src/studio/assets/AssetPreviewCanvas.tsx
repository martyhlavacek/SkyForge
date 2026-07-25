import { useEffect, useRef } from 'react';
import type {
  StudioAssetDefinition,
  StudioResource,
} from '../../schemas/studioPackageSchema';
import { resourceDataUrl } from './AssetResourceTools';

export type AssetPreviewContext =
  'neutral' | 'canyon' | 'ice' | 'space' | 'station' | 'combat';
export type AssetPreviewTool = 'inspect' | 'pivot' | 'hardpoint';

function paintBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  context: AssetPreviewContext,
): void {
  const palettes: Record<AssetPreviewContext, [string, string]> = {
    neutral: ['#17202a', '#263849'],
    canyon: ['#2f1712', '#9a5d2f'],
    ice: ['#0d2b3e', '#75a9c5'],
    space: ['#030711', '#172a50'],
    station: ['#101419', '#3b4652'],
    combat: ['#24151f', '#672d3d'],
  };
  const [top, bottom] = palettes[context];
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, top);
  gradient.addColorStop(1, bottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  for (let x = 0; x < width; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y < height; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  if (context === 'space') {
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    for (let index = 0; index < 24; index += 1)
      ctx.fillRect((index * 73) % width, (index * 47) % height, 1, 1);
  }
}

export function AssetPreviewCanvas({
  asset,
  resource,
  context,
  animationName,
  tool,
  onPoint,
}: {
  asset: StudioAssetDefinition;
  resource?: StudioResource;
  context: AssetPreviewContext;
  animationName: string;
  tool: AssetPreviewTool;
  onPoint: (x: number, y: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let disposed = false;
    let request = 0;
    const image = new Image();
    const frames = asset.frames.length
      ? asset.frames
      : [
          {
            id: `${asset.id}-frame-0`,
            x: 0,
            y: 0,
            width: asset.width,
            height: asset.height,
            durationMs: 100,
          },
        ];
    const animation =
      asset.animations[animationName] ?? Object.values(asset.animations)[0];
    const sequence = animation?.frames.length
      ? animation.frames.filter((index) => index >= 0 && index < frames.length)
      : [0];
    const fps = animation?.fps ?? 8;
    const started = performance.now();

    const draw = (now: number) => {
      if (disposed) return;
      paintBackground(ctx, canvas.width, canvas.height, context);
      const sequenceIndex = animation?.loop
        ? Math.floor(((now - started) / 1000) * fps) % Math.max(1, sequence.length)
        : Math.min(sequence.length - 1, Math.floor(((now - started) / 1000) * fps));
      const frameIndex = sequence[sequenceIndex] ?? 0;
      const frame = frames[frameIndex] ?? frames[0];
      const scale = Math.min(5, Math.max(0.25, asset.scale * 3));
      const drawWidth = frame.width * scale;
      const drawHeight = frame.height * scale;
      const originX = canvas.width / 2 - drawWidth * asset.pivot.x;
      const originY = canvas.height / 2 - drawHeight * asset.pivot.y;

      if (image.complete && image.naturalWidth > 0) {
        ctx.save();
        ctx.globalAlpha = asset.presentation.shadowOpacity;
        ctx.filter = 'brightness(0)';
        ctx.translate(
          originX + asset.presentation.shadowOffsetX,
          originY + asset.presentation.shadowOffsetY,
        );
        ctx.scale(asset.presentation.shadowScaleX, asset.presentation.shadowScaleY);
        ctx.drawImage(
          image,
          frame.x,
          frame.y,
          frame.width,
          frame.height,
          0,
          0,
          drawWidth,
          drawHeight,
        );
        ctx.restore();
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(
          image,
          frame.x,
          frame.y,
          frame.width,
          frame.height,
          originX,
          originY,
          drawWidth,
          drawHeight,
        );
        ctx.restore();
      } else {
        ctx.fillStyle = '#7ec8e3';
        ctx.fillRect(originX, originY, drawWidth, drawHeight);
        ctx.fillStyle = '#d7f5ff';
        ctx.fillRect(
          originX + drawWidth * 0.35,
          originY + drawHeight * 0.15,
          drawWidth * 0.3,
          drawHeight * 0.55,
        );
      }

      ctx.save();
      ctx.translate(originX, originY);
      ctx.scale(scale, scale);
      ctx.strokeStyle = '#ff5d5d';
      ctx.fillStyle = 'rgba(255,93,93,0.12)';
      ctx.lineWidth = 1 / scale;
      const collision = asset.collision;
      if (collision?.type === 'circle') {
        ctx.beginPath();
        ctx.arc(
          frame.width * asset.pivot.x + collision.offsetX,
          frame.height * asset.pivot.y + collision.offsetY,
          collision.radius,
          0,
          Math.PI * 2,
        );
        ctx.fill();
        ctx.stroke();
      } else if (collision?.type === 'rectangle') {
        const x = frame.width * asset.pivot.x + collision.offsetX - collision.width / 2;
        const y = frame.height * asset.pivot.y + collision.offsetY - collision.height / 2;
        ctx.fillRect(x, y, collision.width, collision.height);
        ctx.strokeRect(x, y, collision.width, collision.height);
      } else if (collision?.type === 'polygon') {
        ctx.beginPath();
        collision.points.forEach((point, index) =>
          index === 0 ? ctx.moveTo(point.x, point.y) : ctx.lineTo(point.x, point.y),
        );
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.fillStyle = '#ffe26a';
      asset.hardpoints.forEach((hardpoint) => {
        ctx.beginPath();
        ctx.arc(hardpoint.x, hardpoint.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.strokeStyle = '#5eff91';
      ctx.beginPath();
      ctx.moveTo(frame.width * asset.pivot.x - 4, frame.height * asset.pivot.y);
      ctx.lineTo(frame.width * asset.pivot.x + 4, frame.height * asset.pivot.y);
      ctx.moveTo(frame.width * asset.pivot.x, frame.height * asset.pivot.y - 4);
      ctx.lineTo(frame.width * asset.pivot.x, frame.height * asset.pivot.y + 4);
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = 'rgba(8,12,18,0.82)';
      ctx.fillRect(8, 8, 184, 42);
      ctx.fillStyle = '#d7e5ee';
      ctx.font = '12px monospace';
      ctx.fillText(`${asset.displayName} · ${frame.id}`, 14, 25);
      ctx.fillText(`alt ${asset.presentation.altitude} · ${tool}`, 14, 42);
      request = requestAnimationFrame(draw);
    };
    image.onload = () => {
      request = requestAnimationFrame(draw);
    };
    image.onerror = () => {
      request = requestAnimationFrame(draw);
    };
    image.src = resource ? resourceDataUrl(resource) : '';
    if (!resource) request = requestAnimationFrame(draw);
    return () => {
      disposed = true;
      cancelAnimationFrame(request);
    };
  }, [asset, resource, context, animationName, tool]);

  return (
    <canvas
      ref={canvasRef}
      className="asset-preview-canvas"
      width={480}
      height={360}
      onPointerDown={(event) => {
        if (tool === 'inspect') return;
        const rect = event.currentTarget.getBoundingClientRect();
        const canvasX =
          ((event.clientX - rect.left) / rect.width) * event.currentTarget.width;
        const canvasY =
          ((event.clientY - rect.top) / rect.height) * event.currentTarget.height;
        const frame = asset.frames[0] ?? { width: asset.width, height: asset.height };
        const scale = Math.min(5, Math.max(0.25, asset.scale * 3));
        const originX =
          event.currentTarget.width / 2 - frame.width * scale * asset.pivot.x;
        const originY =
          event.currentTarget.height / 2 - frame.height * scale * asset.pivot.y;
        onPoint((canvasX - originX) / scale, (canvasY - originY) / scale);
      }}
    />
  );
}
