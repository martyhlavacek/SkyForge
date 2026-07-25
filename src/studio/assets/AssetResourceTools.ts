import type {
  StudioAssetDefinition,
  StudioResource,
} from '../../schemas/studioPackageSchema';

const IMAGE_TYPES = new Set(['image/png', 'image/webp', 'image/jpeg']);

export function sanitizeAssetId(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || 'asset';
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

export function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1)
    bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const buffer = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return [...new Uint8Array(buffer)]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

export function resourceDataUrl(resource: StudioResource): string {
  if (resource.embeddedData)
    return `data:${resource.mediaType};base64,${resource.embeddedData}`;
  const base = import.meta.env.BASE_URL || '/';
  if (/^https?:/i.test(resource.uri)) return resource.uri;
  return `${base}${resource.uri.replace(/^\//, '')}`;
}

async function readImageDimensions(
  blob: Blob,
): Promise<{ width: number; height: number }> {
  if ('createImageBitmap' in globalThis) {
    const bitmap = await createImageBitmap(blob);
    const dimensions = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return dimensions;
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('could not decode image dimensions'));
    };
    image.src = url;
  });
}

export async function importImageFile(
  file: File,
  metadata: {
    author?: string;
    license?: string;
    attribution?: string;
    createdWith?: string;
    notes?: string;
  } = {},
): Promise<StudioResource> {
  if (!IMAGE_TYPES.has(file.type))
    throw new Error(`${file.name}: only PNG, WebP, and JPEG images are supported`);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const sha256 = await sha256Hex(bytes);
  const dimensions = await readImageDimensions(file);
  const baseId = sanitizeAssetId(file.name);
  return {
    id: `image-${baseId}-${sha256.slice(0, 12)}`,
    uri: `embedded/${file.name}`,
    filename: file.name,
    mediaType: file.type,
    sha256,
    bytes: bytes.byteLength,
    embeddedData: bytesToBase64(bytes),
    width: dimensions.width,
    height: dimensions.height,
    license: metadata.license || 'Unspecified — review before approval',
    attribution: metadata.attribution || metadata.author || '',
    provenance: {
      source: 'local-import',
      author: metadata.author || '',
      createdWith: metadata.createdWith || '',
      importedAt: new Date().toISOString(),
      notes: metadata.notes || '',
    },
  };
}

export async function verifyEmbeddedResource(
  resource: StudioResource,
): Promise<string[]> {
  const issues: string[] = [];
  if (!resource.embeddedData) return issues;
  let bytes: Uint8Array;
  try {
    bytes = base64ToBytes(resource.embeddedData);
  } catch {
    return ['embedded image is not valid base64'];
  }
  if (resource.bytes !== undefined && bytes.byteLength !== resource.bytes)
    issues.push(
      `byte count mismatch: manifest ${resource.bytes}, decoded ${bytes.byteLength}`,
    );
  if (resource.sha256) {
    const actual = await sha256Hex(bytes);
    if (actual !== resource.sha256)
      issues.push(`SHA-256 mismatch: expected ${resource.sha256}, received ${actual}`);
  }
  if (!IMAGE_TYPES.has(resource.mediaType))
    issues.push(`embedded resource media type ${resource.mediaType} is not PNG, WebP, or JPEG`);
  return issues;
}

export async function verifyAssetPackageResources(
  resources: StudioResource[],
): Promise<void> {
  const failures: string[] = [];
  for (const resource of resources) {
    const issues = await verifyEmbeddedResource(resource);
    issues.forEach((issue) => failures.push(`${resource.id}: ${issue}`));
  }
  if (failures.length)
    throw new Error(`asset resource verification failed: ${failures.join('; ')}`);
}

export function createAssetFromResource(
  resource: StudioResource,
  existingIds: Set<string>,
): StudioAssetDefinition {
  const base = sanitizeAssetId(resource.filename ?? resource.id);
  let id = base;
  let sequence = 2;
  while (existingIds.has(id)) id = `${base}-${sequence++}`;
  const width = resource.width ?? 32;
  const height = resource.height ?? 32;
  return {
    id,
    displayName: (resource.filename ?? id).replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '),
    kind: 'effect',
    status: 'candidate',
    roles: [],
    tags: ['imported'],
    resourceId: resource.id,
    width,
    height,
    scale: 1,
    pivot: { x: 0.5, y: 0.5 },
    frames: [{ id: `${id}-frame-0`, x: 0, y: 0, width, height, durationMs: 100 }],
    hardpoints: [],
    presentation: {
      altitude: 0,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      shadowScaleX: 1,
      shadowScaleY: 0.65,
      shadowOpacity: 0.35,
    },
    animations: { idle: { frames: [0], fps: 8, loop: true } },
    atlasFrameIds: [],
  };
}

export function sliceAssetFrames(
  assetId: string,
  imageWidth: number,
  imageHeight: number,
  frameWidth: number,
  frameHeight: number,
  margin = 0,
  spacing = 0,
): StudioAssetDefinition['frames'] {
  if (frameWidth <= 0 || frameHeight <= 0) throw new Error('frame size must be positive');
  const frames: StudioAssetDefinition['frames'] = [];
  let index = 0;
  for (let y = margin; y + frameHeight <= imageHeight; y += frameHeight + spacing) {
    for (let x = margin; x + frameWidth <= imageWidth; x += frameWidth + spacing) {
      frames.push({
        id: `${assetId}-frame-${index++}`,
        x,
        y,
        width: frameWidth,
        height: frameHeight,
        durationMs: 100,
      });
    }
  }
  if (!frames.length) throw new Error('slice settings produce no complete frames');
  return frames;
}
