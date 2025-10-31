// server.ts
import app from './app';
import ENV from './src/config/env';
import logger from './src/utils/logger';
import './worker';

const port = ENV.PORT || 8080;

app.listen(port, () => {
  const message =
    ENV.NODE_ENV === 'production'
      ? `App is running in production mode on port ${port}`
      : `App is listening on http://localhost:${port}`;
  logger.info(message);
});
