import type { StudioPackage, StudioPackageType } from '../schemas/studioPackageSchema';

export function packageTypeOf(pkg: StudioPackage): StudioPackageType {
  switch (pkg.format) {
    case 'skyforge-level-pack':
      return 'level';
    case 'skyforge-tuning-pack':
      return 'tuning';
    case 'skyforge-music-pack':
      return 'music';
    case 'skyforge-asset-pack':
      return 'asset';
  }
}
