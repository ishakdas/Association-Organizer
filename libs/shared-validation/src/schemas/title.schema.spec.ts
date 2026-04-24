import {
  createMemberTitleSchema,
  updateMemberTitleSchema,
  listMemberTitlesQuerySchema,
  titleResponseSchema,
} from './title.schema';

describe('createMemberTitleSchema', () => {
  describe('name', () => {
    it('accepts 2–100 char names', () => {
      const r = createMemberTitleSchema.safeParse({ name: 'Başkan' });
      expect(r.success).toBe(true);
    });

    it('rejects single-character names', () => {
      const r = createMemberTitleSchema.safeParse({ name: 'B' });
      expect(r.success).toBe(false);
    });

    it('rejects names longer than 100 chars', () => {
      const r = createMemberTitleSchema.safeParse({ name: 'A'.repeat(101) });
      expect(r.success).toBe(false);
    });

    it('rejects when omitted', () => {
      const r = createMemberTitleSchema.safeParse({});
      expect(r.success).toBe(false);
    });
  });

  describe('sortOrder', () => {
    it('defaults to 0', () => {
      const r = createMemberTitleSchema.safeParse({ name: 'Başkan' });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.sortOrder).toBe(0);
    });

    it('coerces string digits to integer', () => {
      const r = createMemberTitleSchema.safeParse({ name: 'Başkan', sortOrder: '3' });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.sortOrder).toBe(3);
    });

    it('rejects negative values', () => {
      const r = createMemberTitleSchema.safeParse({ name: 'Başkan', sortOrder: -1 });
      expect(r.success).toBe(false);
    });

    it('rejects non-integers', () => {
      const r = createMemberTitleSchema.safeParse({ name: 'Başkan', sortOrder: 1.5 });
      expect(r.success).toBe(false);
    });
  });

  describe('isActive', () => {
    it('defaults to true', () => {
      const r = createMemberTitleSchema.safeParse({ name: 'Başkan' });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.isActive).toBe(true);
    });

    it('honors explicit false', () => {
      const r = createMemberTitleSchema.safeParse({ name: 'Başkan', isActive: false });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.isActive).toBe(false);
    });
  });
});

describe('updateMemberTitleSchema', () => {
  it('accepts a single-field name update', () => {
    const r = updateMemberTitleSchema.safeParse({ name: 'Sekreter' });
    expect(r.success).toBe(true);
  });

  it('accepts a single-field sortOrder update', () => {
    const r = updateMemberTitleSchema.safeParse({ sortOrder: 5 });
    expect(r.success).toBe(true);
  });

  it('accepts a single-field isActive update (reactivation)', () => {
    const r = updateMemberTitleSchema.safeParse({ isActive: true });
    expect(r.success).toBe(true);
  });

  it('rejects an empty object (at least one field required)', () => {
    const r = updateMemberTitleSchema.safeParse({});
    expect(r.success).toBe(false);
  });

  it('rejects invalid name length', () => {
    const r = updateMemberTitleSchema.safeParse({ name: 'X' });
    expect(r.success).toBe(false);
  });

  it('rejects negative sortOrder', () => {
    const r = updateMemberTitleSchema.safeParse({ sortOrder: -3 });
    expect(r.success).toBe(false);
  });
});

describe('listMemberTitlesQuerySchema', () => {
  it('parses includeInactive=true to boolean true', () => {
    const r = listMemberTitlesQuerySchema.safeParse({ includeInactive: 'true' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.includeInactive).toBe(true);
  });

  it('parses includeInactive=false to boolean false', () => {
    const r = listMemberTitlesQuerySchema.safeParse({ includeInactive: 'false' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.includeInactive).toBe(false);
  });

  it('defaults to false when omitted', () => {
    const r = listMemberTitlesQuerySchema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.includeInactive).toBe(false);
  });

  it('rejects arbitrary strings', () => {
    const r = listMemberTitlesQuerySchema.safeParse({ includeInactive: 'yes' });
    expect(r.success).toBe(false);
  });
});

describe('titleResponseSchema', () => {
  it('round-trips a valid payload', () => {
    const r = titleResponseSchema.safeParse({
      id: 'title-1',
      name: 'Başkan',
      slug: 'baskan',
      sortOrder: 0,
      isActive: true,
    });
    expect(r.success).toBe(true);
  });

  it('rejects a payload missing slug', () => {
    const r = titleResponseSchema.safeParse({
      id: 'title-1',
      name: 'Başkan',
      sortOrder: 0,
      isActive: true,
    });
    expect(r.success).toBe(false);
  });
});
