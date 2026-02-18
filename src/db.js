const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const config = require('./config');

// Ensure data directory exists
const dataDir = path.dirname(config.dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(config.dbPath);

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL,
    original_url TEXT UNIQUE NOT NULL,
    original_title TEXT NOT NULL,
    original_content TEXT,
    rewritten_content TEXT,
    image_url TEXT,
    category TEXT,
    score INTEGER DEFAULT 0,
    published_at TEXT,
    fetched_at TEXT DEFAULT CURRENT_TIMESTAMP,
    posted_at TEXT,
    status TEXT DEFAULT 'pending'
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
  CREATE INDEX IF NOT EXISTS idx_posts_source ON posts(source);
`);

module.exports = {
  db,

  // Posts
  addPost(post) {
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO posts 
        (source, original_url, original_title, original_content, image_url, category, published_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    return stmt.run(
      post.source,
      post.url,
      post.title,
      post.content || '',
      post.image || null,
      post.category || 'tech',
      post.publishedAt || new Date().toISOString()
    );
  },

  getNextPending() {
    return db.prepare(`
      SELECT * FROM posts 
      WHERE status = 'pending' 
      ORDER BY score DESC, fetched_at ASC 
      LIMIT 1
    `).get();
  },

  // Get random pending posts from different sources (for batch moderation)
  getRandomPendingBatch(count = 5, maxAgeHours = 48) {
    // Get titles already in moderation/posted to avoid similar content
    const existingTitles = db.prepare(`
      SELECT LOWER(original_title) as title FROM posts 
      WHERE status IN ('moderation', 'posted', 'ready')
    `).all().map(r => r.title);
    
    // Filter: only fresh posts (published within maxAgeHours)
    const freshCutoff = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000).toISOString();
    
    // Get one random post per source, then fill remaining slots randomly
    // Only from sources that have fresh pending posts
    const sources = db.prepare(`
      SELECT DISTINCT source FROM posts 
      WHERE status = 'pending' 
      AND published_at > ?
    `).all(freshCutoff).map(r => r.source);
    
    const posts = [];
    const usedIds = new Set();
    const usedTitleWords = new Set();
    
    // Extract key words from existing titles for similarity check
    existingTitles.forEach(title => {
      if (title) {
        title.split(/\s+/).filter(w => w.length > 4).forEach(w => usedTitleWords.add(w));
      }
    });
    
    // Helper: check if title is too similar to existing
    const isSimilar = (title) => {
      if (!title) return false;
      const words = title.toLowerCase().split(/\s+/).filter(w => w.length > 4);
      const matchCount = words.filter(w => usedTitleWords.has(w)).length;
      return matchCount >= 3; // 3+ matching key words = too similar
    };
    
    // First: one from each source (randomized)
    const shuffledSources = sources.sort(() => Math.random() - 0.5);
    for (const source of shuffledSources) {
      if (posts.length >= count) break;
      
      // Get a few fresh candidates and pick first non-similar
      const candidates = db.prepare(`
        SELECT * FROM posts 
        WHERE status = 'pending' AND source = ? AND published_at > ?
        ORDER BY RANDOM()
        LIMIT 5
      `).all(source, freshCutoff);
      
      for (const post of candidates) {
        if (!isSimilar(post.original_title)) {
          posts.push(post);
          usedIds.add(post.id);
          // Add this title's words to avoid duplicates in same batch
          post.original_title?.toLowerCase().split(/\s+/)
            .filter(w => w.length > 4)
            .forEach(w => usedTitleWords.add(w));
          break;
        }
      }
    }
    
    // Fill remaining slots with random fresh posts from any source
    if (posts.length < count) {
      const candidates = db.prepare(`
        SELECT * FROM posts 
        WHERE status = 'pending' 
        AND id NOT IN (${[...usedIds].join(',') || 0})
        AND published_at > ?
        ORDER BY RANDOM()
        LIMIT ?
      `).all(freshCutoff, (count - posts.length) * 3); // Get more to filter
      
      for (const post of candidates) {
        if (posts.length >= count) break;
        if (!isSimilar(post.original_title)) {
          posts.push(post);
          post.original_title?.toLowerCase().split(/\s+/)
            .filter(w => w.length > 4)
            .forEach(w => usedTitleWords.add(w));
        }
      }
    }
    
    return posts;
  },

  // Get fresh pending posts (< 24 hours old)
  getFreshPending(hoursLimit = 24) {
    return db.prepare(`
      SELECT * FROM posts 
      WHERE status = 'pending' 
      AND datetime(published_at) > datetime('now', '-' || ? || ' hours')
      ORDER BY RANDOM()
    `).all(hoursLimit);
  },

  getPendingCount() {
    return db.prepare(`SELECT COUNT(*) as count FROM posts WHERE status = 'pending'`).get().count;
  },

  markAsRewritten(id, rewrittenContent) {
    db.prepare(`UPDATE posts SET rewritten_content = ?, status = 'ready' WHERE id = ?`)
      .run(rewrittenContent, id);
  },

  markAsPosted(id) {
    db.prepare(`UPDATE posts SET posted_at = CURRENT_TIMESTAMP, status = 'posted' WHERE id = ?`)
      .run(id);
  },

  markAsFailed(id, reason) {
    db.prepare(`UPDATE posts SET status = 'failed' WHERE id = ?`).run(id);
  },

  getRecentUrls(limit = 1000) {
    return db.prepare(`SELECT original_url FROM posts ORDER BY fetched_at DESC LIMIT ?`)
      .all(limit)
      .map(r => r.original_url);
  },

  getTodayPostedCount() {
    return db.prepare(`
      SELECT COUNT(*) as count FROM posts 
      WHERE status = 'posted' 
      AND date(posted_at) = date('now')
    `).get().count;
  },

  getStats() {
    return {
      pending: db.prepare(`SELECT COUNT(*) as c FROM posts WHERE status = 'pending'`).get().c,
      ready: db.prepare(`SELECT COUNT(*) as c FROM posts WHERE status = 'ready'`).get().c,
      posted: db.prepare(`SELECT COUNT(*) as c FROM posts WHERE status = 'posted'`).get().c,
      todayPosted: this.getTodayPostedCount(),
    };
  },

  // Settings
  getSetting(key, defaultValue = null) {
    const row = db.prepare(`SELECT value FROM settings WHERE key = ?`).get(key);
    return row ? row.value : defaultValue;
  },

  setSetting(key, value) {
    db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`)
      .run(key, String(value));
  },

  isPaused() {
    return this.getSetting('paused', 'false') === 'true';
  },

  setPaused(paused) {
    this.setSetting('paused', paused ? 'true' : 'false');
  },
};
