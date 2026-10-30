import type { TokenPurpose } from '@prisma/client';

export type EmailLanguage = 'ar' | 'en';
export type EmailPurpose = TokenPurpose | 'PASSWORD_CHANGED' | 'FRIEND_INVITE';

export interface AuthEmailOptions {
  appUrl: string;
  logoUrl?: string;
  supportEmail?: string;
  inviterName?: string;
}

function escapeHtml(value: string) {
  const entities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return value.replace(/[&<>"']/g, (character) => entities[character]!);
}

export function renderAuthEmail(
  purpose: EmailPurpose,
  language: EmailLanguage,
  url: string,
  options: AuthEmailOptions = { appUrl: new URL(url).origin },
) {
  const arabic = language === 'ar';
  const verification = purpose === 'VERIFY_EMAIL';
  const passwordChanged = purpose === 'PASSWORD_CHANGED';
  const friendInvite = purpose === 'FRIEND_INVITE';
  const dir = arabic ? 'rtl' : 'ltr';
  const align = arabic ? 'right' : 'left';
  const brand = arabic ? 'مِرحال' : 'MIRHAL';
  const subject = arabic
    ? verification
      ? 'تأكيد بريدك الإلكتروني في مِرحال'
      : friendInvite
        ? 'دعوة للانضمام إلى مِرحال'
        : passwordChanged
          ? 'تم تغيير كلمة المرور في مِرحال'
          : 'إعادة تعيين كلمة المرور في مِرحال'
    : verification
      ? 'Confirm your MIRHAL email'
      : friendInvite
        ? 'A friend invited you to MIRHAL'
        : passwordChanged
          ? 'Your MIRHAL password was reset'
          : 'Reset your MIRHAL password';
  const title = arabic
    ? verification
      ? 'أكد بريدك الإلكتروني'
      : friendInvite
        ? 'هناك مكان لك في الرحلة'
        : passwordChanged
          ? 'تمت إعادة تعيين كلمة المرور'
          : 'إعادة تعيين كلمة المرور'
    : verification
      ? 'Confirm your email address'
      : friendInvite
        ? 'A friend saved you a place'
        : passwordChanged
          ? 'Your password was reset'
          : 'Reset your password';
  const greeting = arabic ? 'مرحباً بك في مِرحال،' : 'Hello from MIRHAL,';
  const intro = arabic
    ? verification
      ? 'أكد بريدك الإلكتروني لمتابعة رحلتك في مِرحال.'
      : friendInvite
        ? `دعاك ${options.inviterName || 'صديقك'} للانضمام إلى مِرحال ومواصلة الرحلة معاً.`
        : passwordChanged
          ? 'أُعيد تعيين كلمة مرور حسابك في مِرحال بنجاح.'
          : 'تلقينا طلباً لإعادة تعيين كلمة مرور حسابك. استخدم الرابط الآمن أدناه.'
    : verification
      ? 'Confirm your email address to continue your journey with MIRHAL.'
      : friendInvite
        ? `${options.inviterName || 'A friend'} invited you to join MIRHAL and share the journey.`
        : passwordChanged
          ? 'Your MIRHAL account password was reset successfully.'
          : 'We received a request to reset your account password. Use the secure link below.';
  const action = arabic
    ? verification
      ? 'تأكيد البريد الإلكتروني'
      : friendInvite
        ? 'انضم إلى مِرحال'
        : passwordChanged
          ? 'افتح مِرحال'
          : 'إعادة تعيين كلمة المرور'
    : verification
      ? 'Confirm email address'
      : friendInvite
        ? 'Join MIRHAL'
        : passwordChanged
          ? 'Open MIRHAL'
          : 'Reset password';
  const expiry =
    passwordChanged
      ? ''
      : friendInvite
        ? arabic
          ? 'تنتهي هذه الدعوة خلال 7 أيام وتُستخدم مرة واحدة.'
          : 'This invitation expires in 7 days and can be used once.'
        : arabic
          ? verification
            ? 'ينتهي هذا الرابط خلال 24 ساعة ويُستخدم مرة واحدة.'
            : 'ينتهي هذا الرابط خلال 30 دقيقة ويُستخدم مرة واحدة.'
          : verification
            ? 'This one-time link expires in 24 hours.'
            : 'This one-time link expires in 30 minutes.';
  const ignore = arabic
    ? verification
      ? 'إذا لم تنشئ حساباً في مِرحال، يمكنك تجاهل هذه الرسالة.'
      : friendInvite
        ? 'إذا لم تكن تتوقع هذه الدعوة، يمكنك تجاهل الرسالة.'
        : passwordChanged
          ? 'إذا لم تطلب تغيير كلمة المرور، أمّن حسابك فوراً وتواصل مع الدعم.'
          : 'إذا لم تطلب إعادة تعيين كلمة المرور، فتجاهل الرسالة. تظل كلمة مرورك كما هي.'
    : verification
      ? 'If you did not create a MIRHAL account, you can ignore this email.'
      : friendInvite
        ? 'If you were not expecting this invitation, you can ignore this email.'
        : passwordChanged
          ? 'If you did not reset your password, secure your account and contact support immediately.'
          : 'If you did not request a password reset, ignore this email. Your password remains unchanged.';
  const supportLabel = arabic ? 'تحتاج إلى مساعدة؟' : 'Need a hand?';
  const supportText = options.supportEmail
    ? escapeHtml(options.supportEmail)
    : arabic
      ? 'تواصل مع فريق مِرحال'
      : 'Contact MIRHAL support';
  const appUrl = new URL(options.appUrl).origin;
  const logoUrl = options.logoUrl ?? new URL('/mirhal-email-logo.png', appUrl).href;
  const supportUrl = options.supportEmail
    ? `mailto:${options.supportEmail}`
    : new URL('/help', appUrl).href;
  const safeUrl = escapeHtml(url);
  const safeLogoUrl = escapeHtml(logoUrl);
  const safeSupportUrl = escapeHtml(supportUrl);
  const safeAppUrl = escapeHtml(appUrl);
  const html = `<!doctype html>
<html lang="${language}" dir="${dir}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f5f7f4;color:#202c29;font-family:Arial,'Segoe UI',sans-serif;-webkit-text-size-adjust:100%;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(intro)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background-color:#f5f7f4;">
      <tr><td align="center" style="padding:28px 12px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;border-collapse:separate;border-spacing:0;background-color:#fffefa;border:1px solid #dce4de;border-radius:16px;overflow:hidden;">
          <tr><td dir="${dir}" align="${align}" style="padding:22px 28px;background-color:#183a35;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
              <td valign="middle"><img src="${safeLogoUrl}" alt="${escapeHtml(brand)}" width="44" height="44" style="display:block;width:44px;height:44px;border:0;border-radius:12px;"></td>
              <td valign="middle" style="padding-${arabic ? 'right' : 'left'}:12px;color:#f1f7f3;font-size:18px;font-weight:bold;letter-spacing:.2px;">${escapeHtml(brand)}</td>
            </tr></table>
          </td></tr>
          <tr><td dir="${dir}" align="${align}" style="padding:32px 28px 12px;">
            <p style="margin:0 0 10px;color:#0e7165;font-size:12px;font-weight:bold;letter-spacing:1.2px;text-transform:uppercase;">${escapeHtml(greeting)}</p>
            <h1 style="margin:0;color:#202c29;font-size:25px;line-height:1.35;font-weight:700;">${escapeHtml(title)}</h1>
            <p style="margin:18px 0 0;color:#43524d;font-size:16px;line-height:1.75;">${escapeHtml(intro)}</p>
          </td></tr>
          <tr><td dir="${dir}" align="${align}" style="padding:22px 28px 10px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" bgcolor="#0e7165" style="border-radius:10px;background-color:#0e7165;">
              <a href="${safeUrl}" style="display:inline-block;padding:14px 22px;border:1px solid #0e7165;border-radius:10px;color:#ffffff;font-size:15px;font-weight:bold;line-height:1.3;text-align:center;text-decoration:none;">${escapeHtml(action)}</a>
            </td></tr></table>
            ${expiry ? `<p style="margin:18px 0 0;color:#5d6c66;font-size:13px;line-height:1.7;">${escapeHtml(expiry)}</p>` : ''}
          </td></tr>
          <tr><td dir="${dir}" align="${align}" style="padding:12px 28px 28px;">
            <p style="margin:0;color:#5d6c66;font-size:13px;line-height:1.7;">${escapeHtml(ignore)}</p>
            <p style="margin:20px 0 6px;color:#5d6c66;font-size:12px;line-height:1.6;">${arabic ? 'إذا لم يعمل الزر، انسخ هذا الرابط والصقه في متصفحك:' : 'If the button does not work, copy and paste this link into your browser:'}</p>
            <p dir="ltr" style="margin:0;direction:ltr;text-align:left;word-break:break-all;"><a href="${safeUrl}" style="color:#0e7165;font-size:12px;line-height:1.7;text-decoration:underline;">${safeUrl}</a></p>
          </td></tr>
          <tr><td dir="${dir}" align="${align}" style="padding:18px 28px;background-color:#edf1ec;border-top:1px solid #dce4de;">
            <p style="margin:0;color:#43524d;font-size:12px;line-height:1.7;">${escapeHtml(supportLabel)} <a href="${safeSupportUrl}" style="color:#0e7165;text-decoration:underline;">${supportText}</a></p>
            <p style="margin:8px 0 0;color:#5d6c66;font-size:11px;line-height:1.6;"><a href="${safeAppUrl}" style="color:#5d6c66;text-decoration:none;">MIRHAL · مِرحال</a></p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
  const text = `${greeting}\n\n${intro}\n\n${action}: ${url}\n\n${expiry}\n\n${ignore}\n\n${supportLabel}: ${options.supportEmail ?? supportUrl}`;
  return { subject, text, html };
}
