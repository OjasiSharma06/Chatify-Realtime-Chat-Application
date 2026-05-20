const mongoose = require('mongoose');

// ── Message sub-schema ───────────────────────────────────────
const MessageSchema = new mongoose.Schema({
  sender:   { type: String, required: true }, 
  text:     { type: String, default: '' },
  imageUrl: { type: String, default: null }, // <-- FIXED: Added for Cloudinary
  time:     { type: String },
}, { _id: false });

// ── Room schema ──────────────────────────────────────────────
const RoomSchema = new mongoose.Schema({
  code:      { type: String, required: true, unique: true },
  members:   [{ type: Number }], // <-- FIXED: Must be Number for Prisma IDs
  messages:  { type: [MessageSchema], default: [] },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Room', RoomSchema);