// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { contentRegistry } from '../game/systems/ContentRegistry';
import { createEditorProject } from './projectStore';
import { MapViewport } from './MapViewport';

beforeAll(() => {
  const context = {
    clearRect: vi.fn(),
    fillRect: vi.fn(),
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
  Object.defineProperty(HTMLCanvasElement.prototype, 'setPointerCapture', {
    configurable: true,
    value: vi.fn(),
  });
  Object.defineProperty(HTMLCanvasElement.prototype, 'releasePointerCapture', {
    configurable: true,
    value: vi.fn(),
  });
  Object.defineProperty(HTMLCanvasElement.prototype, 'hasPointerCapture', {
    configurable: true,
    value: () => true,
  });
});

describe('MapViewport component', () => {
  afterEach(cleanup);
  it('paints the cell selected by a pointer stroke', () => {
    const level = contentRegistry.levels.get('level_01');
    if (!level) throw new Error('level fixture missing');
    const project = createEditorProject(level);
    const layerId = project.map?.layers[0]?.id;
    if (!layerId) throw new Error('map layer fixture missing');
    const onPaint = vi.fn();
    const onGestureStart = vi.fn();
    const onGestureEnd = vi.fn();
    render(
      <MapViewport
        project={project}
        mode="paint"
        layerId={layerId}
        selectedTile={1}
        startRow={0}
        soloLayerId={null}
        shipRadius={18}
        zoom={1}
        onPaint={onPaint}
        onMoveBoundary={vi.fn()}
        onMoveRoute={vi.fn()}
        onMoveObject={vi.fn()}
        onGestureStart={onGestureStart}
        onGestureEnd={onGestureEnd}
      />,
    );
    const canvas = screen.getByLabelText('Level map painting canvas');
    Object.defineProperty(canvas, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ left: 0, top: 0, width: 544, height: 960 }),
    });

    fireEvent.pointerDown(canvas, {
      pointerId: 7,
      clientX: 16,
      clientY: 944,
    });
    fireEvent.pointerMove(canvas, {
      pointerId: 7,
      clientX: 48,
      clientY: 944,
    });
    fireEvent.pointerUp(canvas, { pointerId: 7 });

    expect(onPaint).toHaveBeenNthCalledWith(1, 0, 0, 1);
    expect(onPaint).toHaveBeenNthCalledWith(2, 1, 0, 1);
    expect(onGestureStart).toHaveBeenCalledTimes(1);
    expect(onGestureEnd).toHaveBeenCalledTimes(1);
  });
});
