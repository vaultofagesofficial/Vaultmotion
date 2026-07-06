/**
 * promptIntelligence.js — Zelf-verbeterende prompt-kalibratie (Fase C3)
 * Meet welke visual_focus prompts de rijkste kie.ai-beelden opleverden
 * (bestandsgrootte als proxy voor beeldkwaliteit) en destilleert patronen.
 */

const fs   = require('fs');
const path = require('path');
const { JOBS_FILE, OUTPUTS_DIR } = require('../paths');

const STORE_FILE = path.join(path.dirname(JOBS_FILE), 'prompt_intelligence.json');

function loadStore() {
  try {
    if (fs.existsSync(STORE_FILE)) return JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
  } catch {}
  return { results: [], patterns: [], renders_analyzed: 0, patterns_updated_at: null };
}

function saveStore(s) {
  try { fs.writeFileSync(STORE_FILE, JSON.stringify(s, null, 2)); }
  catch (e) { console.warn('[PromptIntel] opslaan mislukt:', e.message); }
}

/**
 * Registreert na een render de kwaliteit (bestandsgrootte) per KIE-scène.
 * Draait fire-and-forget na elke voltooide render.
 */
async function recordRenderResults(job) {
  if (!job?.scenes?.length) return;
  const store = loadStore();
  let added = 0;

  for (const scene of job.scenes) {
    if (!scene.visual_focus || !scene.background_video_url) continue;
    // Lokaal bestand zoeken op basis van de URL (/outputs/...)
    const rel = scene.background_video_url.replace(/^https?:\/\/[^/]+/, '').replace(/^\/outputs\//, '');
    const filePath = path.join(OUTPUTS_DIR, rel);
    if (!fs.existsSync(filePath)) continue;
    const sizeKb = Math.round(fs.statSync(filePath).size / 1024);
    store.results.push({ visual_focus: scene.visual_focus, size_kb: sizeKb, template: scene.template, at: new Date().toISOString() });
    added++;
  }

  if (added === 0) return;
  store.results = store.results.slice(-100);
  store.renders_analyzed = (store.renders_analyzed || 0) + 1;
  saveStore(store);
  console.log(`[PromptIntel] ${added} scène-resultaten geregistreerd (render #${store.renders_analyzed})`);

  // Na elke 10 renders: patronen (her)berekenen via Claude
  if (store.renders_analyzed % 10 === 0 && store.results.length >= 10) {
    await analyzePatterns().catch(e => console.warn('[PromptIntel] patroon-analyse mislukt:', e.message));
  }
}

/** Claude analyseert de top-5 best presterende prompts en extraheert patronen. */
async function analyzePatterns() {
  const store = loadStore();
  if (store.results.length < 10) return null;

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || key === 'sk-ant-...') return null;

  const sorted = [...store.results].sort((a, b) => b.size_kb - a.size_kb);
  const top5 = sorted.slice(0, 5);
  const bottom5 = sorted.slice(-5);

  const Anthropic = require('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: key });
  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 800,
    messages: [{
      role: 'user',
      content: `Analyseer welke visual_focus prompt-patronen de rijkste AI-videobeelden opleveren (grotere bestanden = rijker beeld).

BESTE 5 PROMPTS:
${top5.map(r => `- "${r.visual_focus}" → ${r.size_kb}KB`).join('\n')}

SLECHTSTE 5 PROMPTS:
${bottom5.map(r => `- "${r.visual_focus}" → ${r.size_kb}KB`).join('\n')}

Extraheer 3-5 concrete, herbruikbare patronen die de beste prompts onderscheiden (bv. specifieke bewegingswoorden, detailniveau, compositie-elementen). Geef ALLEEN geldige JSON:
{"patterns":["patroon 1 als schrijfinstructie","patroon 2",...]}`,
    }],
  });

  try {
    const parsed = JSON.parse(msg.content[0].text.replace(/```json?|```/g, '').trim());
    store.patterns = (parsed.patterns || []).slice(0, 5);
    store.patterns_updated_at = new Date().toISOString();
    saveStore(store);
    console.log(`[PromptIntel] ${store.patterns.length} patronen geëxtraheerd`);
    return store.patterns;
  } catch { return null; }
}

/** Prompt-blok met geleerde patronen voor toekomstige visual_focus generatie. */
function patternsBlock() {
  const store = loadStore();
  if (!store.patterns?.length) return '';
  return `
LEARNED VISUAL PATTERNS (from this channel's best-performing AI renders — apply to every visual_focus):
${store.patterns.map(p => `- ${p}`).join('\n')}`;
}

function getIntelligence() {
  const store = loadStore();
  const sorted = [...store.results].sort((a, b) => b.size_kb - a.size_kb);
  return {
    renders_analyzed: store.renders_analyzed || 0,
    results_count: store.results.length,
    patterns: store.patterns || [],
    patterns_updated_at: store.patterns_updated_at,
    top_prompts: sorted.slice(0, 5),
  };
}

module.exports = { recordRenderResults, analyzePatterns, patternsBlock, getIntelligence };
