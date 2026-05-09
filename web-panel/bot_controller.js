const { spawn } = require('child_process');
const path = require('path');
const EventEmitter = require('events');

class BotController extends EventEmitter {
  constructor() {
    super();
    this.process = null;
    this.running = false;
    this.stats = {
      totalBots: 0,
      online: 0,
      kicked: 0,
      messagesSent: 0,
      errors: 0,
      startTime: null,
      status: 'stopped'
    };
    this.logs = [];
    this.maxLogs = 500;
  }

  start(config) {
    if (this.running) {
      return { error: 'Боты уже запущены' };
    }

    const botConfigPath = path.join(__dirname, '..', 'bot-core', 'config.json');
    const fs = require('fs');
    const botConfig = {
      server: {
        host: config.host,
        port: parseInt(config.port),
        version: config.version
      },
      bot: {
        baseUsername: config.baseUsername,
        count: parseInt(config.count),
        threadCount: parseInt(config.threadCount)
      },
      timing: {
        delayBetweenBotsSeconds: parseFloat(config.delayBetweenBotsSeconds),
        finalDelaySeconds: parseInt(config.finalDelaySeconds)
      },
      messages: config.messages
    };

    fs.writeFileSync(botConfigPath, JSON.stringify(botConfig, null, 2));

    this.stats = {
      totalBots: parseInt(config.count),
      online: 0,
      kicked: 0,
      messagesSent: 0,
      errors: 0,
      startTime: Date.now(),
      status: 'running'
    };
    this.running = true;

    const botScript = path.join(__dirname, '..', 'bot-core', 'bot.js');
    this.process = spawn('node', [botScript], {
      cwd: path.join(__dirname, '..', 'bot-core'),
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, FORCE_COLOR: '0' }
    });

    this.process.stdout.on('data', (data) => {
      const text = data.toString();
      this.addLog('info', text.trim());
      this.parseStats(text);
    });

    this.process.stderr.on('data', (data) => {
      const text = data.toString();
      this.addLog('error', text.trim());
      this.stats.errors++;
      this.emit('update', this.getStatus());
    });

    this.process.on('close', (code) => {
      this.addLog('info', `Процесс ботов завершён с кодом ${code}`);
      this.running = false;
      this.stats.status = 'stopped';
      this.emit('update', this.getStatus());
      this.process = null;
    });

    this.process.on('error', (err) => {
      this.addLog('error', `Ошибка процесса: ${err.message}`);
      this.running = false;
      this.stats.status = 'error';
      this.emit('update', this.getStatus());
    });

    this.addLog('success', `Боты запущены: ${config.count} шт, ${config.threadCount} потоков`);
    return { success: true };
  }

  stop() {
    if (!this.running || !this.process) {
      return { error: 'Боты не запущены' };
    }
    this.process.kill('SIGTERM');
    this.addLog('warning', 'Боты остановлены принудительно');
    this.stats.status = 'stopped';
    this.running = false;
    this.emit('update', this.getStatus());
    return { success: true };
  }

  parseStats(text) {
    if (text.includes('подключился')) {
      this.stats.online++;
      this.emit('update', this.getStatus());
    }
    if (text.includes('кикнут')) {
      this.stats.online = Math.max(0, this.stats.online - 1);
      this.stats.kicked++;
      this.emit('update', this.getStatus());
    }
    if (text.includes('отправил сообщение')) {
      this.stats.messagesSent++;
      this.emit('update', this.getStatus());
    }
    if (text.includes('ошибка') || text.includes('Error') || text.includes('Ошибка')) {
      this.stats.errors++;
      this.emit('update', this.getStatus());
    }
  }

  addLog(type, message) {
  const entry = {
    type,
    message,
    time: new Date().toISOString()
  };
  
  this.logs.push(entry);          
  if (this.logs.length > this.maxLogs) {
    this.logs.shift();            
  }
  
  this.emit('log', entry);
}

  getStatus() {
    return {
      ...this.stats,
      uptime: this.stats.startTime ? Date.now() - this.stats.startTime : 0
    };
  }

  getLogs(count = 100) {
    return this.logs.slice(0, count);
  }
}

module.exports = BotController;