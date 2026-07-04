/**
 * klingService.js
 * Genereert AI-video achtergronden via Kling 1.6 (piapi.ai).
 * Zet PIAPI_KEY in backend/.env
 */

const axios = require('axios');
const fs    = require('fs');
const path  = require('path');

const { SERVER_BASE_URL } = require('../paths');

const PIAPI_BASE       = 'https://api.piapi.ai/api/v1';
const POLL_INTERVAL_MS = 6000;
const MAX_POLLS        = 50;

// ── Prompt template per template type ──────────────────────────────────────

function buildKlingPrompt(scene) {
  const base = 'cinematic dark fantasy style, dramatic orange and gold lighting, slow motion, smoke and embers, photorealistic textures, epic atmosphere, 9:16 vertical format, no text overlay';
  const content = scene.content || {};
  const segment = scene.script_segment || '';

  const subjects = {
    cinematic_title: `epic title reveal, ${content.title || 'warrior standing victorious'}, dramatic camera push-in`,
    ken_burns:       `${segment || 'vast ancient landscape'}, slow Ken Burns zoom, golden hour lighting`,
    animated_map:    `aerial view of ${content.location || 'ancient realm'}, glowing map borders, mystical fog`,
    timeline:        `${segment || 'epic historical battle scene'}, warriors marching, dust and smoke`,
    stats_counter:   `${segment || 'crowd of thousands'}, dramatic scale reveal, particles flying`,
    outro_cta:       `heroic warrior silhouette against burning horizon, flames, embers rising`,
  };

  return `${subjects[scene.template] || subjects.ken_burns}, ${base}`;
}

// ── Model selectie ─────────────────────────────────────────────────────────

function selectVideoModel(mode, template) {
  const map = {
    epic:         { model: 'kling', version: '1.6' },
    story:        { model: 'kling', version: '1.6' }, // veo zodra piapi.ai het ondersteunt
    documentary:  { model: 'kling', version: '1.6' },
  };
  return map[mode] || map.documentary;
}

// ── Credit check ────────────────────────────────────────────────────────────

async function checkBalance() {
  const key = process.env.PIAPI_KEY;
  if (!key) return null;
  try {
    const res = await axios.get(`${PIAPI_BASE}/user/balance`, {
      headers: { 'x-api-key': key },
      timeout: 10000,
    });
    const balance = res.data?.data?.balance ?? res.data?.balance ?? null;
    console.log('[Kling] Account balance:', JSON.stringify(res.data).slice(0, 300));
    return balance;
  } catch (e) {
    console.warn('[Kling] Balance check mislukt:', e.message);
    return null;
  }
}

// ── API helpers ─────────────────────────────────────────────────────────────

function extractAxiosError(err) {
  if (err.response) {
    return `HTTP ${err.response.status}: ${JSON.stringify(err.response.data).slice(0, 500)}`;
  }
  return err.message;
}

async function createKlingTask(prompt, modelConfig = {}) {
  const key = process.env.PIAPI_KEY;
  if (!key) throw new Error('PIAPI_KEY niet ingesteld in backend/.env');

  const { model = 'kling', version = '1.6' } = modelConfig;

  const body = {
    model,
    task_type: 'video_generation',
    input: {
      prompt,
      negative_prompt: 'text, watermark, logo, blurry, low quality',
      cfg_scale:       0.5,
      duration:        5,
      aspect_ratio:    '9:16',
      mode:            'std',
      ...(version ? { version } : {}),
    },
    config: {
      service_mode: 'public',
    },
  };

  console.log('[Kling] Request body:', JSON.stringify(body));

  const doRequest = async () => axios.post(`${PIAPI_BASE}/task`, body, {
    headers: { 'x-api-key': key, 'Content-Type': 'application/json' },
    timeout: 30000,
  });

  let res;
  try {
    res = await doRequest();
  } catch (err) {
    const detail = extractAxiosError(err);
    console.error('[Kling] Create fout (poging 1):', detail);

    if (err.response?.status >= 500) {
      console.log('[Kling] 500 error — retry over 5s...');
      await new Promise(r => setTimeout(r, 5000));
      try {
        res = await doRequest();
      } catch (err2) {
        throw new Error(`Kling create mislukt na retry: ${extractAxiosError(err2)}`);
      }
    } else {
      throw new Error(`Kling create mislukt: ${detail}`);
    }
  }

  console.log('[Kling] Create response:', JSON.stringify(res.data).slice(0, 500));

  const taskId = res.data?.data?.task_id;
  if (!taskId) throw new Error(`Kling task aanmaken mislukt: ${JSON.stringify(res.data).slice(0, 300)}`);
  return taskId;
}

async function pollKlingTask(taskId) {
  const key = process.env.PIAPI_KEY;

  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));

    let res;
    try {
      res = await axios.get(`${PIAPI_BASE}/task/${taskId}`, {
        headers: { 'x-api-key': key },
        timeout: 15000,
      });
    } catch (err) {
      console.warn(`[Kling] Poll ${i + 1} fout:`, extractAxiosError(err));
      continue;
    }

    const data   = res.data?.data;
    const status = (data?.status || '').toLowerCase();
    console.log(`[Kling] Poll ${i + 1}/${MAX_POLLS} — status: ${status}`);

    if (status === 'completed') {
      console.log('[Kling] Completed output:', JSON.stringify(data?.output).slice(0, 500));
      const videoUrl =
        data?.output?.video_url ||
        data?.output?.video     ||
        data?.output?.works?.[0]?.video?.resource_without_watermark ||
        data?.output?.works?.[0]?.video?.resource ||
        null;
      if (!videoUrl) throw new Error(`Kling klaar maar geen video URL. Output: ${JSON.stringify(data?.output).slice(0, 300)}`);
      return videoUrl;
    }

    if (status === 'failed') {
      throw new Error(`Kling taak mislukt: ${data?.error?.message || JSON.stringify(data?.error) || 'onbekende fout'}`);
    }
  }

  throw new Error('Kling timeout na 5 minuten');
}

async function downloadVideo(url, outputPath) {
  const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 120000 });
  fs.writeFileSync(outputPath, Buffer.from(res.data));
}

// ── Publieke API ────────────────────────────────────────────────────────────

async function generateKlingVideosForScenes(scenes, jobId, outputsDir, onSceneUpdate, mode = 'epic') {
  // Credit check vooraf
  const balance = await checkBalance();
  if (balance !== null && balance <= 0) {
    console.warn('[Kling] Geen credits — gebruik gradient achtergronden als fallback');
    return scenes.map(s => ({ ...s, kling_status: 'skipped_no_credits', background_video_url: null }));
  }

  const bgDir = path.join(outputsDir, 'backgrounds');
  if (!fs.existsSync(bgDir)) fs.mkdirSync(bgDir, { recursive: true });

  const updatedScenes = scenes.map(s => ({ ...s }));

  await Promise.allSettled(
    scenes.map(async (scene, idx) => {
      const outFile     = path.join(bgDir, `${jobId}_scene${idx}.mp4`);
      const prompt      = buildKlingPrompt(scene);
      const modelConfig = selectVideoModel(mode, scene.template);

      onSceneUpdate(idx, { kling_status: 'generating', kling_prompt: prompt, kling_model: modelConfig.model, kling_version: modelConfig.version, kling_progress: 5 });

      try {
        console.log(`[Kling] Scène ${idx}: task aanmaken (model=${modelConfig.model} v${modelConfig.version})...`);
        const taskId = await createKlingTask(prompt, modelConfig);
        onSceneUpdate(idx, { kling_status: 'polling', kling_progress: 20 });

        console.log(`[Kling] Scène ${idx}: polling task ${taskId}...`);
        const videoUrl = await pollKlingTask(taskId);
        onSceneUpdate(idx, { kling_progress: 85 });

        console.log(`[Kling] Scène ${idx}: downloaden...`);
        await downloadVideo(videoUrl, outFile);

        const localUrl = `${SERVER_BASE_URL}/outputs/backgrounds/${jobId}_scene${idx}.mp4`;
        updatedScenes[idx] = { ...updatedScenes[idx], background_video_url: localUrl, kling_status: 'completed', kling_progress: 100, kling_model: modelConfig.model, kling_version: modelConfig.version };
        onSceneUpdate(idx, { kling_status: 'completed', kling_progress: 100, background_video_url: localUrl });
        console.log(`[Kling] Scène ${idx} ✅ klaar`);

      } catch (err) {
        // Fallback naar gradient achtergrond — job mislukt niet
        console.warn(`[Kling] Scène ${idx} mislukt (fallback naar gradient): ${err.message}`);
        updatedScenes[idx] = { ...updatedScenes[idx], kling_status: 'failed', kling_error: err.message, background_video_url: null };
        onSceneUpdate(idx, { kling_status: 'failed', kling_error: err.message, background_video_url: null });
      }
    })
  );

  return updatedScenes;
}

module.exports = { generateKlingVideosForScenes, buildKlingPrompt, checkBalance };
