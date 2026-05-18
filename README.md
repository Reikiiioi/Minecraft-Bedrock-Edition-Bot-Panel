# Bot Panel

Панель управления для массового подключения Minecraft Bedrock ботов к серверу.

Автор: Reikiiioi

- Чат
![preview](photo/Chat.jpeg)

## Панель

![preview](photo/Panel.jpeg)

- Монитор
![preview](photo/Monitor.jpeg)

- Атака
![preview](photo/Attack.jpeg)

- Ручное управление
![preview](photo/ManualControl.jpeg)



### bot-core

Ядро ботов. Содержит логику подключения к Minecraft Bedrock серверу через bedrock-protocol. Запускает ботов в worker threads для параллельной работы.

- `bot.js` -- Главный файл. Создает ботов, подключается к серверу, отправляет сообщения. Работает как main thread (координатор) и как worker thread (боты).
- `config.json` -- Конфигурация: сервер, порт, версия, количество ботов, сообщения. Перезаписывается панелью при старте атаки.

### web-panel

Веб-панель управления на Express + Socket.IO.

- `server.js` -- Сервер. Отдает статику, API логина/конфига, Socket.IO для реального времени.
- `bot_controller.js` -- Контроллер массового запуска. Спавнит bot.js как child process, парсит его stdout/stderr для статистики.
- `single_bot.js` -- Класс для ручного управления одним ботом (подключение, отправка сообщений, чтение чата).
- `setup.js` -- Интерактивный скрипт для генерации bcrypt пароля и sessionSecret.
- `config.json` -- Настройки панели: порт, хеш пароля, секрет, дефолтные параметры ботов.

### public (фронтенд)

Чистый HTML/CSS/JS без фреймворков.

- `index.html` -- Страница логина. Отправляет пароль на /api/login, получает токен, сохраняет в localStorage.
- `dashboard.html` -- Панель управления. 4 вкладки: обзор, атака, ручное управление, логи.
- `app.js` -- Весь клиентский код: сокеты, графики Chart.js, управление ботами, чат, логгирование.
- `style.css` -- Тёмная тема, сетка статистики, чат, адаптив под мобилки.

---

## Быстрый старт

Запускаешь один файл, он сам делает всё остальное:

```bash
cd bot-ddos
node start.js
```

При первом запуске start.js:
- Устанавливает зависимости в bot-core и web-panel
- Спрашивает пароль для входа в панель
- Генерирует sessionSecret
- Запускает веб-сервер

При повторных запусках просто стартует панель.

Панель на http://127.0.0.1:3000

---

## Настройка конфигов

### web-panel/config.json

```json
{
  "panel": {
    "port": 3000,
    "passwordHash": "...",
    "sessionSecret": "..."
  },
  "botDefaults": {
    "host": "localhost",
    "port": 19132,
    "version": "1.20.80",
    "baseUsername": "Bot",
    "count": 10,
    "threadCount": 1,
    "delayBetweenBotsSeconds": 1,
    "finalDelaySeconds": 30,
    "messages": ["Hello!"]
  }
}
```

**Важно:** bot-core/config.json полностью перезаписывается при запуске атаки через панель. Параметры берутся из botDefaults.

### Смена пароля

Через API:

```
POST /api/change-password
Content-Type: application/json

{
  "token": "auth_ok",
  "oldPassword": "старый_пароль",
  "newPassword": "новый_пароль"
}
```

Либо отредактировать web-panel/config.json вручную и перезапустить сервер.

---

## Безопасность

- Панель слушает только 127.0.0.1
- Для удаленного доступа -- reverse proxy (nginx, Caddy) с HTTPS
- sessionSecret должен быть уникальным для каждой установки
- Рекомендуется менять пароль после первого входа

## Команды npm (web-panel)

| Команда        | Описание                        |
|----------------|----------------------------------|
| npm start      | Запуск сервера                   |
| npm run setup  | Генерация пароля и sessionSecret |
## Лицензия

MIT License. Полный текст в файле LICENSE.

Copyright (c) 2024 Reikiiioi
