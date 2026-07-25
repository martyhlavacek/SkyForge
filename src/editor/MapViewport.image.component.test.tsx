// @vitest-environment jsdom
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { contentRegistry } from '../game/systems/ContentRegistry';
import { MapViewport } from './MapViewport';
import { createEditorProject } from './projectStore';

const drawImage = vi.fn();

class LoadedImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private value = '';

  set src(next: string) {
    this.value = next;
    queueMicrotask(() => this.onload?.());
  }

  get src(): string {
    return this.value;
  }
}

describe('MapViewport image-backed terrain', () => {
  beforeEach(() => {
    drawImage.mockClear();
    vi.stubGlobal('Image', LoadedImage);
    const context = {
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      drawImage,
      strokeRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      setLineDash: vi.fn(),
      fillText: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      imageSmoothingEnabled: true,
      globalAlpha: 1,
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      lineCap: 'butt',
      lineJoin: 'miter',
      font: '',
      textAlign: 'start',
    };
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      configurable: true,
      value: () => context,
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('draws normalized atlas frames after the biome image loads', async () => {
    const level = contentRegistry.levels.get('level_01');
    if (!level) throw new Error('level fixture missing');
    const project = createEditorProject(level);
    const layerId = project.map?.layers[0]?.id;
    if (!layerId) throw new Error('map layer fixture missing');

    render(
      <MapViewport
        project={project}
        mode="select"
        layerId={layerId}
        selectedTile={1}
        startRow={0}
        soloLayerId={null}
        shipRadius={18}
        zoom={1}
        onPaint={vi.fn()}
        onMoveBoundary={vi.fn()}
        onMoveRoute={vi.fn()}
        onMoveObject={vi.fn()}
      />,
    );

    await waitFor(() => expect(drawImage).toHaveBeenCalled());
    const call = drawImage.mock.calls[0];
    expect(call[3]).toBe(32);
    expect(call[4]).toBe(32);
    expect(call[7]).toBe(32);
    expect(call[8]).toBe(32);
  });
});
