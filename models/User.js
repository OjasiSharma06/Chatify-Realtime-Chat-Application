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

  friends: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],

  createdAt: {
    type: Date,
    default: Date.now
  }

});

module.exports = mongoose.model('User', UserSchema);