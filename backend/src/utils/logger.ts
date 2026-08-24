import { pino } from 'pino';
import pretty from 'pino-pretty';

import ENV from '#config/env.js';

const isProduction = ENV.NODE_ENV === 'production';

// JSON logs in production (for log aggregators); pretty-printed in dev only.
// Dev prints through a plain stream rather than pino's worker-thread
// transport: under `tsx --watch` the worker's message channel breaks on the
// first write, and the ThreadStream error event takes the process down before
// anything reaches the terminal.
const logger = isProduction
  ? pino({ level: 'info' })
  : pino(
      { level: 'debug' },
      pretty({
        colorize: true,
        ignore: '',
        singleLine: false,
        translateTime: true,
      }),
    );

export default logger;
