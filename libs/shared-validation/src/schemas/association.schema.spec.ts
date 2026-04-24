import {
  createAssociationSchema,
  listAssociationsQuerySchema,
} from './association.schema';

// Minimal valid input — individual tests override one field at a time.
const validInput = {
  name: 'Örnek Derneği',
  taxNumber: '1234567890',
  foundedAt: '2020-01-15T00:00:00.000Z',
  address: 'Moda Mah. Caferağa Sok. No:12',
  city: 'İstanbul',
  district: 'Kadıköy',
  phone: '0555 111 22 33',
  email: 'info@ornek.test',
  activityArea: 'Eğitim',
};

describe('createAssociationSchema', () => {
  describe('name', () => {
    it('accepts 2–200 char names', () => {
      const r = createAssociationSchema.safeParse({ ...validInput, name: 'AB' });
      expect(r.success).toBe(true);
    });

    it('rejects when missing', () => {
      const { name: _omit, ...rest } = validInput;
      const r = createAssociationSchema.safeParse(rest);
      expect(r.success).toBe(false);
    });

    it('rejects when shorter than 2 chars', () => {
      const r = createAssociationSchema.safeParse({ ...validInput, name: 'A' });
      expect(r.success).toBe(false);
    });

    it('rejects when longer than 200 chars', () => {
      const r = createAssociationSchema.safeParse({
        ...validInput,
        name: 'A'.repeat(201),
      });
      expect(r.success).toBe(false);
    });
  });

  describe('taxNumber', () => {
    it('accepts exactly 10 digits', () => {
      const r = createAssociationSchema.safeParse({
        ...validInput,
        taxNumber: '9876543210',
      });
      expect(r.success).toBe(true);
    });

    it('rejects when shorter than 10', () => {
      const r = createAssociationSchema.safeParse({
        ...validInput,
        taxNumber: '123456789',
      });
      expect(r.success).toBe(false);
    });

    it('rejects when longer than 10', () => {
      const r = createAssociationSchema.safeParse({
        ...validInput,
        taxNumber: '12345678901',
      });
      expect(r.success).toBe(false);
    });

    it('rejects non-numeric characters', () => {
      const r = createAssociationSchema.safeParse({
        ...validInput,
        taxNumber: '12345abcde',
      });
      expect(r.success).toBe(false);
    });

    it('rejects whitespace-containing input', () => {
      const r = createAssociationSchema.safeParse({
        ...validInput,
        taxNumber: '123 456 789',
      });
      expect(r.success).toBe(false);
    });
  });

  describe('email', () => {
    it('accepts valid email', () => {
      const r = createAssociationSchema.safeParse({
        ...validInput,
        email: 'contact@ornek.org',
      });
      expect(r.success).toBe(true);
    });

    it('rejects invalid format', () => {
      const r = createAssociationSchema.safeParse({
        ...validInput,
        email: 'not-an-email',
      });
      expect(r.success).toBe(false);
    });

    it('rejects empty string', () => {
      const r = createAssociationSchema.safeParse({ ...validInput, email: '' });
      expect(r.success).toBe(false);
    });
  });

  describe('phone (libphonenumber-js normalize)', () => {
    it('normalizes Turkish local format to +90 E.164', () => {
      const r = createAssociationSchema.safeParse({
        ...validInput,
        phone: '0555 111 22 33',
      });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.phone).toBe('+905551112233');
    });

    it('normalizes already-+90 input', () => {
      const r = createAssociationSchema.safeParse({
        ...validInput,
        phone: '+90 555 111 22 33',
      });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.phone).toBe('+905551112233');
    });

    it('normalizes unspaced local format', () => {
      const r = createAssociationSchema.safeParse({
        ...validInput,
        phone: '05551112233',
      });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.phone).toBe('+905551112233');
    });

    it('rejects clearly invalid number', () => {
      const r = createAssociationSchema.safeParse({
        ...validInput,
        phone: '12',
      });
      expect(r.success).toBe(false);
    });

    it('rejects empty string', () => {
      const r = createAssociationSchema.safeParse({ ...validInput, phone: '' });
      expect(r.success).toBe(false);
    });
  });

  describe('memberCount', () => {
    it('accepts 0', () => {
      const r = createAssociationSchema.safeParse({
        ...validInput,
        memberCount: 0,
      });
      expect(r.success).toBe(true);
    });

    it('accepts positive integers', () => {
      const r = createAssociationSchema.safeParse({
        ...validInput,
        memberCount: 1234,
      });
      expect(r.success).toBe(true);
    });

    it('rejects negative integers', () => {
      const r = createAssociationSchema.safeParse({
        ...validInput,
        memberCount: -1,
      });
      expect(r.success).toBe(false);
    });

    it('rejects non-integer floats', () => {
      const r = createAssociationSchema.safeParse({
        ...validInput,
        memberCount: 3.14,
      });
      expect(r.success).toBe(false);
    });

    it('defaults to 0 when omitted', () => {
      const r = createAssociationSchema.safeParse(validInput);
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.memberCount).toBe(0);
    });
  });

  describe('notes', () => {
    it('is optional (omitted)', () => {
      const r = createAssociationSchema.safeParse(validInput);
      expect(r.success).toBe(true);
    });

    it('accepts up to 2000 chars', () => {
      const r = createAssociationSchema.safeParse({
        ...validInput,
        notes: 'a'.repeat(2000),
      });
      expect(r.success).toBe(true);
    });

    it('rejects over 2000 chars', () => {
      const r = createAssociationSchema.safeParse({
        ...validInput,
        notes: 'a'.repeat(2001),
      });
      expect(r.success).toBe(false);
    });
  });

  describe('foundedAt', () => {
    it('accepts a past ISO 8601 datetime', () => {
      const r = createAssociationSchema.safeParse({
        ...validInput,
        foundedAt: '2010-06-01T00:00:00.000Z',
      });
      expect(r.success).toBe(true);
    });

    it('rejects a future ISO datetime', () => {
      const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const r = createAssociationSchema.safeParse({
        ...validInput,
        foundedAt: future,
      });
      expect(r.success).toBe(false);
    });

    it('rejects non-ISO date string', () => {
      const r = createAssociationSchema.safeParse({
        ...validInput,
        foundedAt: '15/01/2020',
      });
      expect(r.success).toBe(false);
    });

    it('rejects empty string', () => {
      const r = createAssociationSchema.safeParse({
        ...validInput,
        foundedAt: '',
      });
      expect(r.success).toBe(false);
    });
  });

  describe('isActive', () => {
    it('defaults to true', () => {
      const r = createAssociationSchema.safeParse(validInput);
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.isActive).toBe(true);
    });

    it('honors explicit false', () => {
      const r = createAssociationSchema.safeParse({
        ...validInput,
        isActive: false,
      });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.isActive).toBe(false);
    });
  });
});

describe('listAssociationsQuerySchema', () => {
  it('defaults page to 1 and pageSize to 20', () => {
    const r = listAssociationsQuerySchema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.page).toBe(1);
      expect(r.data.pageSize).toBe(20);
    }
  });

  it('coerces numeric strings', () => {
    const r = listAssociationsQuerySchema.safeParse({
      page: '3',
      pageSize: '50',
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.page).toBe(3);
      expect(r.data.pageSize).toBe(50);
    }
  });

  it('caps pageSize at 100', () => {
    const r = listAssociationsQuerySchema.safeParse({ pageSize: 101 });
    expect(r.success).toBe(false);
  });

  it('rejects page < 1', () => {
    const r = listAssociationsQuerySchema.safeParse({ page: 0 });
    expect(r.success).toBe(false);
  });

  it('coerces isActive="true" to boolean true', () => {
    const r = listAssociationsQuerySchema.safeParse({ isActive: 'true' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.isActive).toBe(true);
  });

  it('coerces isActive="false" to boolean false', () => {
    const r = listAssociationsQuerySchema.safeParse({ isActive: 'false' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.isActive).toBe(false);
  });

  it('leaves isActive undefined when omitted', () => {
    const r = listAssociationsQuerySchema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.isActive).toBeUndefined();
  });

  it('accepts optional search', () => {
    const r = listAssociationsQuerySchema.safeParse({ search: 'Örnek' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.search).toBe('Örnek');
  });

  it('trims search whitespace', () => {
    const r = listAssociationsQuerySchema.safeParse({ search: '  Örnek  ' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.search).toBe('Örnek');
  });
});
