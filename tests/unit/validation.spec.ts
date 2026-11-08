import { describe, expect, it } from 'vitest';
import {
  challengeSchema,
  habitUpdateSchema,
  goalUpdateSchema,
  taskUpdateSchema,
  projectUpdateSchema,
  habitLogSchema,
  paginationSchema,
  profileSchema,
  registerSchema,
  rewardSchema,
} from '@mirhal/contracts';
describe('External input validation', () => {
  it('rejects mass assignment and weak passwords', () => {
    expect(
      registerSchema.safeParse({
        email: 'user@example.com',
        password: 'short',
        displayName: 'User',
      }).success,
    ).toBe(false);
    expect(
      registerSchema.safeParse({
        email: 'user@example.com',
        password: 'a-strong-test-password',
        displayName: 'User',
        role: 'SUPER_ADMIN',
      }).success,
    ).toBe(false);
  });
  it('normalizes email and validates timezone', () => {
    expect(
      registerSchema.parse({
        email: '  USER@example.com  ',
        password: 'a-strong-test-password',
        displayName: 'User',
      }).email,
    ).toBe('user@example.com');
    expect(profileSchema.safeParse({ timezone: 'invalid/timezone' }).success).toBe(false);
  });
  it('accepts local avatar choices and rejects remote tracking URLs', () => {
    expect(profileSchema.parse({ avatarUrl: '/avatars/dawn.svg' }).avatarUrl).toBe(
      '/avatars/dawn.svg',
    );
    expect(
      profileSchema.safeParse({ avatarUrl: 'https://external.example/avatar.svg' }).success,
    ).toBe(false);
    expect(profileSchema.parse({ avatarUrl: null }).avatarUrl).toBeNull();
  });
  it('does not accept client XP, score, or log dates', () => {
    expect(habitLogSchema.safeParse({ value: 1, xpReward: 10000 }).success).toBe(false);
    expect(habitLogSchema.safeParse({ date: '2025-01-01' }).success).toBe(false);
    expect(challengeSchema.safeParse({ score: 1000 }).success).toBe(false);
  });
  it('never applies creation defaults to partial updates', () => {
    expect(habitUpdateSchema.parse({ areaId: 'area-mind' })).toEqual({ areaId: 'area-mind' });
    expect(goalUpdateSchema.parse({ title: 'Changed title' })).toEqual({ title: 'Changed title' });
    expect(taskUpdateSchema.parse({ status: 'COMPLETED' })).toEqual({ status: 'COMPLETED' });
    expect(projectUpdateSchema.parse({ notes: 'Some notes' })).toEqual({ notes: 'Some notes' });
    expect(profileSchema.parse({ language: 'ar' })).toEqual({ language: 'ar' });
  });
  it('bounds pagination and reward costs', () => {
    expect(paginationSchema.parse({ page: '2', limit: '10' })).toMatchObject({
      page: 2,
      limit: 10,
    });
    expect(paginationSchema.safeParse({ limit: 100000 }).success).toBe(false);
    expect(rewardSchema.safeParse({ title: 'Coffee', cost: -1 }).success).toBe(false);
  });
});

describe('Patch defaults stay absent across every optional field', () => {
  it('leaves empty updates empty', () => {
    for (const schema of [
      habitUpdateSchema,
      goalUpdateSchema,
      taskUpdateSchema,
      projectUpdateSchema,
      profileSchema,
    ])
      expect(schema.parse({})).toEqual({});
  });
});
