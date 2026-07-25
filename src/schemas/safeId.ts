import { z } from 'zod';

/**
 * Stable authored identifiers are used as lookup keys and, in folder-project
 * tooling, as filesystem path segments. Keep them deliberately conservative.
 */
export const SafeIdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(
    /^[A-Za-z0-9][A-Za-z0-9_-]*$/,
    'must begin with a letter or number and contain only letters, numbers, underscores, and hyphens',
  );

export type SafeId = z.infer<typeof SafeIdSchema>;
