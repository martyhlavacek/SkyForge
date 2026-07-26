# Level schema integration

Store these fields in the dedicated `levelMusic` object. The legacy `music`
string remains the adaptive cue fallback and must never be replaced.

```ts
trackId: safeIdSchema.nullable().default(null),
loop: z.boolean().default(true),
volume: z.number().min(0).max(1).default(0.8),
startOffsetSeconds: z.number().min(0).max(86_400).default(0),
fadeSeconds: z.number().min(0).max(10).default(1),
```

Migration rule for existing levels:

```ts
levelMusic: {
  trackId: legacyLevel.levelMusic?.trackId ?? null,
  loop: legacyLevel.levelMusic?.loop ?? true,
  volume: legacyLevel.levelMusic?.volume ?? 0.8,
  startOffsetSeconds: legacyLevel.levelMusic?.startOffsetSeconds ?? 0,
  fadeSeconds: legacyLevel.levelMusic?.fadeSeconds ?? 1,
}
```
