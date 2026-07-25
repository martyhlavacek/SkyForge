import Phaser from 'phaser';
import { DEPTHS, GAME_HEIGHT } from '../config/constants';
import type {
  BiomeDef,
  LevelPackageDef,
  TerrainCellDef,
  TerrainLayerDef,
  TerrainMapDef,
  TerrainObjectDef,
  TerrainObjectSetDef,
} from '../../schemas/terrainSchema';
import { CARDINAL } from './Autotile';
import {
  resolveTerrainFrame,
  resolveTerrainPlaneFrame,
  terrainPlaneTextureKey,
  terrainTextureKey,
} from './TerrainTileset';

export const TERRAIN_EVENTS = {
  STATE_CHANGED: 'terrain:state-changed',
} as const;

export type TerrainObjectState = 'open' | 'closed' | 'active' | 'destroyed';
export type TerrainStateSnapshot = Record<string, TerrainObjectState>;

interface AnimatedTerrainTile {
  image: Phaser.GameObjects.Image;
  cell: TerrainCellDef;
}

interface PlaneVisual {
  layer: TerrainLayerDef;
  tileSprite: Phaser.GameObjects.TileSprite;
  plane: NonNullable<BiomeDef['tileset']>['planes'][number];
}

interface ChunkVisual {
  key: string;
  layer: TerrainLayerDef;
  chunk: number;
  root: Phaser.GameObjects.Container;
  animatedTiles: AnimatedTerrainTile[];
  generatedTextureKey?: string;
}

interface RuntimeObject {
  def: TerrainObjectDef;
  state: TerrainObjectState;
  graphics: Phaser.GameObjects.Graphics;
}

const MAP_LEFT = -2; // 544px authoring grid centered in the 540px visible playfield.
const PREFETCH = 96;

/**
 * Chunked visual terrain renderer.
 *
 * Terrain is presentation-only until the collision mechanic is reconsidered.
 * Epoch 18 composites a continuous sandstone source through chunk-local
 * Blob-47 alpha masks, preventing the 32px texture grid from appearing.
 * Terrain never moves, damages, clamps, or consumes projectiles.
 */
export class TerrainRuntime {
  private readonly materials = new Map<number, BiomeDef['materials'][number]>();
  private readonly layerCells = new Map<string, Map<number, TerrainLayerDef['cells']>>();
  private readonly chunks = new Map<string, ChunkVisual>();
  private readonly planes = new Map<string, PlaneVisual>();
  private readonly objects = new Map<string, RuntimeObject>();
  private elapsed = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    readonly packageDef: LevelPackageDef,
    readonly map: TerrainMapDef,
    readonly objectSet: TerrainObjectSetDef,
    readonly biome: BiomeDef,
    initialState: TerrainStateSnapshot = {},
  ) {
    for (const material of biome.materials) this.materials.set(material.tile, material);
    for (const layer of map.layers) {
      const byChunk = new Map<number, TerrainLayerDef['cells']>();
      for (const cell of layer.cells) {
        const chunk = Math.floor(cell.row / map.chunkRows);
        const list = byChunk.get(chunk) ?? [];
        list.push(cell);
        byChunk.set(chunk, list);
      }
      this.layerCells.set(layer.id, byChunk);
    }
    for (const def of objectSet.objects) {
      const state =
        initialState[def.id] ?? (def.type === 'gate' ? def.initialState : 'active');
      const graphics = scene.add.graphics().setDepth(DEPTHS.GROUND + 3);
      this.objects.set(def.id, { def, state, graphics });
    }
  }

  update(distance: number, dt: number): void {
    this.elapsed += dt;
    this.syncVisibleChunks(distance);
    this.updateObjects(distance);
  }

  setObjectState(id: string, state: 'open' | 'closed' | 'destroyed'): void {
    const object = this.objects.get(id);
    if (!object) return;
    object.state = state;
    this.scene.events.emit(TERRAIN_EVENTS.STATE_CHANGED, { id, state });
  }

  resetDynamicState(snapshot: TerrainStateSnapshot = {}): void {
    for (const object of this.objects.values()) {
      object.state =
        snapshot[object.def.id] ??
        (object.def.type === 'gate' ? object.def.initialState : 'active');
    }
  }

  snapshot(): TerrainStateSnapshot {
    const snapshot: TerrainStateSnapshot = {};
    for (const [id, object] of this.objects) snapshot[id] = object.state;
    return snapshot;
  }

  destroy(): void {
    for (const chunk of this.chunks.values()) this.destroyChunk(chunk);
    this.chunks.clear();
    for (const plane of this.planes.values()) plane.tileSprite.destroy();
    this.planes.clear();
    for (const object of this.objects.values()) object.graphics.destroy();
    this.objects.clear();
  }

  private syncVisibleChunks(distance: number): void {
    const wanted = new Set<string>();
    for (const layer of this.map.layers) {
      if (!layer.visible) continue;
      const effective = distance * layer.scrollRatio;
      if (layer.renderMode === 'tileSprite') {
        this.updatePlane(layer, effective);
        continue;
      }
      const minWorldY = effective - GAME_HEIGHT - PREFETCH;
      const maxWorldY = effective + PREFETCH;
      const minRow = Math.max(
        0,
        Math.floor((minWorldY - this.map.originWorldY) / this.map.tileSize),
      );
      const maxRow = Math.min(
        this.map.rows - 1,
        Math.ceil((maxWorldY - this.map.originWorldY) / this.map.tileSize),
      );
      const first = Math.floor(minRow / this.map.chunkRows);
      const last = Math.floor(maxRow / this.map.chunkRows);
      for (let chunk = first; chunk <= last; chunk++) {
        const key = `${layer.id}:${chunk}`;
        wanted.add(key);
        const visual = this.chunks.get(key) ?? this.createChunk(layer, chunk);
        const chunkWorldY =
          this.map.originWorldY + chunk * this.map.chunkRows * this.map.tileSize;
        visual.root.setY(effective - chunkWorldY);
        this.updateAnimatedTiles(visual);
        if (layer.kind === 'weather') {
          visual.root.setAlpha(
            layer.opacity * (0.75 + 0.25 * Math.sin(this.elapsed * 2.1 + chunk)),
          );
        }
      }
    }
    for (const [key, chunk] of this.chunks) {
      if (!wanted.has(key)) {
        this.destroyChunk(chunk);
        this.chunks.delete(key);
      }
    }
  }

  private updatePlane(layer: TerrainLayerDef, effective: number): void {
    const tileset = this.biome.tileset;
    const material = this.materials.get(layer.materialTile ?? -1);
    if (!tileset || !material) return;
    const plane = tileset.planes.find(
      (candidate) => candidate.materialId === material.id,
    );
    if (!plane) return;
    const textureKey = terrainPlaneTextureKey(tileset.id, plane.materialId);
    if (!this.scene.textures.exists(textureKey)) return;
    let visual = this.planes.get(layer.id);
    if (!visual) {
      const tileSprite = this.scene.add
        .tileSprite(
          MAP_LEFT + this.map.worldWidth / 2,
          GAME_HEIGHT / 2,
          this.map.worldWidth,
          GAME_HEIGHT + PREFETCH * 2,
          textureKey,
          resolveTerrainPlaneFrame(plane, this.elapsed),
        )
        .setDepth(layer.depth)
        .setAlpha(layer.opacity)
        .setScrollFactor(0);
      visual = { layer, tileSprite, plane };
      this.planes.set(layer.id, visual);
    }
    const frame = resolveTerrainPlaneFrame(plane, this.elapsed);
    if (Number(visual.tileSprite.frame.name) !== frame) visual.tileSprite.setFrame(frame);
    visual.tileSprite.tilePositionX = this.elapsed * plane.driftX;
    visual.tileSprite.tilePositionY =
      -effective + this.map.originWorldY + this.elapsed * plane.driftY;
  }

  private createChunk(layer: TerrainLayerDef, chunk: number): ChunkVisual {
    if (layer.renderMode === 'compositedCells') {
      return this.createCompositedChunk(layer, chunk);
    }
    const root = this.scene.add
      .container(0, 0)
      .setDepth(layer.depth)
      .setAlpha(layer.opacity);
    const graphics = this.scene.add.graphics();
    root.add(graphics);
    const animatedTiles: AnimatedTerrainTile[] = [];
    const cells = this.layerCells.get(layer.id)?.get(chunk) ?? [];
    const firstRow = chunk * this.map.chunkRows;
    const tileset = this.biome.tileset;
    const textureKey = tileset ? terrainTextureKey(tileset.id) : '';
    const hasImageTiles = Boolean(tileset && this.scene.textures.exists(textureKey));

    for (const cell of cells) {
      const material = this.materials.get(cell.tile);
      if (!material || material.alpha <= 0) continue;
      const x = MAP_LEFT + cell.x * this.map.tileSize;
      const y = -(cell.row - firstRow + 1) * this.map.tileSize;
      const frame = resolveTerrainFrame(this.biome, cell, layer.id, this.elapsed);

      if (hasImageTiles && frame !== null) {
        const image = this.scene.add
          .image(x + this.map.tileSize / 2, y + this.map.tileSize / 2, textureKey, frame)
          .setDisplaySize(this.map.tileSize, this.map.tileSize)
          .setAlpha(material.alpha);
        root.add(image);
        if (material.animated) animatedTiles.push({ image, cell });
        continue;
      }

      graphics.fillStyle(material.color, material.alpha);
      graphics.fillRect(x, y, this.map.tileSize, this.map.tileSize);
      if (layer.kind === 'terrainDetail') {
        graphics.fillStyle(material.edgeColor, 0.8);
        const mask = cell.variant;
        if (mask === undefined || (mask & CARDINAL.WEST) === 0)
          graphics.fillRect(x, y, 5, this.map.tileSize);
        if (mask !== undefined && (mask & CARDINAL.EAST) === 0)
          graphics.fillRect(x + this.map.tileSize - 5, y, 5, this.map.tileSize);
        if (mask !== undefined && (mask & CARDINAL.NORTH) === 0)
          graphics.fillRect(x, y, this.map.tileSize, 5);
        if (mask !== undefined && (mask & CARDINAL.SOUTH) === 0)
          graphics.fillRect(x, y + this.map.tileSize - 5, this.map.tileSize, 5);
      } else if (material.animated) {
        graphics.fillStyle(material.edgeColor, 0.35);
        graphics.fillRect(x, y + ((cell.row + cell.x) % 4) * 5, this.map.tileSize, 2);
      }
    }
    const visual = {
      key: `${layer.id}:${chunk}`,
      layer,
      chunk,
      root,
      animatedTiles,
    };
    this.chunks.set(visual.key, visual);
    return visual;
  }

  private createCompositedChunk(layer: TerrainLayerDef, chunk: number): ChunkVisual {
    const tileset = this.biome.tileset;
    const fillMaterial = this.materials.get(layer.materialTile ?? -1);
    const cells = this.layerCells.get(layer.id)?.get(chunk) ?? [];
    const root = this.scene.add
      .container(0, 0)
      .setDepth(layer.depth)
      .setAlpha(layer.opacity);
    const visual: ChunkVisual = {
      key: `${layer.id}:${chunk}`,
      layer,
      chunk,
      root,
      animatedTiles: [],
    };
    this.chunks.set(visual.key, visual);

    if (!tileset || !fillMaterial || cells.length === 0) return visual;
    const plane = tileset.planes.find(
      (candidate) => candidate.materialId === fillMaterial.id,
    );
    if (!plane) return visual;
    const planeKey = terrainPlaneTextureKey(tileset.id, plane.materialId);
    const atlasKey = terrainTextureKey(tileset.id);
    if (!this.scene.textures.exists(planeKey) || !this.scene.textures.exists(atlasKey)) {
      return visual;
    }

    const height = this.map.chunkRows * this.map.tileSize;
    const generatedTextureKey = `terrain-composite-${this.map.id}-${layer.id}-${chunk}`;
    if (this.scene.textures.exists(generatedTextureKey)) {
      this.scene.textures.remove(generatedTextureKey);
    }
    const canvasTexture = this.scene.textures.createCanvas(
      generatedTextureKey,
      this.map.worldWidth,
      height,
    );
    if (!canvasTexture) return visual;
    const context = canvasTexture.getContext();
    const fillSource = this.scene.textures.get(planeKey).getSourceImage(0) as CanvasImageSource;
    const sourceWidth = plane.frameWidth;
    const sourceHeight = plane.frameHeight;
    const firstRow = chunk * this.map.chunkRows;
    const worldOffsetY = firstRow * this.map.tileSize;

    context.clearRect(0, 0, this.map.worldWidth, height);
    for (let y = -(worldOffsetY % sourceHeight); y < height; y += sourceHeight) {
      for (let x = 0; x < this.map.worldWidth; x += sourceWidth) {
        context.drawImage(fillSource, x, y, sourceWidth, sourceHeight);
      }
    }

    context.globalCompositeOperation = 'destination-in';
    const atlas = this.scene.textures.get(atlasKey);
    for (const cell of cells) {
      const localRow = cell.row - firstRow;
      const targetX = cell.x * this.map.tileSize;
      const targetY = height - (localRow + 1) * this.map.tileSize;
      const frameIndex = resolveTerrainFrame(this.biome, cell, layer.id, this.elapsed);
      if (frameIndex === null) continue;
      const frame = atlas.get(frameIndex);
      const source = frame.source.image as CanvasImageSource | null;
      if (!source) continue;
      context.drawImage(
        source,
        frame.cutX,
        frame.cutY,
        frame.cutWidth,
        frame.cutHeight,
        targetX,
        targetY,
        this.map.tileSize,
        this.map.tileSize,
      );
    }
    context.globalCompositeOperation = 'source-over';
    canvasTexture.refresh();

    const image = this.scene.add
      .image(
        MAP_LEFT + this.map.worldWidth / 2,
        -height / 2,
        generatedTextureKey,
      )
      .setDisplaySize(this.map.worldWidth, height);
    root.add(image);
    visual.generatedTextureKey = generatedTextureKey;
    return visual;
  }

  private destroyChunk(chunk: ChunkVisual): void {
    chunk.root.destroy(true);
    if (chunk.generatedTextureKey && this.scene.textures.exists(chunk.generatedTextureKey)) {
      this.scene.textures.remove(chunk.generatedTextureKey);
    }
  }

  private updateAnimatedTiles(visual: ChunkVisual): void {
    for (const tile of visual.animatedTiles) {
      const frame = resolveTerrainFrame(
        this.biome,
        tile.cell,
        visual.layer.id,
        this.elapsed,
      );
      if (frame !== null && Number(tile.image.frame.name) !== frame)
        tile.image.setFrame(frame);
    }
  }

  private updateObjects(distance: number): void {
    for (const object of this.objects.values()) {
      const graphics = object.graphics;
      graphics.clear();
      if (object.state === 'destroyed') continue;
      const rects = this.objectRects(object, distance);
      const color = object.def.type === 'gate' ? 0x8b98a8 : 0xb06b3c;
      for (const rect of rects) {
        graphics.fillStyle(0x171b22, 0.7);
        graphics.fillRect(rect.x + 7, rect.y + 8, rect.width, rect.height);
        graphics.fillStyle(color, 1);
        graphics.fillRect(rect.x, rect.y, rect.width, rect.height);
        graphics.lineStyle(2, 0xd8e3ed, 0.65);
        graphics.strokeRect(rect.x, rect.y, rect.width, rect.height);
      }
    }
  }

  private objectWorldRects(object: RuntimeObject): Phaser.Geom.Rectangle[] {
    const def = object.def;
    const y = def.worldY - def.height / 2;
    if (def.type === 'barrier') {
      return [new Phaser.Geom.Rectangle(def.x - def.width / 2, y, def.width, def.height)];
    }
    const opening = object.state === 'open' ? def.openingWidth : 0;
    const wingWidth = (def.width - opening) / 2;
    return [
      new Phaser.Geom.Rectangle(def.x - def.width / 2, y, wingWidth, def.height),
      new Phaser.Geom.Rectangle(def.x + opening / 2, y, wingWidth, def.height),
    ];
  }

  private objectRects(object: RuntimeObject, distance: number): Phaser.Geom.Rectangle[] {
    return this.objectWorldRects(object).map(
      (rect) =>
        new Phaser.Geom.Rectangle(
          MAP_LEFT + rect.x,
          distance - (rect.y + rect.height),
          rect.width,
          rect.height,
        ),
    );
  }
}
