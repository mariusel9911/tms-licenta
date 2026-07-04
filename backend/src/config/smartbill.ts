// SmartBill API configuration
// Credentials are stored in AppSettings (DB table, id=1) — NOT in .env
// This file provides the base URL and helper for building the auth header

export const SMARTBILL_BASE_URL = 'https://ws.smartbill.ro/SBORO/api';

/**
 * Build HTTP Basic Auth header from AppSettings credentials.
 * @param email     - smartbillEmail from AppSettings
 * @param apiToken  - smartbillApiToken from AppSettings
 */
export function buildSmartBillAuthHeader(email: string, apiToken: string): string {
  const credentials = Buffer.from(`${email}:${apiToken}`).toString('base64');
  return `Basic ${credentials}`;
}
