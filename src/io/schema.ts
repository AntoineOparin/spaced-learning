/**
 * Versioned, validated file formats. These are the app's public data contract — your data must
 * outlive the app — so changes need a new version number plus a migration.
 */
import { z } from 'zod';

const ts = z.number().int().nonnegative();
const id = z.string().min(1).max(100);
const dirty = z.union([z.literal(0), z.literal(1)]);
const sync = { updatedAt: ts, deletedAt: ts.optional(), dirty };
const cardState = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]);
const rating = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]);
const step = z.string().regex(/^\d+(\.\d+)?[mhd]$/) as z.ZodType<`${number}${'m' | 'h' | 'd'}`>;

export const courseSchema = z.object({
  id,
  name: z.string().max(200),
  description: z.string().max(5000).optional(),
  order: z.number(),
  desiredRetention: z.number().min(0.7).max(0.99).optional(),
  newPerDay: z.number().int().min(0).max(9999).optional(),
  archived: z.boolean().optional(),
  originKey: z.string().optional(),
  createdAt: ts,
  ...sync,
});

export const topicSchema = z.object({
  id,
  courseId: id,
  parentId: id.nullable(),
  name: z.string().max(200),
  order: z.number(),
  active: z.boolean(),
  originKey: z.string().optional(),
  createdAt: ts,
  ...sync,
});

const fieldsSchema = z.object({
  prompt: z.string().max(20_000),
  answer: z.string().max(20_000),
  explanation: z.string().max(20_000).optional(),
  mnemonic: z.string().max(5_000).optional(),
  source: z.string().max(2_000).optional(),
});

export const itemSchema = z.object({
  id,
  courseId: id,
  topicId: id,
  type: z.enum(['basic', 'cloze']),
  fields: fieldsSchema,
  options: z.object({
    reverse: z.boolean().optional(),
    answerMode: z.enum(['reveal', 'typed']).optional(),
  }),
  tags: z.array(z.string().max(100)).max(50),
  order: z.number(),
  origin: z.object({ deck: z.string(), key: z.string(), version: z.number() }).optional(),
  createdAt: ts,
  ...sync,
});

export const fsrsCardSchema = z.object({
  due: ts,
  stability: z.number().nonnegative(),
  difficulty: z.number().nonnegative(),
  elapsed_days: z.number().nonnegative(),
  scheduled_days: z.number().nonnegative(),
  learning_steps: z.number().int().nonnegative(),
  reps: z.number().int().nonnegative(),
  lapses: z.number().int().nonnegative(),
  state: cardState,
  last_review: ts.optional(),
});

export const cardSchema = z.object({
  id,
  itemId: id,
  courseId: id,
  topicId: id,
  key: z.string().regex(/^(fwd|rev|c\d+)$/),
  suspended: z.boolean(),
  fsrs: fsrsCardSchema,
  due: ts,
  state: cardState,
  ...sync,
});

export const reviewLogSchema = z.object({
  id,
  cardId: id,
  itemId: id,
  courseId: id,
  topicId: id,
  rating,
  state: cardState,
  due: ts,
  stability: z.number().nonnegative(),
  difficulty: z.number().nonnegative(),
  elapsed_days: z.number().nonnegative(),
  last_elapsed_days: z.number().nonnegative(),
  scheduled_days: z.number().nonnegative(),
  learning_steps: z.number().int().nonnegative(),
  review: ts,
  durationMs: z.number().nonnegative(),
  mode: z.enum(['reveal', 'typed', 'drawn']),
  ...sync,
});

export const settingsSchema = z.object({
  id: z.literal('global'),
  desiredRetention: z.number().min(0.7).max(0.99),
  newPerDay: z.number().int().min(0).max(9999),
  dayStartHour: z.number().int().min(0).max(23),
  learningSteps: z.array(step).max(10),
  relearningSteps: z.array(step).max(10),
  maximumInterval: z.number().int().min(1).max(36500),
  enableFuzz: z.boolean(),
  leechThreshold: z.number().int().min(1).max(100),
  fsrsWeights: z.array(z.number()).optional(),
  ...sync,
});

export const BACKUP_FORMAT = 'spaced-learning-backup';
export const CONTENT_FORMAT = 'spaced-learning-content';

export const backupSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.literal(1),
  exportedAt: ts,
  courses: z.array(courseSchema),
  topics: z.array(topicSchema),
  items: z.array(itemSchema),
  cards: z.array(cardSchema),
  reviewLogs: z.array(reviewLogSchema),
  settings: z.array(settingsSchema).max(1),
});
export type BackupFile = z.infer<typeof backupSchema>;

const key = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9][a-z0-9-]*$/, 'keys must be lowercase kebab-case');

export const contentPackSchema = z
  .object({
    format: z.literal(CONTENT_FORMAT),
    version: z.literal(1),
    deck: z.object({ id: key, version: z.number().int().positive(), title: z.string().max(200) }),
    courses: z
      .array(
        z.object({ key, name: z.string().min(1).max(200), description: z.string().optional() }),
      )
      .min(1),
    topics: z.array(
      z.object({
        key,
        courseKey: key,
        parentKey: key.nullable(),
        name: z.string().min(1).max(200),
      }),
    ),
    items: z.array(
      z.object({
        key,
        topicKey: key,
        type: z.enum(['basic', 'cloze']),
        prompt: z.string().min(1).max(20_000),
        answer: z.string().max(20_000),
        explanation: z.string().max(20_000).optional(),
        mnemonic: z.string().max(5_000).optional(),
        source: z.string().max(2_000).optional(),
        reverse: z.boolean().optional(),
        tags: z.array(z.string().max(100)).max(50).optional(),
      }),
    ),
  })
  .superRefine((pack, ctx) => {
    const courseKeys = new Set(pack.courses.map((c) => c.key));
    const topicKeys = new Set<string>();
    for (const [i, t] of pack.topics.entries()) {
      if (topicKeys.has(t.key)) {
        ctx.addIssue({
          code: 'custom',
          path: ['topics', i, 'key'],
          message: `duplicate topic key "${t.key}"`,
        });
      }
      topicKeys.add(t.key);
      if (!courseKeys.has(t.courseKey)) {
        ctx.addIssue({
          code: 'custom',
          path: ['topics', i, 'courseKey'],
          message: `unknown course "${t.courseKey}"`,
        });
      }
    }
    for (const [i, t] of pack.topics.entries()) {
      const parent = t.parentKey ? pack.topics.find((p) => p.key === t.parentKey) : undefined;
      if (t.parentKey && !parent) {
        ctx.addIssue({
          code: 'custom',
          path: ['topics', i, 'parentKey'],
          message: `unknown parent "${t.parentKey}"`,
        });
      } else if (parent?.parentKey) {
        ctx.addIssue({
          code: 'custom',
          path: ['topics', i, 'parentKey'],
          message: 'topics may only be nested one level deep',
        });
      }
    }
    const itemKeys = new Set<string>();
    for (const [i, it] of pack.items.entries()) {
      if (itemKeys.has(it.key)) {
        ctx.addIssue({
          code: 'custom',
          path: ['items', i, 'key'],
          message: `duplicate item key "${it.key}"`,
        });
      }
      itemKeys.add(it.key);
      if (!topicKeys.has(it.topicKey)) {
        ctx.addIssue({
          code: 'custom',
          path: ['items', i, 'topicKey'],
          message: `unknown topic "${it.topicKey}"`,
        });
      }
    }
  });
export type ContentPack = z.infer<typeof contentPackSchema>;

export type ParseResult<T> = { ok: true; data: T } | { ok: false; errors: string[] };

/** Parses JSON text against a schema, returning readable error messages. */
export function parseJson<T>(text: string, schema: z.ZodType<T>, maxErrors = 10): ParseResult<T> {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (err) {
    return {
      ok: false,
      errors: [`Not valid JSON: ${err instanceof Error ? err.message : String(err)}`],
    };
  }
  const result = schema.safeParse(raw);
  if (result.success) return { ok: true, data: result.data };
  const errors = result.error.issues.slice(0, maxErrors).map((issue) => {
    const path = issue.path.length ? issue.path.join('.') : '(root)';
    return `${path}: ${issue.message}`;
  });
  if (result.error.issues.length > maxErrors) {
    errors.push(`…and ${result.error.issues.length - maxErrors} more problems`);
  }
  return { ok: false, errors };
}
