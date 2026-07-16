import ENV from '#config/env.js';
import logger from '#utils/logger.js';

// server.ts
import app from './app.js';
import './worker.js';

const port = ENV.PORT || 8080;

app.listen(port, () => {
  const message =
    ENV.NODE_ENV === 'production'
      ? `App is running in production mode on port ${port}`
      : `App is listening on http://localhost:${port}`;
  logger.info(message);
});
