/**
 * pixabayService.js
 * Zoekt stock video's via de Pixabay Video API als tweede gratis bron
 * naast Pexels. Pixabay's voorwaarden vereisen dat zoekresultaten 24u
 * gecachet worden — identieke zoektermen binnen 24u komen uit de cache.
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const PIXABAY_API = 'https://pixabay.com/api/videos/';
const { OUTPUTS_DIR } = require('../paths');

// ── 24u zoekresultaten-cache (verplicht volgens Pixabay API-voorwaarden) ────
const CACHE_FILE = path.join(OUTPUTS_DIR, 'pixabay_search_cache.json');
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function loadCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
  } catch { /* corrupt cachebestand → opnieuw beginnen */ }
  return {};
}

function saveCache(cache) {
  try { fs.writeFileSync(CACHE_FILE, JSON.stringify(cache)); } catch { /* niet fataal */ }
}

/**
 * Zoek een video op Pixabay. Resultaten worden 24u gecachet per zoekterm.
 * @returns {{ url, videoId, width, height, fromCache }}
 */
async function searchVideo(query) {
  const apiKey = process.env.PIXABAY_API_KEY;
  if (!apiKey) throw new Error('PIXABAY_API_KEY niet ingesteld in .env');

  const cacheKey = query.toLowerCase().trim();
  const cache = loadCache();
  let hits;
  let fromCache = false;

  const entry = cache[cacheKey];
  if (entry && (Date.now() - entry.ts) < CACHE_TTL_MS) {
    hits = entry.hits;
    fromCache = true;
    console.log(`[Pixabay] Cache-hit voor "${query}" (${Math.round((Date.now() - entry.ts) / 60000)} min oud)`);
  } else {
    const response = await axios.get(PIXABAY_API, {
      params: { key: apiKey, q: query.slice(0, 100), per_page: 5, safesearch: 'true' },
      timeout: 10000,
    });
    hits = response.data?.hits || [];
    cache[cacheKey] = { ts: Date.now(), hits };
    saveCache(cache);
  }

  if (!hits || hits.length === 0) {
    throw new Error(`Geen Pixabay resultaten voor: "${query}"`);
  }

  // Voorkeur voor portrait/vertical; anders eerste hit
  const pickVariant = (h) => h.videos?.large || h.videos?.medium || h.videos?.small || h.videos?.tiny;
  const portrait = hits.find(h => {
    const v = pickVariant(h);
    return v && v.width < v.height;
  });
  const hit = portrait || hits[0];
  const variant = pickVariant(hit);
  if (!variant?.url) throw new Error('Geen afspeelbare Pixabay video link gevonden');

  return { url: variant.url, videoId: hit.id, width: variant.width, height: variant.height, fromCache };
}

module.exports = { searchVideo, CACHE_FILE };
