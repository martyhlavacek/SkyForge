import { z } from 'zod';
import { SafeIdSchema } from './safeId';

export const MusicIntensityStateSchema = z.enum([
  'recovery',
  'normal',
  'combat',
  'critical',
  'boss',
]);

export type MusicIntensityState = z.infer<typeof MusicIntensityStateSchema>;

const gainsSchema = z.object({
  recovery: z.number().min(0).max(1.5),
  normal: z.number().min(0).max(1.5),
  combat: z.number().min(0).max(1.5),
  critical: z.number().min(0).max(1.5),
  boss: z.number().min(0).max(1.5),
});

export const MusicStemSchema = z.object({
  id: SafeIdSchema,
  asset: z.string().min(1),
  defaultGain: z.number().min(0).max(1.5).default(1),
  gains: gainsSchema,
});

export const MusicCueSchema = z
  .object({
    id: SafeIdSchema,
    displayName: z.string().min(1),
    bpm: z.number().positive(),
    beatsPerBar: z.number().int().positive().default(4),
    loopStartSeconds: z.number().nonnegative(),
    loopEndSeconds: z.number().nonnegative(),
    stems: z.array(MusicStemSchema),
    fullMix: z.string().min(1).optional(),
    transitions: z
      .object({
        bossCueId: SafeIdSchema.optional(),
        victoryCueId: SafeIdSchema.optional(),
        defeatCueId: SafeIdSchema.optional(),
      })
      .default({}),
  })
  .superRefine((cue, ctx) => {
    if (cue.stems.length > 0 && cue.loopEndSeconds <= cue.loopStartSeconds) {
      ctx.addIssue({
        code: 'custom',
        path: ['loopEndSeconds'],
        message: 'must be greater than loopStartSeconds when the cue has stems',
      });
    }
    const ids = new Set<string>();
    cue.stems.forEach((stem, index) => {
      if (ids.has(stem.id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['stems', index, 'id'],
          message: `duplicate stem id "${stem.id}"`,
        });
      }
      ids.add(stem.id);
    });
  });

export type MusicStemDef = z.infer<typeof MusicStemSchema>;
export type MusicCueDef = z.infer<typeof MusicCueSchema>;
