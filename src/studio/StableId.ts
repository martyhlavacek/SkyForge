export function createStableId(prefix: string): string {
  const clean = prefix
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const random = globalThis.crypto?.randomUUID?.().replaceAll('-', '').slice(0, 12);
  if (random) return `${clean}-${random}`;
  return `${clean}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
