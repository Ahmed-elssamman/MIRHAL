import { afterEach, describe, expect, it, vi } from 'vitest';
import { MailAdapter } from '../../apps/api/src/auth/mail.adapter';
import { renderAuthEmail } from '../../apps/api/src/auth/mail.templates';
import { validateStartupEnvironment } from '../../apps/api/src/common/startup';

const original = { ...process.env };
afterEach(() => {
  process.env = { ...original };
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('auth email', () => {
  it('accepts database-backed storage in standalone production', () => {
    process.env['NODE_ENV'] = 'production';
    process.env['DATABASE_URL'] = 'postgresql://example.test/db';
    process.env['DIRECT_URL'] = 'postgresql://example.test/db';
    process.env['WEB_ORIGIN'] = 'https://web.example.test';
    process.env['ADMIN_ORIGIN'] = 'https://admin.example.test';
    process.env['APP_URL'] = 'https://web.example.test';
    process.env['MAIL_MODE'] = 'disabled';
    delete process.env['BLOB_READ_WRITE_TOKEN'];
    delete process.env['UPLOAD_DIR'];
    expect(validateStartupEnvironment).not.toThrow();
  });

  it('rejects production origins that browsers cannot send exactly', () => {
    process.env['NODE_ENV'] = 'production';
    process.env['DATABASE_URL'] = 'postgresql://example.test/db';
    process.env['DIRECT_URL'] = 'postgresql://example.test/db';
    process.env['WEB_ORIGIN'] = 'https://web.example.test/';
    process.env['ADMIN_ORIGIN'] = 'https://admin.example.test';
    process.env['APP_URL'] = 'https://web.example.test';
    process.env['MAIL_MODE'] = 'disabled';
    process.env['BLOB_READ_WRITE_TOKEN'] = 'test-only';
    expect(validateStartupEnvironment).toThrow(/WEB_ORIGIN/);
    process.env['WEB_ORIGIN'] = 'https://web.example.test';
    process.env['ADMIN_ORIGIN'] = 'https://name:secret@admin.example.test';
    expect(validateStartupEnvironment).toThrow(/ADMIN_ORIGIN/);
    process.env['ADMIN_ORIGIN'] = 'https://admin.example.test';
    expect(validateStartupEnvironment).not.toThrow();
  });

  it('fails production initialization for an incomplete API email provider', () => {
    process.env['NODE_ENV'] = 'production';
    process.env['EMAIL_PROVIDER'] = 'resend';
    process.env['APP_URL'] = 'https://web.example.test';
    process.env['SMTP_FROM'] = 'mail@example.test';
    delete process.env['RESEND_API_KEY'];
    expect(() => new MailAdapter().onModuleInit()).toThrow();
    process.env['RESEND_API_KEY'] = 'test-only';
    expect(() => new MailAdapter().onModuleInit()).not.toThrow();
  });
  it('renders Arabic RTL and English LTR without unescaped links', () => {
    const ar = renderAuthEmail('VERIFY_EMAIL', 'ar', 'https://example.test/?a=1&b=2', {
      appUrl: 'https://web.example.test',
      supportEmail: 'help@example.test',
    });
    const en = renderAuthEmail('RESET_PASSWORD', 'en', 'https://example.test/reset', {
      appUrl: 'https://web.example.test',
    });
    expect(ar.html).toContain('lang="ar" dir="rtl"');
    expect(ar.html).toContain('a=1&amp;b=2');
    expect(ar.html).toContain('mirhal-email-logo.png');
    expect(ar.html).toContain('alt="مِرحال"');
    expect(ar.html).toContain('<p dir="ltr"');
    expect(ar.html).toContain('mailto:help@example.test');
    expect(ar.html).toContain('ينتهي هذا الرابط خلال 24 ساعة');
    expect(ar.subject).toContain('تأكيد');
    expect(en.html).toContain('lang="en" dir="ltr"');
    expect(en.html).toContain('alt="MIRHAL"');
    expect(en.html).toContain('href="https://web.example.test/help"');
    expect(en.html).toContain('expires in 30 minutes');
    expect(en.subject).toBe('Reset your MIRHAL password');
    expect(en.text).toContain('https://example.test/reset');
  });

  it('escapes token links and provides a plain-text alternative', () => {
    const email = renderAuthEmail(
      'RESET_PASSWORD',
      'en',
      'https://example.test/reset?token=abc"><script>alert(1)</script>',
      { appUrl: 'https://web.example.test' },
    );
    expect(email.html).toContain('&quot;&gt;&lt;script&gt;');
    expect(email.html).not.toContain('<script>');
    expect(email.text).toContain('https://example.test/reset?token=abc"><script>alert(1)</script>');
  });

  it('renders a password reset security notice without including a token', () => {
    const notice = renderAuthEmail(
      'PASSWORD_CHANGED',
      'ar',
      'https://web.example.test/auth/login',
      {
        appUrl: 'https://web.example.test',
      },
    );
    expect(notice.subject).toContain('تم تغيير كلمة المرور');
    expect(notice.html).toContain('lang="ar" dir="rtl"');
    expect(notice.html).toContain('أُعيد تعيين كلمة مرور حسابك');
    expect(notice.html).toContain('href="https://web.example.test/auth/login"');
    expect(notice.html).not.toContain('token=');
    expect(notice.text).not.toContain('token=');
  });

  it('renders friend invitations with the production signup URL and inviter name', () => {
    const invite = renderAuthEmail('FRIEND_INVITE', 'en', 'https://mirhal.example/auth/register', {
      appUrl: 'https://mirhal.example',
      inviterName: 'Nour',
    });
    expect(invite.subject).toBe('A friend invited you to MIRHAL');
    expect(invite.html).toContain('Nour invited you to join MIRHAL');
    expect(invite.html).toContain('href="https://mirhal.example/auth/register"');
    expect(invite.html).toContain('mirhal-email-logo.png');
    expect(invite.text).toContain('https://mirhal.example/auth/register');
  });

  it('sends a friend invitation through the configured HTTPS provider', async () => {
    process.env['NODE_ENV'] = 'development';
    process.env['EMAIL_PROVIDER'] = 'resend';
    process.env['APP_URL'] = 'https://mirhal.example';
    process.env['SMTP_FROM'] = 'MIRHAL <mail@example.test>';
    process.env['RESEND_API_KEY'] = 'test-only';
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ id: 'email-123' }) });
    vi.stubGlobal('fetch', fetchMock);

    await new MailAdapter().sendFriendInvite(
      'friend@example.test',
      'Nour',
      'sender:friend:2026-10-29',
      'en',
    );

    const options = fetchMock.mock.calls[0]?.[1];
    expect(options.headers['Idempotency-Key']).toMatch(/^[a-f0-9]{64}$/);
    const body = JSON.parse(options.body);
    expect(body.to).toEqual(['friend@example.test']);
    expect(body.subject).toBe('A friend invited you to MIRHAL');
    expect(body.html).toContain('https://mirhal.example/auth/register');
    expect(body.html).toContain('Nour invited you to join MIRHAL');
    expect(JSON.stringify(vi.mocked(console.log).mock.calls)).toContain('email-123');
  });

  it('sends a password reset security notice with an event idempotency key and no token', async () => {
    process.env['NODE_ENV'] = 'development';
    process.env['EMAIL_PROVIDER'] = 'resend';
    process.env['APP_URL'] = 'https://web.example.test';
    process.env['SMTP_FROM'] = 'MIRHAL <mail@example.test>';
    process.env['RESEND_API_KEY'] = 'test-only';
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    await new MailAdapter().sendPasswordChanged('member@example.test', 'event-123', 'en');

    const options = fetchMock.mock.calls[0]?.[1];
    expect(options.headers['Idempotency-Key']).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.parse(options.body).html).toContain('Your MIRHAL account password was reset');
    expect(JSON.parse(options.body).html).toContain('https://web.example.test/auth/login');
    expect(JSON.parse(options.body).html).not.toContain('token=');
    expect(JSON.parse(options.body).text).not.toContain('token=');
  });

  it('requires complete SMTP configuration', () => {
    process.env['NODE_ENV'] = 'development';
    process.env['EMAIL_PROVIDER'] = 'smtp';
    process.env['APP_URL'] = 'http://localhost:4200';
    process.env['SMTP_FROM'] = 'Mirhal <mail@example.test>';
    expect(() => new MailAdapter().assertConfigured()).toThrow();
    process.env['SMTP_HOST'] = 'smtp.gmail.com';
    process.env['SMTP_USER'] = 'mail@example.test';
    process.env['SMTP_PASSWORD'] = 'test-only';
    process.env['SMTP_PORT'] = '465';
    process.env['SMTP_SECURE'] = 'true';
    expect(() => new MailAdapter().assertConfigured()).not.toThrow();
  });

  it('reports provider configuration without sending email or exposing credentials', () => {
    process.env['NODE_ENV'] = 'development';
    process.env['EMAIL_PROVIDER'] = 'smtp';
    process.env['MAIL_MODE'] = 'development';
    delete process.env['SMTP_HOST'];
    const mail = new MailAdapter();
    expect(mail.configurationHealth()).toEqual({ provider: 'smtp', status: 'incomplete' });
    process.env['MAIL_MODE'] = 'disabled';
    expect(mail.configurationHealth()).toEqual({ provider: 'smtp', status: 'disabled' });
    expect(JSON.stringify(mail.configurationHealth())).not.toContain('SMTP_PASSWORD');
  });

  it('sends via Resend with an idempotency key and classifies provider failures', async () => {
    process.env['NODE_ENV'] = 'development';
    process.env['EMAIL_PROVIDER'] = 'resend';
    process.env['APP_URL'] = 'https://example.test';
    process.env['SMTP_FROM'] = 'Mirhal <mail@example.test>';
    process.env['RESEND_API_KEY'] = 'test-only';
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: false, status: 429 })
      .mockResolvedValueOnce({ ok: false, status: 400 });
    vi.stubGlobal('fetch', fetchMock);
    const mail = new MailAdapter();
    await mail.send('user@example.test', 'VERIFY_EMAIL', 'token', 'ar');
    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers['Idempotency-Key']).toMatch(/^[a-f0-9]{64}$/);
    expect(options.headers.Authorization).toContain('test-only');
    expect(JSON.parse(options.body).from).toBe('Mirhal <mail@example.test>');
    expect(JSON.parse(options.body).html).toContain('lang="ar" dir="rtl"');
    await expect(
      mail.send('user@example.test', 'RESET_PASSWORD', 'token2', 'en'),
    ).rejects.toThrow();
    expect(error.mock.calls[0][0]).toContain('"classification":"temporary"');
    await expect(
      mail.send('user@example.test', 'RESET_PASSWORD', 'token3', 'en'),
    ).rejects.toThrow();
    expect(error.mock.calls[1][0]).toContain('"classification":"permanent"');
    expect(log).toHaveBeenCalledOnce();
  });

  it('retries a transient Resend failure once with the same idempotency key', async () => {
    process.env['NODE_ENV'] = 'development';
    process.env['EMAIL_PROVIDER'] = 'resend';
    process.env['APP_URL'] = 'https://example.test';
    process.env['SMTP_FROM'] = 'Mirhal <mail@example.test>';
    process.env['RESEND_API_KEY'] = 'test-only';
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: true })
      .mockRejectedValueOnce(new TypeError('network unavailable'))
      .mockResolvedValueOnce({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const mail = new MailAdapter();
    await mail.send('user@example.test', 'VERIFY_EMAIL', 'first-token', 'ar');
    await mail.send('user@example.test', 'RESET_PASSWORD', 'second-token', 'en');
    expect(fetchMock).toHaveBeenCalledTimes(4);
    for (const [first, retry] of [
      [0, 1],
      [2, 3],
    ]) {
      const initial = fetchMock.mock.calls[first]?.[1];
      const repeated = fetchMock.mock.calls[retry]?.[1];
      expect(initial.headers['Idempotency-Key']).toBe(repeated.headers['Idempotency-Key']);
      expect(initial.body).toBe(repeated.body);
    }
    expect(fetchMock.mock.calls[0]?.[1].headers['Idempotency-Key']).not.toBe(
      fetchMock.mock.calls[2]?.[1].headers['Idempotency-Key'],
    );
  });
});
