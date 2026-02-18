# News Aggregator для Telegram

AI-powered агрегатор новостей с автопостингом в Telegram-канал.

## 🚀 Быстрый старт

```bash
# Установка
npm install

# Настройка
cp .env.example .env
# Заполни .env своими токенами

# Запуск
npm start
```

## ⚙️ Настройка .env

```
TELEGRAM_BOT_TOKEN=токен_от_BotFather
TELEGRAM_CHANNEL_ID=@username или -100xxx
ADMIN_USER_ID=твой_telegram_id
OPENROUTER_API_KEY=ключ_openrouter
```

## 📱 Команды бота

| Команда    | Описание               |
| ---------- | ---------------------- |
| `/status`  | Статистика очереди     |
| `/fetch`   | Собрать новости сейчас |
| `/post`    | Опубликовать один пост |
| `/pause`   | Приостановить          |
| `/resume`  | Продолжить             |
| `/sources` | Список источников      |
| `/test`    | Тест подключения       |

## 📰 Источники

- Hacker News
- TechCrunch
- OpenAI Blog
- The Verge
- Wired
- Ars Technica

Настраиваются в `src/sources.js`

## 🏗 Архитектура

```
src/
├── index.js      # Точка входа, cron
├── config.js     # Конфигурация
├── sources.js    # RSS источники
├── aggregator.js # Парсинг RSS
├── rewriter.js   # AI-переписывание
├── publisher.js  # Публикация в TG
├── admin.js      # Админ-команды
└── db.js         # SQLite хранилище
```
