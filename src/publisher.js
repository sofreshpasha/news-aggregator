const { Telegraf, Input, Markup } = require('telegraf');
const axios = require('axios');
const config = require('./config');
const db = require('./db');
const { rewritePost } = require('./rewriter');
const { scrapeImage } = require('./scraper');

// Random link text variants
const LINK_TEXTS = [
  'Читать полностью →',
  'Подробнее →',
  'К источнику →',
  'Читать статью',
  'Полная версия',
  'Узнать больше',
  'Открыть оригинал',
  'Перейти к статье',
  'Детали тут →',
  'Вся история здесь',
];

function getRandomLinkText() {
  return LINK_TEXTS[Math.floor(Math.random() * LINK_TEXTS.length)];
}

/**
 * Truncate message to fit Telegram caption limit (1024 chars)
 */
function truncateCaption(text, limit = 1024) {
  if (text.length <= limit) return text;
  
  // Find a good cutoff point - prefer end of sentence
  const truncated = text.slice(0, limit - 4);
  
  // Try to cut at end of sentence first
  const lastSentence = Math.max(
    truncated.lastIndexOf('. '),
    truncated.lastIndexOf('! '),
    truncated.lastIndexOf('? '),
    truncated.lastIndexOf('.\n'),
    truncated.lastIndexOf('!\n'),
    truncated.lastIndexOf('?\n')
  );
  
  if (lastSentence > limit * 0.5) {
    // Good sentence break found in second half
    return truncated.slice(0, lastSentence + 1) + '...';
  }
  
  // Fall back to word break
  const lastSpace = truncated.lastIndexOf(' ');
  return truncated.slice(0, lastSpace > 0 ? lastSpace : limit - 4) + '...';
}

/**
 * Build moderation message with smart truncation
 * Ensures link and footer are always preserved
 */
function buildModerationText(rewritten, post, isRegen = false) {
  const linkText = `<a href="${post.original_url}">${getRandomLinkText()}</a>`;
  const header = isRegen ? '📝 <b>На модерацию</b> (перегенерировано)' : '📝 <b>На модерацию</b>';
  const footer = `\n\n${linkText}\n\n──────────\n📰 Источник: ${post.source}\n🆔 ID: ${post.id}`;
  
  const LIMIT = 1024;
  const overhead = header.length + footer.length + 4; // +4 for \n\n
  const maxContentLen = LIMIT - overhead;
  
  let content = rewritten;
  if (content.length > maxContentLen) {
    // Truncate content intelligently
    const truncated = content.slice(0, maxContentLen - 3);
    const lastSentence = Math.max(
      truncated.lastIndexOf('. '),
      truncated.lastIndexOf('.\n'),
      truncated.lastIndexOf('! '),
      truncated.lastIndexOf('? ')
    );
    if (lastSentence > maxContentLen * 0.5) {
      content = truncated.slice(0, lastSentence + 1) + '...';
    } else {
      const lastSpace = truncated.lastIndexOf(' ');
      content = truncated.slice(0, lastSpace > 0 ? lastSpace : maxContentLen - 3) + '...';
    }
  }
  
  return `${header}\n\n${content}${footer}`;
}

/**
 * Sanitize HTML for Telegram - strip all HTML except safe tags
 * Simpler approach: remove all tags, then re-add safe formatting
 */
function sanitizeHtml(text) {
  if (!text) return '';
  
  let result = text;
  
  // Step 1: Extract and preserve <b>...</b> content
  const boldMatches = [];
  result = result.replace(/<b>([^<]*)<\/b>/gi, (match, content) => {
    boldMatches.push(content);
    return `__BOLD_${boldMatches.length - 1}__`;
  });
  
  // Step 2: Remove ALL remaining HTML tags (they cause parse errors)
  result = result.replace(/<[^>]+>/g, '');
  
  // Step 3: Escape any remaining < > & 
  result = result
    .replace(/&(?!amp;|lt;|gt;)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  
  // Step 4: Restore bold tags
  boldMatches.forEach((content, i) => {
    result = result.replace(`__BOLD_${i}__`, `<b>${content}</b>`);
  });
  
  return result;
}

/**
 * Send a batch of posts to moderation (from different sources)
 */
async function sendBatchToModeration(bot, count = 5) {
  if (db.isPaused()) {
    console.log('Publishing is paused');
    return [];
  }

  const posts = db.getRandomPendingBatch(count);
  if (posts.length === 0) {
    console.log('No pending posts for batch');
    return [];
  }

  const results = [];
  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];
    try {
      const result = await sendSingleToModeration(bot, post);
      if (result) results.push(post);
      
      // 10 sec delay between posts to avoid rate limiting (except after last)
      if (i < posts.length - 1) {
        await new Promise(r => setTimeout(r, 10000));
      }
    } catch (error) {
      console.error(`Failed to send post ${post.id}:`, error.message);
    }
  }

  console.log(`Batch sent: ${results.length}/${posts.length} posts from ${[...new Set(results.map(p => p.source))].join(', ')}`);
  return results;
}

/**
 * Send single post to moderation (internal)
 */
async function sendSingleToModeration(bot, post) {
  // Try to scrape image if not present
  let imageUrl = post.image_url;
  if (!imageUrl && post.original_url) {
    console.log(`Scraping image for: ${post.original_title?.slice(0, 40)}...`);
    imageUrl = await scrapeImage(post.original_url);
    if (imageUrl) {
      db.db.prepare('UPDATE posts SET image_url = ? WHERE id = ?').run(imageUrl, post.id);
      console.log(`  Found image: ${imageUrl.slice(0, 60)}...`);
    }
  }
  
  // Rewrite content
  const rawRewritten = await rewritePost(post);
  if (!rawRewritten) {
    console.log(`Skipping post ${post.id} - rewrite failed`);
    return null;
  }
  const rewritten = sanitizeHtml(rawRewritten);
  db.markAsRewritten(post.id, rewritten);

  // Format message for moderation (with hidden link)
  const moderationText = buildModerationText(rewritten, post);

  // Inline buttons
  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ Опубликовать', `approve_${post.id}`),
      Markup.button.callback('❌ Отклонить', `reject_${post.id}`),
    ],
    [
      Markup.button.callback('✏️ Перегенерировать', `regen_${post.id}`),
    ],
  ]);

  // Send to moderation channel
  const targetChannel = config.moderationChannelId || config.channelId;
  
  if (imageUrl) {
    try {
      await bot.telegram.sendPhoto(targetChannel, imageUrl, {
        caption: moderationText,
        parse_mode: 'HTML',
        ...keyboard,
      });
    } catch (imgError) {
      console.warn('Failed to send image:', imgError.message);
      await bot.telegram.sendMessage(targetChannel, moderationText, {
        parse_mode: 'HTML',
        disable_web_page_preview: false,
        ...keyboard,
      });
    }
  } else {
    await bot.telegram.sendMessage(targetChannel, moderationText, {
      parse_mode: 'HTML',
      disable_web_page_preview: false,
      ...keyboard,
    });
  }

  // Mark as waiting for moderation
  db.db.prepare('UPDATE posts SET status = ? WHERE id = ?').run('moderation', post.id);
  console.log(`Sent to moderation: [${post.source}] ${post.original_title}`);
  return post;
}

/**
 * Send post to moderation channel with approve/reject buttons (legacy single)
 */
async function sendToModeration(bot) {
  // Check if paused
  if (db.isPaused()) {
    console.log('Publishing is paused');
    return null;
  }

  // Get next post
  const post = db.getNextPending();
  if (!post) {
    console.log('No pending posts');
    return null;
  }

  try {
    // Try to scrape image if not present
    let imageUrl = post.image_url;
    if (!imageUrl && post.original_url) {
      imageUrl = await scrapeImage(post.original_url);
      if (imageUrl) {
        db.db.prepare('UPDATE posts SET image_url = ? WHERE id = ?').run(imageUrl, post.id);
      }
    }
    
    // Rewrite content
    const rawRewritten = await rewritePost(post);
    if (!rawRewritten) {
      console.log(`Skipping post ${post.id} - rewrite failed`);
      return null;
    }
    const rewritten = sanitizeHtml(rawRewritten);
    db.markAsRewritten(post.id, rewritten);

    // Format message for moderation (with hidden link)
    const moderationText = buildModerationText(rewritten, post);

    // Inline buttons
    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('✅ Опубликовать', `approve_${post.id}`),
        Markup.button.callback('❌ Отклонить', `reject_${post.id}`),
      ],
      [
        Markup.button.callback('✏️ Перегенерировать', `regen_${post.id}`),
      ],
    ]);

    // Send to moderation channel
    const targetChannel = config.moderationChannelId || config.channelId;
    
    if (imageUrl) {
      try {
        await bot.telegram.sendPhoto(targetChannel, imageUrl, {
          caption: moderationText,
          parse_mode: 'HTML',
          ...keyboard,
        });
      } catch (imgError) {
        console.warn('Failed to send image:', imgError.message);
        await bot.telegram.sendMessage(targetChannel, moderationText, {
          parse_mode: 'HTML',
          disable_web_page_preview: false,
          ...keyboard,
        });
      }
    } else {
      await bot.telegram.sendMessage(targetChannel, moderationText, {
        parse_mode: 'HTML',
        disable_web_page_preview: false,
        ...keyboard,
      });
    }

    // Mark as waiting for moderation
    db.db.prepare('UPDATE posts SET status = ? WHERE id = ?').run('moderation', post.id);
    console.log(`Sent to moderation: ${post.original_title}`);
    return post;

  } catch (error) {
    console.error(`Failed to send to moderation ${post.id}:`, error.message);
    db.markAsFailed(post.id, error.message);
    return null;
  }
}

/**
 * Approve and publish post to main channel
 */
async function approvePost(bot, postId) {
  const post = db.db.prepare('SELECT * FROM posts WHERE id = ?').get(postId);
  if (!post) {
    return { success: false, error: 'Post not found' };
  }

  try {
    // Format final message with hidden link
    const linkText = `<a href="${post.original_url}">${getRandomLinkText()}</a>`;
    const message = `${sanitizeHtml(post.rewritten_content)}\n\n${linkText}`;
    const caption = truncateCaption(message);

    // Send to main channel
    if (post.image_url) {
      try {
        await bot.telegram.sendPhoto(config.channelId, post.image_url, {
          caption,
          parse_mode: 'HTML',
        });
      } catch (imgError) {
        console.warn('Failed to send image, sending text only:', imgError.message);
        await bot.telegram.sendMessage(config.channelId, message, {
          parse_mode: 'HTML',
          disable_web_page_preview: false,
        });
      }
    } else {
      await bot.telegram.sendMessage(config.channelId, message, {
        parse_mode: 'HTML',
        disable_web_page_preview: false,
      });
    }

    db.markAsPosted(post.id);
    console.log(`Approved and posted: ${post.original_title}`);
    return { success: true };

  } catch (error) {
    console.error(`Failed to approve post ${postId}:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Reject post
 */
function rejectPost(postId) {
  const result = db.db.prepare('UPDATE posts SET status = ? WHERE id = ?').run('rejected', postId);
  return { success: result.changes > 0 };
}

/**
 * Regenerate post content
 */
async function regeneratePost(bot, postId, messageId, chatId) {
  const post = db.db.prepare('SELECT * FROM posts WHERE id = ?').get(postId);
  if (!post) {
    return { success: false, error: 'Post not found' };
  }

  try {
    // Rewrite again
    const rawRewritten = await rewritePost(post);
    if (!rawRewritten) {
      return { success: false, error: 'Rewrite failed, try again later' };
    }
    const rewritten = sanitizeHtml(rawRewritten);
    db.markAsRewritten(post.id, rewritten);

    // Update message
    const moderationText = buildModerationText(rewritten, post, true);

    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('✅ Опубликовать', `approve_${post.id}`),
        Markup.button.callback('❌ Отклонить', `reject_${post.id}`),
      ],
      [
        Markup.button.callback('✏️ Перегенерировать', `regen_${post.id}`),
      ],
    ]);

    await bot.telegram.editMessageText(chatId, messageId, null, moderationText, {
      parse_mode: 'HTML',
      disable_web_page_preview: false,
      ...keyboard,
    });

    return { success: true };

  } catch (error) {
    console.error(`Failed to regenerate post ${postId}:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Legacy: Publish directly (bypass moderation)
 */
async function publishNext(bot) {
  if (db.isPaused()) {
    console.log('Publishing is paused');
    return null;
  }

  if (db.getTodayPostedCount() >= config.maxPostsPerDay) {
    console.log('Daily post limit reached');
    return null;
  }

  const post = db.getNextPending();
  if (!post) {
    console.log('No pending posts');
    return null;
  }

  try {
    // Try to scrape image if not present
    let imageUrl = post.image_url;
    if (!imageUrl && post.original_url) {
      imageUrl = await scrapeImage(post.original_url);
      if (imageUrl) {
        db.db.prepare('UPDATE posts SET image_url = ? WHERE id = ?').run(imageUrl, post.id);
      }
    }
    
    const rawRewritten = await rewritePost(post);
    if (!rawRewritten) {
      console.log(`Skipping post ${post.id} - rewrite failed`);
      return null;
    }
    const rewritten = sanitizeHtml(rawRewritten);
    db.markAsRewritten(post.id, rewritten);

    const linkText = `<a href="${post.original_url}">${getRandomLinkText()}</a>`;
    const message = `${rewritten}\n\n${linkText}`;
    const caption = truncateCaption(message);

    if (imageUrl) {
      try {
        await bot.telegram.sendPhoto(config.channelId, imageUrl, {
          caption,
          parse_mode: 'HTML',
        });
      } catch (imgError) {
        console.warn('Failed to send image, sending text only:', imgError.message);
        await bot.telegram.sendMessage(config.channelId, message, {
          parse_mode: 'HTML',
          disable_web_page_preview: false,
        });
      }
    } else {
      await bot.telegram.sendMessage(config.channelId, message, {
        parse_mode: 'HTML',
        disable_web_page_preview: false,
      });
    }

    db.markAsPosted(post.id);
    console.log(`Posted: ${post.original_title}`);
    return post;

  } catch (error) {
    console.error(`Failed to publish post ${post.id}:`, error.message);
    db.markAsFailed(post.id, error.message);
    return null;
  }
}

/**
 * Test channel connectivity
 */
async function testConnection(bot) {
  try {
    const chat = await bot.telegram.getChat(config.channelId);
    const modChat = config.moderationChannelId 
      ? await bot.telegram.getChat(config.moderationChannelId)
      : null;
    return { 
      success: true, 
      mainChannel: chat,
      moderationChannel: modChat,
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

module.exports = {
  sendToModeration,
  sendBatchToModeration,
  approvePost,
  rejectPost,
  regeneratePost,
  publishNext,
  testConnection,
};
