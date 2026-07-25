import type {
  AssetStudioPackage,
  TuningStudioPackage,
} from '../../schemas/studioPackageSchema';

export interface AssetReferenceIssue {
  severity: 'error' | 'warning';
  source: string;
  assetId: string;
  message: string;
}

export function assetReferenceReport(
  assetPack: AssetStudioPackage,
  tuningPack: TuningStudioPackage,
): AssetReferenceIssue[] {
  const assets = new Map(assetPack.payload.assets.map((asset) => [asset.id, asset]));
  const issues: AssetReferenceIssue[] = [];
  tuningPack.payload.enemies.forEach((enemy) => {
    const asset = assets.get(enemy.sprite);
    if (!asset) {
      issues.push({
        severity: 'error',
        source: `enemy:${enemy.id}`,
        assetId: enemy.sprite,
        message: `enemy references missing asset ${enemy.sprite}`,
      });
    } else if (asset.status !== 'approved') {
      issues.push({
        severity: 'warning',
        source: `enemy:${enemy.id}`,
        assetId: enemy.sprite,
        message: `enemy uses ${asset.status} asset ${enemy.sprite}`,
      });
    }
  });
  tuningPack.payload.equipment.forEach((equipment) => {
    const asset = assets.get(equipment.iconKey);
    if (!asset) {
      issues.push({
        severity: 'warning',
        source: `equipment:${equipment.id}`,
        assetId: equipment.iconKey,
        message: `equipment icon ${equipment.iconKey} is missing`,
      });
    }
  });
  return issues;
}

export function replaceAssetReferences(
  tuningPack: TuningStudioPackage,
  fromAssetId: string,
  toAssetId: string,
): TuningStudioPackage {
  const next = structuredClone(tuningPack);
  next.payload.enemies.forEach((enemy) => {
    if (enemy.sprite === fromAssetId) enemy.sprite = toAssetId;
  });
  next.payload.equipment.forEach((equipment) => {
    if (equipment.iconKey === fromAssetId) equipment.iconKey = toAssetId;
  });
  next.manifest.updatedAt = new Date().toISOString();
  return next;
}
