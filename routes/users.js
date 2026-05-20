// routes/users.js

const express = require('express');
const router = express.Router();

const requireAuth = require('../middleware/auth');

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();


// ─────────────────────────────────────────────
// GET CURRENT USER
// ─────────────────────────────────────────────

router.get('/me', requireAuth, async (req, res) => {

  try {

    const user = await prisma.user.findUnique({

      where: {
        id: req.session.userId
      },

      select: {
        id: true,
        username: true,
        email: true,
        createdAt: true
      }

    });

    if (!user) {

      return res.status(404).json({
        success: false,
        message: 'User not found'
      });

    }

    res.json({
      success: true,
      user
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      success: false,
      message: 'Server error.'
    });

  }

});


// ─────────────────────────────────────────────
// SEARCH USERS
// ─────────────────────────────────────────────

router.get('/search', requireAuth, async (req, res) => {

  try {

    const q = req.query.q;

    if (!q) {

      return res.json({
        success: true,
        users: []
      });

    }

    const users = await prisma.user.findMany({

      where: {

        username: {
          contains: q,
          mode: 'insensitive'
        },

        NOT: {
          id: req.session.userId
        }

      },

      select: {
        id: true,
        username: true
      },

      take: 5

    });

    res.json({
      success: true,
      users
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      success: false,
      message: 'Search failed.'
    });

  }

});


// ─────────────────────────────────────────────
// ADD FRIEND
// ─────────────────────────────────────────────

router.post('/add-friend', requireAuth, async (req, res) => {

  try {

    // Friend system not implemented in Prisma schema yet

    res.json({
      success: true,
      message: 'Friend feature coming soon.'
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      success: false,
      message: 'Could not add friend.'
    });

  }

});


module.exports = router;