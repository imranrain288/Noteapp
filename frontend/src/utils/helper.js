export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;
export const NAME_MAX_LENGTH = 50;
export const EMAIL_MAX_LENGTH = 254;
export const EMAIL_MAX_LOCAL_LENGTH = 64;

// Real-world shape: the local part is made of letters/digits runs joined by a
// single dot, underscore, percent, plus or hyphen, so it can never start or end
// with a symbol or repeat one ("_-00--@gmail.com" and "000-@gmail.com" fail).
// Domain labels are hyphen-safe and the TLD is 2+ letters only.
const emailPattern = /^[A-Za-z0-9]+(?:[._%+-][A-Za-z0-9]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/;
const namePattern = /^[\p{L}][\p{L}\p{M}' .-]*$/u;

export const validateEmail = (email) => {
    const value = String(email ?? '').trim();
    if (!value) return 'Please enter your email address.';
    if (value.length > EMAIL_MAX_LENGTH) return 'That email address is too long.';

    const atIndex = value.lastIndexOf('@');
    if (atIndex > 0) {
        const local = value.slice(0, atIndex);
        if (local.length > EMAIL_MAX_LOCAL_LENGTH) {
            return `The part before @ must be ${EMAIL_MAX_LOCAL_LENGTH} characters or fewer.`;
        }
        if (/^[._%+-]|[._%+-]$/.test(local)) {
            return 'Email addresses cannot start or end with a symbol such as a dot, underscore, plus or hyphen.';
        }
        if (/[._%+-]{2}/.test(local)) {
            return 'Email addresses cannot contain two symbols in a row, like ".." or "--".';
        }
    }

    if (!emailPattern.test(value)) return 'Enter a valid email address.';
    return '';
};

export const validEmail = (email) => !validateEmail(email);

export const validateName = (name, label) => {
    const value = String(name ?? '').trim();
    if (!value) return `Please enter your ${label.toLowerCase()}.`;
    if (value.length > NAME_MAX_LENGTH) return `${label} must be ${NAME_MAX_LENGTH} characters or fewer.`;
    if (!namePattern.test(value)) {
        return `${label} can only contain letters, spaces, apostrophes, periods and hyphens.`;
    }
    return '';
};

// Mirrors validatePassword in backend/validation.js; both sides must agree or the
// form accepts something the API then rejects.
export const validatePassword = (password) => {
    const value = String(password ?? '');
    if (!value) return 'Please enter a password.';
    if (value.length < PASSWORD_MIN_LENGTH) {
        return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
    }
    if (value.length > PASSWORD_MAX_LENGTH) {
        return `Password must be ${PASSWORD_MAX_LENGTH} characters or fewer.`;
    }
    if (!/[A-Za-z]/.test(value) || !/[0-9]/.test(value)) {
        return 'Password must include both a letter and a number.';
    }
    return '';
};

// Drives the inline checklist under the password fields.
export const passwordChecks = (password) => {
    const value = String(password ?? '');
    return [
        { label: `At least ${PASSWORD_MIN_LENGTH} characters`, met: value.length >= PASSWORD_MIN_LENGTH },
        { label: 'A letter', met: /[A-Za-z]/.test(value) },
        { label: 'A number', met: /[0-9]/.test(value) },
    ];
};

export const getInitials = (name) => {

    if(!name) return '';

    const nameArray = name.split(' ');
    if(nameArray.length === 1) return (nameArray[0][0]).toUpperCase();
    return (nameArray[0][0] + nameArray[1][0]).toUpperCase();
}

export default function helper() {
    // console.log('helper function');
    
}
