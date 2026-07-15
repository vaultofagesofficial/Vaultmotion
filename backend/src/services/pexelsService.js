/**
 * pexelsService.js
 * Zoekt en downloadt relevante stock video's via de Pexels API
 * per scène op basis van template type en inhoud.
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const PEXELS_API = 'https://api.pexels.com/videos/search';
const { OUTPUTS_DIR, SERVER_BASE_URL } = require('../paths');
const BACKGROUNDS_DIR = path.join(OUTPUTS_DIR, 'backgrounds');

// Zorg dat de backgrounds map bestaat
if (!fs.existsSync(BACKGROUNDS_DIR)) {
  fs.mkdirSync(BACKGROUNDS_DIR, { recursive: true });
}

/**
 * Bouw een zoekterm op — primair de visual_focus van de scène (concrete,
 * letterlijke onderwerp-beschrijving, zie de visual_focus-letterlijkheid-fix),
 * met een template-gebaseerde fallback als visual_focus ontbreekt.
 */
function buildSearchQuery(template, content, visualFocus, stockQuery) {
  // Voorkeur: de door Claude gegenereerde stock_query (2-4 concrete zoekwoorden
  // afgestemd op wat er écht in stockbibliotheken bestaat). De visual_focus
  // beschrijft het vaste AI-personage en levert bij stock-zoekopdrachten
  // niet-matchende, generieke resultaten op ("engineer's copper-burned hands").
  if (stockQuery && stockQuery.trim()) return stockQuery.trim().slice(0, 80);

  if (visualFocus && visualFocus.trim()) {
    // Fallback: eerste 4-5 betekenisvolle woorden uit de visual_focus.
    const words = visualFocus.trim().split(/\s+/).slice(0, 5).join(' ');
    return words;
  }

  const base = {
    cinematic_title:  'cinematic dark dramatic atmosphere',
    ken_burns:        'documentary historical landscape slow motion',
    animated_map:     'aerial drone world earth geography',
    timeline:         'history vintage time abstract',
    stats_counter:    'data analytics technology abstract dark',
    outro_cta:        'subscribe social media studio dark',
  }[template] || 'cinematic dark abstract';

  // Voeg context uit scène inhoud toe
  const extra = content?.title || content?.text || content?.stat_label || '';
  const words = extra.split(/\s+/).slice(0, 3).join(' ');
  return words ? `${words} ${base}` : base;
}

/**
 * Zoek een video op Pexels en geef de beste SD/HD link terug.
 */
async function searchVideo(query) {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) {
    throw new Error('PEXELS_API_KEY niet ingesteld in .env');
  }

  const response = await axios.get(PEXELS_API, {
    params: {
      query,
      per_page: 5,
      size: 'medium',
      orientation: 'portrait', // 9:16 voorkeur
    },
    headers: {
      Authorization: apiKey,
    },
    timeout: 10000,
  });

  const videos = response.data?.videos;
  if (!videos || videos.length === 0) {
    throw new Error(`Geen Pexels resultaten voor: "${query}"`);
  }

  // Kies de eerste video, voorkeur voor portrait/vertical
  const video = videos.find(v => v.width < v.height) || videos[0];

  // Kies de beste kwaliteitslink: hd > sd > eerste beschikbare
  const files = video.video_files || [];
  const hd = files.find(f => f.quality === 'hd' && f.width <= 1080);
  const sd = files.find(f => f.quality === 'sd');
  const chosen = hd || sd || files[0];

  if (!chosen?.link) throw new Error('Geen afspeelbare video link gevonden');

  return { url: chosen.link, videoId: video.id, width: chosen.width, height: chosen.height };
}

/**
 * Download een video naar outputs/backgrounds/<filename>.mp4
 */
async function downloadVideo(url, filename) {
  const dest = path.join(BACKGROUNDS_DIR, filename);

  // Skip download als al bestaat
  if (fs.existsSync(dest)) {
    console.log(`[Pexels] Cached: ${filename}`);
    return dest;
  }

  const response = await axios.get(url, {
    responseType: 'stream',
    timeout: 60000,
    headers: { 'User-Agent': 'VaultMotion/1.0' },
  });

  await new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(dest);
    response.data.pipe(writer);
    writer.on('finish', resolve);
    writer.on('error', reject);
  });

  console.log(`[Pexels] Gedownload: ${filename} (${Math.round(fs.statSync(dest).size / 1024)}KB)`);
  return dest;
}

/**
 * Zoek en download achtergrondvideo's voor alle scènes.
 * @param {Array} scenes
 * @param {string} jobId
 * @returns {Array} scenes met background_video_path toegevoegd
 */
// Data-visualisatie-templates zijn code-only en hebben geen video-achtergrond nodig
// (zelfde set als kieService.js's SKIP_KIE_TEMPLATES).
const SKIP_TEMPLATES = new Set(['fact_animation', 'stats_counter', 'data_comparison']);


// ── Stock-video optimaliseren voor Remotion ──────────────────────────────────
// Pexels/Pixabay-clips zijn vaak 30-60s en tientallen MB's; het decoderen
// daarvan tijdens de Remotion-render veroorzaakte delayRender-timeouts op
// Railway ("waiting for the page to render... timeout 123000ms"). We trimmen
// elke clip naar de scèneduur (+1s marge) en herschalen naar 1080x1920 zodat
// de render alleen kleine, decodeer-lichte assets ziet.
function findFfmpeg() {
  const glob = require('fs');
  const base = path.resolve(__dirname, '../../node_modules/@remotion');
  try {
    for (const dir of glob.readdirSync(base)) {
      if (!dir.startsWith('compositor-')) continue;
      for (const bin of ['ffmpeg.exe', 'ffmpeg']) {
        const p = path.join(base, dir, bin);
        if (glob.existsSync(p)) return p;
      }
    }
  } catch {}
  return null;
}

async function optimizeStockVideo(localPath, maxSeconds) {
  const ffmpeg = findFfmpeg();
  if (!ffmpeg) { console.warn('[Stock] ffmpeg niet gevonden — clip blijft ongemoeid'); return; }
  const { execFile } = require('child_process');
  const tmp = localPath + '.opt.mp4';
  const dur = Math.max(3, Math.ceil(maxSeconds) + 1);
  await new Promise((resolve, reject) => {
    execFile(ffmpeg, [
      '-y', '-i', localPath,
      '-t', String(dur),
      '-vf', 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-an',
      tmp,
    ], { timeout: 120000 }, (err) => err ? reject(err) : resolve());
  });
  const before = fs.statSync(localPath).size;
  fs.renameSync(tmp, localPath);
  const after = fs.statSync(localPath).size;
  console.log(`[Stock] Geoptimaliseerd: ${path.basename(localPath)} ${Math.round(before/1024)}KB -> ${Math.round(after/1024)}KB (max ${dur}s)`);
}

async function fetchBackgroundsForScenes(scenes, jobId) {
  const results = [...scenes];
  const pixabay = require('./pixabayService');
  const pixabayAvailable = !!process.env.PIXABAY_API_KEY;

  // Zoek via één bron; gooit door bij geen resultaat
  async function searchVia(source, query) {
    if (source === 'pixabay') {
      const r = await pixabay.searchVideo(query);
      return { ...r, source: 'pixabay' };
    }
    const r = await searchVideo(query);
    return { ...r, source: 'pexels' };
  }

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    if (SKIP_TEMPLATES.has(scene.template)) {
      results[i] = { ...results[i], background_video_url: null };
      continue;
    }
    const query = buildSearchQuery(scene.template, scene.content || {}, scene.visual_focus, scene.stock_query);

    // Rotatie: kies per scène willekeurig 50/50 tussen Pexels en Pixabay;
    // bij geen resultaat probeert de andere bron het voordat we opgeven.
    const primary   = pixabayAvailable && Math.random() < 0.5 ? 'pixabay' : 'pexels';
    const secondary = primary === 'pixabay' ? 'pexels' : (pixabayAvailable ? 'pixabay' : null);

    let found = null;
    try {
      console.log(`[Stock] Scène ${i + 1}/${scenes.length}: zoeken via ${primary} naar "${query}"`);
      found = await searchVia(primary, query);
    } catch (err) {
      console.warn(`[Stock] ${primary} mislukt voor scène ${i + 1}: ${err.message}`);
      if (secondary) {
        try {
          console.log(`[Stock] Scène ${i + 1}: fallback naar ${secondary}`);
          found = await searchVia(secondary, query);
        } catch (err2) {
          console.warn(`[Stock] ${secondary} mislukt ook: ${err2.message}`);
        }
      }
    }

    if (!found) {
      results[i] = { ...results[i], background_video_path: null, background_video_url: null };
      continue;
    }

    try {
      const filename = `${jobId}_scene${i}_${found.source}${found.videoId}.mp4`;
      const localPath = await downloadVideo(found.url, filename);
      try {
        await optimizeStockVideo(localPath, (scene.duration_frames || 120) / 30);
      } catch (e) { console.warn(`[Stock] Optimalisatie scène ${i + 1} mislukt (${e.message}) — originele clip gebruikt`); }

      // Geef zowel het lokale pad als een HTTP URL terug
      // Gebruik absolute URL zodat Remotion de video kan laden tijdens rendering
      results[i] = {
        ...results[i],
        background_video_path: localPath,
        background_video_url: `${SERVER_BASE_URL}/outputs/backgrounds/${filename}`,
        stock_source: found.source,
        stock_query: query,
        stock_video_id: found.videoId,
      };
    } catch (err) {
      console.warn(`[Stock] Download scène ${i + 1} mislukt: ${err.message} — geen achtergrond`);
      results[i] = { ...results[i], background_video_path: null, background_video_url: null };
    }
  }

  return results;
}

module.exports = { fetchBackgroundsForScenes, buildSearchQuery };
