const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// --- НАЛАШТУВАННЯ ВАРІАНТА ---
const VARIANT = 5;
const INTERVAL_SEC = 10 + VARIANT; // 15 секунд
const STUDENT_INFO = 'student of group IO-31 Shtyfliuk Olhа';
// -----------------------------

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// socket.id -> { username, room }
const users = new Map();

function getRoomUsers(room) {
  const result = [];
  for (const [, user] of users) {
    if (user.room === room) result.push(user.username);
  }
  return result;
}

// ---- Авто-таймер (стартує при першому користувачі) ----
let autoTimer = null;

function startAutoTimer() {
  if (autoTimer) return;
  autoTimer = setInterval(() => {
    io.emit('message', {
      type: 'admin',
      user: 'Admin',
      text: `Auto message from ${STUDENT_INFO} Var ${VARIANT}`,
      time: new Date().toLocaleTimeString()
    });
  }, INTERVAL_SEC * 1000);
  console.log(`[auto] timer started (${INTERVAL_SEC}s)`);
}

function stopAutoTimerIfEmpty() {
  if (users.size === 0 && autoTimer) {
    clearInterval(autoTimer);
    autoTimer = null;
    console.log('[auto] timer stopped (no users)');
  }
}

io.on('connection', (socket) => {
  console.log('a user connected:', socket.id);

  // ---- Приєднання до кімнати ----
  socket.on('join', ({ username, room }) => {
    if (!username || !room) return;

    socket.join(room);
    users.set(socket.id, { username, room });

    // Вітання новому користувачу
    socket.emit('message', {
      type: 'admin',
      user: 'Admin',
      text: `Welcome, ${username}!`,
      time: new Date().toLocaleTimeString()
    });

    // Іншим - про приєднання
    socket.to(room).emit('message', {
      type: 'admin',
      user: 'Admin',
      text: `${username} has joined`,
      time: new Date().toLocaleTimeString()
    });

    // Оновити список користувачів
    io.to(room).emit('roomUsers', {
      room,
      users: getRoomUsers(room)
    });

    startAutoTimer();
  });

  // ---- Повідомлення чату ----
  socket.on('chat message', (msg) => {
    const user = users.get(socket.id);
    if (!user) return;

    io.to(user.room).emit('message', {
      type: 'user',
      user: user.username,
      text: msg,
      time: new Date().toLocaleTimeString()
    });
  });

  // ---- Вихід ----
  socket.on('disconnect', () => {
    const user = users.get(socket.id);
    if (!user) return;

    users.delete(socket.id);

    io.to(user.room).emit('message', {
      type: 'admin',
      user: 'Admin',
      text: `${user.username} has left`,
      time: new Date().toLocaleTimeString()
    });

    io.to(user.room).emit('roomUsers', {
      room: user.room,
      users: getRoomUsers(user.room)
    });

    stopAutoTimerIfEmpty();
  });
});

server.listen(3000, () => {
  console.log(`Server listening on *:3000 (interval = ${INTERVAL_SEC}s)`);
});