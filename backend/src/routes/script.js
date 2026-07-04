const express = require('express');
const router = express.Router();
const { analyzeScript, generateScript, generateEpicScript, calculateWordTimings, analyzeScriptSettings } = require('../services/claudeAnalyzer');

// POST /api/script/analyze — Analyseer een script met Claude
router.post('/analyze', async (req, res) => {
  try {
    const { script, style, duration } = req.body;
    if (!script) return res.status(400).json({ error: 'Script is verplicht' });

    const scenes = await analyzeScript(script, style || 'documentaire', duration || 60);
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

    const script = await generateScript(topic, style || 'documentaire', duration || 60, language || 'en', format || 'narrative');
    res.json({ script });
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

module.exports = router;
