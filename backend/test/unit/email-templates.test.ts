// test/unit/email-templates.test.ts
//
// The branded shell renders, carries the message, and treats every value as
// text: the templates interpolate customer-supplied names and item titles, so
// an unescaped one would be markup in somebody's inbox.
import { describe, expect, it } from 'vitest';

import {
  buildEmailChangeEmail,
  buildOtpLoginEmail,
  buildPasswordResetEmail,
  buildTwoFactorEmail,
} from '#mail/auth-emails.js';
import { renderTemplate } from '#mail/render-template.js';

const render = (data: Record<string, unknown>) =>
  renderTemplate('message.ejs', data);

describe('email templates', () => {
  it('wraps the message in the branded shell', async () => {
    const html = await render({ intro: ['Hello there'], title: 'A title' });

    expect(html).toContain('<!doctype html>');
    expect(html).toContain('TravelTrek');
    expect(html).toContain('A title');
    expect(html).toContain('Hello there');
  });

  it('shows the masthead logo as a hosted image, and drops it when there is none', async () => {
    const withLogo = await render({
      logoUrl: 'https://travel.test/logo.png',
      title: 'Logo',
    });
    // A hosted image, never a cid attachment - an attachment puts a paperclip
    // on every message.
    expect(withLogo).toContain('<img');
    expect(withLogo).toContain('https://travel.test/logo.png');

    // No reachable logo (a localhost FRONTEND_URL in dev): the wordmark
    // carries the masthead alone rather than a broken image.
    const withoutLogo = await render({ logoUrl: null, title: 'No logo' });
    expect(withoutLogo).not.toContain('<img');
    expect(withoutLogo).toContain('TravelTrek');
  });

  it('escapes interpolated values instead of rendering them as markup', async () => {
    const html = await render({
      intro: ['<b>bold</b>'],
      name: '<img src=x onerror=alert(1)>',
      rows: [{ label: 'Item', value: '<script>alert(1)</script>' }],
      title: 'Escaping',
    });

    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;img src=x');
    expect(html).toContain('&lt;b&gt;bold&lt;/b&gt;');
  });

  it('rejects a non-http action URL rather than putting it in an href', async () => {
    const html = await render({
      action: { label: 'Go', url: 'javascript:alert(1)' },
      title: 'Link',
    });

    expect(html).not.toContain('javascript:alert(1)');
  });

  it('renders the code, detail and amount blocks only when given them', async () => {
    const bare = await render({ intro: ['nothing else'], title: 'Bare' });
    expect(bare).not.toContain('Payment record');

    const full = await render({
      amount: { label: 'Total due', value: 'GHS 2,500.00' },
      code: '481920',
      rows: [{ label: 'Booking', value: '#1042' }],
      rowsCaption: 'Payment record',
      title: 'Full',
    });
    expect(full).toContain('481920');
    expect(full).toContain('GHS 2,500.00');
    expect(full).toContain('Payment record');
    expect(full).toContain('#1042');
  });

  it('keeps the code and link in the plain-text body of every auth email', () => {
    expect(buildOtpLoginEmail('Ada', '123456', 10).text).toContain('123456');
    expect(buildTwoFactorEmail('Ada', '654321', 5).text).toContain('654321');
    expect(
      buildPasswordResetEmail('Ada', 'https://x.test/reset?token=t', 30).text,
    ).toContain('https://x.test/reset?token=t');
    expect(
      buildEmailChangeEmail('Ada', 'new@x.test', 'https://x.test/c?token=t', 30)
        .text,
    ).toContain('https://x.test/c?token=t');
  });
});
