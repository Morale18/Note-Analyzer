import { z } from 'zod';
import { ALL_STRINGS, MAX_FRET, validateSetup } from './fretboard';
import { NATURAL_NOTES } from './notes';

export const stringIndexSchema = z.number().int().min(0).max(5);
export const pitchClassSchema = z.number().int().min(0).max(11);
export const midiSchema = z.number().int().min(0).max(127);
export const fretSchema = z.number().int().min(0).max(MAX_FRET);
export const timestampSchema = z.number().int().nonnegative();
export const accidentalStyleSchema = z.enum(['sharps', 'flats']);

const hasNoDuplicates = (values: number[]) => new Set(values).size === values.length;

const setupFields = {
  selectedStrings: z.array(stringIndexSchema).refine(hasNoDuplicates, 'Duplicate strings'),
  selectedNotes: z.array(pitchClassSchema).refine(hasNoDuplicates, 'Duplicate notes'),
  fretMin: fretSchema,
  fretMax: fretSchema,
};

function refineSetup(
  setup: z.infer<z.ZodObject<typeof setupFields>>,
  ctx: z.RefinementCtx,
): void {
  for (const message of validateSetup(setup)) ctx.addIssue({ code: 'custom', message });
}

export const earSetupSchema = z.object(setupFields).superRefine(refineSetup);
export type EarSetup = z.infer<typeof earSetupSchema>;

export const DEFAULT_EAR_SETUP: EarSetup = {
  selectedStrings: [...ALL_STRINGS],
  selectedNotes: [...NATURAL_NOTES],
  fretMin: 0,
  fretMax: 12,
};

const settingsFields = {
  ...setupFields,
  accidentalStyle: accidentalStyleSchema,
  /** 0 = only loud notes register, 1 = the quietest notes register. */
  sensitivity: z.number().min(0).max(1),
  weightWeakNotes: z.boolean(),
  /** Defaulted because settings cached on a phone may predate it. */
  ear: earSetupSchema.default(DEFAULT_EAR_SETUP),
};

export const settingsInputSchema = z.object(settingsFields).superRefine(refineSetup);
export const settingsSchema = z
  .object({ ...settingsFields, updatedAt: timestampSchema })
  .superRefine(refineSetup);

export type SettingsInput = z.infer<typeof settingsInputSchema>;
export type Settings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: SettingsInput = {
  selectedStrings: [...ALL_STRINGS],
  selectedNotes: [...NATURAL_NOTES],
  fretMin: 0,
  fretMax: 12,
  accidentalStyle: 'sharps',
  sensitivity: 0.5,
  weightWeakNotes: false,
  ear: DEFAULT_EAR_SETUP,
};

/** Maps the 0–1 sensitivity setting to a noise-gate RMS level (0.1 down to ~0.0003). */
export function sensitivityToGate(sensitivity: number): number {
  return 10 ** (-1 - 2.5 * sensitivity);
}

export const createSessionSchema = z.object({
  id: z.uuid(),
  startedAt: timestampSchema,
});
export type CreateSession = z.infer<typeof createSessionSchema>;

export const endSessionSchema = z.object({ endedAt: timestampSchema });
export type EndSession = z.infer<typeof endSessionSchema>;

export const sessionParamsSchema = z.object({ id: z.uuid() });

export const sessionSchema = z.object({
  id: z.uuid(),
  startedAt: timestampSchema,
  endedAt: timestampSchema.nullable(),
});
export type Session = z.infer<typeof sessionSchema>;

export const attemptSchema = z.object({
  id: z.uuid(),
  sessionId: z.uuid(),
  stringIndex: stringIndexSchema,
  targetNote: pitchClassSchema,
  targetMidi: midiSchema,
  playedMidi: midiSchema,
  correct: z.boolean(),
  responseTimeMs: z.number().int().nonnegative(),
  createdAt: timestampSchema,
});
export type Attempt = z.infer<typeof attemptSchema>;

export const MAX_ATTEMPT_BATCH = 500;

export const attemptBatchSchema = z.object({
  attempts: z.array(attemptSchema).min(1).max(MAX_ATTEMPT_BATCH),
});
/** POST /api/attempts takes one attempt or a batch. */
export const createAttemptsSchema = z.union([attemptBatchSchema, attemptSchema]);
export type CreateAttempts = z.infer<typeof createAttemptsSchema>;

export const createAttemptsResponseSchema = z.object({ inserted: z.number().int().nonnegative() });

const accuracyFields = {
  correct: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  accuracy: z.number().min(0).max(1),
};

export const noteStatSchema = z.object({ note: pitchClassSchema, ...accuracyFields });
export const stringStatSchema = z.object({ stringIndex: stringIndexSchema, ...accuracyFields });
export const sessionStatSchema = z.object({
  id: z.uuid(),
  startedAt: timestampSchema,
  endedAt: timestampSchema.nullable(),
  ...accuracyFields,
});

export const statsSchema = z.object({
  overall: z.object(accuracyFields),
  perNote: z.array(noteStatSchema),
  perString: z.array(stringStatSchema),
  recentSessions: z.array(sessionStatSchema),
});
export type NoteStat = z.infer<typeof noteStatSchema>;
export type StringStat = z.infer<typeof stringStatSchema>;
export type SessionStat = z.infer<typeof sessionStatSchema>;
export type Stats = z.infer<typeof statsSchema>;
