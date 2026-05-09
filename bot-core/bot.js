const { createClient } = require('bedrock-protocol');
const fs = require('fs').promises;
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

const config = require('./config.json');

async function log(message, botInfo = {}) {
  const timestamp = new Date().toISOString();
  let logMessage = `${timestamp}: ${message}`;
  if (botInfo.username) {
    logMessage = `${timestamp}: Bot=${botInfo.username} | Message=${message}`;
    if (botInfo.clientID) logMessage += ` | ClientID=${botInfo.clientID}`;
    if (botInfo.sessionID) logMessage += ` | SessionID=${botInfo.sessionID}`;
    if (botInfo.deviceID) logMessage += ` | DeviceID=${botInfo.deviceID}`;
    if (botInfo.deviceOS) logMessage += ` | DeviceOS=${botInfo.deviceOS}`;
    if (botInfo.deviceModel) logMessage += ` | DeviceModel=${botInfo.deviceModel}`;
  }

  try {
    await fs.appendFile('bot.log', `${logMessage}\n`, { encoding: 'utf8', flag: 'a' });
  } catch (e) {
    console.error(`Ошибка записи в bot.log: ${e.message}`);
  }
}

process.on('uncaughtException', (err) => {
  log(`Глобальная ошибка: ${err.message} | Стек: ${err.stack}`);
  console.error(`Глобальная ошибка: ${err.message}`);
});

process.on('unhandledRejection', (reason) => {
  log(`Глобальная ошибка промиса: ${reason}`);
  console.error(`Глобальная ошибка промиса: ${reason}`);
});

async function sleep(ms) {
  await log(`Ожидание ${ms} мс`);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function generateRandomPrefix() {
  const characters = 'qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM0123456789';
  let prefix = '';
  for (let i = 0; i < 6; i++) {
    prefix += characters[Math.floor(Math.random() * characters.length)];
  }
  log(`Сгенерирован префикс: ${prefix}`);
  return prefix;
}

function generateUniqueIdentifiers() {
  const crypto = require('crypto');
  const clientID = crypto.randomUUID();
  const sessionID = crypto.randomBytes(16).toString('hex');
  const deviceID = crypto.randomBytes(8).toString('hex');
  const osList = ['Windows 10', 'Android 12', 'iOS 16', 'Linux Ubuntu'];
  const deviceOS = osList[Math.floor(Math.random() * osList.length)];
  const deviceModel = `Device-${Math.random().toString(36).substring(2, 8)}`;
  const xuid = crypto.randomBytes(8).toString('hex');
  log(`Сгенерированы идентификаторы: clientID=${clientID}, sessionID=${sessionID}, deviceID=${deviceID}, deviceOS=${deviceOS}, deviceModel=${deviceModel}, xuid=${xuid}`);
  return { clientID, sessionID, deviceID, deviceOS, deviceModel, xuid };
}

async function createBot(options) {
  await log(`Начало создания бота: ${options.username}`);
  let client;
  let retries = 3;
  const { clientID, sessionID, deviceID, deviceOS, deviceModel, xuid } = generateUniqueIdentifiers();
  const botInfo = { username: options.username, clientID, sessionID, deviceID, deviceOS, deviceModel, xuid };

  while (retries > 0) {
    try {
      await log(`Попытка подключения бота ${options.username} к ${options.host}:${options.port}`);
      client = createClient({
        ...options,
        clientID,
        sessionID,
        xuid,
        profiles: {
          deviceID,
          deviceOS,
          deviceModel,
          xuid,
          userAgent: `Minecraft/${options.version} (${deviceOS})`
        }
      });
      await log(`Бот ${options.username} успешно создан`, botInfo);
      break;
    } catch (e) {
      await log(`Не удалось запустить бот ${options.username}: ${e.message} | Стек: ${e.stack}`, botInfo);
      console.error(`Ошибка бота ${options.username}: ${e.message}`);
      retries--;
      if (retries > 0) {
        await log(`Повторная попытка для ${options.username} (осталось ${retries})`, botInfo);
        await sleep(1000);
      }
    }
  }

  if (!client) {
    await log(`Бот ${options.username} не запустился после всех попыток`, botInfo);
    console.error(`Бот ${options.username} не запустился после всех попыток`);
    return;
  }

  client.on('join', () => {
    log(`Бот ${options.username} подключился`, botInfo);
    console.log(`Бот ${options.username} подключился`);
  });
  client.on('raknet_connect', (packet) => {
    try {
      const serverInfo = packet.extra.toString().split(';');
      log(`Сервер: ${serverInfo[1]}, Порт: ${options.port}, Версия: ${serverInfo[2]}`, botInfo);
      log(`Онлайн: ${serverInfo[3]}/${serverInfo[4]}, Мир: ${serverInfo[6] || 'Неизвестно'}`, botInfo);
    } catch (e) {
      log(`Ошибка разбора данных сервера: ${e.message} | Стек: ${e.stack}`, botInfo);
      console.error(`Ошибка разбора данных сервера для ${options.username}: ${e.message}`);
    }
  });
  client.on('spawn', async () => {
    await log(`Бот ${options.username} появился`, botInfo);
    console.log(`STATS:SPAWN:${options.username}`);

    if (options.auth) {
      try {
        client.queue('text', {
          type: 'chat',
          needs_translation: false,
          source_name: options.username,
          message: `/register ${options.auth.password} ${options.auth.password}`,
          xuid: xuid,
          platform_chat_id: ''
        });
        await log(`Отправлен /register для ${options.username}`, botInfo);
        await sleep(2000);
      } catch (e) {
        await log(`Ошибка /register для ${options.username}: ${e.message}`, botInfo);
      }

      try {
        client.queue('text', {
          type: 'chat',
          needs_translation: false,
          source_name: options.username,
          message: `/login ${options.auth.password}`,
          xuid: xuid,
          platform_chat_id: ''
        });
        await log(`Отправлен /login для ${options.username}`, botInfo);
        await sleep(2000);
      } catch (e) {
        await log(`Ошибка /login для ${options.username}: ${e.message}`, botInfo);
      }
    }

    for (let i = 0; i < options.messages.length; i++) {
      try {
        const message = options.messages[i];
        await log(`Подготовка отправки сообщения ${i + 1}: ${message}`, botInfo);
        client.queue('text', {
          type: 'chat',
          needs_translation: false,
          source_name: options.username,
          message: message,
          xuid: xuid,
          platform_chat_id: ''
        });
        await log(`Отправлено сообщение: ${message}`, botInfo);
        console.log(`STATS:MSG:${options.username}:${message}`);
        console.log(`Бот ${options.username} отправил сообщение: ${message}`);
        if (i < options.messages.length - 1) {
          await sleep(i < 2 ? 3000 : 7000);
        }
      } catch (e) {
        await log(`Ошибка отправки сообщения ${i + 1}: ${e.message} | Стек: ${e.stack}`, botInfo);
        console.log(`STATS:ERR:${options.username}:${e.message}`);
        console.error(`Ошибка отправки сообщения ${i + 1} для ${options.username}: ${e.message}`);
      }
    }
    await sleep(config.timing.finalDelaySeconds * 1000);
    await log(`Бот ${options.username} завершает работу после ${config.timing.finalDelaySeconds} секунд ожидания`, botInfo);
    client.close();
    await log(`Бот ${options.username} закрыт`, botInfo);
  });
  client.on('error', (err) => {
    log(`Ошибка бота ${options.username}: ${err.message} | Стек: ${err.stack}`, botInfo);
    console.error(`Ошибка бота ${options.username}: ${err.message}`);
  });
  client.on('kick', (reason) => {
    log(`Бот ${options.username} кикнут: ${JSON.stringify(reason)}`, botInfo);
    console.log(`STATS:KICK:${options.username}`);
    console.error(`Бот ${options.username} кикнут: ${JSON.stringify(reason)}`);
    createBot(options);
  });
  client.on('packet_error', (err) => {
    log(`Ошибка пакета для ${options.username}: ${err.message} (ID: ${err.packetId}) | Стек: ${err.stack}`, botInfo);
    console.error(`Ошибка пакета для ${options.username}: ${err.message} (ID: ${err.packetId})`);
  });
}

if (!isMainThread) {
  const { botOptions, botCount, delaySeconds } = workerData;
  log(`Запуск рабочего потока с ${botCount} ботами`);
  (async () => {
    for (let i = 0; i < botCount; i++) {
      log(`Создание бота ${i + 1}/${botCount}`);
      const randomPrefix = generateRandomPrefix();
      const options = {
        ...botOptions,
        username: `${randomPrefix}${botOptions.baseUsername}`
      };
      await createBot(options);
      const randomDelay = delaySeconds * 1000 + Math.random() * 200;
      log(`Задержка между ботами: ${randomDelay} мс`);
      await sleep(randomDelay);
    }
    log(`Рабочий поток завершён`);
    parentPort.postMessage('done');
  })();
} else {
  (async () => {
    try {
      log('Запуск основного потока');
      log(`Конфигурация: ${JSON.stringify(config, null, 2)}`);
      if (
        config.bot.count < 1 ||
        config.bot.threadCount < 1 ||
        config.timing.delayBetweenBotsSeconds < 0 ||
        isNaN(config.server.port) ||
        !config.messages ||
        !Array.isArray(config.messages) ||
        config.timing.finalDelaySeconds < 0
      ) {
        await log('Неверные параметры в config.json');
        console.error('Ошибка: Неверные параметры в config.json');
        return;
      }
      log(`Конфигурация валидна. Запуск ${config.bot.count} ботов в ${config.bot.threadCount} потоках`);
      const botsPerThread = Math.ceil(config.bot.count / config.bot.threadCount);
      const workers = [];
      for (let t = 0; t < config.bot.threadCount; t++) {
        const count = Math.min(botsPerThread, config.bot.count - t * botsPerThread);
        if (count <= 0) break;
        log(`Запуск потока ${t + 1} с ${count} ботами`);
        workers.push(new Promise((resolve) => {
          const worker = new Worker(__filename, {
            workerData: {
              botOptions: {
                host: config.server.host,
                port: config.server.port,
                baseUsername: config.bot.baseUsername,
                offline: true,
                version: config.server.version,
                messages: config.messages
              },
              botCount: count,
              delaySeconds: config.timing.delayBetweenBotsSeconds
            }
          });
          worker.on('message', () => {
            log(`Поток ${t + 1} завершён`);
            resolve();
          });
          worker.on('error', (err) => {
            log(`Ошибка в потоке ${t + 1}: ${err.message} | Стек: ${err.stack}`);
            console.error(`Ошибка в потоке ${t + 1}: ${err.message}`);
            resolve();
          });
          worker.on('exit', (code) => {
            log(`Поток ${t + 1} вышел с кодом ${code}`);
          });
        }));
      }
      await Promise.all(workers);
      await log('Все боты запущены и завершены');
      console.log('Скрипт завершён успешно');
    } catch (e) {
      await log(`Ошибка запуска основного потока: ${e.message} | Стек: ${e.stack}`);
      console.error(`Критическая ошибка: ${e.message}`);
    }
  })();
}