/**
 * musicService.js
 * Selecteert willekeurig een achtergrondmuziek-bestand per stijl.
 *
 * Mappenstructuur: backend/assets/music/{stijl}/*.mp3
 *   epic/         — donker orchestraal
 *   documentary/  — rustig ambient
 *   story/        — warm/gezellig
 *
 * Voeg gewoon extra .mp3 bestanden toe aan de map — geen code-wijziging nodig.
 */

const fs   = require('fs');
const path = require('path');

const MUSIC_BASE = path.resolve(__dirname, '../../assets/music');

const STYLE_MAP = {
  epic:         'epic',
  documentary:  'documentary',
  documentaire: 'documentary',
  mystery:      'epic',
  story:        'story',
  educatief:    'documentary',
};

const THEME_MAP = {
  warm:    'story',
  cool:    'documentary',
  dark:    'epic',
  neutral: null, // valt terug op mode-gebaseerde keuze
};

function getMusicUrl(style, colorTheme = null) {
  let folder = STYLE_MAP[style] || 'documentary';

  // colorTheme overschrijft mode-keuze indien niet 'neutral'
  if (colorTheme && THEME_MAP[colorTheme] !== undefined && THEME_MAP[colorTheme] !== null) {
    folder = THEME_MAP[colorTheme];
    console.log(`[MusicService] colorTheme "${colorTheme}" → map "${folder}"`);
  } else {
    console.log(`[MusicService] mode "${style}" → map "${folder}"`);
  }

  const dir = path.join(MUSIC_BASE, folder);

  if (!fs.existsSync(dir)) {
    console.warn(`[MusicService] Map niet gevonden: ${dir}`);
    return null;
  }

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.mp3'));
  if (files.length === 0) {
    console.warn(`[MusicService] Geen mp3's in ${dir}`);
    return null;
  }

  const chosen = files[Math.floor(Math.random() * files.length)];
  return `/assets/music/${folder}/${chosen}`;
}

module.exports = { getMusicUrl };
