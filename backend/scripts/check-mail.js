// Checks the SMTP account in backend/.env without starting the API.
//   npm run mail:check                -> login test only
//   npm run mail:check -- you@mail.com -> login test, then a real code by mail
import dotenv from 'dotenv';
import { describeMailConfig, sendPasswordResetLink, verifyMailAccount } from '../mailer.js';

dotenv.config({ path: new URL('../.env', import.meta.url) });

const config = describeMailConfig();
console.log('Mail configuration from backend/.env');
for (const [key, value] of Object.entries(config)) {
  console.log(`  ${key.padEnd(15)} ${value}`);
}

const recipient = process.argv[2];
let loginFailed = false;

try {
  await verifyMailAccount();
  console.log('\nSMTP login: OK, the server accepted these credentials.');
} catch (error) {
  loginFailed = true;
  console.error(`\nSMTP login: FAILED (${error.responseCode || error.code || 'unknown'})`);
  console.error(`  ${String(error.message).split('\n')[0]}`);
}

if (!loginFailed && recipient) {
  const result = await sendPasswordResetLink({
    to: recipient,
    resetUrl: 'https://example.com/reset-password/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    expiresInMinutes: 30,
  });
  console.log(result.delivered
    ? `\nTest reset link sent to ${recipient} (${result.messageId}).`
    : '\nSMTP is not configured, so nothing was sent.');
}

if (loginFailed) {
  if (config.host.includes('gmail')) {
    console.error('\nGoogle answers 535 when the App Password was revoked or deleted, was');
    console.error('created for another account, or 2-Step Verification is off. Create a new');
    console.error('one at https://myaccount.google.com/apppasswords, put it in SMTP_PASS in');
    console.error('backend/.env, then run this check again.');
  }
  process.exitCode = 1;
}
