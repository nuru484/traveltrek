// src/notifications/dispatch.ts
//
// Shared fire-and-forget delivery helper (khadys `dispatch` pattern,
// extracted from auth.service so every notification module uses the same
// discipline): a slow or failed email/SMS send must NEVER block or fail the
// request (or job) that triggered it — failures are logged and swallowed.
import { type Logger } from '#services/deps.js';

export type Dispatch = (delivery: Promise<void>, what: string) => void;

/** Builds the fire-and-forget dispatcher for a module's injected logger. */
export const makeDispatch =
  (logger: Logger): Dispatch =>
  (delivery, what) => {
    void delivery.catch((error: unknown) => {
      logger.error({ err: error }, `${what} dispatch threw`);
    });
  };
