

require('dotenv').config();
const mongoose = require('mongoose');
const http    = require('http');
const path    = require('path');
const fs      = require('fs');
const express = require('express');
const socketio = require('socket.io');
const session      = require('express-session');
const cookieParser = require('cookie-parser');
const MongoStore = require('connect-mongo').default;
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');


const Room   = require('./models/Room');
const User   = require('./models/User');


const roomRoutes    = require('./routes/rooms');
const authRoutes    = require('./routes/auth');
const sessionRoutes = require('./routes/session');
const userRoutes    = require('./routes/users');
const requireAuth   = require('./middleware/auth');

const app    = express();
const server = http.createServer(app);
const io     = socketio(server);
const PORT   = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

const LOGS_DIR      = path.join(__dirname, 'logs');
const CHAT_LOG      = path.join(LOGS_DIR, 'chats.log');
const ROOM_LOG      = path.join(LOGS_DIR, 'rooms.log');

const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4']);

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB error:', err));

function appendLog(file, msg) {
  fs.appendFileSync(file, `[${new Date().toISOString()}] ${msg}\n`);
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(session({
  secret:            process.env.SESSION_SECRET || 'chatify-secret-key',
  resave:            false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl:   process.env.MONGO_URI,
    dbName:     'chatify',
    ttl:        60 * 60,          // session expires in 1 hour
    autoRemove: 'native',
  }),
  cookie: {
    maxAge:   1000 * 60 * 60,     // cookie lives 1 hour
    httpOnly: true,               
    sameSite: 'lax',
  }
}));

app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
  next();
});

app.use('/api/rooms',   roomRoutes);
app.use('/api/auth',    authRoutes);
app.use('/api/session', sessionRoutes);
app.use('/api/users',   userRoutes); // <-- Moved to safety!


app.get('/', (req, res) => {
  if (req.session.userId) {
    return res.redirect('/dashboard');
  }
  res.render('index'); 
});

app.get('/dashboard', requireAuth, (req, res) => {
  res.render('dashboard');
});

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

app.get('/chat/:code', requireAuth, async (req, res) => {

  try {

    const user = await prisma.user.findUnique({
      where: {
        id: req.session.userId
      }
    });

    if (!user) {
      return res.redirect('/');
    }

    res.render('chat', {
      username: user.username,
      roomCode: req.params.code
    });

  } catch (err) {

    console.error(err);
    res.redirect('/dashboard');

  }

});

app.use((req, res) => res.status(404).sendFile(path.join(__dirname, 'public', '404.html')));
app.use((err, req, res, next) => { 
  console.error(err); 
  res.status(500).json({ success: false, message: 'Server error.' }); 
});

const userSockets = new Map(); 

io.on('connection', (socket) => {
  console.log(`🔌 Connected: ${socket.id}`);


  socket.on('register-presence', (username) => {
    socket.userName = username;
    if (!userSockets.has(username)) userSockets.set(username, new Set());
    userSockets.get(username).add(socket.id);
    
    
    socket.emit('online-users-list', Array.from(userSockets.keys()));
    
    
    socket.broadcast.emit('user-status', { username, online: true });
  });

  
  socket.on('join-room', async ({ code, name }) => {
    try {
      code = code.trim(); 
      name = name.trim();
      
      if (socket.roomCode) {
        socket.leave(socket.roomCode);
      }

      const room = await Room.findOne({ code });
      if (!room) { socket.emit('join-error', 'Room not found.'); return; }

      socket.join(code);
      socket.roomCode = code;

  
      socket.emit('room-joined', { code, name, history: room.messages });
    } catch (err) { console.error('join-room error:', err); }
  });
  socket.on('send-message', async ({ text }) => {
    try {
      const { roomCode: code, userName: name } = socket;
      if (!code || !name || !text.trim()) return;

      const msg = {
        sender: name,
        text:   text.trim(),
        time:   new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      await Room.findOneAndUpdate({ code }, { $push: { messages: msg } });
      
      io.to(code).emit('new-message', { ...msg, id: Date.now().toString() });
    } catch (err) { console.error('send-message error:', err); }
  });

  socket.on('disconnect', () => {
    const username = socket.userName;
    if (username && userSockets.has(username)) {
      const sockets = userSockets.get(username);
      sockets.delete(socket.id);
      
      if (sockets.size === 0) {
        userSockets.delete(username);
        io.emit('user-status', { username, online: false });
      }
    }
    console.log(`❌ Disconnected: ${socket.id}`);
  });
});

server.listen(PORT, '0.0.0.0',() => {
  appendLog(ROOM_LOG, `SERVER started on port ${PORT}`);
  console.log(`\n🚀 Chatify → http://localhost:${PORT}\n`);
});