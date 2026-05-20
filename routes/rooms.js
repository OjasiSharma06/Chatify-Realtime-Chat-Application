const express    = require('express');
const router     = express.Router();
const Room       = require('../models/Room');
const fs         = require('fs');
const path       = require('path');

const LOGS_DIR = path.join(__dirname, '../logs');
const CHAT_LOG = path.join(LOGS_DIR, 'chats.log');
const ROOM_LOG = path.join(LOGS_DIR, 'rooms.log');
const requireAuth = require('../middleware/auth');

function appendLog(file, msg) {
  fs.appendFileSync(file, `[${new Date().toISOString()}] ${msg}\n`);
}
function readLog(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}
function deleteLog(file) {
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

// Router-level middleware — logs only room routes
router.use((req, res, next) => {
  console.log(`[ROOMS ROUTER] ${req.method} ${req.originalUrl}`);
  next();
});

// CREATE room
router.post('/', async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name || name.trim().length < 2)
      return res.status(400).json({ success: false, message: 'Name must be at least 2 characters.' });

    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    await Room.create({ code, members: [], messages: [] });

    appendLog(ROOM_LOG, `CREATED room=${code} by="${name.trim()}"`);
    res.status(201).json({ success: true, code });
  } catch (err) { next(err); }
});

// READ room info
router.get('/:code', async (req, res, next) => {
  try {
    const room = await Room.findOne({ code: req.params.code.toUpperCase() });
    if (!room) return res.status(404).json({ success: false, message: 'Room not found.' });

    res.json({
      success: true,
      code: room.code,
      members: room.members.length,
      full: room.members.length >= 2,
      createdAt: room.createdAt,
      messageCount: room.messages.length,
    });
  } catch (err) { next(err); }
});

// READ messages
router.get('/:code/messages', async (req, res, next) => {
  try {
    const room = await Room.findOne({ code: req.params.code.toUpperCase() });
    if (!room) return res.status(404).json({ success: false, message: 'Room not found.' });
    res.json({ success: true, messages: room.messages });
  } catch (err) { next(err); }
});

// UPDATE — clear messages
router.put('/:code/clear', async (req, res, next) => {
  try {
    const room = await Room.findOne({ code: req.params.code.toUpperCase() });
    if (!room) return res.status(404).json({ success: false, message: 'Room not found.' });

    const count = room.messages.length;
    room.messages = [];
    await room.save();

    appendLog(CHAT_LOG, `CLEARED room=${room.code} (${count} msgs)`);
    res.json({ success: true, message: `Cleared ${count} messages.` });
  } catch (err) { next(err); }
});

// DELETE room
router.delete('/:code', async (req, res, next) => {
  try {
    const code = req.params.code.toUpperCase();
    const room = await Room.findOneAndDelete({ code });
    if (!room) return res.status(404).json({ success: false, message: 'Room not found.' });

    appendLog(ROOM_LOG, `DELETED room=${code}`);
    res.json({ success: true, message: 'Room deleted.' });
  } catch (err) { next(err); }
});

// Stats
router.get('/stats/all', async (req, res, next) => {
  try {
    const allRooms = await Room.find({}, 'code members messages');
    res.json({
      success: true,
      activeRooms: allRooms.length,
      rooms: allRooms.map(r => ({
        code: r.code,
        members: r.members.length,
        messages: r.messages.length,
      })),
    });
  } catch (err) { next(err); }
});

// Delete logs
router.delete('/logs/all', (req, res) => {
  deleteLog(CHAT_LOG);
  deleteLog(ROOM_LOG);
  res.json({ success: true, message: 'Logs deleted.' });
});

// Add this inside routes/rooms.js (Make sure to import Room model and requireAuth)

router.post('/dm', requireAuth, async (req, res) => {
  try {
    const { friendId } = req.body;
    const myId = req.session.userId;

    // ── The Magic: Deterministic Code ──
    // By sorting the two IDs alphabetically, Alice + Bob is the exact same string as Bob + Alice
    const roomCode = [myId, friendId].sort().join('_');

    // Check if room exists, if not, create it
    let room = await Room.findOne({ code: roomCode });
    if (!room) {
      room = new Room({
        code: roomCode,
        members: [myId, friendId]
      });
      await room.save();
    }

    res.json({ success: true, code: roomCode });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to initiate chat.' });
  }
});

module.exports = router;