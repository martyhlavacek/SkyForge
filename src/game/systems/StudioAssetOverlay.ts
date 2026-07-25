import {
  AssetStudioPackageSchema,
  type AssetStudioPackage,
  type StudioAssetDefinition,
  type StudioResource,
} from '../../schemas/studioPackageSchema';

export type StudioAssetPreviewContext =
  'neutral' | 'canyon' | 'ice' | 'space' | 'station' | 'combat';

export interface StudioAssetPreviewRequest {
  assetId: string;
  context: StudioAssetPreviewContext;
}

function resourceDataUrl(resource: StudioResource): string {
  if (resource.embeddedData)
    return `data:${resource.mediaType};base64,${resource.embeddedData}`;
  const base = import.meta.env.BASE_URL || '/';
  if (/^https?:/i.test(resource.uri)) return resource.uri;
  return `${base}${resource.uri.replace(/^\//, '')}`;
}

class StudioAssetOverlay {
  private package: AssetStudioPackage | null = null;
  private request: StudioAssetPreviewRequest | null = null;

  apply(input: unknown): AssetStudioPackage {
    this.package = AssetStudioPackageSchema.parse(input);
    return structuredClone(this.package);
  }

  setPreview(input: unknown): StudioAssetPreviewRequest {
    const value = input as Partial<StudioAssetPreviewRequest>;
    if (!value.assetId || typeof value.assetId !== 'string')
      throw new Error('asset preview requires assetId');
    const allowed: StudioAssetPreviewContext[] = [
      'neutral',
      'canyon',
      'ice',
      'space',
      'station',
      'combat',
    ];
    const context = allowed.includes(value.context as StudioAssetPreviewContext)
      ? (value.context as StudioAssetPreviewContext)
      : 'neutral';
    this.request = { assetId: value.assetId, context };
    return structuredClone(this.request);
  }

  asset(assetId = this.request?.assetId): StudioAssetDefinition | null {
    if (!assetId) return null;
    return this.package?.payload.assets.find((item) => item.id === assetId) ?? null;
  }

  resource(asset: StudioAssetDefinition): StudioResource | null {
    if (!asset.resourceId) return null;
    return this.package?.resources.find((item) => item.id === asset.resourceId) ?? null;
  }

  textureSource(asset: StudioAssetDefinition): { key: string; uri?: string } | null {
    if (asset.sourceKey) return { key: asset.sourceKey };
    const resource = this.resource(asset);
    if (!resource) return null;
    return {
      key: `studio-asset-${resource.sha256?.slice(0, 16) ?? resource.id}`,
      uri: resourceDataUrl(resource),
    };
  }

  get currentRequest(): StudioAssetPreviewRequest | null {
    return this.request ? structuredClone(this.request) : null;
  }
}

export const studioAssetOverlay = new StudioAssetOverlay();
