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
const MAX_ELEVENLABS_CHARS = 4000;

/**
 * Splitst een script op zinsgrenzen in chunks van max MAX_ELEVENLABS_CHARS.
 * Lange scripts worden zo NIET meer afgekapt maar in delen gegenereerd.
 */
function splitScriptIntoChunks(script) {
  if (script.length <= MAX_ELEVENLABS_CHARS) return [script];
  const sentences = script.match(/[^.!?]+[.!?]+["')\]]*\s*/g) || [script];
  const chunks = [];
  let current = '';
  for (const s of sentences) {
    if ((current + s).length > MAX_ELEVENLABS_CHARS && current) {
      chunks.push(current.trim());
      current = s;
    } else {
      current += s;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  console.log(`[ElevenLabs] Script ${script.length} chars → ${chunks.length} chunks (max ${MAX_ELEVENLABS_CHARS})`);
  return chunks;
}

// Audio-duur van een mp3 via ffprobe (voor correcte word-timing offsets bij chunking)
function probeAudioDuration(filePath) {
  try {
    const { execSync } = require('child_process');
    const ffprobePath = process.env.FFPROBE_PATH
      || (() => { try { return require('@ffprobe-installer/ffprobe').path; } catch { return 'ffprobe'; } })();
    const out = execSync(`"${ffprobePath}" -v quiet -show_entries format=duration -of csv=p=0 "${filePath}"`, { encoding: 'utf8', timeout: 10000 });
    const dur = parseFloat(out.trim());
    return isNaN(dur) ? null : dur;
  } catch { return null; }
}

// Spreekstijlen → ElevenLabs voice_settings (Submagic-stijl)
const SPEAKING_STYLES = {
  dramatic:  { stability: 0.75, similarity_boost: 0.8,  style: 0.6,  use_speaker_boost: true }, // langzamer gevoel, meer expressie
  energetic: { stability: 0.3,  similarity_boost: 0.7,  style: 0.55, use_speaker_boost: true }, // levendiger, hogere variatie
  neutral:   { stability: 0.5,  similarity_boost: 0.75, style: 0.3,  use_speaker_boost: true }, // huidig gedrag
};

/**
 * Genereert audio + word-timings voor ÉÉN tekst-chunk.
 * @returns {{ buffer: Buffer, wordTimings: Array|null }}
 */
async function generateChunkAudio(text, voiceId, voiceSettings, apiKey) {
  // Probeer /with-timestamps (base64 audio + alignment)
  try {
    const tsRes = await axios.post(
      `${ELEVENLABS_BASE}/text-to-speech/${voiceId}/with-timestamps`,
      { text, model_id: 'eleven_multilingual_v2', voice_settings: voiceSettings, output_format: 'mp3_44100_128' },
      { headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' }, timeout: 120000 }
    );
    const body = tsRes.data;
    if (body.audio_base64) {
      const alignment = body.alignment || body.normalized_alignment;
      let wordTimings = null;
      if (alignment?.characters?.length) {
        wordTimings = aggregateToWords(
          alignment.characters,
          alignment.character_start_times_seconds,
          alignment.character_end_times_seconds
        );
      }
      return { buffer: Buffer.from(body.audio_base64, 'base64'), wordTimings };
    }
  } catch (tsErr) {
    console.warn(`[ElevenLabs] with-timestamps mislukt: ${tsErr.message} — fallback naar standaard TTS`);
  }

  // Fallback: standaard TTS zonder timestamps
  const ttsRes = await axios.post(
    `${ELEVENLABS_BASE}/text-to-speech/${voiceId}`,
    { text, model_id: 'eleven_multilingual_v2', voice_settings: voiceSettings, output_format: 'mp3_44100_128' },
    { headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg' }, responseType: 'arraybuffer', timeout: 90000 }
  );
  return { buffer: Buffer.from(ttsRes.data), wordTimings: null };
}

async function generateVoiceOver(script, jobId, voiceKey = 'EXAVITQu4vr4xnSDxMaL', speakingStyle = 'neutral') {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY niet ingesteld');
  const voiceSettings = SPEAKING_STYLES[speakingStyle] || SPEAKING_STYLES.neutral;

  const voiceObj = VOICES[voiceKey];
  const voiceId  = voiceObj ? voiceObj.id : voiceKey;
  const voiceName = voiceObj ? voiceObj.name : voiceKey;

  const audioPath     = path.join(AUDIO_DIR, `${jobId}.mp3`);
  const tsPath        = path.join(AUDIO_DIR, `${jobId}.timestamps.json`);
  const audioUrl      = `${SERVER_BASE_URL}/outputs/audio/${jobId}.mp3`;

  // Cache: als beide bestanden bestaan, hergebruik
  if (fs.existsSync(audioPath) && fs.existsSync(tsPath)) {
    console.log(`[ElevenLabs] Cache hit: ${jobId}.mp3`);
    const wordTimings = JSON.parse(fs.readFileSync(tsPath, 'utf8'));
    return { audioUrl, wordTimings };
  }

  const chunks = splitScriptIntoChunks(script);
  console.log(`[ElevenLabs] Genereer voice-over (${chunks.length} chunk${chunks.length === 1 ? '' : 's'}): "${voiceName}" (${voiceId})`);

  const buffers = [];
  let allTimings = [];
  let anyTimings = false;
  let offsetSec  = 0;

  for (let c = 0; c < chunks.length; c++) {
    const { buffer, wordTimings } = await generateChunkAudio(chunks[c], voiceId, voiceSettings, apiKey);
    buffers.push(buffer);

    // Word-timings verschuiven met de cumulatieve duur van vorige chunks
    if (wordTimings?.length) {
      anyTimings = true;
      allTimings = allTimings.concat(wordTimings.map(w => ({
        ...w,
        start_time: w.start_time + offsetSec,
        end_time:   w.end_time   + offsetSec,
      })));
    }

    // Chunk-duur bepalen voor de offset van de VOLGENDE chunk (ffprobe > laatste woord)
    if (c < chunks.length - 1) {
      const tmpPath = path.join(AUDIO_DIR, `${jobId}.chunk${c}.mp3`);
      fs.writeFileSync(tmpPath, buffer);
      const probed = probeAudioDuration(tmpPath);
      fs.unlinkSync(tmpPath);
      const lastWordEnd = wordTimings?.length ? wordTimings[wordTimings.length - 1].end_time : null;
      offsetSec += probed ?? (lastWordEnd !== null ? lastWordEnd + 0.1 : 0);
      console.log(`[ElevenLabs] Chunk ${c + 1}/${chunks.length} klaar — duur ${((probed ?? lastWordEnd) || 0).toFixed(2)}s, offset nu ${offsetSec.toFixed(2)}s`);
    }
  }

  // Alle chunks samenvoegen (zelfde codec/bitrate → binaire mp3-concatenatie is geldig)
  fs.writeFileSync(audioPath, Buffer.concat(buffers));
  console.log(`[ElevenLabs] Audio opgeslagen (${Math.round(fs.statSync(audioPath).size / 1024)}KB, ${chunks.length} chunks)`);

  const wordTimings = anyTimings ? allTimings : null;
  if (wordTimings) {
    fs.writeFileSync(tsPath, JSON.stringify(wordTimings, null, 2));
    console.log(`[ElevenLabs] ${wordTimings.length} woord-timestamps opgeslagen: ${tsPath}`);
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
