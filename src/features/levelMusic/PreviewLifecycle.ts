/**
 * Releases one preview element without allowing an older rejected play()
 * promise to clear a newer preview's identity.
 */
export function disposeMusicPreview(
  current: HTMLAudioElement | null,
  expected: HTMLAudioElement | null = current,
  revokeObjectUrl: (url: string) => void = URL.revokeObjectURL,
): HTMLAudioElement | null {
  if (!expected) return current;
  expected.pause();
  if (expected.src.startsWith('blob:')) revokeObjectUrl(expected.src);
  expected.removeAttribute('src');
  expected.load();
  return current === expected ? null : current;
}
