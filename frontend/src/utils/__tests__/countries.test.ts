import { describe, it, expect } from 'vitest';
import { COUNTRY_NAMES } from '@/utils/countries';

describe('COUNTRY_NAMES', () => {
  it('contains expected EU member state entries', () => {
    expect(COUNTRY_NAMES['RO']).toBe('Romania');
    expect(COUNTRY_NAMES['DE']).toBe('Germany');
    expect(COUNTRY_NAMES['FR']).toBe('France');
    expect(COUNTRY_NAMES['IT']).toBe('Italy');
    expect(COUNTRY_NAMES['PL']).toBe('Poland');
    expect(COUNTRY_NAMES['ES']).toBe('Spain');
  });

  it('all keys are 2-character uppercase alpha-2 codes', () => {
    Object.keys(COUNTRY_NAMES).forEach((key) => {
      expect(key).toMatch(/^[A-Z]{2}$/);
    });
  });

  it('no null or empty string values', () => {
    Object.values(COUNTRY_NAMES).forEach((value) => {
      expect(value).toBeTruthy();
      expect(typeof value).toBe('string');
    });
  });
});
