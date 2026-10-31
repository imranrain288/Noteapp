export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 72;
export const MAX_NAME_LENGTH = 50;
export const MAX_EMAIL_LENGTH = 254;
export const MAX_EMAIL_LOCAL_LENGTH = 64;

// Real-world shape: the local part is made of letters/digits runs joined by a
// single dot, underscore, percent, plus or hyphen, so it can never start or end
// with a symbol or repeat one ("_-00--@gmail.com" and "000-@gmail.com" fail).
// Domain labels are hyphen-safe and the TLD is 2+ letters only.
const emailPattern = /^[A-Za-z0-9]+(?:[._%+-][A-Za-z0-9]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/;
const namePattern = /^[\p{L}][\p{L}\p{M}' .-]*$/u;

export const normalizeEmail = (value) => String(value ?? '').trim().toLowerCase();

export const normalizeName = (value) => String(value ?? '').trim().replace(/\s+/g, ' ');

export const validateName = (value, label) => {
  if (!value) return `Please enter your ${label.toLowerCase()}.`;
  if (value.length > MAX_NAME_LENGTH) return `${label} must be ${MAX_NAME_LENGTH} characters or fewer.`;
  if (!namePattern.test(value)) return `${label} can only contain letters, spaces, apostrophes, periods and hyphens.`;
  return null;
};

export const validateEmail = (value) => {
  const email = String(value ?? '').trim();
  if (!email) return 'Please enter your email address.';
  if (email.length > MAX_EMAIL_LENGTH) return 'That email address is too long.';

  const atIndex = email.lastIndexOf('@');
  if (atIndex > 0) {
    const local = email.slice(0, atIndex);
    if (local.length > MAX_EMAIL_LOCAL_LENGTH) {
      return `The part before @ must be ${MAX_EMAIL_LOCAL_LENGTH} characters or fewer.`;
    }
    if (/^[._%+-]|[._%+-]$/.test(local)) {
      return 'Email addresses cannot start or end with a symbol such as a dot, underscore, plus or hyphen.';
    }
    if (/[._%+-]{2}/.test(local)) {
      return 'Email addresses cannot contain two symbols in a row, like ".." or "--".';
    }
  }

  if (!emailPattern.test(email)) return 'Enter a valid email address.';
  return null;
};

// Mirrored in frontend/src/utils/helper.js; keep both sides in step or the client
// accepts something the API then rejects.
export const validatePassword = (value) => {
  const password = typeof value === 'string' ? value : '';
  if (!password) return 'Please enter a password.';
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return `Password must be ${MAX_PASSWORD_LENGTH} characters or fewer.`;
  }
  if (!/[A-Za-z]/.test(password) || (!/[0-9]/.test(password))) {
    return 'Password must include both a letter and a number.';
  }
  return null;
};

// Every value is a human readable message (or undefined when the field is fine).
// The first message is reused as the top-level `message`, the whole map powers
// inline field errors on the client.
export const validateFields = (checks) => {
  const fields = {};
  for (const [field, message] of Object.entries(checks)) {
    if (message) fields[field] = message;
  }
  return fields;
};

export const sendValidationError = (res, fields) => res.status(400).json({
  error: true,
  message: Object.values(fields)[0],
  fields,
});
