/**
 * Supertest helpers — attach Authorization header to requests.
 * Each helper returns a supertest chain you can further modify with .send(), .query(), etc.
 */

import type { Application } from 'express';
import request from 'supertest';
import { authHeader as defaultAuthHeader } from './auth.js';

export function authedGet(app: Application, path: string, tokenHeader?: string) {
  return request(app).get(path).set('Authorization', tokenHeader ?? defaultAuthHeader());
}

export function authedPost(app: Application, path: string, tokenHeader?: string) {
  return request(app).post(path).set('Authorization', tokenHeader ?? defaultAuthHeader());
}

export function authedPut(app: Application, path: string, tokenHeader?: string) {
  return request(app).put(path).set('Authorization', tokenHeader ?? defaultAuthHeader());
}

export function authedPatch(app: Application, path: string, tokenHeader?: string) {
  return request(app).patch(path).set('Authorization', tokenHeader ?? defaultAuthHeader());
}

export function authedDelete(app: Application, path: string, tokenHeader?: string) {
  return request(app).delete(path).set('Authorization', tokenHeader ?? defaultAuthHeader());
}
