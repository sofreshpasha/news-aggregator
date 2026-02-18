const Parser = require('rss-parser');
const sources = require('./sources');
const db = require('./db');

const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'NewsAggregator/1.0',
  },
});

/**
 * Fetch all enabled RSS sources and add new posts to DB
 */
async function fetchAll() {
  const recentUrls = new Set(db.getRecentUrls());
  const results = { added: 0, skipped: 0, errors: [] };

  for (const source of sources.filter(s => s.enabled)) {
    try {
      const feed = await parser.parseURL(source.url);
      const items = feed.items.slice(0, source.maxItems);

      for (const item of items) {
        const url = item.link || item.guid;
        
        // Skip if already exists
        if (recentUrls.has(url)) {
          results.skipped++;
          continue;
        }

        // Extract image from various RSS formats
        const image = extractImage(item);

        const result = db.addPost({
          source: source.name,
          url,
          title: item.title || 'Untitled',
          content: item.contentSnippet || item.content || item.description || '',
          image,
          category: source.category,
          publishedAt: item.isoDate || item.pubDate || new Date().toISOString(),
        });

        if (result.changes > 0) {
          results.added++;
          recentUrls.add(url);
        } else {
          results.skipped++;
        }
      }
    } catch (error) {
      results.errors.push({ source: source.name, error: error.message });
      console.error(`Error fetching ${source.name}:`, error.message);
    }
  }

  console.log(`Fetch complete: ${results.added} added, ${results.skipped} skipped, ${results.errors.length} errors`);
  return results;
}

/**
 * Extract image URL from RSS item (handles various formats)
 */
function extractImage(item) {
  // Direct image field
  if (item.image?.url) return item.image.url;
  
  // Media content (common in many feeds)
  if (item['media:content']?.$.url) return item['media:content'].$.url;
  if (item['media:thumbnail']?.$.url) return item['media:thumbnail'].$.url;
  
  // Enclosure (podcasts, some news)
  if (item.enclosure?.url && item.enclosure.type?.startsWith('image/')) {
    return item.enclosure.url;
  }

  // Try to extract from content HTML
  const content = item.content || item['content:encoded'] || '';
  const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (imgMatch) return imgMatch[1];

  return null;
}

/**
 * Get list of enabled sources
 */
function getEnabledSources() {
  return sources.filter(s => s.enabled);
}

/**
 * Toggle source by name
 */
function toggleSource(name, enabled) {
  const source = sources.find(s => s.name.toLowerCase() === name.toLowerCase());
  if (source) {
    source.enabled = enabled;
    return true;
  }
  return false;
}

module.exports = {
  fetchAll,
  getEnabledSources,
  toggleSource,
};

// Test mode
if (require.main === module) {
  fetchAll().then(console.log).catch(console.error);
}
