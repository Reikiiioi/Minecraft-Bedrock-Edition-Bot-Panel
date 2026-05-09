const { createClient } = require('bedrock-protocol');
const EventEmitter = require('events');
const crypto = require('crypto');

class SingleBot extends EventEmitter {
  constructor() {
    super();
    this.client = null;
    this.connected = false;
    this.username = '';
    this.messages = [];
    this.maxMessages = 200;
  }

  connect(options) {
    if (this.client) {
      try { this.client.close(); } catch (e) {}
      this.client = null;
    }
    this.connected = false;
    this.messages = [];

    this.username = options.username || 'Bot';
    const clientID = crypto.randomUUID();
    const sessionID = crypto.randomBytes(16).toString('hex');
    const deviceID = crypto.randomBytes(8).toString('hex');
    const xuid = crypto.randomBytes(8).toString('hex');
    const deviceOS = 'Windows 10';
    const deviceModel = `Device-${Math.random().toString(36).substring(2, 8)}`;

    const joinMessage = options.joinMessage || '';

    try {
      this.client = createClient({
        host: options.host,
        port: parseInt(options.port) || 19132,
        username: this.username,
        offline: true,
        version: options.version || '1.20.80',
        clientID,
        sessionID,
        xuid,
        profiles: {
          deviceID,
          deviceOS,
          deviceModel,
          xuid,
          userAgent: `Minecraft/${options.version || '1.20.80'} (${deviceOS})`
        }
      });

      this.client.on('join', () => {
        this.connected = true;
        this.emit('status', { connected: true, username: this.username });
        this.addMessage('system', `${this.username} подключился к серверу`);
      });

      this.client.on('spawn', () => {
        this.emit('status', { connected: true, username: this.username, spawned: true });
        this.addMessage('system', `${this.username} появился на сервере`);

        if (joinMessage) {
          setTimeout(() => {
            this.sendMessage(joinMessage);
          }, 2000);
        }
      });

      this.client.on('text', (packet) => {
        const source = packet.source_name || '';
        const msg = packet.message || '';
        const type = packet.type || 'chat';

        let formatted = '';
        if (type === 'chat' && source) {
          formatted = `<${source}> ${msg}`;
        } else if (type === 'raw') {
          formatted = msg;
        } else {
          formatted = msg;
        }

        if (formatted) {
          this.addMessage('chat', formatted);
          this.emit('chat', { username: source, message: msg, type, raw: packet });
        }
      });

      this.client.on('kick', (reason) => {
        const reasonText = typeof reason === 'object' ? JSON.stringify(reason) : String(reason);
        this.addMessage('system', `Бот кикнут: ${reasonText}`);
        this.emit('status', { connected: false, username: this.username });
        this.cleanup();
      });

      this.client.on('error', (err) => {
        this.addMessage('error', `Ошибка: ${err.message}`);
        this.emit('error', err);
      });

      this.client.on('disconnect', () => {
        this.connected = false;
        this.addMessage('system', 'Бот отключён от сервера');
        this.emit('status', { connected: false, username: this.username });
        this.cleanup();
      });

      this.addMessage('system', `Подключение к ${options.host}:${options.port}...`);
      this.emit('status', { connected: false, username: this.username, connecting: true });

    } catch (e) {
      this.addMessage('error', `Ошибка создания бота: ${e.message}`);
      this.emit('error', e);
    }
  }

  sendMessage(text) {
    if (!this.client || !this.connected) {
      this.addMessage('error', 'Бот не подключён');
      return false;
    }

    try {
      this.client.queue('text', {
        type: 'chat',
        needs_translation: false,
        source_name: this.username,
        message: text,
        xuid: '',
        platform_chat_id: ''
      });
      this.addMessage('sent', text);
      return true;
    } catch (e) {
      this.addMessage('error', `Ошибка отправки: ${e.message}`);
      return false;
    }
  }

  disconnect() {
    if (this.client) {
      try { this.client.close(); } catch (e) {}
      this.cleanup();
      this.addMessage('system', 'Бот отключён');
    }
    this.emit('status', { connected: false, username: this.username });
  }

  cleanup() {
    this.connected = false;
    this.client = null;
  }

  addMessage(type, text) {
  const entry = {
    type,
    text,
    time: new Date().toISOString()
  };
  
  this.messages.push(entry);        
  if (this.messages.length > this.maxMessages) {
    this.messages.shift();          
  }
  
  this.emit('message', entry);
}

  getMessages(count = 100) {
    return this.messages.slice(0, count);
  }

  getStatus() {
    return {
      connected: this.connected,
      username: this.username
    };
  }
}

module.exports = SingleBot;