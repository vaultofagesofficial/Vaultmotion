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
 * Bouw een zoekterm op per template + scène inhoud.
 */
function buildSearchQuery(template, content) {
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
async function fetchBackgroundsForScenes(scenes, jobId) {
  const results = [...scenes];

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    try {
      const query = buildSearchQuery(scene.template, scene.content || {});
      console.log(`[Pexels] Scène ${i + 1}/${scenes.length}: zoeken naar "${query}"`);

      const { url, videoId } = await searchVideo(query);
      const filename = `${jobId}_scene${i}_pexels${videoId}.mp4`;
      const localPath = await downloadVideo(url, filename);

      // Geef zowel het lokale pad als een HTTP URL terug
      // Gebruik absolute URL zodat Remotion de video kan laden tijdens rendering
      results[i] = {
        ...results[i],
        background_video_path: localPath,
        background_video_url: `${SERVER_BASE_URL}/outputs/backgrounds/${filename}`,
        pexels_query: query,
        pexels_video_id: videoId,
      };

    } catch (err) {
      console.warn(`[Pexels] Scène ${i + 1} mislukt: ${err.message} — geen achtergrond`);
      results[i] = {
        ...results[i],
        background_video_path: null,
        background_video_url: null,
      };
    }
  }

  return results;
}

module.exports = { fetchBackgroundsForScenes, buildSearchQuery };
