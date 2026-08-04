// test/integration/api-docs.test.ts
//
// The public API reference. These are cheap assertions guarding failures that
// are invisible until someone opens the page in production: a spec that no
// longer assembles, a docs route that quietly started requiring a session, or
// a Content-Security-Policy that blocks Swagger UI's bootstrap script and
// renders a blank page with a 200 status.
//
// Endpoint COVERAGE is not checked here. `npm run docs:check` owns that, and
// it walks the route table rather than the database, so it runs in CI without
// a Postgres service.
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import app from '../../app.js';

/**
 * Only the parts of the document these assertions touch. Supertest types
 * `res.body` as `any`, and handing that straight to `Object.keys` is an unsafe
 * argument, so the response is narrowed once here instead.
 */
interface OpenApiDocument {
  components: { securitySchemes: Record<string, unknown> };
  info: { title: string };
  openapi: string;
  paths: Record<string, unknown>;
}

describe('API reference', () => {
  it('serves the OpenAPI document without a session', async () => {
    const res = await request(app).get('/api/docs.json');
    const document = res.body as OpenApiDocument;

    expect(res.status).toBe(200);
    expect(document.openapi).toBe('3.1.0');
    expect(document.info.title).toBe('Travel Trek API');
    expect(Object.keys(document.paths).length).toBeGreaterThan(0);
  });

  it('declares the session cookie as the security scheme', async () => {
    const res = await request(app).get('/api/docs.json');
    const document = res.body as OpenApiDocument;

    // Auth is an httpOnly cookie, so the scheme has to be `apiKey in: cookie`.
    // Declaring it as a bearer token would render an Authorize dialog that
    // cannot possibly work.
    expect(document.components.securitySchemes.sessionCookie).toMatchObject({
      in: 'cookie',
      name: 'accessToken',
      type: 'apiKey',
    });
  });

  it('renders the Swagger UI page', async () => {
    const res = await request(app).get('/api/docs/');

    expect(res.status).toBe(200);
    expect(res.text).toContain('<div id="swagger-ui">');
  });

  it('relaxes script-src for the docs page only', async () => {
    const docs = await request(app).get('/api/docs/');
    const api = await request(app).get('/health');

    // Swagger UI boots from an inline script, which the app-wide policy blocks.
    expect(docs.headers['content-security-policy']).toContain(
      "script-src 'self' 'unsafe-inline'",
    );
    // The relaxation must not have leaked to the rest of the app.
    expect(api.headers['content-security-policy']).toContain("script-src 'self'");
    expect(api.headers['content-security-policy']).not.toContain(
      "script-src 'self' 'unsafe-inline'",
    );
  });
});
