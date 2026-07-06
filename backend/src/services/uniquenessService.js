/**
 * uniquenessService.js — Uniciteit Engine
 * Anti-herhaling (A1), perspectief-rotatie (A2) en visuele DNA (A3).
 * Persistente opslag naast jobs.json (Railway: /data volume).
 */

const fs   = require('fs');
const path = require('path');
const { JOBS_FILE } = require('../paths');

const STORE_FILE = path.join(path.dirname(JOBS_FILE), 'used_elements.json');

const EMPTY = { openings: [], ctas: [], visual_focus: [], style_anchors: [], perspectives: [], script_keywords: [], ab_choices: [] };

function loadStore() {
  try {
    if (fs.existsSync(STORE_FILE)) return { ...EMPTY, ...JSON.parse(fs.readFileSync(STORE_FILE, 'utf8')) };
  } catch (e) { console.warn('[Uniqueness] store laden mislukt:', e.message); }
  return { ...EMPTY };
}

function saveStore(store) {
  try { fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2)); }
  catch (e) { console.warn('[Uniqueness] store opslaan mislukt:', e.message); }
}

// ── A2: Perspectief-rotatie ─────────────────────────────────────────────────

const PERSPECTIVES = [
  { key: 'insider',      hint: '"The untold story of..." — insider perspective: tell it as if revealing what only people on the inside knew' },
  { key: 'revealing',    hint: '"What X never wants you to know..." — revealing/exposé angle: frame facts as hidden truths coming to light' },
  { key: 'narrative',    hint: '"The day everything changed..." — narrative angle: build the script around one pivotal moment or day' },
  { key: 'authority',    hint: '"Scientists are baffled by..." — authority angle: lead with expert astonishment and evidence' },
  { key: 'challenging',  hint: '"You are probably doing/thinking X wrong..." — challenging angle: confront a common assumption of the viewer' },
  { key: 'temporal',     hint: '"In [year], something happened that..." — temporal angle: anchor the story to a specific year or date' },
  { key: 'hypothetical', hint: '"Imagine you [impossible scenario]..." — hypothetical angle: put the viewer inside an impossible scenario' },
];

/**
 * Kiest een perspectief, nooit hetzelfde als het vorige.
 * Na ≥5 A/B-keuzes weegt de keuze mee welk type de gebruiker verkiest (C5-learning).
 */
function pickPerspective() {
  const store = loadStore();
  const last = store.perspectives[store.perspectives.length - 1];
  let pool = PERSPECTIVES.filter(p => p.key !== last);

  // A/B-learning: perspectieven die de gebruiker vaker koos, wegen zwaarder
  if ((store.ab_choices || []).length >= 5) {
    const wins = {};
    for (const c of store.ab_choices) wins[c.chosen] = (wins[c.chosen] || 0) + 1;
    pool = pool.flatMap(p => Array(1 + (wins[p.key] || 0)).fill(p));
  }

  const chosen = pool[Math.floor(Math.random() * pool.length)];
  store.perspectives = [...store.perspectives, chosen.key].slice(-20);
  saveStore(store);
  return chosen;
}

/** C5: registreert welke A/B-variant de gebruiker koos. */
function recordAbChoice(chosen, rejected) {
  const store = loadStore();
  store.ab_choices = [...(store.ab_choices || []), { chosen, rejected, at: new Date().toISOString() }].slice(-30);
  saveStore(store);
  console.log(`[Uniqueness] A/B-keuze: ${chosen} > ${rejected} (${store.ab_choices.length} keuzes totaal)`);
}

// ── A1: Anti-herhaling ──────────────────────────────────────────────────────

const STOPWORDS = new Set(('de het een en van in op is was zijn dat die dit voor met als aan er om te door bij naar uit over nog ook maar dan wat wie hoe je jij we wij ze zij hun hem haar the a an and of in on is was were that this for with as at to by from it its they you your what who how not no or so').split(' '));

function keywords(text) {
  return new Set(
    (text || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/)
      .filter(w => w.length > 3 && !STOPWORDS.has(w))
  );
}

function firstSentence(script) {
  const m = (script || '').trim().match(/^[^.!?]+[.!?]/);
  return m ? m[0].trim() : (script || '').slice(0, 100);
}

function lastSentence(script) {
  const parts = (script || '').trim().match(/[^.!?]+[.!?]+/g) || [];
  return (parts[parts.length - 1] || '').trim();
}

/** Uniciteits-score 0-100: hoe anders is dit script t.o.v. de laatste 5 (keyword-overlap). */
function uniquenessScore(script) {
  const store = loadStore();
  const kw = keywords(script);
  if (kw.size === 0) return 100;
  const recent = store.script_keywords.slice(-5);
  if (recent.length === 0) return 100;
  let maxOverlap = 0;
  for (const prev of recent) {
    const prevSet = new Set(prev);
    const inter = [...kw].filter(w => prevSet.has(w)).length;
    const union = new Set([...kw, ...prevSet]).size;
    maxOverlap = Math.max(maxOverlap, union ? inter / union : 0);
  }
  return Math.round((1 - maxOverlap) * 100);
}

/** Registreert een gegenereerd script (opening, CTA, keywords). */
function recordScript(script) {
  const store = loadStore();
  store.openings        = [...store.openings, firstSentence(script)].slice(-25);
  store.ctas            = [...store.ctas, lastSentence(script)].slice(-25);
  store.script_keywords = [...store.script_keywords, [...keywords(script)]].slice(-10);
  saveStore(store);
}

/** Registreert scène-analyse output (visual_focus + style_anchor). */
function recordScenes(scenes, styleAnchor) {
  const store = loadStore();
  const focuses = (scenes || []).map(s => s.visual_focus).filter(Boolean);
  store.visual_focus  = [...store.visual_focus, ...focuses].slice(-60);
  if (styleAnchor) store.style_anchors = [...store.style_anchors, styleAnchor].slice(-10);
  saveStore(store);
}

/** Prompt-blok voor script-generatie: vermijd eerdere openingen/CTA's. */
function scriptAvoidBlock() {
  const store = loadStore();
  const openings = store.openings.slice(-10);
  if (openings.length === 0) return '';
  return `
ANTI-REPETITION (critical for channel uniqueness):
These opening lines were used in previous videos. NEVER use any of these openings or a similar sentence structure:
${openings.map(o => `- "${o}"`).join('\n')}
${store.ctas.length ? `Also avoid repeating these exact call-to-action phrasings:\n${store.ctas.slice(-5).map(c => `- "${c}"`).join('\n')}` : ''}`;
}

/** Prompt-blok voor scène-analyse: vermijd eerdere visual_focus beschrijvingen + style anchors. */
function visualAvoidBlock() {
  const store = loadStore();
  const focuses = store.visual_focus.slice(-25);
  const anchors = store.style_anchors.slice(-5);
  if (focuses.length === 0 && anchors.length === 0) return '';
  return `
ANTI-REPETITION (visual uniqueness):
${focuses.length ? `Never reuse or closely paraphrase these visual_focus descriptions from previous videos:\n${focuses.map(f => `- "${f}"`).join('\n')}` : ''}
${anchors.length ? `\nThe style_anchor must be COMPLETELY different from these previous ones:\n${anchors.map(a => `- "${a}"`).join('\n')}` : ''}`;
}

// ── A3: Unieke visuele DNA ──────────────────────────────────────────────────

const DNA_PALETTES  = ['burnt amber and deep teal', 'ash grey with crimson accents', 'moonlit blue and antique gold', 'sun-bleached ochre and slate', 'emerald shadow and copper', 'ivory mist and charcoal', 'blood orange dusk and indigo', 'verdigris and weathered bronze'];
const DNA_LIGHTING  = ['low golden side-light with long shadows', 'cold overcast diffuse light', 'single torch-like warm key light', 'harsh noon sun with deep contrast', 'blue-hour ambient glow', 'volumetric fog with backlight', 'flickering firelight from below', 'pale dawn light through haze'];
const DNA_CAMERA    = ['slow push-in at eye level', 'low-angle drift upward', 'high aerial descent', 'handheld intimate close tracking', 'locked-off wide with subject movement', 'lateral dolly through foreground objects', 'slow orbit around the subject', 'crane-down from above the scene'];

/** Genereert een visuele-DNA instructie voor de style_anchor (random seed → unieke combinatie). */
function visualDnaBlock(seed = Date.now()) {
  const pick = (arr, off) => arr[Math.abs((seed >> off) + seed) % arr.length];
  const palette  = pick(DNA_PALETTES, 2);
  const lighting = pick(DNA_LIGHTING, 5);
  const camera   = pick(DNA_CAMERA, 8);
  return `
VISUAL DNA (unique fingerprint for THIS video only — never generic):
Build the style_anchor around exactly this combination:
- Color palette: ${palette}
- Lighting: ${lighting}
- Signature camera movement: ${camera}
- Invent ONE distinctive recurring character or object description unique to this video (specific age, clothing texture, physical detail)
Two videos about the same topic must look completely different — this fingerprint guarantees that.`;
}

module.exports = {
  pickPerspective, uniquenessScore, recordScript, recordScenes, recordAbChoice,
  scriptAvoidBlock, visualAvoidBlock, visualDnaBlock, PERSPECTIVES,
};
