const express = require('express');
const router  = express.Router();

// Router-level middleware — logs only session routes
router.use((req, res, next) => {
  console.log(`[SESSION ROUTER] ${req.method} ${req.originalUrl}`);
  next();
});

// CREATE session
router.post('/join', (req, res) => {
  const { name, code } = req.body;
  if (!name || !code)
    return res.status(400).json({ success: false, message: 'Name and code required.' });

  req.session.user = {
    name: name.trim(),
    roomCode: code.toUpperCase(),
    joinedAt: new Date().toISOString(),
  };

  res.cookie('chatify_user', name.trim(), { maxAge: 1000 * 60 * 60, httpOnly: false });
  res.json({ success: true, message: 'Session created.', user: req.session.user });
});

// READ session
router.get('/', (req, res) => {
  if (!req.session.user)
    return res.status(401).json({ success: false, message: 'No active session.' });
  res.json({ success: true, user: req.session.user });
});

// DESTROY session
router.delete('/', (req, res) => {
  req.session.destroy(err => {
    if (err)
      return res.status(500).json({ success: false, message: 'Could not end session.' });
    res.clearCookie('connect.sid');
    res.clearCookie('chatify_user');
    res.json({ success: true, message: 'Session ended.' });
  });
});

module.exports = router;