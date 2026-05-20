const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');

// 1. Import and initialize Prisma
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const User = require('../models/User');

// ── REGISTER ROUTE ──────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !password || !email) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    // Prisma: Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { username: username }
    });

    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Username already taken.' });
    }

    // Hash password and create user in PostgreSQL
    const hashedPassword = await bcrypt.hash(password, 10);

const newUser = await prisma.user.create({
  data: {
    username,
    email,
    password: hashedPassword
  }
});

const mongoUser = new User({
  prismaId: newUser.id,
  username: newUser.username
});

await mongoUser.save();

req.session.userId = newUser.id;


req.session.save(err => {

  if (err) {
    return res.status(500).json({
      success: false,
      message: 'Session error'
    });
  }

  res.json({
    success: true,
    message: 'Registration successful'
  });

});

  } catch (err) {
    console.error('Registration Error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── LOGIN ROUTE ─────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Prisma: Find the user
    const user = await prisma.user.findUnique({
      where: { username: username }
    });

    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid credentials.' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Invalid credentials.' });
    }

    // Save to session
    req.session.userId = user.id;

req.session.save(err => {

  if (err) {
    return res.status(500).json({
      success: false,
      message: 'Session error'
    });
  }

  res.json({
    success: true,
    message: 'Login successful'
  });

});

  } catch (err) {
    console.error('Login Error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── LOGOUT ROUTE ────────────────────────────────────────────
router.post('/logout', (req, res) => {
  // Pass a callback function to wait for the database to finish
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout Error:', err);
      return res.status(500).json({ success: false, message: 'Could not log out.' });
    }
    
    // Clear the session cookie from the user's browser
    res.clearCookie('connect.sid'); 
    
    // Now it is safe to send the response!
    return res.json({ success: true, message: 'Logged out successfully' });
  });
});

module.exports = router;