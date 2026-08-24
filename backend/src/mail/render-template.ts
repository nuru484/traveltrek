// src/mail/render-template.ts
//
// Renders an EJS template from src/ejs into the HTML body of an email. Every
// template gets the brand values below without any builder passing them, so a
// rebrand is a one-line change here rather than an edit to every message.
import ejs from 'ejs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import ENV from '#config/env.js';

const currentDir = path.dirname(fileURLToPath(import.meta.url));

/** FRONTEND_URL without a trailing slash, so joins never double up. */
const siteUrl = ENV.FRONTEND_URL.replace(/\/+$/, '');

/**
 * The site's palette, flattened to hex because email clients have no oklch
 * and no custom properties. Kept beside the templates so a page and an email
 * never drift apart.
 */
export const BRAND = {
  /** Turquoise, used for the tagline on the dark band. */
  accent: '#1fb0a8',
  /** Body text. */
  ink: '#262d3d',
  /** Secondary text on a pale background. */
  muted: '#666e80',
  /** Secondary text on a dark band. */
  mutedOnDark: '#9aa6bd',
  /** The dark band behind the masthead and footer. */
  night: '#1c2333',
  /** The sheet the message is printed on. */
  paper: '#ffffff',
  /** Sky blue: buttons and rules. */
  primary: '#0e86cc',
  /** Dark enough for link text on a pale background. */
  primaryDeep: '#0a6ba4',
  /** Hairlines between rows. */
  rule: '#cdd3dd',
  /** Sky light enough to read on the night band. */
  sky: '#7cc6f2',
  /** The page behind the card. */
  surface: '#f2f5f9',
  /** Tint for callouts and detail blocks. */
  surfaceAlt: '#f7f9fc',
} as const;

const brandDefaults = {
  brand: BRAND,
  brandName: 'TravelTrek',
  brandTagline: 'Flights · Hotels · Tours',
  /** Hosted rather than a cid attachment: an inline image makes every message
   * arrive wearing a paperclip, and Gmail proxies remote images by default.
   * The frontend's own file serves it, but only once FRONTEND_URL is a public
   * https origin - an inbox cannot fetch localhost, so a dev run drops the
   * mark and prints the wordmark alone rather than a broken image. */
  logoUrl:
    ENV.EMAIL_LOGO_URL ??
    (siteUrl.startsWith('https') ? `${siteUrl}/logo.png` : null),
  siteUrl,
};

/**
 * Constrains a URL to http(s) before it lands in an href. Anything else
 * (javascript:, data:) collapses to the site root - a useless link beats a
 * script-in-mail-client vector.
 */
const safeUrl = (url: string): string =>
  /^https?:\/\//i.test(url) ? url : siteUrl;

export const renderTemplate = async (
  template: string,
  data: Record<string, unknown>,
): Promise<string> => {
  const action = data.action as undefined | { label: string; url: string };
  return ejs.renderFile(path.join(currentDir, '../ejs', template), {
    ...brandDefaults,
    ...data,
    ...(action ? { action: { ...action, url: safeUrl(action.url) } } : {}),
  });
};
