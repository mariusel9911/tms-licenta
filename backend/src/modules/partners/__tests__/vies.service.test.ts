import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
  },
}));

import axios from 'axios';
import { lookupVies } from '../vies.service.js';

const axiosMock = axios as unknown as { get: ReturnType<typeof vi.fn> };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('lookupVies()', () => {
  it('returns name and address for a valid VAT number', async () => {
    axiosMock.get.mockResolvedValue({
      data: { isValid: true, name: 'Test Company SRL', address: 'Str. Test 1, Timisoara' },
    });

    const result = await lookupVies('RO12345678');

    expect(result).toEqual({ name: 'Test Company SRL', address: 'Str. Test 1, Timisoara' });
    expect(axiosMock.get).toHaveBeenCalledWith(
      'https://ec.europa.eu/taxation_customs/vies/rest-api/ms/RO/vat/12345678',
      expect.objectContaining({ timeout: 10000 }),
    );
  });

  it('returns null when API responds with isValid: false', async () => {
    axiosMock.get.mockResolvedValue({
      data: { isValid: false, name: '', address: '' },
    });

    const result = await lookupVies('RO99999999');

    expect(result).toBeNull();
  });

  it('returns null for an empty string without calling the API', async () => {
    const result = await lookupVies('');

    expect(result).toBeNull();
    expect(axiosMock.get).not.toHaveBeenCalled();
  });

  it('returns null for a VAT shorter than 3 characters without calling the API', async () => {
    const result = await lookupVies('RO');

    expect(result).toBeNull();
    expect(axiosMock.get).not.toHaveBeenCalled();
  });

  it('returns null when the API call times out', async () => {
    axiosMock.get.mockRejectedValue(Object.assign(new Error('timeout of 10000ms exceeded'), { code: 'ECONNABORTED' }));

    const result = await lookupVies('RO12345678');

    expect(result).toBeNull();
  });

  it('returns null on any generic API error', async () => {
    axiosMock.get.mockRejectedValue(new Error('Network Error'));

    const result = await lookupVies('RO12345678');

    expect(result).toBeNull();
  });

  it('returns empty strings when API response has null name and address', async () => {
    axiosMock.get.mockResolvedValue({
      data: { isValid: true, name: null, address: null },
    });

    const result = await lookupVies('RO12345678');

    expect(result).toEqual({ name: '', address: '' });
  });
});
