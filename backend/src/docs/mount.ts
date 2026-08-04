// src/docs/mount.ts
//
// Serves the OpenAPI document and the Swagger UI that renders it.
//
// Deliberately public: this API is a portfolio piece and the docs are the
// point. Nothing here exposes anything a reader could not learn by reading the
// repository, and no endpoint becomes reachable that was not already.
import express, { Express, Request, Response } from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';

import { getOpenApiDocument } from '#docs/openapi.js';

const DOCS_PATH = '/api/docs';

// The global helmet() sets `script-src 'self'`, which blocks the inline
// bootstrap script swagger-ui-express injects, so the docs render as a blank
// page. Rather than weaken the policy for the whole API, this re-runs helmet
// with a relaxed script-src for the docs route only; because it runs after the
// global one, its header wins for these requests alone.
const docsSecurityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      'img-src': ["'self'", 'data:'],
      'script-src': ["'self'", "'unsafe-inline'"],
    },
  },
});

const uiOptions: swaggerUi.SwaggerUiOptions = {
  // The default topbar is a Swagger logo and a spec-URL box that would let a
  // visitor load someone else's spec into this page. Neither belongs here.
  customCss: `
    .swagger-ui .topbar { display: none }
    .swagger-ui .info { margin: 32px 0 }
    .swagger-ui .info .title { font-weight: 700 }
  `,
  customSiteTitle: 'Travel Trek API reference',
  swaggerOptions: {
    defaultModelsExpandDepth: 1,
    displayRequestDuration: true,
    // Many operations expanded on load is unreadable; show the tag list and
    // let the reader open what they came for.
    docExpansion: 'none',
    filter: true,
    persistAuthorization: true,
    tryItOutEnabled: true,
    // Auth is an httpOnly cookie, so "Try it out" only works if the browser is
    // allowed to send credentials with the requests this page makes.
    withCredentials: true,
  },
};

/**
 * Mounts the reference UI at /api/docs and the raw document at
 * /api/docs.json. The JSON is what tooling consumes: import it into Postman
 * or Insomnia, or point a client generator at it.
 */
export const mountApiDocs = (app: Express): void => {
  const document = getOpenApiDocument();

  app.get(`${DOCS_PATH}.json`, (_req: Request, res: Response) => {
    res.status(200).json(document);
  });

  app.use(
    DOCS_PATH,
    docsSecurityHeaders as express.RequestHandler,
    swaggerUi.serve,
    swaggerUi.setup(document, uiOptions),
  );
};

export default mountApiDocs;
