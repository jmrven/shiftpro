import { describe, it, expect } from 'vitest';
import { profileSchema } from './EmployeeProfilePage';

describe('profileSchema', () => {
  it('rejects empty first_name', () => {
    const result = profileSchema.safeParse({ first_name: '', last_name: 'Smith' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe('Required');
  });

  it('rejects empty last_name', () => {
    const result = profileSchema.safeParse({ first_name: 'Jane', last_name: '' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe('Required');
  });

  it('accepts valid minimal input', () => {
    const result = profileSchema.safeParse({ first_name: 'Jane', last_name: 'Smith' });
    expect(result.success).toBe(true);
  });

  it('coerces hourly_rate string to number', () => {
    const result = profileSchema.safeParse({
      first_name: 'Jane',
      last_name: 'Smith',
      hourly_rate: '25.50',
    });
    expect(result.success).toBe(true);
    expect(result.data?.hourly_rate).toBe(25.5);
  });

  it('accepts empty string for optional fields', () => {
    const result = profileSchema.safeParse({
      first_name: 'Jane',
      last_name: 'Smith',
      phone: '',
      hire_date: '',
      employee_number: '',
    });
    expect(result.success).toBe(true);
  });
});
