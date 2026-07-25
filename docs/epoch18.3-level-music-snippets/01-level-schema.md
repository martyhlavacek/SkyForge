# Level schema integration

Merge these fields into the existing level `music` schema; do not replace legacy cue fields.

```ts
trackId: safeIdSchema.nullable().default(null),
loop: z.boolean().default(true),
volume: z.number().min(0).max(1).default(0.8),
startOffsetSeconds: z.number().min(0).max(86_400).default(0),
fadeSeconds: z.number().min(0).max(10).default(1),
```

Migration rule for existing levels:

```ts
music: {
  ...legacyMusic,
  trackId: legacyMusic.trackId ?? null,
  loop: legacyMusic.loop ?? true,
  volume: legacyMusic.volume ?? 0.8,
  startOffsetSeconds: legacyMusic.startOffsetSeconds ?? 0,
  fadeSeconds: legacyMusic.fadeSeconds ?? 1,
}
```
