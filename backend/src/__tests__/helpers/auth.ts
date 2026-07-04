import jwt from 'jsonwebtoken';

const TEST_JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long';
const TEST_JWT_EXPIRES_IN = '1h';

export interface TestTokenPayload {
  id?: number;
  email?: string;
  role?: 'ADMIN' | 'DISPATCHER';
  name?: string;
}

/**
 * Generate a valid JWT token for use in supertest requests.
 * Defaults to an ADMIN user.
 */
export function createTestToken(overrides: TestTokenPayload = {}): string {
  const payload = {
    id: 1,
    email: 'test-admin@tms.ro',
    role: 'ADMIN' as const,
    name: 'Test Admin',
    ...overrides,
  };
  return jwt.sign(payload, TEST_JWT_SECRET, { expiresIn: TEST_JWT_EXPIRES_IN });
}

/**
 * Create a DISPATCHER token (for testing role guard rejections).
 */
export function createDispatcherToken(overrides: TestTokenPayload = {}): string {
  return createTestToken({ role: 'DISPATCHER', email: 'dispatcher@tms.ro', ...overrides });
}

/**
 * Authorization header value ready to use in supertest:
 *   .set('Authorization', authHeader())
 */
export function authHeader(overrides: TestTokenPayload = {}): string {
  return `Bearer ${createTestToken(overrides)}`;
}
