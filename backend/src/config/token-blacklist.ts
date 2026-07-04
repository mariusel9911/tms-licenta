/**
 * In-memory JWT ID blacklist for token revocation on logout.
 *
 * Suitable for single-server deployments: a server restart clears all active
 * sessions anyway (8-hour JWT expiry), so persistence is not needed.
 *
 * Each entry auto-expires via setTimeout once the JWT's own `exp` is reached,
 * keeping memory usage bounded to the set of tokens still within their expiry window.
 */
const blacklist = new Set<string>();

/**
 * Add a JWT ID to the blacklist. The entry is automatically removed when
 * the token's expiry timestamp (`exp`, seconds since epoch) is reached.
 */
export function blacklistToken(jti: string, exp: number): void {
  blacklist.add(jti);
  const ttl = exp * 1000 - Date.now();
  if (ttl > 0) {
    setTimeout(() => blacklist.delete(jti), ttl).unref();
  }
}

/** Returns true if the given JWT ID has been revoked. */
export function isTokenBlacklisted(jti: string): boolean {
  return blacklist.has(jti);
}

/** Clears all entries. Exposed for test isolation only — do not call in production. */
export function _clearBlacklist(): void {
  blacklist.clear();
}
