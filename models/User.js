const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  prismaId: { 
    type: Number, 
    required: true, 
    unique: true 
  },
  username: { 
    type: String, 
    required: true, 
    unique: true, 
    trim: true 
  },
  profilePic: { 
    type: String, 
    default: '' 
  },
  friends: [{ 
    type: Number // <-- FIXED: Must be Number to hold Prisma IDs!
  }],
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

module.exports = mongoose.model('User', UserSchema);