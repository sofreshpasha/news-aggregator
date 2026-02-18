require("dotenv").config();

module.exports = {
  // Telegram
  botToken: process.env.TELEGRAM_BOT_TOKEN,
  channelId: process.env.TELEGRAM_CHANNEL_ID,
  moderationChannelId: process.env.TELEGRAM_MODERATION_CHANNEL_ID,
  adminUserId: parseInt(process.env.ADMIN_USER_ID) || 0,

  // LLM
  openrouterApiKey: process.env.OPENROUTER_API_KEY,
  llmModel: process.env.LLM_MODEL || "anthropic/claude-3.5-sonnet",
  tonePrompt:
    process.env.TONE_PROMPT ||
    "Пиши кратко и по делу, как опытный tech-эксперт.",

  // Scheduler
  postIntervalMinutes: parseInt(process.env.POST_INTERVAL_MINUTES) || 180,
  batchSize: parseInt(process.env.BATCH_SIZE) || 5,
  maxPostsPerDay: parseInt(process.env.MAX_POSTS_PER_DAY) || 15,
  autoPost: process.env.AUTO_POST === 'true',

  // Paths
  dbPath: "./data/aggregator.db",
};
