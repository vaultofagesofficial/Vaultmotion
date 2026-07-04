const express = require('express');
const router = express.Router();
const { getVoices, VOICES } = require('../services/elevenLabsService');

// GET /api/voices — Haal alle ElevenLabs stemmen op
router.get('/', async (req, res) => {
  try {
    const voices = await getVoices();
    res.json({ voices });
  } catch (err) {
    // Fallback op hardcoded stemmen als API niet bereikbaar is
    const fallback = Object.entries(VOICES).map(([key, v]) => ({
      voice_id: v.id,
      name: v.name,
      lang: v.lang,
      gender: key.includes('female') ? 'female' : 'male',
      preview_url: null,
      category: 'premade',
    }));
    res.json({ voices: fallback, fallback: true });
  }
});

module.exports = router;
