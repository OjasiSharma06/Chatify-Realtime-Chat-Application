// routes/users.js

const express = require('express');
const router = express.Router();

const requireAuth = require('../middleware/auth');

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const MongoUser = require('../models/User');


// ─────────────────────────────────────────────
// GET CURRENT USER
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// GET CURRENT USER (Merged Prisma + Mongo)
// ─────────────────────────────────────────────
router.get('/me', requireAuth, async (req, res) => {
  try {
    const myId = req.session.userId;

    // 1. Get base user from Prisma
    const pUser = await prisma.user.findUnique({
      where: { id: myId },
      select: { id: true, username: true }
    });

    if (!pUser) {
      return res.status(404).json({ success: false, message: 'User not found in Prisma' });
    }

    // 2. Get friends and avatar from Mongo
    let mUser = await MongoUser.findOne({ prismaId: myId });
    
    // Auto-repair missing mongo mirror profile on login
    if (!mUser) {
      mUser = new MongoUser({ prismaId: myId, username: pUser.username, friends: [] });
      await mUser.save();
    }

    // Safety net for old accounts missing the array
    if (!mUser.friends) mUser.friends = [];

    // 3. Translate Friend IDs into Usernames for the frontend
    const friendDetails = await prisma.user.findMany({
      where: { id: { in: mUser.friends } },
      select: { id: true, username: true }
    });

    const mappedFriends = friendDetails.map(f => ({
      prismaId: f.id,
      username: f.username
    }));

    // 4. Send the perfectly merged data back
    res.json({
      success: true,
      user: {
        username: pUser.username,
        prismaId: pUser.id,
        profilePic: mUser.profilePic || 'https://abs.twimg.com/sticky/default_profile_images/default_profile_400x400.png',
        friends: mappedFriends
      }
    });

  } catch (err) {
    console.error('ME Route Error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
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


router.post('/add-friend', requireAuth, async (req, res) => {
  try {
    const friendId = parseInt(req.body.friendId);
    const myId = req.session.userId;

    if (!friendId) {
      return res.status(400).json({ success: false, message: 'Friend ID required.' });
    }

    // 1. Find YOUR mirror profile in MongoDB
    let me = await MongoUser.findOne({ prismaId: myId });
    
    if (!me) {
      return res.status(404).json({ success: false, message: 'Your Mongo profile is missing.' });
    }

    // SAFETY NET: Create friends array if it is missing from an old database record
    if (!me.friends) {
      me.friends = [];
    }

    // 2. Prevent duplicate friends
    if (me.friends.includes(friendId)) {
      return res.status(400).json({ success: false, message: 'Already friends.' });
    }

    // 3. Check if the friend exists in MongoDB
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
        username: friendPrisma.username,
        friends: [] // Give them a blank friends array too!
      });
      await friendMongo.save();
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