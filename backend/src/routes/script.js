const express = require('express');
const router = express.Router();
const { analyzeScript, generateScript, generateEpicScript, calculateWordTimings, analyzeScriptSettings } = require('../services/claudeAnalyzer');

// POST /api/script/analyze — Analyseer een script met Claude
router.post('/analyze', async (req, res) => {
  try {
    const { script, style, duration } = req.body;
    if (!script) return res.status(400).json({ error: 'Script is verplicht' });

    const result = await analyzeScript(script, style || 'documentaire', duration || 60);
    const scenes = Array.isArray(result) ? result : (result.scenes || []);
    const wordTimings = calculateWordTimings(script, scenes);

    res.json({ scenes, word_timings: wordTimings });
  } catch (err) {
    console.error('[POST /api/script/analyze]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/script/generate — Genereer een script via Claude
router.post('/generate', async (req, res) => {
  try {
    const { topic, style, duration, language, format } = req.body;
    if (!topic) return res.status(400).json({ error: 'Topic is verplicht' });

    const result = await generateScript(topic, style || 'documentaire', duration || 60, language || 'en', format || 'narrative');
    res.json({ script: result.script, perspective: result.perspective, uniqueness_score: result.uniqueness_score });
  } catch (err) {
    console.error('[POST /api/script/generate]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/script/generate-epic — Epic dark fantasy script via Claude
router.post('/generate-epic', async (req, res) => {
  try {
    const { topic, duration, language } = req.body;
    if (!topic) return res.status(400).json({ error: 'Topic is verplicht' });
    const script = await generateEpicScript(topic, duration || 60, language || 'en');
    res.json({ script });
  } catch (err) {
    console.error('[POST /api/script/generate-epic]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/script/generate-ab — twee script-varianten met verschillend perspectief (Fase C5)
router.post('/generate-ab', async (req, res) => {
  try {
    const { topic, style, duration, language, format } = req.body;
    if (!topic) return res.status(400).json({ error: 'Topic is verplicht' });

    // Twee sequentiële generaties — de perspectief-rotatie garandeert verschillende hoeken
    const a = await generateScript(topic, style || 'documentaire', duration || 60, language || 'en', format || 'narrative');
    const b = await generateScript(topic, style || 'documentaire', duration || 60, language || 'en', format || 'narrative');
    res.json({
      variant_a: { script: a.script, perspective: a.perspective, uniqueness_score: a.uniqueness_score },
      variant_b: { script: b.script, perspective: b.perspective, uniqueness_score: b.uniqueness_score },
    });
  } catch (err) {
    console.error('[POST /api/script/generate-ab]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/script/ab-choice — registreer welke variant de gebruiker koos (learning)
router.post('/ab-choice', (req, res) => {
  const { chosen_perspective, rejected_perspective } = req.body;
  if (!chosen_perspective) return res.status(400).json({ error: 'chosen_perspective is verplicht' });
  require('../services/uniquenessService').recordAbChoice(chosen_perspective, rejected_perspective || null);
  res.json({ ok: true });
});

// POST /api/script/humanize — herschrijf het script als een authentiek mens (Fase B3)
router.post('/humanize', async (req, res) => {
  try {
    const { script, language } = req.body;
    if (!script || script.trim().length < 20) return res.status(400).json({ error: 'Script is verplicht (min. 20 tekens)' });

    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const langName = language === 'nl' ? 'Dutch' : 'English';
    const wordCount = script.trim().split(/\s+/).length;

    const msg = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: `Herschrijf dit videoscript zodat het klinkt als een enthousiaste, authentieke mens die dit spontaan aan een vriend vertelt — niet als een voorgelezen tekst.

REGELS:
- PARAFRASEER ELKE ZIN: geen enkele zin mag woordelijk gelijk blijven aan het origineel (behalve citaten). Gebruik andere woorden, andere zinsbouw, ander ritme — maar exact dezelfde boodschap.
- Behoud ALLE feiten, namen, cijfers en de volgorde van de informatie exact
- Behoud de taal (${langName}) en blijf binnen ${Math.round(wordCount * 1.1)} woorden
- Wissel korte en lange zinnen af; gebruik spreektaal ("nou", "echt", "trouwens" — spaarzaam) en samentrekkingen waar natuurlijk
- Voeg af en toe een kleine persoonlijke noot toe ("dit fascineerde mij omdat...", "wat ik hier eerst niet bij begreep was...") — maximaal 2 keer
- Verwijder ALLE clichés en AI-achtige formuleringen. Verboden (herschrijf ze ALTIJD, ook in de openingszin): "Het is geen geheim dat", "In de wereld van", "Stel je voor dat", "Het is verbazingwekkend", "It's no secret that", "Imagine..."
- Behoud de FUNCTIE van de openingszin (een sterke hook) en de call-to-action aan het einde — maar in nieuwe bewoordingen
- Geef ALLEEN het herschreven script terug, geen uitleg, geen markdown

SCRIPT:
${script.trim()}`,
      }],
    });

    const humanized = msg.content[0].text.trim();
    // Percentage herschreven zinnen, zodat de UI kan tonen hoeveel er echt veranderd is
    const origSentences = script.trim().split(/(?<=[.!?])\s+/).filter(Boolean);
    const humSet = new Set(humanized.split(/(?<=[.!?])\s+/).map(z => z.trim()));
    const unchanged = origSentences.filter(z => humSet.has(z.trim())).length;
    const rewritePct = origSentences.length
      ? Math.round(100 * (1 - unchanged / origSentences.length))
      : 0;
    res.json({ original: script.trim(), humanized, rewrite_pct: rewritePct });
  } catch (err) {
    console.error('[POST /api/script/humanize]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/script/analyze-settings — Aanbevolen format/mode/render_style voor een script
router.post('/analyze-settings', async (req, res) => {
  try {
    const { script } = req.body;
    if (!script || !script.trim()) return res.status(400).json({ error: 'Script is verplicht' });
    const recommendation = await analyzeScriptSettings(script);
    res.json(recommendation);
  } catch (err) {
    console.error('[POST /api/script/analyze-settings]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Studio-handoff: VaultBoost stuurt een script door; Studio vult het in ────
// Kort-levende in-memory opslag (1 uur TTL) — bewust geen render-start:
// de gebruiker kiest zelf stijl/duur/stem in Studio en klikt zelf op Render.
const handoffs = new Map();
const HANDOFF_TTL_MS = 60 * 60 * 1000;

router.post('/handoff', (req, res) => {
  const { script, topic, title, thumbnail } = req.body || {};
  if (!script?.trim() && !topic?.trim()) return res.status(400).json({ error: 'script of topic is vereist' });
  const id = require('crypto').randomUUID();
  handoffs.set(id, { script: script || '', topic: topic || '', title: title || topic || '', thumbnail: thumbnail || null, created: Date.now() });
  // opruimen van verlopen handoffs
  for (const [k, v] of handoffs) if (Date.now() - v.created > HANDOFF_TTL_MS) handoffs.delete(k);
  res.json({ id });
});

router.get('/handoff/:id', (req, res) => {
  const h = handoffs.get(req.params.id);
  if (!h || Date.now() - h.created > HANDOFF_TTL_MS) return res.status(404).json({ error: 'Handoff niet gevonden of verlopen' });
  res.json(h);
});

module.exports = router;
