export interface StudioReleaseManifest {
  runtimeMusicCueIds: string[];
  resources: {
    packageKey: string;
    resourceId: string;
    sourceUri: string;
    targetPath: string;
    mediaType: string;
    bytes: number;
    sha256: string;
  }[];
}

export function createLock(
  workspace: unknown,
  packages: unknown[],
  generatedAt?: string,
): unknown;

export function compileRelease(options: {
  workspace: unknown;
  packages: unknown[];
  lock: unknown;
  output: string;
  publicDir: string;
}): Promise<StudioReleaseManifest>;
