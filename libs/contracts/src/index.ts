import { z } from 'zod';
// Zod 4 evaluates defaults inside optional fields. PATCH must only change
// explicitly supplied fields, so remove creation defaults before optionalizing.
export function patchSchema<T extends Record<string, z.ZodType>>(schema: z.ZodObject<T>) {
  type PatchShape = {
    [K in keyof T]: z.ZodOptional<T[K] extends z.ZodDefault<infer Inner> ? Inner : T[K]>;
  };
  const shape = Object.fromEntries(
    Object.entries(schema.shape).map(([key, field]) => [
      key,
      ((field instanceof z.ZodDefault ? field.removeDefault() : field) as z.ZodType).optional(),
    ]),
  ) as PatchShape;
  return z.object(shape).strict();
}
export const id = z.string().min(1).max(80);
const text = z.string().trim().max(4000);
const title = z.string().trim().min(2).max(160);
const date = z.iso.date();
const optionalDate = date.nullish();
const positive = z.number().finite().positive().max(1_000_000);
const priority = z.enum(['LOW', 'MEDIUM', 'HIGH']);
const status = z.enum(['PLANNED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED']);
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().max(160).optional(),
  status: z.string().max(40).optional(),
  areaId: id.optional(),
  projectId: id.optional(),
  today: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
  category: z
    .enum(['BUG', 'SUGGESTION', 'UX', 'FEATURE', 'CONTENT', 'COMPLAINT', 'OTHER'])
    .optional(),
});
export const registerSchema = z
  .object({
    email: z
      .email()
      .max(254)
      .transform((value) => value.toLowerCase()),
    password: z.string().min(12).max(128),
    displayName: title,
    language: z.enum(['ar', 'en']).default('ar'),
    timezone: z
      .string()
      .max(80)
      .refine((value) => {
        try {
          new Intl.DateTimeFormat('en', { timeZone: value });
          return true;
        } catch {
          return false;
        }
      }, 'Choose a valid timezone')
      .default('Africa/Cairo'),
    inviteToken: z.string().min(16).max(256).optional(),
  })
  .strict();
export const loginSchema = registerSchema.pick({ email: true, password: true });
export const emailSchema = registerSchema.pick({ email: true });
export const tokenSchema = z.object({ token: z.string().min(32).max(256) }).strict();
export const inviteResolveSchema = z.object({ token: z.string().min(16).max(256) }).strict();
export const resetSchema = tokenSchema.extend({ password: registerSchema.shape.password });
export const profileSchema = patchSchema(
  z.object({
    displayName: title,
    bio: text,
    avatarUrl: z
      .enum([
        '/avatars/dawn.svg',
        '/avatars/grove.svg',
        '/avatars/tide.svg',
        '/avatars/bloom.svg',
        '/avatars/summit.svg',
        '/avatars/moon.svg',
      ])
      .nullable(),
    timezone: registerSchema.shape.timezone,
    language: z.enum(['en', 'ar']),
    theme: z.enum(['light', 'dark', 'system']),
    profileVisibility: z.enum(['PRIVATE', 'FRIENDS']),
    shareChallengeScore: z.boolean(),
    shareStreak: z.boolean(),
    notificationsEnabled: z.boolean(),
    reducedMotion: z.boolean(),
    preferredRoutine: z.enum(['morning', 'afternoon', 'evening']),
  }),
);
export const onboardingSchema = z
  .object({
    areaIds: z.array(id).min(1).max(20),
    goal: title.optional(),
    habit: title.optional(),
    preferredRoutine: z.enum(['morning', 'afternoon', 'evening']).default('morning'),
    profileVisibility: z.enum(['PRIVATE', 'FRIENDS']).default('PRIVATE'),
  })
  .strict();
export const goalSchema = z
  .object({
    title,
    description: text.default(''),
    areaId: id,
    priority: priority.default('MEDIUM'),
    startDate: optionalDate,
    targetDate: optionalDate,
    strategy: z.enum(['MANUAL', 'PROJECT', 'NUMERIC', 'MILESTONE']).default('MANUAL'),
    manualProgress: z.number().min(0).max(100).default(0),
    numericTarget: positive.nullish(),
    numericValue: z.number().min(0).max(1_000_000).default(0),
    unit: z.string().max(40).nullish(),
    notes: text.default(''),
  })
  .strict();
export const goalUpdateSchema = patchSchema(goalSchema)
  .extend({ status: status.optional() })
  .strict();
export const projectSchema = z
  .object({
    title,
    description: text.default(''),
    goalId: id.nullish(),
    priority: priority.default('MEDIUM'),
    startDate: optionalDate,
    deadline: optionalDate,
    notes: text.default(''),
  })
  .strict();
export const projectUpdateSchema = patchSchema(projectSchema)
  .extend({ status: status.optional() })
  .strict();
export const taskSchema = z
  .object({
    title,
    description: text.default(''),
    projectId: id.nullish(),
    goalId: id.nullish(),
    parentId: id.nullish(),
    priority: priority.default('MEDIUM'),
    dueDate: optionalDate,
    startDate: optionalDate,
    estimatedMinutes: z.number().int().min(1).max(10000).nullish(),
    labels: z.array(z.string().max(30)).max(10).default([]),
  })
  .strict();
export const taskUpdateSchema = patchSchema(taskSchema)
  .extend({ status: status.optional() })
  .strict();
export const habitSchema = z
  .object({
    name: title,
    description: text.default(''),
    areaId: id,
    goalId: id.nullish(),
    frequency: z.enum(['DAILY', 'WEEKLY', 'CUSTOM']).default('DAILY'),
    scheduleDays: z.array(z.number().int().min(0).max(6)).max(7).default([]),
    weeklyTarget: z.number().int().min(1).max(7).default(3),
    target: positive.default(1),
    unit: z.string().min(1).max(40).default('times'),
    difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).default('EASY'),
    preferredTime: z.enum(['morning', 'afternoon', 'evening']).default('morning'),
    startDate: date.optional(),
    commitment: z.enum(['flexible', 'committed']).default('flexible'),
    minimumAction: text.default(''),
    whyItMatters: text.default(''),
    notes: text.default(''),
  })
  .strict();
export const habitUpdateSchema = patchSchema(habitSchema)
  .extend({
    status: z.enum(['ACTIVE', 'PAUSED', 'ARCHIVED', 'COMPLETED']).optional(),
    failureReason: text.optional(),
    nextExperiment: text.optional(),
  })
  .strict();
export const habitLogSchema = z
  .object({
    value: positive.optional(),
    minimum: z.boolean().default(false),
    note: text.default(''),
  })
  .strict();
export const experimentSchema = z
  .object({
    reason: title,
    hypothesis: title,
    adjustment: title,
    target: positive.optional(),
    minimumAction: text.optional(),
    preferredTime: z.enum(['morning', 'afternoon', 'evening']).optional(),
    frequency: habitSchema.shape.frequency.removeDefault().optional(),
    scheduleDays: habitSchema.shape.scheduleDays.removeDefault().optional(),
    weeklyTarget: habitSchema.shape.weeklyTarget.removeDefault().optional(),
    commitment: habitSchema.shape.commitment.removeDefault().optional(),
    action: z.enum(['KEEP', 'ADJUST', 'PAUSE', 'ARCHIVE']).default('ADJUST'),
  })
  .strict();
export const checkInSchema = z
  .object({
    mood: z.number().int().min(1).max(5),
    energy: z.number().int().min(1).max(5),
    majorWin: text.default(''),
    difficulty: text.default(''),
    reflection: text.default(''),
    recoveryIntention: text.default(''),
    notes: text.default(''),
    dayComplete: z.boolean().default(true),
  })
  .strict();
export const questSchema = z
  .object({
    title,
    description: text.default(''),
    areaId: id,
    goalId: id.nullish(),
    projectId: id.nullish(),
    habitId: id.nullish(),
    difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).default('MEDIUM'),
    deadline: z.iso.datetime(),
    realReward: text.default(''),
    encouragement: text.default('Small steps add up.'),
    items: z.array(title).min(1).max(12),
  })
  .strict();
export const rewardSchema = z
  .object({
    title,
    titleAr: text.default(''),
    description: text.default(''),
    descriptionAr: text.default(''),
    cost: z.number().int().min(50).max(100000),
    icon: z.string().max(30).default('gift'),
    category: z.string().max(40).default('personal'),
    categoryAr: z.string().max(40).default(''),
    cooldownDays: z.number().int().min(0).max(365).default(0),
    contexts: z
      .array(z.enum(['morning', 'afternoon', 'evening']))
      .max(3)
      .default([]),
    redemptionLimit: z.number().int().min(1).max(1000).nullish(),
    notes: text.default(''),
  })
  .strict();
export const rewardUpdateSchema = patchSchema(rewardSchema).extend({
  active: z.boolean().optional(),
});
export const rewardRatingSchema = z.object({ rating: z.number().int().min(1).max(5) }).strict();
export const rewardSavingsSchema = z
  .object({ targetXp: z.number().int().min(50).max(100000).optional() })
  .strict();
export const redeemSchema = z.object({ idempotencyKey: z.uuid() }).strict();
export const challengeSchema = z
  .object({
    title,
    description: text.default(''),
    scope: z.enum(['LIFE', 'AREA', 'HABIT']).default('LIFE'),
    areaId: id.nullish(),
    habitId: id.nullish(),
    mode: z.enum(['SCORE', 'CONSISTENCY', 'IMPROVEMENT', 'TARGET', 'STREAK', 'COOPERATIVE']),
    startDate: z.iso.datetime(),
    endDate: z.iso.datetime(),
    friendIds: z.array(id).min(1).max(9),
    target: positive.default(7),
    lowerIsBetter: z.boolean().default(false),
    dailyCap: positive.default(100),
    visibility: z.enum(['PRIVATE', 'FRIENDS']).default('PRIVATE'),
  })
  .strict();
export const challengeAcceptSchema = z
  .object({
    habitId: id.nullish(),
    shareScore: z.boolean().default(true),
    shareProgress: z.boolean().default(true),
    shareStreak: z.boolean().default(false),
  })
  .strict();
export const feedbackSchema = z
  .object({
    title,
    description: z.string().trim().min(10).max(8000),
    category: z.enum(['BUG', 'SUGGESTION', 'UX', 'FEATURE', 'CONTENT', 'COMPLAINT', 'OTHER']),
    priority: priority.default('MEDIUM'),
    anonymous: z.boolean().default(false),
  })
  .strict();
export const feedbackAdminSchema = z
  .object({
    status: z
      .enum(['SUBMITTED', 'REVIEWING', 'PLANNED', 'IN_PROGRESS', 'RESOLVED', 'REJECTED', 'CLOSED'])
      .optional(),
    priority: priority.optional(),
    reply: text.optional(),
    internal: z.boolean().default(false),
  })
  .strict();
export type InputOf<T extends z.ZodType> = z.infer<T>;

export const questTemplateSchema = z
  .object({
    title,
    titleAr: title,
    description: text.default(''),
    descriptionAr: text.default(''),
    areaId: id,
    difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).default('MEDIUM'),
    active: z.boolean().default(true),
    items: z.array(title).min(1).max(12),
    itemsAr: z.array(title).max(12).optional(),
  })
  .strict()
  .refine((value) => !value.itemsAr || value.itemsAr.length === value.items.length, {
    path: ['itemsAr'],
    message: 'Provide one Arabic step for each English step.',
  });

export const journeyQuerySchema = z
  .object({
    month: z
      .string()
      .regex(/^(20[2-9][0-9]|21[0-9]{2}|2200)-(0[1-9]|1[0-2])$/)
      .optional(),
  })
  .strict();
