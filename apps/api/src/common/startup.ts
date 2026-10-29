export class StartupConfigurationError extends Error {}

export function validateStartupEnvironment() {
  const required = ['DATABASE_URL'];
  if (process.env['VERCEL'] !== '1') required.push('DIRECT_URL');
  if (process.env['NODE_ENV'] === 'production')
    required.push('WEB_ORIGIN', 'ADMIN_ORIGIN', 'APP_URL');
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length)
    throw new StartupConfigurationError(
      `Missing required environment variables: ${missing.join(', ')}`,
    );
  const port = Number(process.env['PORT'] ?? 3333);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new StartupConfigurationError('PORT must be a valid TCP port.');
  if (process.env['NODE_ENV'] === 'production') {
    for (const name of ['WEB_ORIGIN', 'ADMIN_ORIGIN', 'APP_URL']) {
      try {
        const url = new URL(process.env[name]!);
        if (url.protocol !== 'https:' || url.origin !== process.env[name])
          throw new Error('Invalid origin');
      } catch {
        throw new StartupConfigurationError(
          `${name} must be an HTTPS origin without a path, query, or credentials.`,
        );
      }
    }
    if (process.env['MAIL_MODE'] !== 'disabled') {
      const provider = process.env['EMAIL_PROVIDER'];
      const fields =
        provider === 'smtp'
          ? ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM']
          : provider === 'resend'
            ? ['RESEND_API_KEY', 'SMTP_FROM']
            : [];
      if (!fields.length || fields.some((name) => !process.env[name]))
        throw new StartupConfigurationError(
          'Production email provider configuration is incomplete.',
        );
    }
  }
}
