export {};
declare global {
  interface Window {
    __skyforge?: {
      activeScenes: () => string[];
      sceneStatus: (key: string) => 'active' | 'paused' | 'sleeping' | 'stopped';
      playerPos: () => { x: number; y: number } | null;
      levelSnapshot: () => { id: string; levelTime: number } | null;
      terrainState: () => Record<string, string> | null;
      musicState: () => {
        cueId: string | null;
        state: string;
        contextState: string;
      };
      contentErrorCount: () => number;
      setInvulnerable: (enabled: boolean) => void;
      setTimeScale: (scale: number) => void;
      seek: (seconds: number) => void;
      pause: () => void;
      resume: () => void;
      restart: () => void;
      applyAssets: (value: unknown) => string | null;
      previewAsset: (value: unknown) => unknown;
      applyMusic: (value: unknown) => string | null;
      previewMusic: (value: unknown) => void;
      restoreMusic: () => void;
    };
  }
}
