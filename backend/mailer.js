import nodemailer from 'nodemailer';

// dotenv.config() runs in the body of server.js, which is evaluated *after* this
// module, so the environment is read lazily instead of at import time.
const readConfig = () => {
  const host = (process.env.SMTP_HOST || '').trim();
  const port = Number(process.env.SMTP_PORT || 587);
  const user = (process.env.SMTP_USER || '').trim();
  // Google displays App Passwords as four groups of four; the spaces are not part
  // of the secret and must be stripped or the login is rejected.
  const pass = host.includes('gmail')
    ? (process.env.SMTP_PASS || '').replace(/\s+/g, '')
    : (process.env.SMTP_PASS || '').trim();

  // Ports 465/2465 expect implicit TLS while 587/25 upgrade with STARTTLS.
  // Deriving `secure` from the port avoids the common "SMTP_SECURE=true on 587"
  // failure, where the client speaks TLS to a plaintext port.
  const declaredSecure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true';
  const secureByPort = port === 465 || port === 2465
    ? true
    : port === 587 || port === 25
      ? false
      : null;

  return {
    host,
    port,
    secure: secureByPort ?? declaredSecure,
    auth: user ? { user, pass } : undefined,
    from: (process.env.MAIL_FROM || user || 'no-reply@localhost').trim(),
  };
};

export const isMailConfigured = () => Boolean((process.env.SMTP_HOST || '').trim());

let transporter = null;

const getTransporter = (config) => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.auth,
    });
  }
  return transporter;
};

const buildMessage = ({ from, to, resetUrl, expiresInMinutes }) => ({
  from,
  to,
  subject: 'Reset your password',
  text: [
    'Someone asked to reset the password for this note app account.',
    '',
    `Open this link to choose a new password: ${resetUrl}`,
    '',
    `The link expires in ${expiresInMinutes} minutes and can only be used once.`,
    "If you didn't ask for this, you can safely ignore this email.",
  ].join('\n'),
  html: `
    <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:460px;color:#263247">
      <p style="margin:0 0 18px;font-size:14px;color:#596579">Someone asked to reset the password for this note app account.</p>
      <p style="margin:0 0 18px">
        <a href="${resetUrl}" style="display:inline-block;padding:12px 20px;border-radius:8px;background:#4851ba;color:#fff;text-decoration:none;font-weight:600">Choose a new password</a>
      </p>
      <p style="margin:0 0 12px;font-size:12px;color:#8a95a5;word-break:break-all">${resetUrl}</p>
      <p style="margin:0;font-size:12px;color:#8a95a5">
        The link expires in ${expiresInMinutes} minutes and can only be used once.
        If you didn't ask for it, you can ignore this email.
      </p>
    </div>
  `,
});

/**
 * Describes the active SMTP configuration without exposing the password, so the
 * mail check script can show what will really be used.
 */
export const describeMailConfig = () => {
  const config = readConfig();
  return {
    configured: isMailConfigured(),
    host: config.host || '(empty, mail is skipped)',
    port: config.port,
    secure: config.secure,
    user: config.auth?.user ?? '(no login)',
    passwordLength: config.auth?.pass.length ?? 0,
    from: config.from,
  };
};

/**
 * Logs in to the SMTP server without sending anything, and rejects with the
 * server's own error (e.g. 535 when the password is rejected).
 */
export const verifyMailAccount = async () => {
  if (!isMailConfigured()) {
    throw new Error('SMTP_HOST is empty, so there is no account to verify');
  }
  await getTransporter(readConfig()).verify();
};

/**
 * Emails a password reset link. Returns `{ delivered: false }` when SMTP is not
 * configured, so the caller can decide whether to echo the link instead.
 */
export const sendPasswordResetLink = async ({ to, resetUrl, expiresInMinutes }) => {
  if (!isMailConfigured()) {
    return { delivered: false };
  }

  const config = readConfig();
  const info = await getTransporter(config).sendMail(buildMessage({
    from: config.from,
    to,
    resetUrl,
    expiresInMinutes,
  }));

  return { delivered: true, messageId: info.messageId };
};
