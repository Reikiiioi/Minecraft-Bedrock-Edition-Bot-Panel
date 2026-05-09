const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const root = __dirname;
const webPanelConfig = path.join(root, 'web-panel', 'config.json');
const botCoreDir = path.join(root, 'bot-core');
const webPanelDir = path.join(root, 'web-panel');

function run(cmd, cwd) {
  console.log(`[exec] ${cmd} in ${cwd}`);
  execSync(cmd, { cwd, stdio: 'inherit' });
}

function isFirstRun() {
  try {
    const cfg = JSON.parse(fs.readFileSync(webPanelConfig, 'utf8'));
    if (cfg.panel.passwordHash && cfg.panel.passwordHash.length > 20 && cfg.panel.sessionSecret && cfg.panel.sessionSecret !== 'change_this_secret_key') {
      return false;
    }
  } catch (e) {}
  return true;
}

function setup() {
  console.log('Первый запуск. Установка зависимостей и настройка...');
  
  if (!fs.existsSync(path.join(botCoreDir, 'node_modules'))) {
    console.log('Установка зависимостей bot-core...');
    run('npm install', botCoreDir);
  } else {
    console.log('bot-core зависимости уже установлены.');
  }

  if (!fs.existsSync(path.join(webPanelDir, 'node_modules'))) {
    console.log('Установка зависимостей web-panel...');
    run('npm install', webPanelDir);
  } else {
    console.log('web-panel зависимости уже установлены.');
  }

  return new Promise((resolve) => {
    rl.question('Введи пароль для панели: ', (password) => {
      if (!password || password.length < 3) {
        console.log('Пароль должен быть минимум 3 символа. Используется пароль по умолчанию: admin');
        password = 'admin';
      }
      
      const bcrypt = require('bcryptjs');
      const crypto = require('crypto');
      const salt = bcrypt.genSaltSync(10);
      const config = JSON.parse(fs.readFileSync(webPanelConfig, 'utf8'));
      config.panel.passwordHash = bcrypt.hashSync(password, salt);
      config.panel.sessionSecret = crypto.randomBytes(32).toString('hex');
      fs.writeFileSync(webPanelConfig, JSON.stringify(config, null, 2));
      
      console.log('Пароль установлен.');
      console.log('sessionSecret сгенерирован.');
      rl.close();
      resolve();
    });
  });
}

(async () => {
  console.log('MineDDoS Bot Panel');
  console.log('');

  if (isFirstRun()) {
    await setup();
  } else {
    if (!fs.existsSync(path.join(botCoreDir, 'node_modules')) || !fs.existsSync(path.join(webPanelDir, 'node_modules'))) {
      console.log('Обнаружены отсутствующие зависимости. Установка...');
      if (!fs.existsSync(path.join(botCoreDir, 'node_modules'))) {
        run('npm install', botCoreDir);
      }
      if (!fs.existsSync(path.join(webPanelDir, 'node_modules'))) {
        run('npm install', webPanelDir);
      }
    }
  }

  console.log('');
  console.log('Запуск панели...');
  
  const server = spawn('node', ['server.js'], {
    cwd: webPanelDir,
    stdio: 'inherit',
    env: { ...process.env }
  });

  server.on('close', (code) => {
    console.log(`Сервер завершил работу с кодом ${code}`);
    process.exit(code);
  });

  process.on('SIGINT', () => {
    server.kill('SIGINT');
    process.exit(0);
  });
})();