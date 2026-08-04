// src/docs/openapi.ts
//
// Assembles the OpenAPI document from docs/openapi/.
//
// The spec is split by domain so a large API stays reviewable: one file per
// domain under paths/, one under components/. This module merges them into a
// single document, which means every $ref in the spec is internal
// (#/components/...) and nothing has to resolve external files at serve time.
//
// Merging is shallow by design and collisions throw rather than overwrite. Two
// files silently declaring the same path or the same schema name is exactly
// the kind of drift a split spec invites, so it fails loudly at boot instead
// of shipping a document missing whichever half lost.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

type Fragment = Record<string, unknown>;

/**
 * Finds docs/openapi by walking up from this module.
 *
 * The depth differs between running the TypeScript directly under tsx
 * (src/docs/) and running the compiled output (build/src/docs/), so a fixed
 * `../../` would be correct in exactly one of them. Walking up until the
 * directory appears is right in both, and in tests.
 */
const findDocsDir = (): string => {
  let dir = path.dirname(fileURLToPath(import.meta.url));

  for (let depth = 0; depth < 10; depth += 1) {
    const candidate = path.join(dir, 'docs', 'openapi');
    if (fs.existsSync(path.join(candidate, 'openapi.yaml'))) return candidate;

    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  throw new Error(
    'Could not locate docs/openapi/openapi.yaml. The spec ships with the ' +
      'application and is read at boot, so check it was not excluded from the ' +
      'build or the container image.',
  );
};

const DOCS_DIR = findDocsDir();

const readYaml = (file: string): Fragment => {
  // An empty or comment-only file parses to null; treat it as "contributes
  // nothing" rather than crashing the merge.
  return (YAML.parse(fs.readFileSync(file, 'utf8')) as Fragment | null) ?? {};
};

const yamlFilesIn = (dir: string): string[] =>
  fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.yaml') || name.endsWith('.yml'))
    .sort()
    .map((name) => path.join(dir, name));

/**
 * Merges `{ key: value }` fragments from several files, refusing to let one
 * file overwrite another's key. `label` and `origins` exist only so the thrown
 * message can name both files involved.
 */
const mergeUnique = (
  target: Fragment,
  fragment: Fragment,
  options: { file: string; label: string; origins: Record<string, string> },
): Fragment => {
  const { file, label, origins } = options;

  for (const [key, value] of Object.entries(fragment)) {
    if (key in target) {
      throw new Error(
        `OpenAPI ${label} "${key}" is declared twice: ` +
          `${path.basename(origins[key])} and ${path.basename(file)}`,
      );
    }
    target[key] = value;
    origins[key] = file;
  }

  return target;
};

/** paths/*.yaml each hold a map of path -> path item. */
const loadPaths = (): Fragment => {
  const paths: Fragment = {};
  const origins: Record<string, string> = {};

  for (const file of yamlFilesIn(path.join(DOCS_DIR, 'paths'))) {
    mergeUnique(paths, readYaml(file), { file, label: 'path', origins });
  }

  return paths;
};

/**
 * components/*.yaml each hold a map of component type (schemas, responses,
 * parameters, ...) -> map of name -> definition. Merging is per type, so
 * common.yaml can own `responses` while a domain file adds `schemas`, and two
 * domains can both add schemas without colliding.
 */
const loadComponents = (): Fragment => {
  const components: Record<string, Fragment> = {};
  const origins: Record<string, Record<string, string>> = {};

  for (const file of yamlFilesIn(path.join(DOCS_DIR, 'components'))) {
    for (const [type, entries] of Object.entries(readYaml(file))) {
      components[type] ??= {};
      origins[type] ??= {};
      mergeUnique(components[type], entries as Fragment, {
        file,
        label: `components.${type}`,
        origins: origins[type],
      });
    }
  }

  return components;
};

export const buildOpenApiDocument = (): Fragment => ({
  ...readYaml(path.join(DOCS_DIR, 'openapi.yaml')),
  components: loadComponents(),
  paths: loadPaths(),
});

// Built once per process. The spec is static files on disk, and re-reading and
// re-merging them on every docs page view would be pure waste.
let cached: Fragment | undefined;

export const getOpenApiDocument = (): Fragment => {
  cached ??= buildOpenApiDocument();
  return cached;
};

export default getOpenApiDocument;
