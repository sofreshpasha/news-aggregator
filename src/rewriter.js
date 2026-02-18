const axios = require('axios');
const config = require('./config');

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * Rewrite news article in the configured tone
 */
async function rewritePost(post) {
  if (!config.openrouterApiKey) {
    console.warn('No OpenRouter API key, returning original content');
    return formatOriginal(post);
  }

  // Parse tone config (JSON or plain text)
  let toneConfig;
  try {
    toneConfig = JSON.parse(config.tonePrompt);
  } catch {
    toneConfig = { voice: config.tonePrompt };
  }

  const systemPrompt = `Ты ведёшь популярный tech-канал в Telegram. Перепиши новость в стиле лучших tech-каналов.

## Твой стиль
- Персона: ${toneConfig.persona || 'tech-эксперт'}
- Голос: ${toneConfig.voice || 'разговорный'}
- Настроение: ${toneConfig.mood || 'нейтральное'}
${toneConfig.avoid ? `- НЕ используй: ${toneConfig.avoid.join(', ')}` : ''}

## Структура поста (ВАЖНО!)

1. **Заголовок-крючок** — 1 строка, жирный (<b>текст</b>), можно с эмодзи в начале
   Примеры: "🍎 Apple показала M5 — и это монстр", "Google берёт деньги в долг... на 100 лет"

2. **Основной текст** — 3-6 предложений, раскрывающих суть
   - Пиши абзацами, не сплошной стеной
   - Можно использовать буллеты (—) для перечислений
   - Выделяй ключевые цифры и факты
   - Добавь контекст: почему это важно

3. **Твоя мысль/вывод** — 1-2 предложения в конце
   Примеры: "Будем проверять 🚀", "Посмотрим, что из этого выйдет", "В общем, годнота 🔥"

4. **Хештеги** — 2-4 штуки в самом конце

## Примеры хорошего стиля:
${toneConfig.examples ? toneConfig.examples.map(e => `• "${e}"`).join('\n') : `• "Cursor выкатили новую модель для кодинга — Composer 1.5 🎉\\n\\nРебята не стали менять базу, а просто выкрутили ручку RL на максимум.\\n\\nЧто внутри:\\n— Модель сама решает, сколько «думать»\\n— Рекурсивная суммаризация: когда контекст забивается, ИИ сжимает диалог\\n\\nБудем проверять 🚀"`}

## Правила
- Длина: 400-700 символов (с хештегами). ВАЖНО: не более 700!
- Язык: ТОЛЬКО РУССКИЙ. Переводи всё на русский, даже если оригинал на английском!
- Названия продуктов/компаний оставляй на английском (Apple, Tesla, GPT-5)
- Ссылку НЕ добавляй
- НЕ начинай с "Привет" или обращений
- НЕ пиши "Друзья," или подобное

Ответь ТОЛЬКО готовым постом. Без комментариев.`;

  const userPrompt = `Новость от ${post.source}:

«${post.original_title}»

${post.original_content?.slice(0, 400) || ''}`;

  try {
    const response = await axios.post(
      OPENROUTER_URL,
      {
        model: config.llmModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 500,
        temperature: 0.9,
        top_p: 0.95,
      },
      {
        headers: {
          'Authorization': `Bearer ${config.openrouterApiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/news-aggregator',
        },
        timeout: 30000,
      }
    );

    const rewritten = response.data.choices?.[0]?.message?.content?.trim();
    if (!rewritten) {
      throw new Error('Empty response from LLM');
    }

    return rewritten;
  } catch (error) {
    console.error('Rewrite error:', error.response?.data || error.message);
    // Return null - post will be skipped (no fallback to English)
    return null;
  }
}

/**
 * Format original content as fallback
 */
function formatOriginal(post) {
  const title = post.original_title || 'Новость';
  const snippet = post.original_content?.slice(0, 200) || '';
  return `📰 ${title}\n\n${snippet}...`;
}

module.exports = {
  rewritePost,
};

// Test mode
if (require.main === module) {
  const testPosts = [
    {
      original_title: 'Apple Vision Pro sales plummet 75% as consumers reject $3,500 headset',
      original_content: 'Apple\'s Vision Pro headset has seen a dramatic 75% drop in sales since launch, with analysts pointing to the high $3,499 price tag and limited app ecosystem as primary factors. The company reportedly slashed production orders and is now focusing on a cheaper version expected in 2026. Meanwhile, Meta\'s Quest 3 continues to dominate the VR market with its $499 price point.',
      source: 'The Verge',
    },
    {
      original_title: 'GitHub Copilot now writes 61% of code at major tech companies',
      original_content: 'A new study reveals that AI coding assistants, led by GitHub Copilot, now generate over 61% of code at Fortune 500 tech companies. Developers report mixed feelings: while productivity has increased, concerns about code quality and job security are growing. Some engineers describe feeling like "Copilot babysitters" reviewing AI-generated code all day.',
      source: 'Ars Technica',
    },
    {
      original_title: 'EU passes landmark AI Act requiring transparency for all AI systems',
      original_content: 'The European Union has officially passed the AI Act, the world\'s first comprehensive AI regulation. Companies must now disclose when content is AI-generated, and high-risk AI systems face strict requirements. Big Tech lobbying failed to water down key provisions. Fines can reach up to 7% of global revenue.',
      source: 'Wired',
    },
  ];
  
  // Pick random test post
  const testPost = testPosts[Math.floor(Math.random() * testPosts.length)];
  console.log(`\n📰 Testing with: "${testPost.original_title}"\n`);
  rewritePost(testPost).then(result => {
    console.log('--- Result ---');
    console.log(result);
    console.log(`\n📊 Length: ${result.length} chars`);
  }).catch(console.error);
}
