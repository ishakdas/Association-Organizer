import {
  createTaskSchema,
  reminderFrequencyEnum,
} from './task.schema';

const baseInput = {
  title: 'Yıllık raporu hazırla',
  assignedToUserId: 'ckv0000testuser00000000001',
  priority: 'MEDIUM' as const,
  reminderFrequency: 'NONE' as const,
};

describe('reminderFrequencyEnum', () => {
  it('accepts the full Prisma set including ONCE and MONTHLY', () => {
    expect(reminderFrequencyEnum.options).toEqual([
      'NONE',
      'ONCE',
      'DAILY',
      'WEEKLY',
      'MONTHLY',
    ]);
  });
});

describe('createTaskSchema', () => {
  it('accepts a minimal valid input', () => {
    const r = createTaskSchema.safeParse(baseInput);
    expect(r.success).toBe(true);
  });

  it('rejects when reminderFrequency is set without reminderAt', () => {
    const r = createTaskSchema.safeParse({
      ...baseInput,
      reminderFrequency: 'DAILY',
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const issue = r.error.issues.find(
        (i) => i.path[0] === 'reminderAt',
      );
      expect(issue?.message).toMatch(/Hatırlatma için tarih girin/);
    }
  });

  it('accepts ONCE frequency with a reminderAt anchor', () => {
    const r = createTaskSchema.safeParse({
      ...baseInput,
      reminderFrequency: 'ONCE',
      reminderAt: '2030-01-01T09:00:00.000Z',
    });
    expect(r.success).toBe(true);
  });

  it('rejects when reminderAt is after dueDate', () => {
    const r = createTaskSchema.safeParse({
      ...baseInput,
      reminderFrequency: 'ONCE',
      dueDate: '2030-01-01T00:00:00.000Z',
      reminderAt: '2030-02-01T00:00:00.000Z',
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const issue = r.error.issues.find((i) => i.path[0] === 'reminderAt');
      expect(issue?.message).toMatch(/bitiş tarihinden önce/);
    }
  });

  it('accepts when reminderAt is before dueDate', () => {
    const r = createTaskSchema.safeParse({
      ...baseInput,
      reminderFrequency: 'ONCE',
      dueDate: '2030-02-01T00:00:00.000Z',
      reminderAt: '2030-01-15T09:00:00.000Z',
    });
    expect(r.success).toBe(true);
  });

  it('rejects an invalid assignedToUserId (not cuid)', () => {
    const r = createTaskSchema.safeParse({
      ...baseInput,
      assignedToUserId: 'not-a-cuid',
    });
    expect(r.success).toBe(false);
  });

  it('rejects too-short title', () => {
    const r = createTaskSchema.safeParse({ ...baseInput, title: 'a' });
    expect(r.success).toBe(false);
  });
});
