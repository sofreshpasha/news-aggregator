const { Telegraf } = require('telegraf');
const cron = require('node-cron');
const config = require('./config');
const aggregator = require('./aggregator');
const { sendToModeration, sendBatchToModeration, approvePost, rejectPost, regeneratePost, publishNext } = require('./publisher');
const { setupAdminCommands } = require('./admin');

// Validate config
if (!config.botToken) {
  console.error('❌ TELEGRAM_BOT_TOKEN не установлен в .env');
  process.exit(1);
}

if (!config.channelId) {
  console.error('❌ TELEGRAM_CHANNEL_ID не установлен в .env');
  process.exit(1);
}

// Initialize bot
const bot = new Telegraf(config.botToken);

// Setup admin commands
setupAdminCommands(bot);

// Helper: update message (works for both text and photo messages)
async function updateModMessage(ctx, statusText) {
  const msg = ctx.callbackQuery.message;
  const isPhoto = !!msg.photo;
  const currentText = isPhoto ? msg.caption : msg.text;
  const newText = currentText + '\n\n' + statusText;
  
  try {
    if (isPhoto) {
      await ctx.editMessageCaption(newText, { parse_mode: 'HTML' });
    } else {
      await ctx.editMessageText(newText, { parse_mode: 'HTML' });
    }
  } catch (e) {
    console.error('Failed to update message:', e.message);
  }
}

// Handle moderation buttons
bot.action(/^approve_(\d+)$/, async (ctx) => {
  const postId = parseInt(ctx.match[1]);
  try {
    await ctx.answerCbQuery('Публикую...');
  } catch (e) { /* ignore old query errors */ }
  
  try {
    const result = await approvePost(bot, postId);
    if (result.success) {
      await updateModMessage(ctx, '✅ <b>ОПУБЛИКОВАНО</b>');
    } else {
      await ctx.reply(`❌ Ошибка: ${result.error}`);
    }
  } catch (error) {
    console.error('Approve error:', error.message);
  }
});

bot.action(/^reject_(\d+)$/, async (ctx) => {
  const postId = parseInt(ctx.match[1]);
  try {
    await ctx.answerCbQuery('Отклонено');
  } catch (e) { /* ignore old query errors */ }
  
  try {
    rejectPost(postId);
    await updateModMessage(ctx, '❌ <b>ОТКЛОНЕНО</b>');
  } catch (error) {
    console.error('Reject error:', error.message);
  }
});

bot.action(/^regen_(\d+)$/, async (ctx) => {
  const postId = parseInt(ctx.match[1]);
  try {
    await ctx.answerCbQuery('Генерирую заново...');
  } catch (e) { /* ignore old query errors */ }
  
  try {
    const result = await regeneratePost(
      bot, 
      postId, 
      ctx.callbackQuery.message.message_id,
      ctx.callbackQuery.message.chat.id
    );
    
    if (!result.success) {
      await ctx.reply(`❌ Ошибка: ${result.error}`);
    }
  } catch (error) {
    console.error('Regen error:', error.message);
  }
});

// Scheduler: Fetch news every 30 minutes
cron.schedule('*/30 * * * *', async () => {
  console.log('[Cron] Fetching news...');
  try {
    await aggregator.fetchAll();
  } catch (error) {
    console.error('[Cron] Fetch error:', error.message);
  }
});

// Scheduler: Send batch to moderation every N hours
const postInterval = `0 */${Math.floor(config.postIntervalMinutes / 60)} * * *`;
cron.schedule(postInterval, async () => {
  console.log(`[Cron] Sending batch of ${config.batchSize} to moderation...`);
  try {
    if (config.autoPost) {
      // Auto-post mode: publish directly to main channel
      for (let i = 0; i < config.batchSize; i++) {
        await publishNext(bot);
        if (i < config.batchSize - 1) {
          await new Promise(r => setTimeout(r, 10000));
        }
      }
    } else if (config.moderationChannelId) {
      await sendBatchToModeration(bot, config.batchSize);
    } else {
      // Direct publish mode (no moderation)
      for (let i = 0; i < config.batchSize; i++) {
        await publishNext(bot);
      }
    }
  } catch (error) {
    console.error('[Cron] Batch error:', error.message);
  }
});

// Start bot (drop pending updates to avoid processing old callbacks)
bot.launch({ dropPendingUpdates: true })
  .then(() => {
    console.log('🚀 Bot started successfully');
    console.log(`📢 Main channel: ${config.channelId}`);
    console.log(`📝 Moderation channel: ${config.moderationChannelId || 'not set (direct publish)'}`);
    console.log(`🤖 Auto-post: ${config.autoPost ? 'ON' : 'OFF'}`);
    console.log(`⏱ Batch interval: every ${config.postIntervalMinutes} minutes`);
    console.log(`📦 Batch size: ${config.batchSize} posts`);
    console.log(`📰 Max posts/day: ${config.maxPostsPerDay}`);
    
    // Initial fetch on startup
    aggregator.fetchAll().catch(console.error);
  })
  .catch((error) => {
    console.error('Failed to start bot:', error);
    process.exit(1);
  });

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
