/**
 * geminiTtsService.js
 * Google AI Studio TTS via Gemini 2.5 Flash — fallback wanneer ElevenLabs quota op is.
 */

const axios = require('axios');
const fs    = require('fs');
const path  = require('path');

const { OUTPUTS_DIR } = require('../paths');
const AUDIO_DIR = path.join(OUTPUTS_DIR, 'audio');
if (!fs.existsSync(AUDIO_DIR)) fs.mkdirSync(AUDIO_DIR, { recursive: true });

// Gemini ondersteunt geen NL-specifieke stemmen — beste EN-equivalenten
const VOICE_MAP = {
  en_male:   'Algieba',
  en_female: 'Aoede',
  nl_male:   'Algieba',
  nl_female: 'Aoede',
};

/**
 * Genereert voice-over via Google AI Studio TTS (Gemini 2.5 Flash).
 * @returns {{ audioUrl: string }}
 */
async function generateVoiceOverGemini(script, voiceKey, jobId) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY niet ingesteld');

  const voiceName  = VOICE_MAP[voiceKey] || 'Algieba';
  const audioPath  = path.join(AUDIO_DIR, `${jobId}-gemini.mp3`);
  const { SERVER_BASE_URL } = require('../paths');
  const audioUrl   = `${SERVER_BASE_URL}/outputs/audio/${jobId}-gemini.mp3`;

  console.log(`[GeminiTTS] Genereer voice-over met stem "${voiceName}" voor job ${jobId}`);

  const response = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`,
    {
      contents: [{ parts: [{ text: script }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
    },
    {
      headers: { 'Content-Type': 'application/json' },
      timeout: 120000,
    }
  );

  const audioData = response.data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!audioData) throw new Error('Gemini TTS: geen audio in response');

  // Gemini levert PCM/WAV-data — sla op als .mp3 (renderService stuurt naar Remotion als URL)
  fs.writeFileSync(audioPath, Buffer.from(audioData, 'base64'));
  const fileSize = fs.statSync(audioPath).size;
  console.log(`[GeminiTTS] Audio opgeslagen: ${audioPath} (${Math.round(fileSize / 1024)}KB)`);

  if (fileSize < 1000) throw new Error(`Gemini TTS: ongeldig audiobestand (${fileSize} bytes)`);

  return { audioUrl };
}

module.exports = { generateVoiceOverGemini };
