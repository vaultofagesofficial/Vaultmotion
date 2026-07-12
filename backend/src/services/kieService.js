/**
 * kieService.js
 * Video-achtergronden via kie.ai (Kling 2.6 / Seedance).
 * Zet KIE_API_KEY in backend/.env
 *
 * Create:  POST https://api.kie.ai/api/v1/jobs/createTask
 * Status:  GET  https://api.kie.ai/api/v1/jobs/recordInfo?taskId=...
 */

const axios = require('axios');
const fs    = require('fs');
const path  = require('path');
const sharp = require('sharp');

const { SERVER_BASE_URL } = require('../paths');

const KIE_BASE         = 'https://api.kie.ai/api/v1';
const POLL_INTERVAL_MS = 8000;
const MAX_POLLS        = 90; // max ~12 minuten (Kling kan 8-10 min duren)

// ── Prompt builder ──────────────────────────────────────────────────────────

function buildKlingPrompt(scene, mode = 'epic', styleAnchor = '') {
  const noText = 'no text, no words, no letters, no inscriptions, no signs, no captions';
  const segment = scene.script_segment || '';

  // ── Fallback belichting/stijl (alleen gebruikt als Claude geen lighting_mood geeft) ──
  const fallbackLighting = {
    epic:        'dramatic rim lighting from left, deep shadows, volumetric god rays piercing through smoke, golden-orange atmospheric haze',
    documentary: 'soft golden hour side lighting, natural warm tones, subtle lens flare, realistic ambient occlusion',
    story:       'moody low-key lighting, warm practicals in background, shallow depth of field, soft backlight glow',
  };
  const fallbackBase = {
    epic:        'cinematic dark fantasy style, photorealistic textures, epic atmosphere, smoke and embers drifting',
    documentary: 'cinematic documentary style, photorealistic, natural environment',
    story:       'cinematic narrative style, photorealistic, intimate atmosphere',
  };

  // ── Fallback camera per template (gebruikt als Claude geen camera_style geeft) ──
  const fallbackCamera = {
    cinematic_title: 'slow dolly-in from wide to medium shot, camera tilts slightly upward, rack focus from foreground smoke to distant silhouette',
    ken_burns:       'slow Ken Burns zoom-in with gentle left pan, static wide establishing shot gradually tightening to medium',
    animated_map:    'slow aerial drone push-in from high altitude descending toward terrain, subtle rotation, birds-eye perspective',
    timeline:        'static wide shot slowly panning left to right across vast scene, telephoto compression, slow motion',
    stats_counter:   'extreme wide static shot, slow zoom-out revealing massive scale, drone altitude perspective',
    outro_cta:       'slow pull-back dolly from medium to wide shot, camera stays low angle looking up, hero perspective',
  };

  // ── Subject per template (statische fallback-subjects voor protected templates) ──
  const fallbackSubject = {
    cinematic_title: 'lone warrior silhouette emerging from shadows and smoke, dramatic heroic pose, embers rising around figure',
    timeline:        'epic ancient battlefield panorama at dusk, warriors silhouetted in distance, dust clouds and smoke rolling across plains',
    stats_counter:   'vast crowd of thousands stretching to the horizon, golden particles drifting upward, dramatic aerial perspective',
    outro_cta:       'heroic warrior silhouette standing against burning horizon at sunset, embers and sparks rising into dark sky',
  };

  // ── Adaptieve velden van Claude (primair), fallback als ze ontbreken ──────
  const lightingMood  = scene.lighting_mood  || fallbackLighting[mode]  || fallbackLighting.epic;
  const cameraStyle   = scene.camera_style   || fallbackCamera[scene.template] || 'slow cinematic push-in';
  const baseQuality   = `${fallbackBase[mode] || fallbackBase.epic}, 9:16 vertical format, ultra-detailed 4K`;

  // Subject: visual_focus heeft prioriteit; protected templates vallen terug op hardcoded subject
  const subject = scene.visual_focus || fallbackSubject[scene.template] || segment || 'cinematic atmospheric scene';

  const anchorPrefix = styleAnchor ? `${styleAnchor}, ` : '';
  const prompt = `${anchorPrefix}${subject}, ${cameraStyle}, ${lightingMood}, ${baseQuality}`;

  const needsNoText = ['cinematic_title', 'timeline', 'stats_counter', 'outro_cta'].includes(scene.template);

  return needsNoText
    ? `${prompt}, ${noText}`
    : `${prompt}, no text overlay`;
}

// ── Model selectie ──────────────────────────────────────────────────────────

// Retourneert { model, resolution } op basis van mode + template
// Geverifieerde model-strings via docs.kie.ai (juni 2026):
//   Kling text-to-video : "kling-2.6/text-to-video"
//   Seedance 1.5 Pro    : "bytedance/seedance-1.5-pro"
function selectVideoModel(mode, template) {
  // Personage/sfeer: Kling 2.6 text-to-video
  if (['cinematic_title', 'outro_cta'].includes(template)) {
    return { model: 'kling-2.6/text-to-video', resolution: '720p' };
  }

  // B-roll / landschap: Seedance 1.5 Pro 720p
  if (['ken_burns', 'animated_map', 'timeline'].includes(template)) {
    return { model: 'bytedance/seedance-1.5-pro', resolution: '720p' };
  }

  // Simpele achtergrond: Seedance 1.5 Pro 480p (goedkoopst)
  if (template === 'stats_counter') {
    return { model: 'bytedance/seedance-1.5-pro', resolution: '480p' };
  }

  // Fallback op basis van mode
  const modeMap = {
    epic:        { model: 'kling-2.6/text-to-video',    resolution: '720p' },
    story:       { model: 'bytedance/seedance-1.5-pro', resolution: '720p' },
    documentary: { model: 'bytedance/seedance-1.5-pro', resolution: '720p' },
  };
  return modeMap[mode] || modeMap.documentary;
}

// ── API helpers ─────────────────────────────────────────────────────────────

function authHeader() {
  const key = process.env.KIE_API_KEY;
  if (!key) throw new Error('KIE_API_KEY niet ingesteld in backend/.env');
  return { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
}

function extractError(err) {
  if (err.response) return `HTTP ${err.response.status}: ${JSON.stringify(err.response.data).slice(0, 500)}`;
  return err.message;
}

// ── Credit Shield: saldo-check vóór dure aanroepen ──────────────────────────

// Geschatte credits per bewerking (kie.ai-tarieven, conservatief afgerond)
const CREDIT_COSTS = {
  t2i_grok:        5,   // grok-imagine/text-to-image per beeld
  i2v_kling:      70,   // kling-2.6 image/text-to-video 5s std 720p
  t2v_seedance720: 30,  // bytedance/seedance-1.5-pro 5s 720p
  t2v_seedance480: 15,  // bytedance/seedance-1.5-pro 5s 480p
};

/**
 * Haalt het actuele creditsaldo op bij kie.ai.
 * Retourneert null als de check niet lukt (dan blokkeert Credit Shield niets).
 */
async function getCreditBalance() {
  if (!process.env.KIE_API_KEY) return null;
  try {
    const res = await axios.get('https://api.kie.ai/api/v1/chat/credit', {
      headers: authHeader(),
      timeout: 10000,
    });
    const credits = res.data?.data;
    if (typeof credits === 'number') return credits;
    if (typeof credits?.credits === 'number') return credits.credits;
    return null;
  } catch (err) {
    console.warn('[CreditShield] Saldo-check mislukt:', extractError(err));
    return null;
  }
}

// ── Ankerbeeld generatie via kie.ai text-to-image (met Pexels als fallback) ──

async function generateAnchorImage(styleAnchor, jobId, outputsDir) {
  const prompt = `${styleAnchor}, main character full body portrait on neutral dark background, character reference sheet, photorealistic, cinematic lighting`;

  try {
    console.log(`[KIE] Ankerbeeld via grok-imagine/text-to-image...`);
    const cdnUrl = await generateImageForScene(prompt, 'grok-imagine/text-to-image');

    // Download en schaal lokaal op voor persistentie
    if (jobId && outputsDir) {
      const bgDir = path.join(outputsDir, 'backgrounds');
      if (!fs.existsSync(bgDir)) fs.mkdirSync(bgDir, { recursive: true });
      const outFile = path.join(bgDir, `${jobId}_anchor.jpg`);
      await downloadVideo(cdnUrl, outFile);
      await sharp(outFile)
        .resize(1080, 1920, { fit: 'cover', position: 'center' })
        .jpeg({ quality: 92 })
        .toFile(outFile + '.tmp.jpg');
      fs.renameSync(outFile + '.tmp.jpg', outFile);
      const fileSize = fs.statSync(outFile).size;
      console.log(`[KIE] Ankerbeeld opgeslagen en geschaald 1080×1920: ${outFile} (${Math.round(fileSize / 1024)}KB)`);
    }

    console.log(`[KIE] Ankerbeeld klaar via grok-imagine: ${cdnUrl}`);
    return cdnUrl; // CDN-URL voor kling image-to-video input
  } catch (err) {
    console.warn(`[KIE] grok-imagine/text-to-image mislukt (${err.message}) — fallback naar Pexels`);
    return await generateAnchorImagePexels(styleAnchor);
  }
}

// ── Character sheet: 3 hoeken van hetzelfde personage (Regisseur-modus) ──────
// Professionele film/animatie-pipelines gebruiken een multi-hoek character
// sheet i.p.v. één los ankerbeeld. grok-imagine via kie.ai heeft geen seed-
// parameter; consistentie komt van de identieke, zeer gedetailleerde
// styleAnchor (uniquenessService genereert al hyper-specifieke personages:
// littekens, kledingdetails, props) + expliciete "same exact character"-
// framing per hoek. Kosten: 3 × t2i_grok = ~15 credits per video.
const CHARACTER_SHEET_ANGLES = [
  { key: 'front',   prompt: 'front-facing portrait, looking directly at camera, head and shoulders centered' },
  { key: 'quarter', prompt: 'three-quarter angle view, body turned 45 degrees, face clearly visible' },
  { key: 'profile', prompt: 'full side profile view, facing left, silhouette edge clearly defined' },
];

async function generateCharacterSheet(styleAnchor, topic, jobId, outputsDir) {
  const bgDir = path.join(outputsDir, 'backgrounds');
  if (!fs.existsSync(bgDir)) fs.mkdirSync(bgDir, { recursive: true });

  const base = `${styleAnchor}, character reference sheet of the same exact character, identical face, identical clothing, identical props, neutral dark studio background, photorealistic, cinematic lighting, subject: ${topic}`;

  const results = await Promise.allSettled(CHARACTER_SHEET_ANGLES.map(async angle => {
    const cdnUrl = await generateImageForScene(`${base}, ${angle.prompt}`, 'grok-imagine/text-to-image');
    // lokaal bewaren voor UI/debug
    const outFile = path.join(bgDir, `${jobId}_charsheet_${angle.key}.jpg`);
    try {
      await downloadVideo(cdnUrl, outFile);
      await sharp(outFile).resize(1080, 1920, { fit: 'cover', position: 'center' }).jpeg({ quality: 92 }).toFile(outFile + '.tmp.jpg');
      fs.renameSync(outFile + '.tmp.jpg', outFile);
    } catch (e) { console.warn(`[CharSheet] lokaal opslaan ${angle.key} mislukt: ${e.message}`); }
    return { key: angle.key, cdnUrl, localUrl: `${SERVER_BASE_URL}/outputs/backgrounds/${path.basename(outFile)}` };
  }));

  const sheet = {};
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') sheet[CHARACTER_SHEET_ANGLES[i].key] = r.value;
    else console.warn(`[CharSheet] hoek ${CHARACTER_SHEET_ANGLES[i].key} mislukt: ${r.reason?.message}`);
  });

  if (!sheet.front) throw new Error('Character sheet: front-hoek mislukt — geen bruikbare referentie');

  // Composiet (3 hoeken naast elkaar) lokaal via sharp — gratis, voor UI en
  // als mogelijke sterkere single-reference (multi-ref-uitkomst bepaalt gebruik)
  try {
    const angleFiles = CHARACTER_SHEET_ANGLES
      .map(a => path.join(bgDir, `${jobId}_charsheet_${a.key}.jpg`))
      .filter(f => fs.existsSync(f));
    if (angleFiles.length >= 2) {
      const thumbs = await Promise.all(angleFiles.map(f => sharp(f).resize(360, 640, { fit: 'cover' }).toBuffer()));
      const compositeFile = path.join(bgDir, `${jobId}_charsheet_composite.jpg`);
      await sharp({ create: { width: 360 * thumbs.length, height: 640, channels: 3, background: '#111111' } })
        .composite(thumbs.map((buf, i) => ({ input: buf, left: i * 360, top: 0 })))
        .jpeg({ quality: 92 })
        .toFile(compositeFile);
      sheet.composite = { localUrl: `${SERVER_BASE_URL}/outputs/backgrounds/${path.basename(compositeFile)}` };
      console.log(`[CharSheet] Composiet opgeslagen: ${compositeFile} (${Math.round(fs.statSync(compositeFile).size / 1024)}KB)`);
    }
  } catch (e) { console.warn(`[CharSheet] composiet mislukt (niet-blokkerend): ${e.message}`); }

  console.log(`[CharSheet] Klaar: ${Object.keys(sheet).join(', ')}`);
  return sheet; // { front: {cdnUrl, localUrl}, quarter?, profile?, composite? }
}

// Multi-image-reference probe: proberen 2+ image_urls mee te geven aan
// kling-2.6/image-to-video. Bij afwijzing valideert kie.ai vóór creditverbruik
// (createTask-fout kost niets). Resultaat wordt per proces gecachet.
let multiRefSupport = null; // null = onbekend, true/false na eerste echte poging
function getMultiRefSupport() { return multiRefSupport; }
function setMultiRefSupport(v) { multiRefSupport = v; }

async function generateAnchorImagePexels(styleAnchor) {
  const pexelsKey = process.env.PEXELS_API_KEY;
  if (!pexelsKey) throw new Error('PEXELS_API_KEY niet ingesteld — Pexels-fallback niet mogelijk');

  const query = styleAnchor
    .replace(/,.*$/m, '')
    .replace(/[^a-zA-Z\s]/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 5)
    .join(' ');

  console.log(`[KIE] Ankerbeeld via Pexels (fallback): zoekterm="${query}"`);
  const res = await axios.get('https://api.pexels.com/v1/search', {
    params: { query, per_page: 5, orientation: 'portrait' },
    headers: { Authorization: pexelsKey },
    timeout: 10000,
  });

  const photos = res.data?.photos;
  if (!photos || photos.length === 0) throw new Error(`Pexels: geen foto's voor "${query}"`);

  const photo    = photos.find(p => p.height > p.width) || photos[0];
  const imageUrl = photo.src?.large2x || photo.src?.large || photo.src?.original;
  if (!imageUrl) throw new Error('Pexels: geen bruikbare URL in resultaat');

  console.log(`[KIE] Ankerbeeld klaar via Pexels fallback: ${imageUrl}`);
  return imageUrl;
}

// ── Text-to-image helper ────────────────────────────────────────────────────

async function generateImageForScene(prompt, model = 'grok-imagine/text-to-image', aspectRatio = '9:16') {
  const body = {
    model,
    callBackUrl: '',
    input: { prompt: prompt.slice(0, 2000), aspect_ratio: aspectRatio },
  };

  console.log('[KIE] T2I Create request:', JSON.stringify(body).slice(0, 200));

  const res = await axios.post(`${KIE_BASE}/jobs/createTask`, body, {
    headers: authHeader(),
    timeout: 30000,
  });

  console.log('[KIE] T2I Create response:', JSON.stringify(res.data).slice(0, 300));

  const taskId = res.data?.data?.taskId;
  if (!taskId) throw new Error(`KIE T2I task aanmaken mislukt: ${JSON.stringify(res.data).slice(0, 300)}`);

  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 8000));
    let result;
    try { result = await checkVideoStatus(taskId); }
    catch (e) { console.warn(`[KIE] T2I poll ${i + 1} fout:`, e.message); continue; }
    console.log(`[KIE] T2I poll ${i + 1}/30 — status: ${result.status}`);
    if (result.status === 'success') return result.videoUrl;
    if (result.status === 'fail') throw new Error(`KIE T2I mislukt: ${result.failMsg}`);
  }
  throw new Error('KIE T2I timeout');
}

// ── Create task ─────────────────────────────────────────────────────────────

async function createVideoTask(prompt, model, resolution = '720p', startImageUrl = null) {
  const isSeedance = model.startsWith('bytedance/');

  // Variant A: image-to-video wanneer startImageUrl beschikbaar is
  // kling-2.6/image-to-video vereist image_urls als ARRAY (niet string) — gevalideerd juni 2026
  // bytedance/seedance-1.5-pro ondersteunt start_image_url (string) voor image-to-video
  let effectiveModel = model;
  if (startImageUrl && model === 'kling-2.6/text-to-video') {
    effectiveModel = 'kling-2.6/image-to-video';
  }

  // Seedance: duration als number (4-12), generate_audio i.p.v. sound, geen resolution in Kling-stijl
  // Kling:   duration als string ("5"), sound boolean, geen resolution parameter
  const input = isSeedance
    ? { prompt: prompt.slice(0, 1000), aspect_ratio: '9:16', duration: 5, resolution, generate_audio: false }
    : { prompt: prompt.slice(0, 1000), aspect_ratio: '9:16', duration: '5', sound: false, mode: 'std' };

  // image-to-video parameters toevoegen
  // startImageUrl mag een string zijn of een array (multi-reference probe voor
  // Regisseur-modus). Kling accepteert image_urls als array; of >1 element
  // daadwerkelijk als extra referentie gebruikt wordt is de multiRefSupport-probe.
  if (startImageUrl) {
    const urls = Array.isArray(startImageUrl) ? startImageUrl : [startImageUrl];
    if (effectiveModel === 'kling-2.6/image-to-video') {
      input.image_urls = urls; // array vereist — string geeft "This field is required"
    } else if (isSeedance) {
      input.start_image_url = urls[0]; // Seedance ondersteunt enkel single start frame
    }
  }

  const body = {
    model: effectiveModel,
    callBackUrl: '',
    input,
  };

  console.log('[KIE] Create request:', JSON.stringify(body));

  const res = await axios.post(`${KIE_BASE}/jobs/createTask`, body, {
    headers: authHeader(),
    timeout: 30000,
  });

  console.log('[KIE] Create response:', JSON.stringify(res.data).slice(0, 500));

  const taskId = res.data?.data?.taskId;
  if (!taskId) throw new Error(`KIE task aanmaken mislukt: ${JSON.stringify(res.data).slice(0, 300)}`);
  return taskId;
}

// ── Poll task ───────────────────────────────────────────────────────────────

async function checkVideoStatus(taskId) {
  const res = await axios.get(`${KIE_BASE}/jobs/recordInfo`, {
    params:  { taskId },
    headers: authHeader(),
    timeout: 15000,
  });

  const data   = res.data?.data;
  const state  = (data?.state || '').toLowerCase();

  // resultJson is een JSON-string met { resultUrls: [...] }
  let videoUrl = null;
  if (state === 'success' && data?.resultJson) {
    try {
      const result = JSON.parse(data.resultJson);
      videoUrl = result?.resultUrls?.[0] || null;
    } catch {}
  }

  return {
    status:   state,   // 'waiting' | 'queuing' | 'generating' | 'success' | 'fail'
    videoUrl,
    progress: data?.progress ?? null,
    failMsg:  data?.failMsg  || null,
  };
}

// ── Download ────────────────────────────────────────────────────────────────

async function downloadVideo(url, outputPath) {
  const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 120000 });
  fs.writeFileSync(outputPath, Buffer.from(res.data));
}

// ── Hoofd export: genereer video's voor alle scènes ─────────────────────────

// Illustratie-substijlen voor render_style='illustrated' — enkel T2I, geen I2V.
// Elke substijl heeft een eigen prompt-suffix met kleurenpalet-instructie.
const ILLUSTRATION_STYLES = {
  flat: {
    label: 'Flat Design',
    suffix: 'flat 2D vector illustration, bold geometric shapes, vibrant saturated color palette, clean thick outlines, animated explainer video style, simple minimalist background, no photorealism',
  },
  storybook: {
    label: 'Storybook',
    suffix: 'soft watercolor storybook illustration, gentle warm pastel color palette, hand-painted texture, whimsical picture book art style, soft rounded edges, no photorealism',
  },
  motion: {
    label: 'Motion Graphics',
    suffix: 'modern motion graphics illustration, clean geometric shapes, corporate explainer video aesthetic, duotone gradient color palette with one accent color, isometric perspective, minimal flat design, no photorealism',
  },
};

// Templates die een ankerbeeld gebruiken (image-to-video via Kling)
const ANCHOR_TEMPLATES = new Set(['cinematic_title', 'outro_cta']);

// Templates die code-only zijn — geen kie.ai aanroep nodig
const SKIP_KIE_TEMPLATES = new Set(['fact_animation', 'stats_counter', 'data_comparison']);

async function generateKlingVideosForScenes(scenes, jobId, outputsDir, onSceneUpdate, mode = 'epic', styleAnchor = '', renderStyle = 'ai-cinematic', illustrationStyle = 'flat') {
  if (renderStyle === '2d') {
    console.log(`[KIE] render_style=2d — kie.ai overgeslagen voor job ${jobId}`);
    return { scenes, anchorImageUrl: null };
  }

  if (renderStyle === 'illustrated') {
    // Geïllustreerd: enkel T2I per scène (geen I2V) — Ken Burns doet de beweging in Remotion.
    const sub = ILLUSTRATION_STYLES[illustrationStyle] || ILLUSTRATION_STYLES.flat;
    console.log(`[KIE] render_style=illustrated (${sub.label}) — enkel T2I, geen I2V`);
    const updatedIll = scenes.map(s => ({ ...s }));
    const bgDir = path.join(outputsDir, 'backgrounds');
    if (!fs.existsSync(bgDir)) fs.mkdirSync(bgDir, { recursive: true });
    const noText = 'no text, no words, no letters, no inscriptions, no signs';

    await Promise.allSettled(scenes.map(async (scene, idx) => {
      if (SKIP_KIE_TEMPLATES.has(scene.template)) {
        updatedIll[idx] = { ...updatedIll[idx], kling_status: 'skipped', background_image_url: null };
        onSceneUpdate(idx, { kling_status: 'skipped', background_image_url: null });
        return;
      }
      const subject = scene.visual_focus || scene.script_segment || '';
      const prompt = `${subject}, ${sub.suffix}, 9:16 vertical composition, ${noText}`;
      onSceneUpdate(idx, { kling_status: 'generating', kling_prompt: prompt, kling_model: 'grok-imagine/text-to-image', kling_progress: 5 });
      try {
        const imageUrl = await generateImageForScene(prompt.slice(0, 2000));
        const outFile  = path.join(bgDir, `${jobId}_scene${idx}.jpg`);
        await downloadVideo(imageUrl, outFile);
        // Pre-schaal naar compositieresolutie zodat Ken Burns vloeiend blijft (zelfde fix als ai-image)
        await sharp(outFile)
          .resize(1080, 1920, { fit: 'cover', position: 'center' })
          .jpeg({ quality: 92 })
          .toFile(outFile + '.tmp.jpg');
        fs.renameSync(outFile + '.tmp.jpg', outFile);
        const localUrl = `${SERVER_BASE_URL}/outputs/backgrounds/${jobId}_scene${idx}.jpg`;
        updatedIll[idx] = { ...updatedIll[idx], background_image_url: localUrl, kling_status: 'completed', kling_progress: 100 };
        onSceneUpdate(idx, { kling_status: 'completed', kling_progress: 100, background_image_url: localUrl });
        console.log(`[KIE] Illustratie scène ${idx} ✅ (${sub.label})`);
      } catch (err) {
        console.warn(`[KIE] Illustratie scène ${idx} mislukt: ${err.message}`);
        updatedIll[idx] = { ...updatedIll[idx], kling_status: 'failed', kling_error: err.message, background_image_url: null };
        onSceneUpdate(idx, { kling_status: 'failed', kling_error: err.message, background_image_url: null });
      }
    }));

    return { scenes: updatedIll, anchorImageUrl: null };
  }

  if (renderStyle === 'ai-image') {
    console.log(`[KIE] render_style=ai-image — stilstaande beelden via qwen2/text-to-image`);
    const updatedAiImg = scenes.map(s => ({ ...s }));
    const bgDir = path.join(outputsDir, 'backgrounds');
    if (!fs.existsSync(bgDir)) fs.mkdirSync(bgDir, { recursive: true });

    await Promise.allSettled(scenes.map(async (scene, idx) => {
      if (SKIP_KIE_TEMPLATES.has(scene.template)) {
        console.log(`[KIE] AI-beeld scène ${idx} (${scene.template}): overgeslagen — code-only`);
        updatedAiImg[idx] = { ...updatedAiImg[idx], kling_status: 'skipped', background_image_url: null };
        onSceneUpdate(idx, { kling_status: 'skipped', background_image_url: null });
        return;
      }

      const prompt = buildKlingPrompt(scene, mode, styleAnchor);
      onSceneUpdate(idx, { kling_status: 'generating', kling_prompt: prompt, kling_model: 'qwen2/text-to-image', kling_progress: 5 });

      try {
        const imageUrl = await generateImageForScene(prompt);
        const outFile  = path.join(bgDir, `${jobId}_scene${idx}.jpg`);
        await downloadVideo(imageUrl, outFile);
        // Pre-schaal naar compositieresolutie (1080×1920) zodat Chromium geen CSS-upscaling nodig heeft
        await sharp(outFile)
          .resize(1080, 1920, { fit: 'cover', position: 'center' })
          .jpeg({ quality: 92 })
          .toFile(outFile + '.tmp.jpg');
        fs.renameSync(outFile + '.tmp.jpg', outFile);
        console.log(`[KIE] AI-beeld scène ${idx}: pre-geschaald naar 1080×1920`);
        const localUrl = `${SERVER_BASE_URL}/outputs/backgrounds/${jobId}_scene${idx}.jpg`;
        updatedAiImg[idx] = { ...updatedAiImg[idx], background_image_url: localUrl, kling_status: 'completed', kling_progress: 100 };
        onSceneUpdate(idx, { kling_status: 'completed', kling_progress: 100, background_image_url: localUrl });
        console.log(`[KIE] AI-beeld scène ${idx} ✅ ${localUrl}`);
      } catch (err) {
        console.warn(`[KIE] AI-beeld scène ${idx} mislukt: ${err.message}`);
        updatedAiImg[idx] = { ...updatedAiImg[idx], kling_status: 'failed', kling_error: err.message, background_image_url: null };
        onSceneUpdate(idx, { kling_status: 'failed', kling_error: err.message, background_image_url: null });
      }
    }));

    return { scenes: updatedAiImg, anchorImageUrl: null };
  }

  const bgDir = path.join(outputsDir, 'backgrounds');
  if (!fs.existsSync(bgDir)) fs.mkdirSync(bgDir, { recursive: true });

  const updatedScenes = scenes.map(s => ({ ...s }));

  // ── REGISSEUR-MODUS ────────────────────────────────────────────────────────
  // Character sheet (3 hoeken) + per scène een eigen T2I-startframe met het
  // vaste personage, daarna image-to-video. cinematic_title gebruikt Kling 2.6
  // met multi-reference-probe [scèneframe, front-referentie]; overige scènes
  // Seedance 1.5 Pro i2v (30cr/scène 720p — betaalbaarder dan Kling's 70cr).
  if (renderStyle === 'director') {
    const cheap = process.env.DIRECTOR_TEST_CHEAP === '1'; // testmodus: alles Seedance 480p
    console.log(`[Director] Regisseur-modus start (cheap=${cheap}) — character sheet genereren...`);

    let sheet = null;
    try {
      sheet = await generateCharacterSheet(styleAnchor, scenes[0]?.content?.title || '', jobId, outputsDir);
    } catch (err) {
      console.warn(`[Director] Character sheet mislukt (${err.message}) — fallback naar los ankerbeeld`);
    }
    const frontRef = sheet?.front?.cdnUrl || null;

    async function directorScene(scene, idx) {
      const outFile = path.join(bgDir, `${jobId}_scene${idx}.mp4`);
      const noText  = 'no text, no words, no letters, no inscriptions';
      // Startframe: zelfde personage, scène-specifieke regie (emotie/gebaar/blik uit visual_focus)
      const framePrompt = `${styleAnchor}, the same exact character as established, ${scene.visual_focus || scene.script_segment || ''}, ${scene.lighting_mood || 'cinematic lighting'}, photorealistic film still, 9:16 vertical, ${noText}`;
      const isTitle = scene.template === 'cinematic_title';
      const useKlingHere = isTitle && !cheap;
      const model = useKlingHere ? 'kling-2.6/text-to-video' : 'bytedance/seedance-1.5-pro';
      const resolution = cheap ? '480p' : '720p';

      onSceneUpdate(idx, { kling_status: 'generating', kling_prompt: framePrompt.slice(0, 300), kling_model: model, kling_progress: 5, director_mode: true });
      try {
        console.log(`[Director] Scène ${idx}: startframe via grok-imagine...`);
        const sceneFrameUrl = await generateImageForScene(framePrompt.slice(0, 2000), 'grok-imagine/text-to-image');

        // Multi-reference probe: enkel op Kling, enkel als front-referentie bestaat
        let imageInput = sceneFrameUrl;
        if (useKlingHere && frontRef && multiRefSupport !== false) {
          imageInput = [sceneFrameUrl, frontRef];
        }

        const videoPrompt = `${scene.visual_focus || ''}, ${scene.camera_style || 'slow cinematic camera movement'}, ${noText}`;
        let taskId;
        try {
          taskId = await createVideoTask(videoPrompt.slice(0, 1000), model, resolution, imageInput);
          if (Array.isArray(imageInput) && imageInput.length > 1) {
            multiRefSupport = true;
            console.log('[Director] ✅ Multi-image-reference GEACCEPTEERD door kling-2.6/image-to-video');
          }
        } catch (err) {
          if (Array.isArray(imageInput) && imageInput.length > 1) {
            multiRefSupport = false;
            console.warn(`[Director] Multi-ref AFGEWEZEN (${err.message.slice(0, 150)}) — retry met enkel scèneframe`);
            taskId = await createVideoTask(videoPrompt.slice(0, 1000), model, resolution, sceneFrameUrl);
          } else throw err;
        }

        onSceneUpdate(idx, { kling_status: 'polling', kling_progress: 15, kling_task_id: taskId });
        let videoUrl = null;
        for (let i = 0; i < MAX_POLLS; i++) {
          await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
          let result;
          try { result = await checkVideoStatus(taskId); } catch (e) { continue; }
          onSceneUpdate(idx, { kling_progress: Math.min(15 + Math.round(result.progress ?? (i / MAX_POLLS * 70)), 85) });
          if (result.status === 'success') { videoUrl = result.videoUrl; break; }
          if (result.status === 'fail') throw new Error(`KIE taak mislukt: ${result.failMsg || 'onbekend'}`);
        }
        if (!videoUrl) throw new Error('KIE timeout');

        await downloadVideo(videoUrl, outFile);
        const localUrl = `${SERVER_BASE_URL}/outputs/backgrounds/${path.basename(outFile)}`;
        updatedScenes[idx] = { ...updatedScenes[idx], background_video_url: localUrl, kling_status: 'completed', kling_progress: 100, kling_model: model, director_frame_url: sceneFrameUrl };
        onSceneUpdate(idx, { kling_status: 'completed', kling_progress: 100, background_video_url: localUrl });
        console.log(`[Director] Scène ${idx} ✅ (${model} ${resolution})`);
      } catch (err) {
        console.warn(`[Director] Scène ${idx} mislukt: ${err.message}`);
        updatedScenes[idx] = { ...updatedScenes[idx], kling_status: 'failed', kling_error: err.message, background_video_url: null };
        onSceneUpdate(idx, { kling_status: 'failed', kling_error: err.message, background_video_url: null });
      }
    }

    // Code-only templates overslaan; fact/stats krijgen zoals bij ai-cinematic een stilstaand beeld
    await Promise.allSettled(scenes.map((scene, idx) => {
      if (SKIP_KIE_TEMPLATES.has(scene.template)) {
        updatedScenes[idx] = { ...updatedScenes[idx], kling_status: 'skipped', background_video_url: null };
        onSceneUpdate(idx, { kling_status: 'skipped' });
        return null;
      }
      return directorScene(scene, idx);
    }).filter(Boolean));

    return { scenes: updatedScenes, anchorImageUrl: frontRef, characterSheet: sheet, multiRefSupported: multiRefSupport };
  }

  // ── Render helper (één scène) ──────────────────────────────────────────────
  async function renderScene(scene, idx, startImageUrl = null) {
    const outFile              = path.join(bgDir, `${jobId}_scene${idx}.mp4`);
    const prompt               = buildKlingPrompt(scene, mode, styleAnchor);
    const { model, resolution } = selectVideoModel(mode, scene.template);

    onSceneUpdate(idx, {
      kling_status: 'generating', kling_prompt: prompt,
      kling_model: model, kling_resolution: resolution, kling_progress: 5,
      ...(startImageUrl ? { kling_anchor_used: true } : {}),
    });

    try {
      console.log(`[KIE] Scène ${idx} (${scene.template}): task aanmaken (model=${model}${startImageUrl ? ' image-to-video' : ''}, res=${resolution})...`);
      const taskId = await createVideoTask(prompt, model, resolution, startImageUrl);
      onSceneUpdate(idx, { kling_status: 'polling', kling_progress: 15, kling_task_id: taskId });
      console.log(`[KIE] Scène ${idx}: polling task ${taskId}...`);

      let videoUrl = null;
      for (let i = 0; i < MAX_POLLS; i++) {
        await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
        let result;
        try { result = await checkVideoStatus(taskId); }
        catch (pollErr) { console.warn(`[KIE] Poll ${i + 1} fout:`, extractError(pollErr)); continue; }

        const progress = 15 + Math.round((result.progress ?? (i / MAX_POLLS * 70)));
        console.log(`[KIE] Poll ${i + 1}/${MAX_POLLS} — status: ${result.status}, progress: ${result.progress ?? '?'}%`);
        onSceneUpdate(idx, { kling_progress: Math.min(progress, 85) });

        if (result.status === 'success') { videoUrl = result.videoUrl; break; }
        if (result.status === 'fail') throw new Error(`KIE taak mislukt: ${result.failMsg || 'onbekende fout'}`);
      }

      if (!videoUrl) throw new Error('KIE timeout: geen video URL na maximale wachttijd');

      console.log(`[KIE] Scène ${idx}: downloaden...`);
      await downloadVideo(videoUrl, outFile);

      const localUrl = `${SERVER_BASE_URL}/outputs/backgrounds/${jobId}_scene${idx}.mp4`;
      updatedScenes[idx] = { ...updatedScenes[idx], background_video_url: localUrl, kling_status: 'completed', kling_progress: 100, kling_model: model };
      onSceneUpdate(idx, { kling_status: 'completed', kling_progress: 100, background_video_url: localUrl });
      console.log(`[KIE] Scène ${idx} ✅ klaar`);

    } catch (err) {
      console.warn(`[KIE] Scène ${idx} mislukt (fallback naar gradient): ${err.message}`);
      updatedScenes[idx] = { ...updatedScenes[idx], kling_status: 'failed', kling_error: err.message, background_video_url: null };
      onSceneUpdate(idx, { kling_status: 'failed', kling_error: err.message, background_video_url: null });
    }
  }

  // ── Strategie: anker-scènes (cinematic_title/outro_cta) wachten op ankerbeeld;
  //              alle andere scènes starten direct parallel zonder te wachten ──

  const hasAnchorScenes  = scenes.some(s => ANCHOR_TEMPLATES.has(s.template));
  const anchorStart      = Date.now();

  // Ankerbeeld generatie start gelijktijdig met de non-anchor scènes
  const anchorImagePromise = (styleAnchor && hasAnchorScenes)
    ? generateAnchorImage(styleAnchor, jobId, outputsDir).catch(err => {
        console.warn('[KIE] Ankerbeeld mislukt, fallback naar text-to-video:', err.message);
        return null;
      })
    : Promise.resolve(null);

  // fact_animation krijgt bij ai-cinematic een stilstaand achtergrondbeeld via grok-imagine
  async function renderFactAnimBg(scene, idx) {
    const prompt = `${styleAnchor}, ${scene.visual_focus || 'dramatic cinematic background'}, no people, no text, atmospheric epic mood`;
    try {
      console.log(`[KIE] fact_animation scène ${idx}: achtergrond via grok-imagine...`);
      const imageUrl = await generateImageForScene(prompt, 'grok-imagine/text-to-image');
      const outFile  = path.join(bgDir, `${jobId}_scene${idx}.jpg`);
      await downloadVideo(imageUrl, outFile);
      await sharp(outFile).resize(1080, 1920, { fit: 'cover', position: 'center' }).jpeg({ quality: 92 }).toFile(outFile + '.tmp.jpg');
      fs.renameSync(outFile + '.tmp.jpg', outFile);
      const localUrl = `${SERVER_BASE_URL}/outputs/backgrounds/${jobId}_scene${idx}.jpg`;
      updatedScenes[idx] = { ...updatedScenes[idx], background_image_url: localUrl, kling_status: 'completed' };
      onSceneUpdate(idx, { background_image_url: localUrl, kling_status: 'completed' });
      console.log(`[KIE] fact_animation scène ${idx} achtergrond ✅ ${localUrl}`);
    } catch (err) {
      console.warn(`[KIE] fact_animation scène ${idx} achtergrond mislukt: ${err.message}`);
      updatedScenes[idx] = { ...updatedScenes[idx], kling_status: 'skipped' };
      onSceneUpdate(idx, { kling_status: 'skipped' });
    }
  }

  // data_comparison is code-only — geen achtergrond nodig
  // stats_counter krijgt een stilstaand achtergrondbeeld (net als fact_animation)
  const CINEMATIC_SKIP = new Set(['data_comparison']);
  scenes.forEach((scene, idx) => {
    if (CINEMATIC_SKIP.has(scene.template)) {
      console.log(`[KIE] Scène ${idx} (${scene.template}): overgeslagen — code-only template`);
      updatedScenes[idx] = { ...updatedScenes[idx], kling_status: 'skipped', background_video_url: null };
      onSceneUpdate(idx, { kling_status: 'skipped', background_video_url: null });
    }
  });

  async function renderStatCounterBg(scene, idx) {
    const prompt = `${styleAnchor}, ${scene.visual_focus || 'dramatic cinematic background'}, no people, no text, atmospheric mood, wide establishing shot`;
    try {
      console.log(`[KIE] stats_counter scène ${idx}: achtergrond via grok-imagine...`);
      const imageUrl = await generateImageForScene(prompt, 'grok-imagine/text-to-image');
      const outFile  = path.join(bgDir, `${jobId}_scene${idx}.jpg`);
      await downloadVideo(imageUrl, outFile);
      await sharp(outFile).resize(1080, 1920, { fit: 'cover', position: 'center' }).jpeg({ quality: 92 }).toFile(outFile + '.tmp.jpg');
      fs.renameSync(outFile + '.tmp.jpg', outFile);
      const localUrl = `${SERVER_BASE_URL}/outputs/backgrounds/${jobId}_scene${idx}.jpg`;
      updatedScenes[idx] = { ...updatedScenes[idx], background_image_url: localUrl, kling_status: 'completed' };
      onSceneUpdate(idx, { background_image_url: localUrl, kling_status: 'completed' });
      console.log(`[KIE] stats_counter scène ${idx} achtergrond ✅ ${localUrl}`);
    } catch (err) {
      console.warn(`[KIE] stats_counter scène ${idx} achtergrond mislukt: ${err.message}`);
      updatedScenes[idx] = { ...updatedScenes[idx], kling_status: 'skipped' };
      onSceneUpdate(idx, { kling_status: 'skipped' });
    }
  }

  // Non-anchor scènes: direct starten, geen wachttijd
  const nonAnchorWork = Promise.allSettled(
    scenes
      .map((scene, idx) => {
        if (ANCHOR_TEMPLATES.has(scene.template) || CINEMATIC_SKIP.has(scene.template)) return null;
        if (scene.template === 'fact_animation') return renderFactAnimBg(scene, idx);
        if (scene.template === 'stats_counter') return renderStatCounterBg(scene, idx);
        return renderScene(scene, idx, null);
      })
      .filter(Boolean)
  );

  // Anker-scènes: starten zodra ankerbeeld beschikbaar is
  let resolvedAnchorUrl = null;
  const anchorWork = anchorImagePromise.then(anchorImageUrl => {
    resolvedAnchorUrl = anchorImageUrl;
    const elapsed = Math.round((Date.now() - anchorStart) / 1000);
    console.log(`[KIE] Ankerbeeld ${anchorImageUrl ? `beschikbaar na ${elapsed}s` : 'niet beschikbaar'} — cinematic_title/outro_cta starten`);
    return Promise.allSettled(
      scenes
        .map((scene, idx) => ANCHOR_TEMPLATES.has(scene.template) ? renderScene(scene, idx, anchorImageUrl) : null)
        .filter(Boolean)
    );
  });

  await Promise.all([nonAnchorWork, anchorWork]);
  return { scenes: updatedScenes, anchorImageUrl: resolvedAnchorUrl };
}

// ── Simple scene generator — text-to-image → image-to-video ─────────────────

async function generateSimpleScene(visualFocus, styleAnchor, jobId, outputsDir, sceneIdx) {
  const noText = 'no text, no words, no letters, no inscriptions, no signs';
  const prompt = styleAnchor
    ? `${styleAnchor}, ${visualFocus}, cinematic 9:16 vertical, photorealistic 4K, ${noText}`
    : `${visualFocus}, cinematic 9:16 vertical, photorealistic 4K, ${noText}`;

  console.log(`[SimpleScene ${sceneIdx}] T2I: ${prompt.slice(0, 120)}...`);

  // Stap 1: text-to-image — retourneer null bij 402 (credits op) voor TextFocus2D-fallback
  let imageUrl;
  try {
    imageUrl = await generateImageForScene(prompt.slice(0, 2000), 'grok-imagine/text-to-image');
  } catch (err) {
    const is402 = err.message?.includes('402') || err.message?.includes('Credits insufficient') || err.message?.includes('insufficient');
    if (is402) {
      console.warn(`[SimpleScene ${sceneIdx}] KIE credits op (402) — TextFocus2D-fallback`);
      return null; // caller zet template op 'text_focus_2d'
    }
    throw new Error(`SimpleScene T2I mislukt: ${err.message}`);
  }

  console.log(`[SimpleScene ${sceneIdx}] T2I klaar: ${imageUrl.slice(0, 80)}...`);

  // Stap 2: image-to-video (kling-2.6/image-to-video)
  const videoPrompt = `${visualFocus}, slow cinematic camera movement, ${noText}`;
  const taskId = await createVideoTask(videoPrompt.slice(0, 1000), 'kling-2.6/text-to-video', '720p', imageUrl);

  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    let result;
    try { result = await checkVideoStatus(taskId); }
    catch (e) { console.warn(`[SimpleScene ${sceneIdx}] poll ${i + 1} fout:`, e.message); continue; }
    console.log(`[SimpleScene ${sceneIdx}] I2V poll ${i + 1} — status: ${result.status}`);
    if (result.status === 'success') {
      // Download lokaal
      const bgDir = path.join(outputsDir, 'backgrounds');
      if (!fs.existsSync(bgDir)) fs.mkdirSync(bgDir, { recursive: true });
      const outFile = path.join(bgDir, `${jobId}_simple_scene${sceneIdx}.mp4`);
      await downloadVideo(result.videoUrl, outFile);
      const localUrl = `${SERVER_BASE_URL}/outputs/backgrounds/${path.basename(outFile)}`;
      console.log(`[SimpleScene ${sceneIdx}] I2V klaar: ${localUrl}`);
      return localUrl;
    }
    if (result.status === 'fail') throw new Error(`SimpleScene I2V mislukt: ${result.failMsg}`);
  }
  throw new Error(`SimpleScene I2V timeout (scène ${sceneIdx})`);
}

module.exports = { generateKlingVideosForScenes, generateSimpleScene, generateAnchorImage, generateCharacterSheet, getMultiRefSupport, generateImageForScene, buildKlingPrompt, selectVideoModel, createVideoTask, checkVideoStatus, getCreditBalance, CREDIT_COSTS, ILLUSTRATION_STYLES };
