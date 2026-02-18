/**
 * RSS News Sources
 * Each source has: name, url, category, maxItems, enabled
 */

module.exports = [
  // ========== TECH (основные) ==========
  {
    name: 'Hacker News',
    url: 'https://news.ycombinator.com/rss',
    category: 'tech',
    maxItems: 3,
    enabled: true,
  },
  {
    name: 'TechCrunch',
    url: 'https://feeds.feedburner.com/TechCrunch/',
    category: 'tech',
    maxItems: 3,
    enabled: true,
  },
  {
    name: 'The Verge',
    url: 'https://www.theverge.com/rss/index.xml',
    category: 'tech',
    maxItems: 3,
    enabled: true,
  },
  {
    name: 'Wired',
    url: 'https://www.wired.com/feed/rss',
    category: 'tech',
    maxItems: 2,
    enabled: true,
  },
  {
    name: 'Ars Technica',
    url: 'https://feeds.arstechnica.com/arstechnica/index',
    category: 'tech',
    maxItems: 2,
    enabled: true,
  },

  // ========== AI / ML (news) ==========
  {
    name: 'MIT Tech Review',
    url: 'https://www.technologyreview.com/feed/',
    category: 'ai',
    maxItems: 3,
    enabled: true,
  },
  {
    name: 'VentureBeat AI',
    url: 'https://venturebeat.com/category/ai/feed/',
    category: 'ai',
    maxItems: 3,
    enabled: true,
  },
  {
    name: 'The Decoder',
    url: 'https://the-decoder.com/feed/',
    category: 'ai',
    maxItems: 3,
    enabled: true,
  },

  // ========== LLM COMPANY BLOGS ==========
  {
    name: 'OpenAI Blog',
    url: 'https://openai.com/news/rss.xml',
    category: 'llm-blog',
    maxItems: 3,
    enabled: true,
  },
  {
    name: 'Anthropic News',
    url: 'https://raw.githubusercontent.com/Olshansk/rss-feeds/main/feeds/feed_anthropic_news.xml',
    category: 'llm-blog',
    maxItems: 3,
    enabled: true,
  },
  {
    name: 'Google AI Blog',
    url: 'https://blog.google/technology/ai/rss/',
    category: 'llm-blog',
    maxItems: 3,
    enabled: true,
  },
  {
    name: 'DeepMind Blog',
    url: 'https://deepmind.google/blog/rss.xml',
    category: 'llm-blog',
    maxItems: 3,
    enabled: true,
  },
  {
    name: 'Hugging Face',
    url: 'https://hf.co/blog/feed.xml',
    category: 'llm-blog',
    maxItems: 3,
    enabled: true,
  },
  {
    name: 'Nvidia AI',
    url: 'https://blogs.nvidia.com/feed/',
    category: 'llm-blog',
    maxItems: 2,
    enabled: true,
  },
  {
    name: 'Microsoft AI',
    url: 'https://blogs.microsoft.com/ai/feed/',
    category: 'llm-blog',
    maxItems: 2,
    enabled: true,
  },
  {
    name: 'AWS ML Blog',
    url: 'https://aws.amazon.com/blogs/machine-learning/feed/',
    category: 'llm-blog',
    maxItems: 2,
    enabled: true,
  },
  {
    name: 'Together AI',
    url: 'https://www.together.ai/blog/rss.xml',
    category: 'llm-blog',
    maxItems: 2,
    enabled: true,
  },

  // ========== STARTUPS / VENTURE ==========
  {
    name: 'TechCrunch Startups',
    url: 'https://techcrunch.com/category/startups/feed/',
    category: 'startups',
    maxItems: 2,
    enabled: true,
  },
  {
    name: 'Crunchbase News',
    url: 'https://news.crunchbase.com/feed/',
    category: 'startups',
    maxItems: 2,
    enabled: true,
  },
  {
    name: 'Sifted',
    url: 'https://sifted.eu/feed',
    category: 'startups',
    maxItems: 2,
    enabled: true,
  },

  // ========== SCIENCE / DISCOVERIES ==========
  {
    name: 'Phys.org Tech',
    url: 'https://phys.org/rss-feed/technology-news/',
    category: 'science',
    maxItems: 2,
    enabled: true,
  },
  {
    name: 'Nature News',
    url: 'https://www.nature.com/nature.rss',
    category: 'science',
    maxItems: 2,
    enabled: false, // 406 error - blocks bots
  },
  {
    name: 'New Scientist',
    url: 'https://www.newscientist.com/feed/home',
    category: 'science',
    maxItems: 2,
    enabled: true,
  },

  // ========== FINANCE / FINTECH ==========
  {
    name: 'Bloomberg Tech',
    url: 'https://feeds.bloomberg.com/technology/news.rss',
    category: 'finance',
    maxItems: 2,
    enabled: true,
  },
  {
    name: 'Finextra',
    url: 'https://www.finextra.com/rss/headlines.aspx',
    category: 'finance',
    maxItems: 2,
    enabled: true,
  },
  {
    name: 'CoinDesk',
    url: 'https://www.coindesk.com/arc/outboundfeeds/rss/',
    category: 'crypto',
    maxItems: 2,
    enabled: true,
  },

  // ========== RUSSIAN ==========
  {
    name: 'Хабр',
    url: 'https://habr.com/ru/rss/best/daily/',
    category: 'tech-ru',
    maxItems: 3,
    enabled: true,
  },
  {
    name: 'VC.ru',
    url: 'https://vc.ru/rss/all',
    category: 'startups-ru',
    maxItems: 3,
    enabled: true,
  },
  {
    name: '3DNews',
    url: 'https://3dnews.ru/news/rss/',
    category: 'tech-ru',
    maxItems: 2,
    enabled: true,
  },
];
