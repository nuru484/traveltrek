// src/utils/http-response.ts
//
// Response envelope helpers. Every success response uses the same shape —
// `{ message, data }`, plus `meta` for lists — so clients get one predictable
// contract across every endpoint. Controllers call these instead of
// hand-building `res.json(...)`, which keeps the envelope consistent and the
// pagination math in one place.
import { Response } from 'express';

import { HTTP_STATUS_CODES } from '#config/constants.js';

export interface PaginationMeta {
  limit: number;
  page: number;
  total: number;
  totalPages: number;
}

/**
 * Builds the standard list `meta`. `totalPages` is at least 1 so an empty list
 * still reports a coherent single page.
 */
export const buildPaginationMeta = (
  total: number,
  page: number,
  limit: number,
): PaginationMeta => ({
  limit,
  page,
  total,
  totalPages: Math.max(1, Math.ceil(total / Math.max(1, limit))),
});

interface SendSuccessOptions<T> extends SuccessBody<T> {
  /** HTTP status; defaults to 200. Use 201 for creates. */
  status?: number;
}

interface SuccessBody<T> {
  data?: T;
  message: string;
  meta?: PaginationMeta;
  summary?: Record<string, unknown>;
}

/**
 * Sends the standard success envelope. `data`/`meta`/`summary` are omitted from
 * the payload when not provided (e.g. a bare `{ message }` for a delete).
 */
export const sendSuccess = <T>(
  res: Response,
  {
    data,
    message,
    meta,
    status = HTTP_STATUS_CODES.OK,
    summary,
  }: SendSuccessOptions<T>,
): void => {
  const body: SuccessBody<T> = { message };
  if (data !== undefined) body.data = data;
  if (meta !== undefined) body.meta = meta;
  if (summary !== undefined) body.summary = summary;

  res.status(status).json(body);
};

/**
 * Convenience for paginated list responses: pass the rows and the raw counts,
 * get the enveloped `{ message, data, meta }`.
 */
export const sendPaginated = (
  res: Response,
  params: {
    data: unknown[];
    limit: number;
    message: string;
    page: number;
    summary?: Record<string, unknown>;
    total: number;
  },
): void => {
  const { data, limit, message, page, summary, total } = params;
  sendSuccess(res, {
    data,
    message,
    meta: buildPaginationMeta(total, page, limit),
    summary,
  });
};
