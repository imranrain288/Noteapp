import mongoose from 'mongoose';

const noteSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true
  },
  tags: {
    type: [String],
    default: []
  },
  label: {
    type: String,
    default: '',
    maxlength: 40
  },
  labelColor: {
    type: String,
    default: '#F9FBFC',
    match: /^#[0-9A-Fa-f]{6}$/
  },
  reminderAt: {
    type: Date,
    default: null
  },
  isPinned: {
    type: Boolean,
    default: false
  },
  isTrashed: {
    type: Boolean,
    default: false
  },
  trashedAt: {
    type: Date,
    default: null
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

const Note = mongoose.model('Note', noteSchema);

export default Note;