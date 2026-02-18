const config = require('./config');
const db = require('./db');
const aggregator = require('./aggregator');
const { publishNext, testConnection } = require('./publisher');

/**
 * Setup admin commands for bot
 */
function setupAdminCommands(bot) {
  // Middleware: check if user is admin
  const adminOnly = (ctx, next) => {
    if (ctx.from?.id !== config.adminUserId) {
      return ctx.reply('⛔ Доступ запрещён');
    }
    return next();
  };

  // /start - Welcome
  bot.command('start', adminOnly, (ctx) => {
    ctx.reply(`🤖 News Aggregator Bot

Команды:
/status - Статус системы
/fetch - Собрать новости сейчас
/post - Опубликовать следующий пост
/pause - Приостановить публикацию
/resume - Возобновить публикацию
/sources - Список источников
/test - Тест подключения к каналу`);
  });

  // /status - System status
  bot.command('status', adminOnly, async (ctx) => {
    const stats = db.getStats();
    const paused = db.isPaused();
    
    ctx.reply(`📊 *Статус*

📝 В очереди: ${stats.pending}
✅ Готово к публикации: ${stats.ready}
📤 Опубликовано всего: ${stats.posted}
📅 Сегодня: ${stats.todayPosted}/${config.maxPostsPerDay}

⏸ Пауза: ${paused ? 'Да' : 'Нет'}
⏱ Интервал: ${config.postIntervalMinutes} мин`, { parse_mode: 'Markdown' });
  });

  // /fetch - Force fetch
  bot.command('fetch', adminOnly, async (ctx) => {
    ctx.reply('🔄 Собираю новости...');
    try {
      const results = await aggregator.fetchAll();
      ctx.reply(`✅ Готово!

➕ Добавлено: ${results.added}
⏭ Пропущено (дубли): ${results.skipped}
❌ Ошибок: ${results.errors.length}`);
    } catch (error) {
      ctx.reply(`❌ Ошибка: ${error.message}`);
    }
  });

  // /post - Force post
  bot.command('post', adminOnly, async (ctx) => {
    ctx.reply('📤 Публикую...');
    try {
      const post = await publishNext(bot);
      if (post) {
        ctx.reply(`✅ Опубликовано: ${post.original_title}`);
      } else {
        ctx.reply('⚠️ Нет постов для публикации или достигнут лимит');
      }
    } catch (error) {
      ctx.reply(`❌ Ошибка: ${error.message}`);
    }
  });

  // /pause - Pause posting
  bot.command('pause', adminOnly, (ctx) => {
    db.setPaused(true);
    ctx.reply('⏸ Публикация приостановлена');
  });

  // /resume - Resume posting
  bot.command('resume', adminOnly, (ctx) => {
    db.setPaused(false);
    ctx.reply('▶️ Публикация возобновлена');
  });

  // /sources - List sources
  bot.command('sources', adminOnly, (ctx) => {
    const sources = aggregator.getEnabledSources();
    const list = sources.map(s => `${s.enabled ? '✅' : '❌'} ${s.name} (${s.category})`).join('\n');
    ctx.reply(`📰 *Источники*\n\n${list}`, { parse_mode: 'Markdown' });
  });

  // /test - Test channel connection
  bot.command('test', adminOnly, async (ctx) => {
    ctx.reply('🔌 Проверяю подключение к каналу...');
    const result = await testConnection(bot);
    if (result.success) {
      ctx.reply(`✅ Подключено к: ${result.chat.title || result.chat.username || config.channelId}`);
    } else {
      ctx.reply(`❌ Ошибка: ${result.error}\n\nУбедись что бот добавлен в канал как администратор.`);
    }
  });
}

module.exports = {
  setupAdminCommands,
};
