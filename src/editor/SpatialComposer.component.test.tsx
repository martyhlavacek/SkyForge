// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { contentRegistry } from '../game/systems/ContentRegistry';
import { createEditorProject } from './projectStore';
import { SpatialComposer } from './SpatialComposer';

beforeAll(() => {
  const context = {
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    setLineDash: vi.fn(),
    fillText: vi.fn(),
    globalAlpha: 1,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    font: '',
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

describe('SpatialComposer interaction transactions', () => {
  afterEach(cleanup);

  it('commits a dragged paint stroke as one project change', () => {
    const level = contentRegistry.levels.get('level_01');
    if (!level) throw new Error('level fixture missing');
    const project = createEditorProject(level);
    const onChange = vi.fn();
    render(<SpatialComposer project={project} onChange={onChange} />);

    fireEvent.click(screen.getByTitle('Paint (B)'));
    const canvas = screen.getByLabelText('Level map painting canvas');
    Object.defineProperty(canvas, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ left: 0, top: 0, width: 544, height: 960 }),
    });

    fireEvent.pointerDown(canvas, { pointerId: 3, clientX: 16, clientY: 944 });
    fireEvent.pointerMove(canvas, { pointerId: 3, clientX: 48, clientY: 944 });
    fireEvent.pointerMove(canvas, { pointerId: 3, clientX: 80, clientY: 944 });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.pointerUp(canvas, { pointerId: 3, clientX: 80, clientY: 944 });

    expect(onChange).toHaveBeenCalledTimes(1);
    const committed = onChange.mock.calls[0][0];
    const activeLayer = committed.map?.layers.find((layer: { kind: string }) => layer.kind === 'terrainSurface');
    expect(activeLayer?.cells.filter((cell: { row: number }) => cell.row === 0).length).toBeGreaterThanOrEqual(3);
  });
});
