const readline = require('readline');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const configPath = path.join(__dirname, 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

rl.question('Введи новый пароль для панели: ', (password) => {
  if (!password || password.length < 3) {
    console.log('Пароль должен быть минимум 3 символа.');
    rl.close();
    return;
  }

  const salt = bcrypt.genSaltSync(10);
  config.panel.passwordHash = bcrypt.hashSync(password, salt);
  config.panel.sessionSecret = crypto.randomBytes(32).toString('hex');

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log('Пароль установлен.');
  console.log('sessionSecret сгенерирован.');
  console.log('Можешь запускать панель: npm start');
  rl.close();
});