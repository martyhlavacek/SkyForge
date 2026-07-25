import {
  MusicStudioPackageSchema,
  type MusicStudioPackage,
  type StudioResource,
} from '../../schemas/studioPackageSchema';
import type { MusicCueDef, MusicIntensityState } from '../../schemas/musicSchema';
import { contentRegistry } from './ContentRegistry';
import { music } from './MusicDirector';

function resourceUrl(resource: StudioResource): string {
  if (resource.embeddedData)
    return `data:${resource.mediaType};base64,${resource.embeddedData}`;
  if (/^https?:/i.test(resource.uri)) return resource.uri;
  return resource.uri;
}

function resolvedCue(cue: MusicCueDef, resources: StudioResource[]): MusicCueDef {
  const byUri = new Map(resources.map((resource) => [resource.uri, resource]));
  const resolve = (uri: string): string => {
    const resource = byUri.get(uri);
    return resource ? resourceUrl(resource) : uri;
  };
  return {
    ...structuredClone(cue),
    fullMix: cue.fullMix ? resolve(cue.fullMix) : undefined,
    stems: cue.stems.map((stem) => ({ ...stem, asset: resolve(stem.asset) })),
  };
}

class StudioMusicOverlay {
  private baseline: MusicCueDef[] | null = null;
  private activePackage: MusicStudioPackage | null = null;

  apply(input: unknown): MusicStudioPackage {
    const pkg = MusicStudioPackageSchema.parse(input);
    if (!this.baseline)
      this.baseline = [...contentRegistry.music.values()].map((cue) => structuredClone(cue));
    contentRegistry.music.clear();
    pkg.payload.cues.forEach((cue) =>
      contentRegistry.music.set(cue.id, resolvedCue(cue, pkg.resources)),
    );
    this.activePackage = structuredClone(pkg);
    music.clearBufferCache();
    return structuredClone(pkg);
  }

  async preview(input: unknown): Promise<void> {
    const value = input as {
      cueId?: unknown;
      state?: unknown;
      offsetSeconds?: unknown;
    };
    if (typeof value.cueId !== 'string') throw new Error('music preview requires cueId');
    const states: MusicIntensityState[] = ['recovery', 'normal', 'combat', 'critical', 'boss'];
    const state = states.includes(value.state as MusicIntensityState)
      ? (value.state as MusicIntensityState)
      : 'normal';
    const offset = Number.isFinite(Number(value.offsetSeconds))
      ? Math.max(0, Number(value.offsetSeconds))
      : 0;
    await music.playCue(value.cueId, state, offset);
  }

  restore(): void {
    if (!this.baseline) return;
    music.stop();
    contentRegistry.music.clear();
    this.baseline.forEach((cue) => contentRegistry.music.set(cue.id, structuredClone(cue)));
    this.activePackage = null;
    music.clearBufferCache();
  }

  get activeId(): string | null {
    return this.activePackage?.manifest.id ?? null;
  }
}

export const studioMusicOverlay = new StudioMusicOverlay();
