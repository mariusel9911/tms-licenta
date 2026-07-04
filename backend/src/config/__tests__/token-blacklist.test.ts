import { describe, it, expect, beforeEach } from 'vitest';
import { blacklistToken, isTokenBlacklisted, _clearBlacklist } from '../token-blacklist.js';

beforeEach(() => {
  _clearBlacklist();
});

describe('token-blacklist', () => {
  it('isTokenBlacklisted returns false for unknown jti', () => {
    expect(isTokenBlacklisted('unknown-jti')).toBe(false);
  });

  it('isTokenBlacklisted returns true after blacklistToken is called with future exp', () => {
    const exp = Math.floor((Date.now() + 60_000) / 1000); // expires in 60s
    blacklistToken('jti-future', exp);
    expect(isTokenBlacklisted('jti-future')).toBe(true);
  });

  it('blacklistToken with already-expired token (ttl <= 0) still adds to blacklist synchronously', () => {
    const exp = Math.floor((Date.now() - 5_000) / 1000); // already expired
    expect(() => blacklistToken('jti-expired', exp)).not.toThrow();
    // Entry is added synchronously even when ttl <= 0 (no setTimeout scheduled)
    expect(isTokenBlacklisted('jti-expired')).toBe(true);
  });

  it('_clearBlacklist removes all entries', () => {
    const exp = Math.floor((Date.now() + 60_000) / 1000);
    blacklistToken('jti-a', exp);
    blacklistToken('jti-b', exp);
    _clearBlacklist();
    expect(isTokenBlacklisted('jti-a')).toBe(false);
    expect(isTokenBlacklisted('jti-b')).toBe(false);
  });

  it('multiple tokens can be blacklisted independently', () => {
    const exp = Math.floor((Date.now() + 60_000) / 1000);
    blacklistToken('jti-1', exp);
    blacklistToken('jti-2', exp);
    expect(isTokenBlacklisted('jti-1')).toBe(true);
    expect(isTokenBlacklisted('jti-2')).toBe(true);
    expect(isTokenBlacklisted('jti-3')).toBe(false);
  });
});
