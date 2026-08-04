// scripts/check-openapi.ts
//
// CI gate for the API reference. Two checks, both of which have to pass:
//
//   1. The assembled document is valid OpenAPI 3.1.
//   2. It describes exactly the routes the app actually mounts.
//
// The second check is the one that matters over time. A spec split across a
// dozen files is easy to write and easy to forget, and hand-maintained docs
// rot silently: the endpoint ships, nobody touches the YAML, and the reference
// quietly starts lying. Diffing the live route table against the spec turns
// that from something a reviewer might notice into something the build
// refuses to let through.
//
// Run: npm run docs:check
import { validate } from '@readme/openapi-parser';
import express from 'express';
import process from 'node:process';

// The app validates its environment at import time, and this script only needs
// the route table, never a live connection. Placeholders keep the check
// runnable in CI without handing it production secrets.
const PLACEHOLDER_ENV: Record<string, string> = {
  ACCESS_TOKEN_SECRET: 'openapi-check-placeholder',
  CLOUDINARY_API_KEY: 'placeholder',
  CLOUDINARY_API_SECRET: 'placeholder',
  CLOUDINARY_CLOUD_NAME: 'placeholder',
  DATABASE_URL: 'postgresql://placeholder:placeholder@localhost:5432/placeholder',
  PAYSTACK_SECRET_KEY: 'placeholder',
  REDIS_URL: 'redis://localhost:6379',
  REFRESH_TOKEN_SECRET: 'openapi-check-placeholder',
};
for (const [key, value] of Object.entries(PLACEHOLDER_ENV)) {
  process.env[key] ??= value;
}
process.env.NODE_ENV ??= 'test';

interface Handle {
  stack?: unknown[];
}

/**
 * Express 5 compiles a mount path into a matcher closure and keeps no copy of
 * the string, so `app.use('/api/v1', router)` leaves nothing on the layer that
 * says "/api/v1". Walking the finished tree can therefore recover
 * `/tours/{id}` but never the prefix it hangs under.
 *
 * So record the prefixes as they are registered instead. Patching `use` before
 * the app is imported captures every mount, and the map is then enough to
 * rebuild full paths from the tree. This runs only in this script, never in
 * the served application.
 *
 * One caveat: a single router instance mounted at two different paths would
 * keep only the last prefix. Nothing here does that, and the coverage diff
 * would flag it immediately if something started to.
 */
const mountPaths = new WeakMap<object, string>();

const patchUse = (target: Record<string, unknown>): void => {
  const original = target.use as (...args: unknown[]) => unknown;

  target.use = function patchedUse(this: unknown, ...args: unknown[]) {
    const [first, ...handlers] = args;
    if (typeof first === 'string') {
      for (const handler of handlers) {
        if (typeof handler === 'function' && (handler as Handle).stack) {
          mountPaths.set(handler, first);
        }
      }
    }
    return original.apply(this, args);
  };
};

/**
 * An Express 5 router is a *function*, so its prototype chain is
 * Function -> Router.prototype -> ... and `use` is not on the immediate
 * prototype. Walk up to whichever object actually owns it rather than
 * guessing a depth that a minor release could change.
 */
const routerPrototypeOwningUse = (): Record<string, unknown> => {
  let proto: unknown = Object.getPrototypeOf(express.Router());

  while (proto) {
    if (Object.prototype.hasOwnProperty.call(proto, 'use')) {
      return proto as Record<string, unknown>;
    }
    proto = Object.getPrototypeOf(proto);
  }

  throw new Error(
    'Could not find Router.prototype.use. Express internals changed, and the ' +
      'route coverage check cannot recover mount prefixes without it.',
  );
};

patchUse(express.application as unknown as Record<string, unknown>);
patchUse(routerPrototypeOwningUse());

const { default: app } = await import('../app.js');
const { buildOpenApiDocument } = await import('#docs/openapi.js');

// The docs endpoints describe the API rather than being part of it, so they
// are intentionally absent from the spec and must not read as drift.
const IGNORED_PREFIXES = ['/api/docs'];

const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'patch', 'options', 'trace'];

/**
 * Express writes params as `:id`; OpenAPI writes them as `{id}`.
 *
 * Concatenating mount prefixes also produces artifacts that are not really
 * part of the URL: a router mounted at "/" inside another gives "/api/v1//auth",
 * and a route registered at "/" on a mounted router gives a trailing slash.
 * Express serves both without them, so both are normalized away before
 * comparing against the spec.
 */
const toOpenApiPath = (path: string): string =>
  path
    .replace(/:([A-Za-z0-9_]+)/g, '{$1}')
    .replace(/\/{2,}/g, '/')
    .replace(/(.)\/$/, '$1');

/** Every `METHOD path` the app actually serves. */
const mountedOperations = (
  stack: unknown[],
  prefix = '',
  found = new Set<string>(),
): Set<string> => {
  for (const raw of stack) {
    const layer = raw as {
      handle?: Handle;
      route?: { methods?: Record<string, boolean>; path?: string };
    };

    if (layer.route) {
      const path = toOpenApiPath(prefix + (layer.route.path ?? '')) || '/';
      for (const [method, enabled] of Object.entries(layer.route.methods ?? {})) {
        // Express registers an implicit HEAD alongside every GET.
        if (enabled && method !== '_all' && method !== 'head') {
          found.add(`${method.toUpperCase()} ${path}`);
        }
      }
      continue;
    }

    if (layer.handle?.stack) {
      const nested = mountPaths.get(layer.handle) ?? '';
      mountedOperations(layer.handle.stack, prefix + nested, found);
    }
  }

  return found;
};

/** Every `METHOD path` the spec claims exists. */
const documentedOperations = (document: {
  paths?: Record<string, Record<string, unknown>>;
}): Set<string> => {
  const found = new Set<string>();

  for (const [path, item] of Object.entries(document.paths ?? {})) {
    for (const method of Object.keys(item)) {
      if (HTTP_METHODS.includes(method)) found.add(`${method.toUpperCase()} ${path}`);
    }
  }

  return found;
};

/**
 * operationId is what client generators turn into function names, so a
 * duplicate silently produces one method that shadows another. The spec is
 * written across a dozen files, which is exactly the situation where two
 * domains reach for the same obvious name.
 */
const operationIdProblems = (document: {
  paths?: Record<string, Record<string, { operationId?: string }>>;
}): string[] => {
  const seen = new Map<string, string>();
  const problems: string[] = [];

  for (const [path, item] of Object.entries(document.paths ?? {})) {
    for (const [method, operation] of Object.entries(item)) {
      if (!HTTP_METHODS.includes(method)) continue;

      const where = `${method.toUpperCase()} ${path}`;
      const id = operation.operationId;
      if (!id) {
        problems.push(`${where} has no operationId`);
        continue;
      }
      if (seen.has(id)) {
        problems.push(`"${id}" used by both ${seen.get(id)} and ${where}`);
      } else {
        seen.set(id, where);
      }
    }
  }

  return problems;
};

const ignored = (operation: string): boolean =>
  IGNORED_PREFIXES.some((prefix) => operation.split(' ')[1].startsWith(prefix));

const reportGroup = (title: string, items: string[]): boolean => {
  if (items.length === 0) return false;
  console.error(`\n${title}`);
  for (const item of [...items].sort()) console.error(`  ${item}`);
  return true;
};

const document = buildOpenApiDocument();

// validate() dereferences in place, so it gets a copy: the served document
// keeps its $refs, which is what makes the rendered page navigable.
const result = await validate(structuredClone(document) as never);
if (!result.valid) {
  console.error('OpenAPI document is not valid:\n');
  console.error(result.errors);
  process.exit(1);
}

const appRouter = (app as unknown as { router: { stack: unknown[] } }).router;
const mounted = [...mountedOperations(appRouter.stack)].filter(
  (operation) => !ignored(operation),
);
const documented = [...documentedOperations(document)];

const undocumented = mounted.filter((operation) => !documented.includes(operation));
const phantom = documented.filter((operation) => !mounted.includes(operation));

// A prefix silently lost by the walker would make every route look
// undocumented at once, which is a broken checker rather than a real finding.
// Only meaningful once the spec has paths at all; an empty spec legitimately
// leaves everything undocumented and should just be reported as such.
if (
  documented.length > 0 &&
  mounted.length > 0 &&
  undocumented.length === mounted.length
) {
  console.error(
    'Every mounted route looks undocumented, which almost certainly means the ' +
      'route walker failed to recover mount prefixes rather than that the spec ' +
      'is empty. Check the express.use patching in this script.',
  );
  process.exit(1);
}

const failedIds = reportGroup(
  'operationId problems (each operation needs one, and it must be unique):',
  operationIdProblems(document),
);
const failedUndocumented = reportGroup(
  'Mounted but missing from the spec (add them to docs/openapi/paths/):',
  undocumented,
);
const failedPhantom = reportGroup(
  'In the spec but not mounted by the app (stale, or a typo in the path):',
  phantom,
);

if (failedIds || failedUndocumented || failedPhantom) {
  console.error(
    `\n${mounted.length} routes mounted, ${documented.length} documented, ` +
      `${undocumented.length} undocumented, ${phantom.length} stale.`,
  );
  process.exit(1);
}

console.log(
  `OpenAPI 3.1 document is valid and covers all ${mounted.length} mounted routes.`,
);

// Importing the app constructs the Prisma client and the Redis connection, and
// those keep handles open even though this check never issues a query. Without
// an explicit exit the process sits idle until CI's job timeout kills it,
// turning a passing check into a red build.
process.exit(0);
