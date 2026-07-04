/**
 * elevenLabsService.js
 * TTS via ElevenLabs + word-level timestamps via /with-timestamps endpoint.
 */

const axios = require('axios');
const fs    = require('fs');
const path  = require('path');

const { OUTPUTS_DIR, SERVER_BASE_URL } = require('../paths');
const AUDIO_DIR = path.join(OUTPUTS_DIR, 'audio');
if (!fs.existsSync(AUDIO_DIR)) fs.mkdirSync(AUDIO_DIR, { recursive: true });

const ELEVENLABS_BASE = 'https://api.elevenlabs.io/v1';

const VOICES = {
  en_female: { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', lang: 'en' },
  nl_female: { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella',  lang: 'nl' },
  nl_male:   { id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi',   lang: 'nl' },
  en_male:   { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam',   lang: 'en' },
};

// ── Character → word timestamps ─────────────────────────────────────────────

/**
 * Converteert ElevenLabs character-level alignment naar word-level timestamps.
 * @returns {Array<{word, start_time, end_time}>} — tijden in seconden
 */
function aggregateToWords(characters, charStartTimes, charEndTimes) {
  const words    = [];
  let wordChars  = '';
  let wordStart  = 0;
  let wordEnd    = 0;

  for (let i = 0; i < characters.length; i++) {
    const ch = characters[i];
    const s  = charStartTimes[i];
    const e  = charEndTimes[i];

    if (ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t') {
      if (wordChars.trim()) {
        words.push({ word: wordChars.trim(), start_time: wordStart, end_time: wordEnd });
        wordChars = '';
      }
    } else {
      if (!wordChars) wordStart = s;
      wordChars += ch;
      wordEnd    = e;
    }
  }

  if (wordChars.trim()) {
    words.push({ word: wordChars.trim(), start_time: wordStart, end_time: wordEnd });
  }

  return words;
}

// ── Voice-over + timestamps ──────────────────────────────────────────────────

/**
 * Genereert voice-over EN word-level timestamps via ElevenLabs.
 * Slaat op:
 *   outputs/audio/{jobId}.mp3
 *   outputs/audio/{jobId}.timestamps.json
 *
 * @returns {{ audioUrl, wordTimings: [{word, start_time, end_time}] }}
 */
const MAX_ELEVENLABS_CHARS = 4500;

function truncateScriptToLimit(script) {
  if (script.length <= MAX_ELEVENLABS_CHARS) return { text: script, truncated: false };
  const sub = script.slice(0, MAX_ELEVENLABS_CHARS);
  const lastSentence = sub.search(/[^.!?]+[.!?]+\s*$/);
  const cut = lastSentence > 0 ? sub.slice(0, lastSentence).trimEnd() : sub.trimEnd();
  console.warn(`[ElevenLabs] Script te lang (${script.length} chars > ${MAX_ELEVENLABS_CHARS}) — afgekapt naar ${cut.length} chars op laatste volledige zin`);
  return { text: cut, truncated: true };
}

async function generateVoiceOver(script, jobId, voiceKey = 'EXAVITQu4vr4xnSDxMaL') {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY niet ingesteld');

  const voiceObj = VOICES[voiceKey];
  const voiceId  = voiceObj ? voiceObj.id : voiceKey;
  const voiceName = voiceObj ? voiceObj.name : voiceKey;

  const { text: safeScript, truncated } = truncateScriptToLimit(script);
  if (truncated) {
    console.warn(`[ElevenLabs] validation_warning: Script te lang voor ElevenLabs — mogelijke truncatie vermeden door afkappen`);
  }
  script = safeScript;

  const audioPath     = path.join(AUDIO_DIR, `${jobId}.mp3`);
  const tsPath        = path.join(AUDIO_DIR, `${jobId}.timestamps.json`);
  const audioUrl      = `${SERVER_BASE_URL}/outputs/audio/${jobId}.mp3`;

  // Cache: als beide bestanden bestaan, hergebruik
  if (fs.existsSync(audioPath) && fs.existsSync(tsPath)) {
    console.log(`[ElevenLabs] Cache hit: ${jobId}.mp3`);
    const wordTimings = JSON.parse(fs.readFileSync(tsPath, 'utf8'));
    return { audioUrl, wordTimings };
  }

  console.log(`[ElevenLabs] Genereer voice-over + timestamps: "${voiceName}" (${voiceId})`);

  // ── Probeer /with-timestamps endpoint (geeft base64 audio + alignment) ────
  let wordTimings = null;

  try {
    const tsRes = await axios.post(
      `${ELEVENLABS_BASE}/text-to-speech/${voiceId}/with-timestamps`,
      {
        text: script,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.3, use_speaker_boost: true },
        output_format: 'mp3_44100_128',
      },
      {
        headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
        timeout: 90000,
      }
    );

    const body = tsRes.data;

    // Sla audio op vanuit base64
    if (body.audio_base64) {
      fs.writeFileSync(audioPath, Buffer.from(body.audio_base64, 'base64'));
      console.log(`[ElevenLabs] Audio opgeslagen via with-timestamps (${Math.round(fs.statSync(audioPath).size / 1024)}KB)`);
    }

    // Aggregeer character timestamps naar woorden
    const alignment = body.alignment || body.normalized_alignment;
    if (alignment?.characters?.length) {
      wordTimings = aggregateToWords(
        alignment.characters,
        alignment.character_start_times_seconds,
        alignment.character_end_times_seconds
      );
      console.log(`[ElevenLabs] ${wordTimings.length} woord-timestamps opgehaald`);
    }

  } catch (tsErr) {
    console.warn(`[ElevenLabs] with-timestamps mislukt: ${tsErr.message} — fallback naar standaard TTS`);
  }

  // ── Fallback: standaard TTS zonder timestamps ─────────────────────────────
  if (!fs.existsSync(audioPath)) {
    const ttsRes = await axios.post(
      `${ELEVENLABS_BASE}/text-to-speech/${voiceId}`,
      {
        text: script,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.3, use_speaker_boost: true },
        output_format: 'mp3_44100_128',
      },
      {
        headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg' },
        responseType: 'arraybuffer',
        timeout: 60000,
      }
    );
    fs.writeFileSync(audioPath, Buffer.from(ttsRes.data));
    console.log(`[ElevenLabs] Audio opgeslagen via standaard TTS (${Math.round(fs.statSync(audioPath).size / 1024)}KB)`);
  }

  // Sla timestamps op (ook als null — renderService valt dan terug op 130wpm)
  if (wordTimings) {
    fs.writeFileSync(tsPath, JSON.stringify(wordTimings, null, 2));
    console.log(`[ElevenLabs] Timestamps opgeslagen: ${tsPath}`);
  }

  return { audioUrl, wordTimings };
}

// ── Stemmen ophalen ─────────────────────────────────────────────────────────

async function getVoices() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY niet ingesteld');

  const response = await axios.get(`${ELEVENLABS_BASE}/voices`, {
    headers: { 'xi-api-key': apiKey },
    timeout: 10000,
  });

  return (response.data?.voices || [])
    .filter(v => {
      const labels  = Object.values(v.labels || {}).join(' ').toLowerCase();
      const desc    = (v.description || '').toLowerCase();
      const combined = `${labels} ${desc}`;
      return (
        combined.includes('dutch') || combined.includes('english') ||
        combined.includes('american') || combined.includes('british') ||
        (!combined.includes('german') && !combined.includes('french') &&
         !combined.includes('spanish') && !combined.includes('italian') &&
         !combined.includes('portuguese'))
      );
    })
    .map(v => {
      const labels  = Object.values(v.labels || {}).join(' ').toLowerCase();
      const isDutch = labels.includes('dutch') || labels.includes('nederlands');
      const gender  = labels.includes('female') ? 'female' : labels.includes('male') ? 'male' : 'unknown';
      return { voice_id: v.voice_id, name: v.name, lang: isDutch ? 'nl' : 'en', gender, preview_url: v.preview_url || null, category: v.category || 'generated' };
    })
    .sort((a, b) => a.lang === b.lang ? a.name.localeCompare(b.name) : a.lang === 'nl' ? -1 : 1);
}

module.exports = { generateVoiceOver, getVoices, VOICES };
