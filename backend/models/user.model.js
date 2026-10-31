import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

const SALT_ROUNDS = 12;
const bcryptHashPattern = /^\$2[aby]\$/;

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true
  },
  lastName: {
    type: String,
    default: ''
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  passwordResetTokenHash: {
    type: String,
    default: null,
    select: false
  },
  passwordResetExpiresAt: {
    type: Date,
    default: null,
    select: false
  }
}, {
  timestamps: true
});

// Hash on create and on any explicit password change. Values that already look
// like a bcrypt digest are left alone so re-saving a user can never double-hash.
userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password') || bcryptHashPattern.test(this.password)) {
    return next();
  }

  try {
    this.password = await bcrypt.hash(this.password, SALT_ROUNDS);
    return next();
  } catch (error) {
    return next(error);
  }
});

userSchema.statics.hashPassword = (password) => bcrypt.hash(password, SALT_ROUNDS);

// Accounts created before hashing was introduced still store a plain text
// password; they are verified as-is and upgraded on the next successful login.
userSchema.methods.hasLegacyPassword = function hasLegacyPassword() {
  return !bcryptHashPattern.test(this.password);
};

userSchema.methods.verifyPassword = function verifyPassword(candidate) {
  if (this.hasLegacyPassword()) return Promise.resolve(this.password === candidate);
  return bcrypt.compare(candidate, this.password);
};

const User = mongoose.model('User', userSchema);

export default User;
