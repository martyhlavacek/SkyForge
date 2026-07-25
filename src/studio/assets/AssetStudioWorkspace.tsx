import { useMemo, useRef, useState } from 'react';
import type {
  AssetStudioPackage,
  StudioAssetDefinition,
  StudioPackage,
  StudioResource,
  StudioTilesetDefinition,
  TuningStudioPackage,
} from '../../schemas/studioPackageSchema';
import {
  createAssetFromResource,
  importImageFile,
  resourceDataUrl,
  sanitizeAssetId,
  sha256Hex,
  sliceAssetFrames,
  bytesToBase64,
} from './AssetResourceTools';
import {
  AssetPreviewCanvas,
  type AssetPreviewContext,
  type AssetPreviewTool,
} from './AssetPreviewCanvas';
import { collectAtlasInputs, packAtlas } from './AssetAtlasPacker';
import { assetReferenceReport, replaceAssetReferences } from './AssetReplacementReport';

const ASSET_KINDS = [
  'playerShip',
  'enemyAircraft',
  'groundVehicle',
  'turret',
  'building',
  'projectile',
  'effect',
  'pickup',
  'ui',
  'terrainTile',
  'overlay',
  'shadow',
] as const;

type AssetKind = (typeof ASSET_KINDS)[number];
type Panel = 'assets' | 'tilesets' | 'atlases' | 'references';

function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="asset-number-field">
      <span>{label}</span>
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function loadImage(resource: StudioResource): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`could not load ${resource.id}`));
    image.src = resourceDataUrl(resource);
  });
}

async function canvasPngResource(
  canvas: HTMLCanvasElement,
  id: string,
  filename: string,
): Promise<StudioResource> {
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (value) => (value ? resolve(value) : reject(new Error('PNG export failed'))),
      'image/png',
    ),
  );
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return {
    id,
    uri: `embedded/${filename}`,
    filename,
    mediaType: 'image/png',
    sha256: await sha256Hex(bytes),
    bytes: bytes.byteLength,
    embeddedData: bytesToBase64(bytes),
    width: canvas.width,
    height: canvas.height,
    license: 'Compiled from source assets; inherit source licenses',
    provenance: {
      source: 'skyforge-atlas-compiler',
      author: '',
      createdWith: 'Skyforge Asset Studio Epoch 14',
      importedAt: new Date().toISOString(),
      notes: 'Deterministic atlas output',
    },
  };
}

function uniqueId(base: string, values: string[]): string {
  let result = sanitizeAssetId(base);
  let index = 2;
  while (values.includes(result)) result = `${sanitizeAssetId(base)}-${index++}`;
  return result;
}

export function AssetStudioWorkspace({
  pkg,
  tuningPack,
  onChange,
  onTuningChange,
  onExport,
  onPreviewRuntime,
}: {
  pkg: AssetStudioPackage;
  tuningPack: TuningStudioPackage;
  onChange: (pkg: StudioPackage) => void;
  onTuningChange: (pkg: TuningStudioPackage) => void;
  onExport: () => void;
  onPreviewRuntime: (assetId: string, context: AssetPreviewContext) => void;
}) {
  const [panel, setPanel] = useState<Panel>('assets');
  const [assetId, setAssetId] = useState(pkg.payload.assets[0]?.id ?? '');
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState<'all' | AssetKind>('all');
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'candidate' | 'approved' | 'rejected'
  >('all');
  const [context, setContext] = useState<AssetPreviewContext>('canyon');
  const [tool, setTool] = useState<AssetPreviewTool>('inspect');
  const [animationName, setAnimationName] = useState('idle');
  const [sliceWidth, setSliceWidth] = useState(32);
  const [sliceHeight, setSliceHeight] = useState(32);
  const [sliceMargin, setSliceMargin] = useState(0);
  const [sliceSpacing, setSliceSpacing] = useState(0);
  const [animationFrames, setAnimationFrames] = useState('0');
  const [animationFps, setAnimationFps] = useState(8);
  const [animationLoop, setAnimationLoop] = useState(true);
  const [newAnimationName, setNewAnimationName] = useState('idle');
  const [provenanceAuthor, setProvenanceAuthor] = useState('');
  const [provenanceLicense, setProvenanceLicense] = useState('All rights reserved');
  const [provenanceTool, setProvenanceTool] = useState('');
  const [message, setMessage] = useState('');
  const [tilesetId, setTilesetId] = useState(pkg.payload.tilesets[0]?.id ?? '');
  const [replacementAssetId, setReplacementAssetId] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  const asset =
    pkg.payload.assets.find((item) => item.id === assetId) ?? pkg.payload.assets[0];
  const resource = asset?.resourceId
    ? pkg.resources.find((item) => item.id === asset.resourceId)
    : undefined;
  const filteredAssets = useMemo(
    () =>
      pkg.payload.assets.filter((item) => {
        const matchesSearch =
          `${item.id} ${item.displayName} ${item.roles.join(' ')} ${item.tags.join(' ')}`
            .toLowerCase()
            .includes(search.toLowerCase());
        return (
          matchesSearch &&
          (kindFilter === 'all' || item.kind === kindFilter) &&
          (statusFilter === 'all' || item.status === statusFilter)
        );
      }),
    [pkg.payload.assets, search, kindFilter, statusFilter],
  );
  const references = useMemo(
    () => assetReferenceReport(pkg, tuningPack),
    [pkg, tuningPack],
  );

  const commit = (mutator: (next: AssetStudioPackage) => void, text?: string) => {
    const next = structuredClone(pkg);
    mutator(next);
    next.manifest.updatedAt = new Date().toISOString();
    onChange(next);
    if (text) setMessage(text);
  };

  const updateSelected = (mutator: (target: StudioAssetDefinition) => void) => {
    commit((next) => {
      const target = next.payload.assets.find((item) => item.id === asset?.id);
      if (target) mutator(target);
    });
  };

  const importImages = async (files: FileList | null) => {
    if (!files?.length) return;
    try {
      const imported: { resource: StudioResource; asset: StudioAssetDefinition }[] = [];
      const ids = new Set(pkg.payload.assets.map((item) => item.id));
      for (const file of [...files]) {
        const importedResource = await importImageFile(file, {
          author: provenanceAuthor,
          license: provenanceLicense,
          attribution: provenanceAuthor,
          createdWith: provenanceTool,
        });
        const definition = createAssetFromResource(importedResource, ids);
        ids.add(definition.id);
        imported.push({ resource: importedResource, asset: definition });
      }
      commit(
        (next) => {
          imported.forEach(({ resource: nextResource, asset: nextAsset }) => {
            const existingResource = next.resources.find(
              (item) => item.sha256 === nextResource.sha256,
            );
            if (existingResource) nextAsset.resourceId = existingResource.id;
            else next.resources.push(nextResource);
            next.payload.assets.push(nextAsset);
          });
        },
        `Imported ${imported.length} verified image${imported.length === 1 ? '' : 's'}.`,
      );
      setAssetId(imported[0].asset.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };

  const sliceSelected = () => {
    if (!asset || !resource) return;
    try {
      const frames = sliceAssetFrames(
        asset.id,
        resource.width ?? asset.width,
        resource.height ?? asset.height,
        sliceWidth,
        sliceHeight,
        sliceMargin,
        sliceSpacing,
      );
      updateSelected((target) => {
        target.width = sliceWidth;
        target.height = sliceHeight;
        target.frames = frames;
        target.animations = {
          idle: { frames: frames.map((_, index) => index), fps: 8, loop: true },
        };
      });
      setAnimationFrames(frames.map((_, index) => index).join(','));
      setMessage(`Sliced ${frames.length} frames.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };

  const saveAnimation = () => {
    if (!asset) return;
    const frames = animationFrames
      .split(',')
      .map((value) => Number(value.trim()))
      .filter(
        (value) =>
          Number.isInteger(value) &&
          value >= 0 &&
          value < Math.max(1, asset.frames.length),
      );
    if (!newAnimationName.trim() || !frames.length) {
      setMessage('Animation requires a name and at least one valid frame index.');
      return;
    }
    updateSelected((target) => {
      target.animations[newAnimationName.trim()] = {
        frames,
        fps: animationFps,
        loop: animationLoop,
      };
    });
    setAnimationName(newAnimationName.trim());
    setMessage(`Saved animation ${newAnimationName.trim()}.`);
  };

  const generateAtlas = async () => {
    try {
      const inputs = collectAtlasInputs(pkg.payload.assets);
      if (!inputs.length)
        throw new Error('Import and approve at least one image-backed asset first.');
      const result = packAtlas(inputs, 1024, 1);
      const canvas = document.createElement('canvas');
      canvas.width = result.width;
      canvas.height = result.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas is unavailable');
      ctx.imageSmoothingEnabled = false;
      const imageCache = new Map<string, HTMLImageElement>();
      for (const placement of result.frames) {
        const sourceAsset = pkg.payload.assets.find(
          (item) => item.id === placement.assetId,
        );
        if (!sourceAsset?.resourceId) continue;
        const sourceResource = pkg.resources.find(
          (item) => item.id === sourceAsset.resourceId,
        );
        if (!sourceResource) continue;
        let image = imageCache.get(sourceResource.id);
        if (!image) {
          image = await loadImage(sourceResource);
          imageCache.set(sourceResource.id, image);
        }
        const frame = sourceAsset.frames[placement.sourceFrame] ?? {
          x: 0,
          y: 0,
          width: sourceAsset.width,
          height: sourceAsset.height,
        };
        ctx.drawImage(
          image,
          frame.x,
          frame.y,
          frame.width,
          frame.height,
          placement.x,
          placement.y,
          placement.width,
          placement.height,
        );
      }
      const fingerprint = sanitizeAssetId(pkg.manifest.id);
      const atlasResource = await canvasPngResource(
        canvas,
        `atlas-${fingerprint}`,
        `${fingerprint}-atlas.png`,
      );
      commit((next) => {
        next.resources = next.resources.filter((item) => item.id !== atlasResource.id);
        next.resources.push(atlasResource);
        next.payload.atlases = next.payload.atlases.filter(
          (item) => item.id !== `${fingerprint}-atlas`,
        );
        next.payload.atlases.push({
          id: `${fingerprint}-atlas`,
          displayName: `${pkg.manifest.name} Atlas`,
          resourceId: atlasResource.id,
          width: result.width,
          height: result.height,
          padding: 1,
          frames: result.frames,
        });
        next.payload.assets.forEach((target) => {
          const placements = result.frames.filter((frame) => frame.assetId === target.id);
          target.atlasFrameIds = placements.map((frame) => frame.id);
          placements.forEach((placement) => {
            if (target.frames[placement.sourceFrame])
              target.frames[placement.sourceFrame].atlasFrameId = placement.id;
          });
        });
      }, `Generated ${result.width}×${result.height} atlas with ${result.frames.length} frames.`);
      setPanel('atlases');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };

  const tileset =
    pkg.payload.tilesets.find((item) => item.id === tilesetId) ?? pkg.payload.tilesets[0];
  const updateTileset = (mutator: (target: StudioTilesetDefinition) => void) => {
    commit((next) => {
      const target = next.payload.tilesets.find((item) => item.id === tileset?.id);
      if (target) mutator(target);
    });
  };

  const createTileset = () => {
    if (!asset?.resourceId) {
      setMessage('Select an image-backed asset before creating a tileset.');
      return;
    }
    const id = uniqueId(
      `${asset.id}-tileset`,
      pkg.payload.tilesets.map((item) => item.id),
    );
    const nextTileset: StudioTilesetDefinition = {
      id,
      displayName: `${asset.displayName} Tileset`,
      resourceId: asset.resourceId,
      tileSize: Math.min(asset.width, asset.height, 32),
      columns: Math.max(
        1,
        Math.floor((resource?.width ?? asset.width) / Math.min(asset.width, 32)),
      ),
      rows: Math.max(
        1,
        Math.floor((resource?.height ?? asset.height) / Math.min(asset.height, 32)),
      ),
      margin: 0,
      spacing: 0,
      materialIds: [],
      autotileRule: 'cardinal',
      autotileMappings: Object.fromEntries(
        Array.from({ length: 16 }, (_, index) => [String(index), index]),
      ),
      tiles: [],
    };
    commit(
      (next) => next.payload.tilesets.push(nextTileset),
      `Created ${nextTileset.displayName}.`,
    );
    setTilesetId(id);
    setPanel('tilesets');
  };

  return (
    <div className="workspace-scroll asset-studio-production">
      <div className="workspace-header">
        <div>
          <h2>Asset Studio</h2>
          <p>
            {pkg.payload.assets.length} assets · {pkg.resources.length} resources ·{' '}
            {pkg.payload.tilesets.length} tilesets · {pkg.payload.atlases.length} atlases
          </p>
        </div>
        <div>
          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/webp"
            multiple
            hidden
            onChange={(event) => void importImages(event.target.files)}
          />
          <button onClick={() => fileInput.current?.click()}>Import PNG/WebP</button>
          <button onClick={generateAtlas}>Build Atlas</button>
          <button className="primary" onClick={onExport}>
            Export .sfassetpack
          </button>
        </div>
      </div>

      <nav className="asset-subtabs">
        {(['assets', 'tilesets', 'atlases', 'references'] as Panel[]).map((value) => (
          <button
            key={value}
            className={panel === value ? 'active' : ''}
            onClick={() => setPanel(value)}
          >
            {value}
          </button>
        ))}
      </nav>

      {panel === 'assets' && asset && (
        <div className="asset-production-grid">
          <aside className="asset-library-panel studio-card">
            <div className="asset-filter-grid">
              <input
                placeholder="Search assets"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <select
                value={kindFilter}
                onChange={(event) =>
                  setKindFilter(event.target.value as 'all' | AssetKind)
                }
              >
                <option value="all">All kinds</option>
                {ASSET_KINDS.map((kind) => (
                  <option key={kind}>{kind}</option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as typeof statusFilter)
                }
              >
                <option value="all">All status</option>
                <option value="candidate">candidate</option>
                <option value="approved">approved</option>
                <option value="rejected">rejected</option>
              </select>
            </div>
            <div className="asset-list production-list">
              {filteredAssets.map((item) => (
                <button
                  className={asset.id === item.id ? 'selected' : ''}
                  key={item.id}
                  onClick={() => setAssetId(item.id)}
                >
                  <span className={`asset-chip kind-${item.kind}`} />
                  <span>
                    {item.displayName}
                    <small>
                      {item.kind} · {item.status}
                    </small>
                  </span>
                </button>
              ))}
            </div>
            <details>
              <summary>Import provenance defaults</summary>
              <label>
                Author
                <input
                  value={provenanceAuthor}
                  onChange={(event) => setProvenanceAuthor(event.target.value)}
                />
              </label>
              <label>
                License
                <input
                  value={provenanceLicense}
                  onChange={(event) => setProvenanceLicense(event.target.value)}
                />
              </label>
              <label>
                Created with
                <input
                  value={provenanceTool}
                  onChange={(event) => setProvenanceTool(event.target.value)}
                />
              </label>
            </details>
          </aside>

          <section className="asset-stage-panel studio-card">
            <div className="asset-preview-toolbar">
              <select
                value={context}
                onChange={(event) =>
                  setContext(event.target.value as AssetPreviewContext)
                }
              >
                {(
                  ['neutral', 'canyon', 'ice', 'space', 'station', 'combat'] as const
                ).map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
              <select
                value={animationName}
                onChange={(event) => setAnimationName(event.target.value)}
              >
                {Object.keys(asset.animations).map((value) => (
                  <option key={value}>{value}</option>
                ))}
                {Object.keys(asset.animations).length === 0 && <option>idle</option>}
              </select>
              <select
                value={tool}
                onChange={(event) => setTool(event.target.value as AssetPreviewTool)}
              >
                <option value="inspect">Inspect</option>
                <option value="pivot">Set pivot</option>
                <option value="hardpoint">Add hardpoint</option>
              </select>
              <button onClick={() => onPreviewRuntime(asset.id, context)}>
                Preview in Runtime
              </button>
            </div>
            <AssetPreviewCanvas
              asset={asset}
              resource={resource}
              context={context}
              animationName={animationName}
              tool={tool}
              onPoint={(x, y) => {
                if (tool === 'pivot') {
                  updateSelected((target) => {
                    target.pivot.x = Math.max(
                      0,
                      Math.min(1, x / Math.max(1, target.width)),
                    );
                    target.pivot.y = Math.max(
                      0,
                      Math.min(1, y / Math.max(1, target.height)),
                    );
                  });
                  setTool('inspect');
                } else if (tool === 'hardpoint') {
                  updateSelected((target) =>
                    target.hardpoints.push({
                      id: uniqueId(
                        'hardpoint',
                        target.hardpoints.map((point) => point.id),
                      ),
                      kind: 'primary',
                      x: Math.round(x * 10) / 10,
                      y: Math.round(y * 10) / 10,
                      rotation: 0,
                      mirrored: false,
                    }),
                  );
                }
              }}
            />
            <div className="asset-stage-summary">
              <span>
                {resource
                  ? `${resource.filename ?? resource.uri} · ${resource.sha256?.slice(0, 12) ?? 'unhashed'}`
                  : `runtime key ${asset.sourceKey ?? 'none'}`}
              </span>
              <span>
                {asset.frames.length || 1} frames · {Object.keys(asset.animations).length}{' '}
                animations
              </span>
            </div>
          </section>

          <aside className="asset-inspector-panel studio-card">
            <h3>Definition</h3>
            <label>
              Name
              <input
                value={asset.displayName}
                onChange={(event) =>
                  updateSelected((target) => {
                    target.displayName = event.target.value;
                  })
                }
              />
            </label>
            <label>
              Kind
              <select
                value={asset.kind}
                onChange={(event) =>
                  updateSelected((target) => {
                    target.kind = event.target.value as AssetKind;
                  })
                }
              >
                {ASSET_KINDS.map((kind) => (
                  <option key={kind}>{kind}</option>
                ))}
              </select>
            </label>
            <label>
              Status
              <select
                value={asset.status}
                onChange={(event) =>
                  updateSelected((target) => {
                    target.status = event.target.value as StudioAssetDefinition['status'];
                  })
                }
              >
                <option>candidate</option>
                <option>approved</option>
                <option>rejected</option>
              </select>
            </label>
            <label>
              Roles
              <input
                value={asset.roles.join(', ')}
                onChange={(event) =>
                  updateSelected((target) => {
                    target.roles = event.target.value
                      .split(',')
                      .map((value) => value.trim())
                      .filter(Boolean);
                  })
                }
              />
            </label>
            <label>
              Tags
              <input
                value={asset.tags.join(', ')}
                onChange={(event) =>
                  updateSelected((target) => {
                    target.tags = event.target.value
                      .split(',')
                      .map((value) => value.trim())
                      .filter(Boolean);
                  })
                }
              />
            </label>
            <NumberField
              label="Scale"
              value={asset.scale}
              min={0.1}
              max={8}
              step={0.05}
              onChange={(value) =>
                updateSelected((target) => {
                  target.scale = value;
                })
              }
            />
            <div className="two-col-fields">
              <NumberField
                label="Pivot X"
                value={asset.pivot.x}
                min={0}
                max={1}
                step={0.01}
                onChange={(value) =>
                  updateSelected((target) => {
                    target.pivot.x = value;
                  })
                }
              />
              <NumberField
                label="Pivot Y"
                value={asset.pivot.y}
                min={0}
                max={1}
                step={0.01}
                onChange={(value) =>
                  updateSelected((target) => {
                    target.pivot.y = value;
                  })
                }
              />
            </div>
            <details open>
              <summary>Sprite slicing</summary>
              <div className="two-col-fields">
                <NumberField
                  label="Frame W"
                  value={sliceWidth}
                  min={1}
                  onChange={setSliceWidth}
                />
                <NumberField
                  label="Frame H"
                  value={sliceHeight}
                  min={1}
                  onChange={setSliceHeight}
                />
                <NumberField
                  label="Margin"
                  value={sliceMargin}
                  min={0}
                  onChange={setSliceMargin}
                />
                <NumberField
                  label="Spacing"
                  value={sliceSpacing}
                  min={0}
                  onChange={setSliceSpacing}
                />
              </div>
              <button onClick={sliceSelected} disabled={!resource}>
                Slice sheet
              </button>
            </details>
            <details open>
              <summary>Animation</summary>
              <label>
                Name
                <input
                  value={newAnimationName}
                  onChange={(event) => setNewAnimationName(event.target.value)}
                />
              </label>
              <label>
                Frame indexes
                <input
                  value={animationFrames}
                  onChange={(event) => setAnimationFrames(event.target.value)}
                />
              </label>
              <NumberField
                label="FPS"
                value={animationFps}
                min={0.1}
                max={60}
                step={0.1}
                onChange={setAnimationFps}
              />
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={animationLoop}
                  onChange={(event) => setAnimationLoop(event.target.checked)}
                />{' '}
                Loop
              </label>
              <button onClick={saveAnimation}>Save animation</button>
            </details>
            <details open>
              <summary>Collision</summary>
              <select
                value={asset.collision?.type ?? 'none'}
                onChange={(event) =>
                  updateSelected((target) => {
                    const value = event.target.value;
                    target.collision =
                      value === 'circle'
                        ? {
                            type: 'circle',
                            radius: Math.min(target.width, target.height) * 0.3,
                            offsetX: 0,
                            offsetY: 0,
                          }
                        : value === 'rectangle'
                          ? {
                              type: 'rectangle',
                              width: target.width * 0.6,
                              height: target.height * 0.6,
                              offsetX: 0,
                              offsetY: 0,
                            }
                          : value === 'polygon'
                            ? {
                                type: 'polygon',
                                points: [
                                  { x: target.width / 2, y: 2 },
                                  { x: target.width - 2, y: target.height - 2 },
                                  { x: 2, y: target.height - 2 },
                                ],
                              }
                            : undefined;
                  })
                }
              >
                <option value="none">none</option>
                <option value="circle">circle</option>
                <option value="rectangle">rectangle</option>
                <option value="polygon">polygon</option>
              </select>
              {asset.collision?.type === 'circle' && (
                <NumberField
                  label="Radius"
                  value={asset.collision.radius}
                  min={1}
                  onChange={(value) =>
                    updateSelected((target) => {
                      if (target.collision?.type === 'circle')
                        target.collision.radius = value;
                    })
                  }
                />
              )}
              {asset.collision?.type === 'rectangle' && (
                <div className="two-col-fields">
                  <NumberField
                    label="Width"
                    value={asset.collision.width}
                    min={1}
                    onChange={(value) =>
                      updateSelected((target) => {
                        if (target.collision?.type === 'rectangle')
                          target.collision.width = value;
                      })
                    }
                  />
                  <NumberField
                    label="Height"
                    value={asset.collision.height}
                    min={1}
                    onChange={(value) =>
                      updateSelected((target) => {
                        if (target.collision?.type === 'rectangle')
                          target.collision.height = value;
                      })
                    }
                  />
                </div>
              )}
            </details>
            <details open>
              <summary>Altitude and shadow</summary>
              <NumberField
                label="Altitude"
                value={asset.presentation.altitude}
                min={0}
                max={200}
                onChange={(value) =>
                  updateSelected((target) => {
                    target.presentation.altitude = value;
                  })
                }
              />
              <div className="two-col-fields">
                <NumberField
                  label="Shadow X"
                  value={asset.presentation.shadowOffsetX}
                  min={-100}
                  max={100}
                  onChange={(value) =>
                    updateSelected((target) => {
                      target.presentation.shadowOffsetX = value;
                    })
                  }
                />
                <NumberField
                  label="Shadow Y"
                  value={asset.presentation.shadowOffsetY}
                  min={-100}
                  max={100}
                  onChange={(value) =>
                    updateSelected((target) => {
                      target.presentation.shadowOffsetY = value;
                    })
                  }
                />
                <NumberField
                  label="Shadow scale X"
                  value={asset.presentation.shadowScaleX}
                  min={0.1}
                  max={3}
                  step={0.05}
                  onChange={(value) =>
                    updateSelected((target) => {
                      target.presentation.shadowScaleX = value;
                    })
                  }
                />
                <NumberField
                  label="Shadow scale Y"
                  value={asset.presentation.shadowScaleY}
                  min={0.1}
                  max={3}
                  step={0.05}
                  onChange={(value) =>
                    updateSelected((target) => {
                      target.presentation.shadowScaleY = value;
                    })
                  }
                />
              </div>
              <NumberField
                label="Shadow opacity"
                value={asset.presentation.shadowOpacity}
                min={0}
                max={1}
                step={0.05}
                onChange={(value) =>
                  updateSelected((target) => {
                    target.presentation.shadowOpacity = value;
                  })
                }
              />
            </details>
            <details>
              <summary>Hardpoints ({asset.hardpoints.length})</summary>
              {asset.hardpoints.map((hardpoint, index) => (
                <div className="hardpoint-row" key={hardpoint.id}>
                  <input
                    value={hardpoint.id}
                    onChange={(event) =>
                      updateSelected((target) => {
                        target.hardpoints[index].id = event.target.value;
                      })
                    }
                  />
                  <select
                    value={hardpoint.kind}
                    onChange={(event) =>
                      updateSelected((target) => {
                        target.hardpoints[index].kind = event.target
                          .value as typeof hardpoint.kind;
                      })
                    }
                  >
                    <option>primary</option>
                    <option>secondary</option>
                    <option>engine</option>
                    <option>effect</option>
                    <option>attachment</option>
                  </select>
                  <button
                    onClick={() =>
                      updateSelected((target) => {
                        target.hardpoints.splice(index, 1);
                      })
                    }
                  >
                    ×
                  </button>
                </div>
              ))}
            </details>
            <button onClick={createTileset}>Use image as tileset</button>
          </aside>
        </div>
      )}

      {panel === 'tilesets' && (
        <div className="asset-secondary-grid">
          <section className="studio-card">
            <h3>Tilesets</h3>
            <select
              value={tileset?.id ?? ''}
              onChange={(event) => setTilesetId(event.target.value)}
            >
              {pkg.payload.tilesets.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.displayName}
                </option>
              ))}
            </select>
            <button onClick={createTileset}>Create from selected asset</button>
          </section>
          {tileset && (
            <section className="studio-card tileset-editor">
              <h3>{tileset.displayName}</h3>
              <label>
                Name
                <input
                  value={tileset.displayName}
                  onChange={(event) =>
                    updateTileset((target) => {
                      target.displayName = event.target.value;
                    })
                  }
                />
              </label>
              <div className="two-col-fields">
                <NumberField
                  label="Tile size"
                  value={tileset.tileSize}
                  min={4}
                  max={256}
                  onChange={(value) =>
                    updateTileset((target) => {
                      target.tileSize = value;
                    })
                  }
                />
                <NumberField
                  label="Columns"
                  value={tileset.columns}
                  min={1}
                  onChange={(value) =>
                    updateTileset((target) => {
                      target.columns = value;
                    })
                  }
                />
                <NumberField
                  label="Rows"
                  value={tileset.rows}
                  min={1}
                  onChange={(value) =>
                    updateTileset((target) => {
                      target.rows = value;
                    })
                  }
                />
                <NumberField
                  label="Spacing"
                  value={tileset.spacing}
                  min={0}
                  onChange={(value) =>
                    updateTileset((target) => {
                      target.spacing = value;
                    })
                  }
                />
              </div>
              <label>
                Autotile rule
                <select
                  value={tileset.autotileRule}
                  onChange={(event) =>
                    updateTileset((target) => {
                      target.autotileRule = event.target
                        .value as StudioTilesetDefinition['autotileRule'];
                    })
                  }
                >
                  <option>none</option>
                  <option>cardinal</option>
                  <option>blob47</option>
                  <option>dualGrid</option>
                  <option>wang</option>
                </select>
              </label>
              <label>
                Material IDs
                <input
                  value={tileset.materialIds.join(', ')}
                  onChange={(event) =>
                    updateTileset((target) => {
                      target.materialIds = event.target.value
                        .split(',')
                        .map((value) => value.trim())
                        .filter(Boolean);
                    })
                  }
                />
              </label>
              <div className="autotile-grid">
                {Array.from(
                  {
                    length:
                      tileset.autotileRule === 'dualGrid'
                        ? 16
                        : tileset.autotileRule === 'wang'
                          ? 16
                          : 16,
                  },
                  (_, mask) => (
                    <label key={mask}>
                      <span>{mask.toString(2).padStart(4, '0')}</span>
                      <input
                        type="number"
                        min={0}
                        value={tileset.autotileMappings[String(mask)] ?? mask}
                        onChange={(event) =>
                          updateTileset((target) => {
                            target.autotileMappings[String(mask)] = Number(
                              event.target.value,
                            );
                          })
                        }
                      />
                    </label>
                  ),
                )}
              </div>
              <p className="foundation-note">
                Cardinal masks use N/E/S/W bits. Dual-grid and Wang mappings preserve the
                same deterministic lookup contract while allowing authored transition
                sheets.
              </p>
            </section>
          )}
        </div>
      )}

      {panel === 'atlases' && (
        <div className="asset-secondary-grid">
          <section className="studio-card">
            <h3>Deterministic atlases</h3>
            <button className="primary" onClick={generateAtlas}>
              Rebuild atlas
            </button>
            <p>
              Assets are sorted by stable ID and frame number before shelf packing.
              Rebuilding unchanged inputs produces identical keys and placement.
            </p>
          </section>
          <section className="studio-card atlas-list">
            {pkg.payload.atlases.map((atlas) => (
              <article key={atlas.id}>
                <strong>{atlas.displayName}</strong>
                <span>
                  {atlas.width}×{atlas.height}
                </span>
                <span>{atlas.frames.length} frames</span>
                <code>{atlas.resourceId}</code>
              </article>
            ))}
            {pkg.payload.atlases.length === 0 && <p>No generated atlas yet.</p>}
          </section>
        </div>
      )}

      {panel === 'references' && (
        <div className="asset-secondary-grid">
          <section className="studio-card">
            <h3>Reference health</h3>
            <p>
              {references.filter((item) => item.severity === 'error').length} errors ·{' '}
              {references.filter((item) => item.severity === 'warning').length} warnings
            </p>
            <div className="reference-report">
              {references.map((issue, index) => (
                <div className={issue.severity} key={`${issue.source}-${index}`}>
                  <strong>{issue.source}</strong>
                  <code>{issue.assetId}</code>
                  <span>{issue.message}</span>
                </div>
              ))}
              {references.length === 0 && (
                <p className="ok">All tuning references resolve to assets.</p>
              )}
            </div>
          </section>
          <section className="studio-card">
            <h3>Replace references</h3>
            <label>
              Missing / old asset
              <input
                value={replacementAssetId}
                onChange={(event) => setReplacementAssetId(event.target.value)}
                placeholder="asset id"
              />
            </label>
            <label>
              Replacement
              <select id="replacement-target">
                <option value="">Select approved asset</option>
                {pkg.payload.assets
                  .filter((item) => item.status === 'approved')
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.displayName}
                    </option>
                  ))}
              </select>
            </label>
            <button
              onClick={() => {
                const select = document.getElementById(
                  'replacement-target',
                ) as HTMLSelectElement | null;
                if (!replacementAssetId || !select?.value) return;
                onTuningChange(
                  replaceAssetReferences(tuningPack, replacementAssetId, select.value),
                );
                setMessage(
                  `Replaced ${replacementAssetId} references with ${select.value}.`,
                );
              }}
            >
              Apply replacement to tuning pack
            </button>
          </section>
        </div>
      )}

      <footer className="asset-message">
        {message ||
          'Import images, classify them, preview presentation, configure gameplay anchors, then export a verified asset pack.'}
      </footer>
    </div>
  );
}
