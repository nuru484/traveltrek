// src/lib/request-context.ts
//
// Async-local request context. The request-id middleware opens a store for
// the lifetime of each request, so code with no `req` in scope (services
// enqueueing jobs, notification wiring) can still read the current
// requestId without it being threaded through every signature.
import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
  requestId: string;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

/** The current request's id, or undefined outside a request (jobs, scripts). */
export const getRequestId = (): string | undefined =>
  requestContext.getStore()?.requestId;
