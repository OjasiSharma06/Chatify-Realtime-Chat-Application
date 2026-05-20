const mongoose = require('mongoose');

// ── Message sub-schema ───────────────────────────────────────
const MessageSchema = new mongoose.Schema({
  sender:  { type: String, required: true }, // <-- Fixed: Changed back to 'sender'
  text:    { type: String, required: true },
  time:    { type: String },
}, { _id: false });

// ── Room schema ──────────────────────────────────────────────
const RoomSchema = new mongoose.Schema({
  code:      { type: String, required: true, unique: true },
  members:   [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  messages:  { type: [MessageSchema], default: [] },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Room', RoomSchema);