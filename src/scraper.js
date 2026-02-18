const axios = require('axios');

/**
 * Scrape Open Graph image from a URL
 * Falls back to first large image on page
 */
async function scrapeImage(url) {
  if (!url) return null;
  
  try {
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      maxRedirects: 5,
    });

    const html = response.data;
    
    // Try og:image first (most reliable)
    const ogImage = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
    
    if (ogImage?.[1]) {
      const imgUrl = resolveUrl(ogImage[1], url);
      if (await isValidImage(imgUrl)) {
        return imgUrl;
      }
    }

    // Try twitter:image
    const twitterImage = html.match(/<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']twitter:image["']/i);
    
    if (twitterImage?.[1]) {
      const imgUrl = resolveUrl(twitterImage[1], url);
      if (await isValidImage(imgUrl)) {
        return imgUrl;
      }
    }

    // Try first large image in content
    const images = html.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi);
    for (const match of images) {
      const imgUrl = resolveUrl(match[1], url);
      // Skip small icons, tracking pixels, etc
      if (imgUrl.includes('icon') || imgUrl.includes('logo') || imgUrl.includes('avatar')) continue;
      if (imgUrl.includes('1x1') || imgUrl.includes('pixel')) continue;
      
      if (await isValidImage(imgUrl)) {
        return imgUrl;
      }
    }

    return null;
  } catch (error) {
    console.warn(`Scrape failed for ${url}:`, error.message);
    return null;
  }
}

/**
 * Resolve relative URL to absolute
 */
function resolveUrl(imgUrl, baseUrl) {
  if (!imgUrl) return null;
  
  // Already absolute
  if (imgUrl.startsWith('http://') || imgUrl.startsWith('https://')) {
    return imgUrl;
  }
  
  // Protocol-relative
  if (imgUrl.startsWith('//')) {
    return 'https:' + imgUrl;
  }
  
  // Relative URL
  try {
    const base = new URL(baseUrl);
    if (imgUrl.startsWith('/')) {
      return `${base.protocol}//${base.host}${imgUrl}`;
    }
    return `${base.protocol}//${base.host}/${imgUrl}`;
  } catch {
    return imgUrl;
  }
}

/**
 * Check if image URL is valid and accessible
 */
async function isValidImage(url) {
  if (!url) return false;
  
  try {
    const response = await axios.head(url, {
      timeout: 5000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NewsBot/1.0)',
      },
    });
    
    const contentType = response.headers['content-type'] || '';
    return contentType.startsWith('image/');
  } catch {
    return false;
  }
}

module.exports = {
  scrapeImage,
};

// Test mode
if (require.main === module) {
  const testUrls = [
    'https://techcrunch.com/2024/01/15/openai-announces-gpt-store/',
    'https://www.theverge.com/2024/1/15/24039253/apple-vision-pro-preorder',
  ];
  
  const url = testUrls[Math.floor(Math.random() * testUrls.length)];
  console.log('Testing:', url);
  
  scrapeImage(url).then(img => {
    console.log('Image:', img || 'Not found');
  });
}
