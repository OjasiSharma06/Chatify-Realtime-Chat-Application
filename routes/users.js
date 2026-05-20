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

// ─────────────────────────────────────────────
// ADD FRIEND (With Auto-Repair Sync)
// ─────────────────────────────────────────────
router.post('/add-friend', requireAuth, async (req, res) => {
  try {
    const friendId = parseInt(req.body.friendId);
    const myId = req.session.userId;

    if (!friendId) {
      return res.status(400).json({ success: false, message: 'Friend ID required.' });
    }

    // 1. Find YOUR mirror profile in MongoDB
    const me = await MongoUser.findOne({ prismaId: myId });
    if (!me) {
      return res.status(404).json({ success: false, message: 'Your Mongo profile is missing.' });
    }

    // 2. Check if the friend exists in MongoDB
    let friendMongo = await MongoUser.findOne({ prismaId: friendId });
    
    // 🔧 AUTO-REPAIR: If friend is a ghost user (exists in Prisma but missing in Mongo)
    if (!friendMongo) {
      console.log(`🔧 Auto-Repair: Syncing missing MongoDB profile for Prisma ID: ${friendId}`);
      
      // Look them up in PostgreSQL
      const friendPrisma = await prisma.user.findUnique({
        where: { id: friendId }
      });
      
      if (!friendPrisma) {
        return res.status(404).json({ success: false, message: 'User does not exist in the system.' });
      }

      // Recreate their missing mirror profile instantly
      friendMongo = new MongoUser({
        prismaId: friendPrisma.id,
        username: friendPrisma.username
      });
      await friendMongo.save();
    }

    // 3. Prevent duplicate friends
    if (me.friends.includes(friendId)) {
      return res.status(400).json({ success: false, message: 'Already friends.' });
    }

    // 4. Save the friend connection safely
    me.friends.push(friendId);
    await me.save();

    res.json({ success: true, message: 'Friend added successfully!' });

  } catch (err) {
    console.error('Add Friend Error:', err);
    res.status(500).json({ success: false, message: 'Could not add friend.' });
  }
});


module.exports = router;