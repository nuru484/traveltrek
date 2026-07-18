import { pino } from 'pino';

import ENV from '#config/env.js';

const isProduction = ENV.NODE_ENV === 'production';

// JSON logs in production (for log aggregators); pretty-printed in dev only.
const logger = pino({
  level: isProduction ? 'info' : 'debug',
  ...(isProduction
    ? {}
    : {
        transport: {
          options: {
            colorize: true,
            ignore: '',
            singleLine: false,
            translateTime: true,
          },
          target: 'pino-pretty',
        },
      }),
});

export default logger;
