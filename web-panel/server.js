const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const BotController = require('./bot_controller');
const SingleBot = require('./single_bot');

const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const botCtrl = new BotController();
const singleBot = new SingleBot();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/login', (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.json({ success: false, error: 'Пароль не указан' });
  }
  if (bcrypt.compareSync(password, config.panel.passwordHash)) {
    return res.json({ success: true, token: 'auth_ok' });
  }
  return res.json({ success: false, error: 'Неверный пароль' });
});

app.post('/api/change-password', (req, res) => {
  const { token, oldPassword, newPassword } = req.body;
  if (token !== 'auth_ok') {
    return res.json({ success: false, error: 'Не авторизован' });
  }
  if (!bcrypt.compareSync(oldPassword, config.panel.passwordHash)) {
    return res.json({ success: false, error: 'Старый пароль неверен' });
  }
  const salt = bcrypt.genSaltSync(10);
  config.panel.passwordHash = bcrypt.hashSync(newPassword, salt);
  fs.writeFileSync(path.join(__dirname, 'config.json'), JSON.stringify(config, null, 2));
  return res.json({ success: true });
});

app.get('/api/config', (req, res) => {
  const { token } = req.query;
  if (token !== 'auth_ok') {
    return res.json({ success: false, error: 'Не авторизован' });
  }
  return res.json({ success: true, config: config.botDefaults });
});

app.post('/api/config', (req, res) => {
  const { token, config: newConfig } = req.body;
  if (token !== 'auth_ok') {
    return res.json({ success: false, error: 'Не авторизован' });
  }
  config.botDefaults = { ...config.botDefaults, ...newConfig };
  fs.writeFileSync(path.join(__dirname, 'config.json'), JSON.stringify(config, null, 2));
  return res.json({ success: true });
});

singleBot.on('status', (status) => {
  io.emit('manual_status', status);
});

singleBot.on('message', (entry) => {
  io.emit('manual_message', entry);
});

io.on('connection', (socket) => {
  console.log(`Клиент подключён: ${socket.id}`);

  socket.on('auth', (data, callback) => {
    if (data && data.token === 'auth_ok') {
      socket.auth = true;
      socket.emit('status', botCtrl.getStatus());
      socket.emit('logs', botCtrl.getLogs(100));
      socket.emit('manual_status', singleBot.getStatus());
      socket.emit('manual_messages', singleBot.getMessages(100));
      if (callback) callback({ success: true });
    } else {
      if (callback) callback({ success: false, error: 'Неверный токен' });
    }
  });

  socket.on('start', (configData) => {
    if (!socket.auth) return socket.emit('log', { type: 'error', message: 'Не авторизован', time: new Date().toISOString() });
    const result = botCtrl.start(configData || config.botDefaults);
    if (result.error) {
      socket.emit('log', { type: 'error', message: result.error, time: new Date().toISOString() });
    }
  });

  socket.on('stop', () => {
    if (!socket.auth) return;
    botCtrl.stop();
  });

  socket.on('getStatus', () => {
    if (!socket.auth) return;
    socket.emit('status', botCtrl.getStatus());
  });

  socket.on('connect_bot', (options) => {
    if (!socket.auth) return;
    singleBot.connect(options);
  });

  socket.on('disconnect_bot', () => {
    if (!socket.auth) return;
    singleBot.disconnect();
  });

  socket.on('bot_command', (text) => {
    if (!socket.auth) return;
    singleBot.sendMessage(text);
  });

  socket.on('get_manual_status', () => {
    if (!socket.auth) return;
    socket.emit('manual_status', singleBot.getStatus());
    socket.emit('manual_messages', singleBot.getMessages(100));
  });
});

botCtrl.on('update', (status) => {
  io.emit('status', status);
});

botCtrl.on('log', (entry) => {
  io.emit('log', entry);
});

server.listen(config.panel.port, '127.0.0.1', () => {
  console.log(`Панель запущена на http://127.0.0.1:${config.panel.port}`);
});