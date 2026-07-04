/**
 * Test data factories for k6 load tests.
 *
 * Generates randomized, realistic payloads to avoid false-positive caching
 * and to ensure the database actually processes each request.
 *
 * Usage:
 *   import { buildOrderPayload, LOAD_TEST_MARKER } from '../helpers/data.js';
 *   const payload = buildOrderPayload(clientId);
 */

import { randomIntBetween, randomString } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

/**
 * Marker prefix embedded in test data to make teardown cleanup easy.
 * Any order with pickupAddress starting with this string is a load-test artifact.
 */
export const LOAD_TEST_MARKER = 'LOADTEST_';

/**
 * Builds a minimal valid order creation payload.
 *
 * @param {number|null} clientId   Prisma ID of an existing Partner to use as client.
 *                                 Pass null to create an order without a client.
 * @returns {object} Order DTO matching CreateOrderDto schema
 */
export function buildOrderPayload(clientId) {
  const tag = randomString(6).toUpperCase();
  const now = new Date().toISOString();

  return {
    // clientId is required by CreateOrderDto (z.number().int().positive())
    clientId,
    orderSeries: 'BGR',
    documentDate: now,
    pickupAddress: `${LOAD_TEST_MARKER}Warehouse ${tag}`,
    pickupCountry: 'Romania',
    deliveryAddress: `${LOAD_TEST_MARKER}Depot ${tag}`,
    deliveryCountry: 'Hungary',
    // Must be numbers, not strings (Zod: z.number().min(0))
    transporterPrice: randomIntBetween(500, 5000),
    transporterCurrency: 'EUR',
    clientPrice: randomIntBetween(600, 6000),
    clientCurrency: 'EUR',
    distanceKm: randomIntBetween(200, 2000),
    // CargoItemSchema fields: qty, weightKg (not quantity/weight/unit)
    cargoItems: [
      {
        description: `Cargo ${tag}`,
        weightKg: randomIntBetween(100, 25000),
        qty: 1,
      },
    ],
  };
}

/**
 * Returns a date string offset by `offsetDays` from today,
 * formatted as required by datetime-local inputs (ISO slice).
 */
export function offsetDate(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString();
}
