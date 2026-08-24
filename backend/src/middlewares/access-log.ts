// src/middlewares/access-log.ts
//
// Structured HTTP access log (pino-http). Runs right after the request-id
// middleware and reuses its id, so the completion line, the X-Request-Id
// header and every `req.log` line share one requestId. Level follows the
// outcome: 5xx = error, 4xx = warn, otherwise info. Platform probes are
// excluded so they don't drown the log.
import type { IncomingMessage } from 'node:http';
import type { Logger } from 'pino';

import { pinoHttp } from 'pino-http';

import logger from '#utils/logger.js';

const PROBE_PATHS = new Set(['/health', '/health/ready', '/ready']);

export const createAccessLog = (log: Logger) =>
  pinoHttp({
    autoLogging: {
      ignore: (req: IncomingMessage) =>
        PROBE_PATHS.has(req.url?.split('?')[0] ?? ''),
    },
    customAttributeKeys: { reqId: 'requestId' },
    customLogLevel: (_req, res, err) => {
      if (err || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    genReqId: (req: IncomingMessage & { requestId?: string }) =>
      req.requestId ?? '',
    logger: log,
    // The per-request child carries only the requestId; the full request is
    // serialized once, on the completion line.
    quietReqLogger: true,
  });

export const accessLog = createAccessLog(logger);

export default accessLog;
