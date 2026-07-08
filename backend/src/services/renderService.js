/**
 * renderService.js
 * Pipeline: Claude → ElevenLabs → [Kling indien Epic] → Remotion
 */

const fs            = require('fs');
const path          = require('path');
const { execSync }  = require('child_process');
const { v4: uuidv4 }           = require('uuid');
const { analyzeScript, analyzeScriptSimple } = require('./claudeAnalyzer');
const { generateVoiceOver }    = require('./elevenLabsService');
const { generateVoiceOverGemini } = require('./geminiTtsService');
const { getMusicUrl }          = require('./musicService');
const { generateKlingVideosForScenes, generateSimpleScene } = require('./kieService');

const { OUTPUTS_DIR, JOBS_FILE, SERVER_BASE_URL } = require('../paths');
console.log(`[renderService] OUTPUTS_DIR: ${OUTPUTS_DIR}`);

// ── Fallback word timings (130wpm, seconden) ────────────────────────────────

/**
 * Genereert word-level timestamps in seconden op basis van 130wpm.
 * Gebruikt als ElevenLabs geen timestamps levert.
 * @returns {Array<{word, start_time, end_time}>}
 */
function fallbackWordTimings(script, audioDurationSeconds = null) {
  const words = script
    .replace(/[^\w\s'-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 0);

  if (words.length === 0) return [];

  const WPM          = 100;
  const secPerWord   = 60 / WPM;                                   // 0.6s per woord
  const totalSpeech  = audioDurationSeconds || words.length * secPerWord;
  const adjustedSPW  = totalSpeech / words.length;

  return words.map((word, idx) => ({
    word,
    start_time: parseFloat((idx * adjustedSPW).toFixed(4)),
    end_time:   parseFloat(((idx + 1) * adjustedSPW).toFixed(4)),
  }));
}

// ── Persistentie helpers ────────────────────────────────────────────────────

function loadJobs() {
  try {
    if (fs.existsSync(JOBS_FILE)) return JSON.parse(fs.readFileSync(JOBS_FILE, 'utf8'));
  } catch (e) { console.error('[RenderService] Laden jobs.json:', e.message); }
  return {};
}

function saveJobs(jobs) {
  try { fs.writeFileSync(JOBS_FILE, JSON.stringify(jobs, null, 2)); }
  catch (e) { console.error('[RenderService] Opslaan jobs.json:', e.message); }
}

function getJob(jobId) {
  return loadJobs()[jobId] || null;
}

function updateJob(jobId, updates) {
  const jobs = loadJobs();
  if (!jobs[jobId]) return null;
  jobs[jobId] = { ...jobs[jobId], ...updates, updated_at: new Date().toISOString() };
  saveJobs(jobs);
  return jobs[jobId];
}

function getAllJobs() {
  return Object.values(loadJobs()).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

// ── Pipeline ────────────────────────────────────────────────────────────────

// Max gelijktijdige kie.ai-calls — voorkomt rate-limiting bij lange video's met veel scènes
const MAX_CONCURRENT_KIE = parseInt(process.env.MAX_CONCURRENT_KIE || '3', 10);

/** Voert worker(item, idx) uit over alle items met maximaal `limit` tegelijk. */
async function runWithConcurrency(items, limit, worker) {
  let next = 0;
  const runners = Array(Math.min(limit, items.length)).fill(0).map(async () => {
    while (next < items.length) {
      const idx = next++;
      await worker(items[idx], idx);
    }
  });
  await Promise.all(runners);
}

// Visual presets: nieuwe render-stijlen die op een bestaande pipeline draaien
// met een eigen kleurthema, pacing en VFX-profiel.
const VISUAL_PRESETS = {
  cinematic_noir:    { base: 'hybrid', color_theme: 'noir',    pacing: 'normal', vfx: { grainIntensity: 2,   shakeIntensity: 2 } },
  documentary:       { base: '2d',     color_theme: 'neutral', pacing: 'slow',   vfx: { grainIntensity: 0.5, shakeIntensity: 0 } },
  social_media_fast: { base: '2d',     color_theme: 'neon',    pacing: 'fast',   vfx: { grainIntensity: 0,   shakeIntensity: 1 } },
  luxury:            { base: '2d',     color_theme: 'luxury',  pacing: 'slow',   vfx: { grainIntensity: 0.5, shakeIntensity: 0 } },
};

async function startRenderJob({ script, title, style, mode, duration, workspace_id, subtitleSettings, voiceKey, vaultboost_meta, render_style, format, adaptive_strategy, preview, hybrid_intensity }) {
  const jobId = uuidv4();
  const resolvedMode = mode || (style === 'epic' ? 'epic' : 'documentary');

  // Preset-vertaling: cinematic_noir/documentary/social_media_fast/luxury → basis-pipeline + preset-metadata
  let visualPreset = null;
  if (VISUAL_PRESETS[render_style]) {
    visualPreset = render_style;
    render_style = VISUAL_PRESETS[visualPreset].base;
    console.log(`[RenderService] Visual preset '${visualPreset}' → pipeline '${render_style}'`);
  }

  // Duur begrenzen: 15s minimum, 600s (10 min) maximum
  const clampedDuration = Math.max(15, Math.min(600, parseInt(duration, 10) || 60));

  const job = {
    id: jobId,
    title:       title || 'Untitled Short',
    script,
    style:       style || 'documentaire',
    mode:        resolvedMode,
    format:      format || 'narrative',
    duration:    clampedDuration,
    estimated_render_minutes: Math.max(3, Math.round(clampedDuration / 10)),
    render_style:     render_style || 'ai-cinematic',
    visual_preset:    visualPreset,
    ...(visualPreset ? { color_theme: VISUAL_PRESETS[visualPreset].color_theme } : {}),
    hybrid_intensity: hybrid_intensity || 'low',
    adaptive_strategy: adaptive_strategy !== false,
    voice_key:   voiceKey || 'nl_female',
    preview:     !!preview,
    audio_url:   null,
    music_url:   null,
    workspace_id: workspace_id || null,
    status:      'analyzing',
    progress:    0,
    scenes:      [],
    word_timings: [],
    subtitle_settings: subtitleSettings || {
      enabled: true, fontSize: 'normaal', highlightColor: '#FFD700', position: 'onder'
    },
    video_url:      null,
    file_path:      null,
    error:          null,
    vaultboost_meta: vaultboost_meta || null,
    created_at:     new Date().toISOString(),
    updated_at:     new Date().toISOString(),
  };

  const jobs = loadJobs();
  jobs[jobId] = job;
  saveJobs(jobs);

  runRenderPipeline(jobId, job).catch(err => {
    console.error(`[RenderService] Pipeline fout ${jobId}:`, err.message);
    updateJob(jobId, { status: 'failed', error: err.message });
  });

  return { job_id: jobId, status: 'analyzing', estimated_time: duration * 3 };
}

async function runRenderPipeline(jobId, job) {
  try {
    // ── STAP 1: Claude scène analyse ─────────────────────────────────────────
    console.log(`[Pipeline ${jobId}] Stap 1: Claude analyse...`);
    updateJob(jobId, { status: 'analyzing', progress: 5 });

    const isSimple = job.render_style === 'simple';

    if (isSimple) {
      const scenes = await analyzeScriptSimple(job.script, job.duration);
      updateJob(jobId, { scenes, status: 'editing', progress: 20 });

      // Preview of automatische flows (webhook auto_upload) gaan direct door;
      // interactief gebruik pauzeert in de Scene Editor zodat de gebruiker
      // visual_focus/skip-KIE kan aanpassen VÓÓR er credits verbrand worden.
      const autoContinue = job.preview || job.vaultboost_meta?.auto_upload;
      if (autoContinue) {
        console.log(`[Pipeline ${jobId}] Simple analyse klaar (${scenes.length} scenes) — auto-continue (${job.preview ? 'preview' : 'auto_upload'})`);
        runAfterEditing(jobId, { ...job, scenes }).catch(err => {
          console.error(`[Pipeline ${jobId}] ❌ Fout:`, err.message);
          updateJob(jobId, { status: 'failed', error: err.message });
        });
      } else {
        console.log(`[Pipeline ${jobId}] Simple analyse klaar (${scenes.length} scenes) — wacht op goedkeuring in Scene Editor`);
      }
      return;
    }

    const { scenes, styleAnchor, validationWarnings, templateDecisions, colorTheme } = await analyzeScript(job.script, job.style, job.duration, job.render_style, job.format || 'narrative', job.adaptive_strategy !== false, job.visual_preset ? VISUAL_PRESETS[job.visual_preset]?.pacing : null);
    updateJob(jobId, {
      scenes, style_anchor: styleAnchor, status: 'editing', progress: 20,
      ...(validationWarnings?.length  > 0 ? { validation_warnings:  validationWarnings  } : {}),
      ...(templateDecisions?.length   > 0 ? { template_decisions:   templateDecisions   } : {}),
      // Preset-kleurthema heeft voorrang op het thema uit de analyse
      ...(colorTheme && !job.visual_preset ? { color_theme: colorTheme } : {}),
    });

    // Pipeline pauzeren — gebruiker bewerkt scènes via SceneEditor
    // Herstart via POST /api/render/:jobId/continue
    console.log(`[Pipeline ${jobId}] Scène-analyse klaar — wacht op gebruikersgoedkeuring`);
    return;
  } catch (err) {
    console.error(`[Pipeline ${jobId}] ❌ Fout:`, err.message);
    updateJob(jobId, { status: 'failed', error: err.message });
  }
}

async function continueFromEditing(jobId) {
  const job = getJob(jobId);
  if (!job) throw new Error('Job niet gevonden');
  if (job.status !== 'editing') throw new Error(`Job heeft status '${job.status}', verwacht 'editing'`);

  runAfterEditing(jobId, job).catch(err => {
    console.error(`[ContinuePipeline] Fout ${jobId}:`, err.message);
    updateJob(jobId, { status: 'failed', error: err.message });
  });
}

async function runAfterEditing(jobId, job) {
  try {
    const scenes = getJob(jobId)?.scenes || job.scenes;

    // ── STAP 2: ElevenLabs voice-over ────────────────────────────────────────
    console.log(`[Pipeline ${jobId}] Stap 2: Voice-over...`);
    updateJob(jobId, { status: 'generating_audio', progress: 25 });

    // Harde woordlimiet voor TTS — voorkomt dat de audio langer is dan de video
    const maxTTSWords = Math.round((job.duration || 60) * 2.5);
    const rawScript = (job.script || '').trim();
    const rawWordCount = rawScript.split(/\s+/).filter(Boolean).length;
    let ttsScript = rawScript;
    if (rawWordCount > maxTTSWords) {
      const words = rawScript.split(/\s+/);
      const limited = words.slice(0, maxTTSWords).join(' ');
      const sentenceEnd = Math.max(limited.lastIndexOf('. '), limited.lastIndexOf('! '), limited.lastIndexOf('? '));
      ttsScript = (sentenceEnd > 0 ? limited.slice(0, sentenceEnd + 1) : limited).trim();
      const finalCount = ttsScript.split(/\s+/).length;
      console.log(`[Pipeline ${jobId}] Script ingekort: ${rawWordCount} → ${finalCount} woorden (max ${maxTTSWords} voor ${job.duration}s)`);
      updateJob(jobId, { script: ttsScript });
    }

    let audioUrl   = null;
    let wordTimings = null;

    if (process.env.ELEVENLABS_API_KEY) {
      try {
        const result = await generateVoiceOver(ttsScript, jobId, job.voice_key || 'nl_female', job.speaking_style || 'neutral');
        audioUrl     = result.audioUrl;
        wordTimings  = result.wordTimings || null; // seconden-gebaseerd van ElevenLabs
        updateJob(jobId, { audio_url: audioUrl, progress: 40 });
        console.log(`[Pipeline ${jobId}] Voice-over klaar${wordTimings ? ` + ${wordTimings.length} timestamps` : ' (geen timestamps)'}`);
      } catch (e) {
        const isQuotaError = e.response?.status === 402 || String(e.message).includes('402');
        console.warn(`[Pipeline ${jobId}] Voice-over mislukt: ${e.message}`);
        const currentWarnings = getJob(jobId)?.validation_warnings || [];
        if (isQuotaError && process.env.GEMINI_API_KEY) {
          // Automatische fallback naar Google AI Studio TTS
          console.log(`[Pipeline ${jobId}] ElevenLabs 402 — probeer Gemini TTS fallback...`);
          try {
            const geminiResult = await generateVoiceOverGemini(ttsScript, job.voice_key || 'en_male', jobId);
            audioUrl    = geminiResult.audioUrl;
            wordTimings = null; // Gemini geeft geen word timings — gebruik 130wpm fallback
            updateJob(jobId, {
              audio_url: audioUrl,
              progress: 40,
              validation_warnings: [...currentWarnings, 'ElevenLabs quota bereikt — Gemini TTS stem gebruikt als fallback'],
            });
            console.log(`[Pipeline ${jobId}] Gemini TTS fallback gelukt: ${audioUrl}`);
          } catch (geminiErr) {
            console.error(`[Pipeline ${jobId}] Gemini TTS fallback ook mislukt: ${geminiErr.message}`);
            updateJob(jobId, {
              audio_failed: true,
              status: 'failed',
              error: `Voice-over mislukt (ElevenLabs quota op, Gemini fallback ook mislukt): ${geminiErr.message}`,
              validation_warnings: [...currentWarnings, `ElevenLabs 402 + Gemini TTS mislukt: ${geminiErr.message}`],
            });
            return;
          }
        } else if (isQuotaError) {
          updateJob(jobId, {
            audio_failed: true,
            status: 'failed',
            error: `Voice-over mislukt (quota op): ${e.message}. Stel GEMINI_API_KEY in voor automatische fallback.`,
            validation_warnings: [...currentWarnings, `ElevenLabs 402: ${e.message}`],
          });
          return;
        } else {
          const warnMsg = `Voice-over generatie mislukt: ${e.message}. Render gaat door ZONDER geluid.`;
          updateJob(jobId, {
            audio_failed: true,
            validation_warnings: [...currentWarnings, warnMsg],
          });
        }
      }
    }

    // Fallback: 130wpm berekening als ElevenLabs geen timestamps gaf
    if (!wordTimings || wordTimings.length === 0) {
      console.log(`[Pipeline ${jobId}] Fallback 130wpm word timings...`);
      wordTimings = fallbackWordTimings(job.script);
    }

    updateJob(jobId, { word_timings: wordTimings, progress: 45 });

    // ── STAP 3: Achtergrondmuziek selecteren ─────────────────────────────────
    const musicUrl = getMusicUrl(job.mode || job.style, job.color_theme || null);
    updateJob(jobId, { music_url: musicUrl });

    // ── STAP 4: Achtergronden ────────────────────────────────────────────────
    let finalScenes = scenes;
    const resolvedRenderStyle = getJob(jobId)?.render_style || job.render_style || 'ai-cinematic';
    const is2D        = resolvedRenderStyle === '2d';
    const isSimple    = resolvedRenderStyle === 'simple';
    const isHybrid    = resolvedRenderStyle === 'hybrid';
    const isAiImage   = !is2D && !isSimple && !isHybrid && resolvedRenderStyle === 'ai-image';
    const isPreview   = !!(getJob(jobId)?.preview || job.preview);
    const useKling    = !is2D && !isSimple && !isHybrid && !isPreview && !!process.env.KIE_API_KEY;
    const waitForMcp  = !is2D && !isSimple && !isHybrid && !isAiImage && !isPreview && !process.env.KIE_API_KEY;

    if (isPreview) {
      console.log(`[Pipeline ${jobId}] PREVIEW-modus — KIE overgeslagen, gradient-fallbacks worden gebruikt`);
      updateJob(jobId, { status: 'generating_backgrounds', progress: 50, total_scenes: scenes.length });
      updateJob(jobId, { scenes: finalScenes, progress: 75 });
    }

    if (isSimple) {
      console.log(`[Pipeline ${jobId}] SIMPLE-modus — T2I + I2V per scène...`);
      updateJob(jobId, { status: 'generating_backgrounds', progress: 50, total_scenes: scenes.length });
      const currentJob   = getJob(jobId);
      const styleAnchor  = currentJob?.style_anchor || job.style_anchor || '';
      finalScenes = [...scenes];

      // Credit Shield: onder de drempel → alle scènes 2D i.p.v. falen halverwege
      const shieldThreshold = parseInt(process.env.CREDIT_SHIELD_THRESHOLD || '100', 10);
      const { getCreditBalance } = require('./kieService');
      const balance = await getCreditBalance();
      const kieScenesCount = scenes.filter(s => !s.skip_kie).length;
      if (balance !== null && balance < shieldThreshold) {
        console.warn(`[CreditShield ${jobId}] Saldo ${balance} < drempel ${shieldThreshold} — ${kieScenesCount} scène(s) naar 2D-fallback`);
        scenes.forEach(s => { s.skip_kie = true; });
        updateJob(jobId, {
          credit_shield_triggered: true,
          credit_warning: `Weinig credits (saldo: ${balance}) — ${kieScenesCount} scène${kieScenesCount === 1 ? '' : 's'} worden in 2D-modus gerenderd`,
          kie_balance: balance,
          estimated_credits: 0,
        });
      } else {
        updateJob(jobId, {
          estimated_credits: kieScenesCount * 75,
          credit_breakdown: `${kieScenesCount} scènes AI-beeld (~${kieScenesCount * 75} credits), ${scenes.length - kieScenesCount} scènes 2D (gratis)`,
          ...(balance !== null ? { kie_balance: balance } : {}),
        });
      }

      await runWithConcurrency(scenes, MAX_CONCURRENT_KIE, async (scene, idx) => {
        // Door gebruiker gemarkeerd als code-only (kostenbesparing)
        if (scene.skip_kie) {
          const updates = { background_video_url: null, template: 'text_focus_2d', kling_status: 'skipped' };
          finalScenes[idx] = { ...finalScenes[idx], ...updates };
          const jobs = loadJobs();
          if (jobs[jobId]?.scenes?.[idx]) { jobs[jobId].scenes[idx] = { ...jobs[jobId].scenes[idx], ...updates }; saveJobs(jobs); }
          return;
        }
        try {
          updateJob(jobId, (() => {
            const j = loadJobs();
            if (j[jobId]?.scenes?.[idx]) j[jobId].scenes[idx].kling_status = 'generating';
            saveJobs(j);
            return {};
          })());
          const videoUrl = await generateSimpleScene(scene.visual_focus, styleAnchor, jobId, OUTPUTS_DIR, idx);
          const updates = videoUrl
            ? { background_video_url: videoUrl, kling_status: 'success' }
            : { background_video_url: null, template: 'text_focus_2d', kling_status: 'skipped' };
          finalScenes[idx] = { ...finalScenes[idx], ...updates };
          const jobs = loadJobs();
          if (jobs[jobId]?.scenes?.[idx]) {
            jobs[jobId].scenes[idx] = { ...jobs[jobId].scenes[idx], ...updates };
            saveJobs(jobs);
          }
        } catch (e) {
          console.error(`[SimpleScene ${idx}] mislukt:`, e.message);
          finalScenes[idx] = { ...finalScenes[idx], kling_status: 'failed', kling_error: e.message };
          const jobs = loadJobs();
          if (jobs[jobId]?.scenes?.[idx]) {
            jobs[jobId].scenes[idx] = { ...jobs[jobId].scenes[idx], kling_status: 'failed', kling_error: e.message };
            saveJobs(jobs);
          }
        }
      });

      updateJob(jobId, { scenes: finalScenes, progress: 75 });
    }

    if (isHybrid && !!process.env.KIE_API_KEY) {
      const intensity   = getJob(jobId)?.hybrid_intensity || job.hybrid_intensity || 'low';
      const styleAnchor = getJob(jobId)?.style_anchor || job.style_anchor || '';
      console.log(`[Pipeline ${jobId}] HYBRID-modus (${intensity}) — KIE voor geselecteerde scènes...`);
      updateJob(jobId, { status: 'generating_backgrounds', progress: 50, total_scenes: scenes.length });
      finalScenes = [...scenes];

      // Bepaal welke scène-indices KIE krijgen
      const kieIndices = new Set();
      const firstIdx   = 0;
      const lastIdx    = scenes.length - 1;

      // cinematic_title + outro_cta altijd KIE
      scenes.forEach((s, i) => {
        if (s.template === 'cinematic_title' || s.template === 'outro_cta') kieIndices.add(i);
      });
      // fallback: eerste en laatste als geen titels gevonden
      if (kieIndices.size === 0) { kieIndices.add(firstIdx); kieIndices.add(lastIdx); }

      if (intensity === 'medium' || intensity === 'high') {
        const nonKieIndices = scenes.map((_, i) => i).filter(i => !kieIndices.has(i));
        nonKieIndices.forEach((absIdx, relIdx) => {
          if (intensity === 'high' || relIdx % 2 === 0) kieIndices.add(absIdx);
        });
      }

      // Gebruiker kan per scène 'skip_kie' zetten in de Scene Editor (kostenbesparing)
      scenes.forEach((s, i) => {
        if (s.skip_kie) kieIndices.delete(i);
      });

      // Smart Quality Selector: Claude bepaalde per scène of AI-beeld echt nodig is
      if (intensity === 'smart') {
        kieIndices.clear();
        scenes.forEach((s, i) => {
          if (s.template === 'cinematic_title' || s.template === 'outro_cta') kieIndices.add(i);
          else if (s.needs_ai && !s.skip_kie) kieIndices.add(i);
        });
      }

      // Credit Shield: check saldo vóór dure aanroepen; onder de drempel → 2D-fallback
      const CREDITS_PER_KIE_SCENE = 75; // T2I (~5) + Kling I2V (~70)
      const shieldThreshold = parseInt(process.env.CREDIT_SHIELD_THRESHOLD || '100', 10);
      const { getCreditBalance } = require('./kieService');
      const balance = await getCreditBalance();
      if (balance !== null && balance < shieldThreshold && kieIndices.size > 0) {
        const blocked = kieIndices.size;
        console.warn(`[CreditShield ${jobId}] Saldo ${balance} < drempel ${shieldThreshold} — ${blocked} scène(s) naar 2D-fallback`);
        kieIndices.clear();
        updateJob(jobId, {
          credit_shield_triggered: true,
          credit_warning: `Weinig credits (saldo: ${balance}) — ${blocked} scène${blocked === 1 ? '' : 's'} worden in 2D-modus gerenderd`,
          kie_balance: balance,
        });
      }

      // Geschat kredietgebruik vastleggen zodat de gebruiker per job kan terugzien wat het kostte
      updateJob(jobId, {
        estimated_credits: kieIndices.size * CREDITS_PER_KIE_SCENE,
        credit_breakdown: `${kieIndices.size} scène${kieIndices.size === 1 ? '' : 's'} AI-beeld (~${kieIndices.size * CREDITS_PER_KIE_SCENE} credits), ${scenes.length - kieIndices.size} scène${scenes.length - kieIndices.size === 1 ? '' : 's'} 2D (gratis)`,
        ...(balance !== null ? { kie_balance: balance } : {}),
      });

      const kieCount = kieIndices.size;
      console.log(`[Pipeline ${jobId}] Hybrid ${intensity}: ${kieCount} KIE-scènes van ${scenes.length} totaal — indices: [${[...kieIndices].join(',')}]`);

      await runWithConcurrency(scenes, MAX_CONCURRENT_KIE, async (scene, idx) => {
        if (kieIndices.has(idx)) {
          // Gebruik generateSimpleScene (T2I + I2V) voor KIE-scènes
          try {
            const videoUrl = await generateSimpleScene(scene.visual_focus || scene.script_segment, styleAnchor, jobId, OUTPUTS_DIR, idx);
            const updates  = videoUrl
              ? { background_video_url: videoUrl, kling_status: 'success' }
              : { background_video_url: null, template: 'text_focus_2d', kling_status: 'skipped' };
            finalScenes[idx] = { ...finalScenes[idx], ...updates };
            const jobs = loadJobs();
            if (jobs[jobId]?.scenes?.[idx]) { jobs[jobId].scenes[idx] = { ...jobs[jobId].scenes[idx], ...updates }; saveJobs(jobs); }
          } catch (e) {
            console.error(`[Hybrid ${idx}] KIE mislukt:`, e.message);
            finalScenes[idx] = { ...finalScenes[idx], kling_status: 'failed', kling_error: e.message };
          }
        } else {
          // 2D-fallback: text_focus_2d
          finalScenes[idx] = { ...finalScenes[idx], background_video_url: null, template: 'text_focus_2d', kling_status: 'skipped' };
          const jobs = loadJobs();
          if (jobs[jobId]?.scenes?.[idx]) { jobs[jobId].scenes[idx] = { ...jobs[jobId].scenes[idx], background_video_url: null, template: 'text_focus_2d', kling_status: 'skipped' }; saveJobs(jobs); }
        }
      });

      updateJob(jobId, { scenes: finalScenes, progress: 75 });
    } else if (isHybrid && !process.env.KIE_API_KEY) {
      // Geen KIE-sleutel — alles 2D
      console.log(`[Pipeline ${jobId}] HYBRID-modus — geen KIE_API_KEY, alles 2D`);
      finalScenes = scenes.map(s => ({ ...s, background_video_url: null, template: 'text_focus_2d', kling_status: 'skipped' }));
      updateJob(jobId, { scenes: finalScenes, progress: 75 });
    }

    if (useKling) {
      // Auto-Kling via PIAPI
      console.log(`[Pipeline ${jobId}] Stap 4: Kling video's genereren...`);
      scenes.forEach((s, i) => {
        if (s.lighting_mood || s.camera_style) {
          console.log(`[Pipeline ${jobId}] Scene ${i} (${s.template}) — lighting: "${s.lighting_mood || '(fallback)'}" | camera: "${s.camera_style || '(fallback)'}"`);
        }
      });
      updateJob(jobId, { status: 'generating_backgrounds', progress: 50, total_scenes: scenes.length });

      const kieResult = await generateKlingVideosForScenes(
        scenes, jobId, OUTPUTS_DIR,
        (sceneIdx, sceneUpdates) => {
          const jobs = loadJobs();
          if (jobs[jobId]?.scenes?.[sceneIdx]) {
            jobs[jobId].scenes[sceneIdx] = { ...jobs[jobId].scenes[sceneIdx], ...sceneUpdates };
            jobs[jobId].updated_at = new Date().toISOString();
            saveJobs(jobs);
          }
        },
        job.mode || 'epic',
        job.style_anchor || '',
        job.render_style || 'ai-cinematic'
      );
      finalScenes = kieResult.scenes;
      if (kieResult.anchorImageUrl) {
        updateJob(jobId, { anchor_image_url: kieResult.anchorImageUrl });
        console.log(`[Pipeline ${jobId}] anchor_image_url opgeslagen: ${kieResult.anchorImageUrl}`);
      }
      const failedCount = finalScenes.filter(s => s.kling_status === 'failed').length;
      if (failedCount === finalScenes.length) {
        updateJob(jobId, { scenes: finalScenes, status: 'failed', progress: 55, error: `Alle ${failedCount} scène-achtergronden mislukt. Klik "Opnieuw proberen" of render zonder achtergronden.` });
        return;
      }
      updateJob(jobId, { scenes: finalScenes, progress: 75, partial_failure: failedCount > 0 ? failedCount : 0 });

    } else if (waitForMcp) {
      // Wacht op Higgsfield MCP injectie via PATCH /scene/:id/video
      console.log(`[Pipeline ${jobId}] Stap 4: Wachten op MCP achtergronden (geen KIE_API_KEY)...`);
      updateJob(jobId, { status: 'waiting_for_backgrounds', progress: 55, total_scenes: scenes.length });
      return; // Pipeline stopt hier — resume via triggerRemotionRender (PATCH endpoint)
    }

    // ── STAP 5: Remotion render ───────────────────────────────────────────────
    console.log(`[Pipeline ${jobId}] Stap 5: Remotion render...`);
    updateJob(jobId, { status: 'rendering', progress: 80 });

    const currentJob = getJob(jobId);
    const outputFile = await renderWithRemotion(jobId, {
      ...currentJob,
      audio_url:  audioUrl,
      music_url:  musicUrl,
      word_timings: wordTimings,
    }, finalScenes);

    const videoUrl = `/outputs/${path.basename(outputFile)}`;
    updateJob(jobId, {
      status: 'completed', progress: 100,
      video_url: videoUrl, file_path: outputFile,
      completed_at: new Date().toISOString(),
    });

    console.log(`[Pipeline ${jobId}] ✅ Klaar: ${videoUrl}`);
    if (job.workspace_id) await notifyVaultBoost(job.workspace_id, videoUrl, outputFile);

  } catch (err) {
    console.error(`[Pipeline ${jobId}] ❌ Fout:`, err.message);
    updateJob(jobId, { status: 'failed', error: err.message });
  }
}

async function retryFailedScenes(jobId) {
  const job = getJob(jobId);
  if (!job) throw new Error('Job niet gevonden');

  // 'failed' én vastgelopen 'polling' (bijv. na server-herstart) worden opnieuw geprobeerd
  const failedIdxs = (job.scenes || [])
    .map((s, i) => (s.kling_status === 'failed' || s.kling_status === 'polling' ? i : -1))
    .filter(i => i >= 0);

  if (failedIdxs.length === 0) throw new Error('Geen mislukte of vastgelopen scènes');

  const scenes = job.scenes.map((s, i) =>
    failedIdxs.includes(i)
      ? { ...s, kling_status: 'pending', kling_error: null, kling_progress: 0, background_video_url: null }
      : s
  );
  updateJob(jobId, { scenes, status: 'generating_backgrounds', progress: 50, error: null });

  runRetry(jobId, scenes, job.mode || 'epic').catch(err => {
    console.error(`[Retry ${jobId}]`, err.message);
    updateJob(jobId, { status: 'failed', error: err.message });
  });
}

async function runRetry(jobId, scenes, mode) {
  const finalScenes = await generateKlingVideosForScenes(
    scenes, jobId, OUTPUTS_DIR,
    (sceneIdx, sceneUpdates) => {
      const jobs = loadJobs();
      if (jobs[jobId]?.scenes?.[sceneIdx]) {
        jobs[jobId].scenes[sceneIdx] = { ...jobs[jobId].scenes[sceneIdx], ...sceneUpdates };
        jobs[jobId].updated_at = new Date().toISOString();
        saveJobs(jobs);
      }
    },
    mode
  );
  updateJob(jobId, { scenes: finalScenes, status: 'rendering', progress: 80 });
  const outputFile = await renderWithRemotion(jobId, getJob(jobId), finalScenes);
  const videoUrl   = `/outputs/${path.basename(outputFile)}`;
  updateJob(jobId, { status: 'completed', progress: 100, video_url: videoUrl, file_path: outputFile, completed_at: new Date().toISOString() });
  generateAutoThumbnails(jobId).catch(e => console.warn(`[AutoThumb ${jobId}]`, e.message));
}

async function retryRender(jobId) {
  const job = getJob(jobId);
  if (!job) throw new Error('Job niet gevonden');
  if (!job.scenes?.length) throw new Error('Geen scène-data beschikbaar');

  updateJob(jobId, { status: 'rendering', progress: 80, error: null });
  try {
    const outputFile = await renderWithRemotion(jobId, job, job.scenes);
    const videoUrl   = `/outputs/${path.basename(outputFile)}`;
    updateJob(jobId, { status: 'completed', progress: 100, video_url: videoUrl, file_path: outputFile, completed_at: new Date().toISOString() });
  } catch (err) {
    console.error(`[RetryRender ${jobId}]`, err.message);
    updateJob(jobId, { status: 'failed', error: err.message });
    throw err;
  }
}

async function triggerRemotionRender(jobId) {
  const job = getJob(jobId);
  if (!job) throw new Error('Job niet gevonden');
  updateJob(jobId, { status: 'rendering', progress: 80 });
  try {
    const outputFile = await renderWithRemotion(jobId, job, job.scenes);
    const videoUrl   = `/outputs/${path.basename(outputFile)}`;
    updateJob(jobId, { status: 'completed', progress: 100, video_url: videoUrl, file_path: outputFile, completed_at: new Date().toISOString() });
    if (job.workspace_id) await notifyVaultBoost(job.workspace_id, videoUrl, outputFile);
    generateAutoThumbnails(jobId).catch(e => console.warn(`[AutoThumb ${jobId}]`, e.message));
    require('./promptIntelligence').recordRenderResults(getJob(jobId)).catch(e => console.warn(`[PromptIntel ${jobId}]`, e.message));
  } catch (err) {
    updateJob(jobId, { status: 'failed', error: err.message });
    throw err;
  }
}

// ── Auto-thumbnail generator: 3 varianten via grok-imagine na elke render ──
async function generateAutoThumbnails(jobId) {
  if (!process.env.KIE_API_KEY) return;
  const job = getJob(jobId);
  if (!job || job.thumbnail_options?.length) return;

  const { generateImageForScene } = require('./kieService');
  const firstVisual = (job.scenes || []).find(s => s.visual_focus)?.visual_focus || '';
  const base = `YouTube thumbnail, bold cinematic composition, high contrast, dramatic lighting, no text, 16:9. Topic: "${job.title}". ${firstVisual ? `Key visual: ${firstVisual}.` : ''}`;
  const prompts = [
    `${base} Epic wide establishing shot.`,
    `${base} Extreme close-up with intense mood.`,
    `${base} Mysterious silhouette, single strong light source.`,
  ];

  const thumbsDir = path.join(OUTPUTS_DIR, 'thumbnails');
  fs.mkdirSync(thumbsDir, { recursive: true });
  const axios = require('axios');
  const urls = [];

  for (let i = 0; i < prompts.length; i++) {
    try {
      const cdnUrl = await generateImageForScene(prompts[i], 'grok-imagine/text-to-image', '16:9');
      const filePath = path.join(thumbsDir, `${jobId}-auto-${i + 1}.jpg`);
      const img = await axios.get(cdnUrl, { responseType: 'arraybuffer', timeout: 60000 });
      fs.writeFileSync(filePath, Buffer.from(img.data));
      urls.push(`/outputs/thumbnails/${jobId}-auto-${i + 1}.jpg`);
      console.log(`[AutoThumb ${jobId}] Variant ${i + 1} klaar (${Math.round(img.data.byteLength / 1024)}KB)`);
    } catch (e) {
      console.warn(`[AutoThumb ${jobId}] Variant ${i + 1} mislukt: ${e.message}`);
      if (e.message.includes('402')) break; // geen credits — stop meteen
    }
  }
  if (urls.length) updateJob(jobId, { thumbnail_options: urls });
}

// ── Audio duur via ffprobe ───────────────────────────────────────────────────

const FFPROBE_PATH = (() => {
  if (process.env.FFPROBE_PATH) return process.env.FFPROBE_PATH;
  try { return require('@ffprobe-installer/ffprobe').path; } catch {}
  const legacyWin = 'C:\\Users\\kurtc\\Documents\\Vault of ages\\backend\\node_modules\\@remotion\\compositor-win32-x64-msvc\\ffprobe.exe';
  if (process.platform === 'win32' && fs.existsSync(legacyWin)) return legacyWin;
  return 'ffprobe'; // hoop op PATH (Railway nixpacks)
})();

function getAudioDurationSec(audioFilePath) {
  try {
    const out = execSync(
      `"${FFPROBE_PATH}" -v quiet -show_entries format=duration -of csv=p=0 "${audioFilePath}"`,
      { encoding: 'utf8', timeout: 10000 }
    );
    const dur = parseFloat(out.trim());
    return isNaN(dur) ? null : dur;
  } catch (e) {
    console.warn(`[RenderService] ffprobe audio duur mislukt: ${e.message}`);
    return null;
  }
}

// ── Scène-sync: herbereken scèneduur op echte woordtimings ──────────────────
// Claude schat duration_frames op woordaantal, maar de echte voice-over spreekt
// segmenten sneller of trager uit. Zonder herberekening loopt het beeld voor of
// achter op de ondertitels. Hier krijgt elke scène exact de duur van zijn eigen
// script_segment in de audio.
function realignScenesToTimings(scenes, timings, fps) {
  if (!Array.isArray(scenes) || !Array.isArray(timings) || timings.length === 0) return scenes;
  const countWords = (s) => (s || '').trim().split(/\s+/).filter(Boolean).length;
  const MIN_FRAMES = 45; // 1.5s ondergrens per scène

  let wordIdx = 0;
  let prevEndSec = 0;
  let realigned = 0;
  const out = scenes.map((sc) => {
    const n = countWords(sc.script_segment);
    if (n === 0 || wordIdx >= timings.length) return sc; // outro/tekstloze scène: behoud duur
    const lastIdx = Math.min(wordIdx + n - 1, timings.length - 1);
    const endSec = timings[lastIdx].end_time;
    if (typeof endSec !== 'number' || !(endSec > prevEndSec)) { wordIdx = lastIdx + 1; return sc; }
    const durFrames = Math.max(MIN_FRAMES, Math.round((endSec - prevEndSec) * fps));
    prevEndSec = endSec;
    wordIdx = lastIdx + 1;
    realigned++;
    return { ...sc, duration_frames: durFrames };
  });
  if (realigned > 0) console.log(`[RenderService] [SYNC] ${realigned}/${scenes.length} scènes uitgelijnd op echte woordtimings`);
  return out;
}

// ── Remotion render ─────────────────────────────────────────────────────────

async function renderWithRemotion(jobId, job, scenes) {
  const outputFile  = path.join(OUTPUTS_DIR, `${jobId}.mp4`);
  const remotionDir = path.resolve(__dirname, '../../../remotion');
  const FPS = 30;

  // BUG 2 & 3: Pas scène-frames aan op audio-duur zodat video nooit te kort is
  // en outro altijd NA het einde van de voice-over begint.
  let adjustedScenes = scenes && scenes.length > 0 ? [...scenes] : null;
  if (adjustedScenes) {
    // SYNC: lijn scèneduur uit op de echte woordtimings vóór de audio-correcties
    const jobTimings = getJob(jobId)?.word_timings || job.word_timings || [];
    adjustedScenes = realignScenesToTimings(adjustedScenes, jobTimings, FPS);
    const audioFilePath = path.join(OUTPUTS_DIR, 'audio', `${jobId}.mp3`);
    if (fs.existsSync(audioFilePath)) {
      const audioDurSec = getAudioDurationSec(audioFilePath);
      if (audioDurSec) {
        const audioEndFrame = Math.ceil(audioDurSec * FPS);

        // BUG 3: outro_cta mag pas starten NA het einde van de audio
        const outroIdx = adjustedScenes.length - 1;
        if (adjustedScenes[outroIdx]?.template === 'outro_cta' && outroIdx > 0) {
          const contentFrames = adjustedScenes.slice(0, outroIdx).reduce((s, sc) => s + (sc.duration_frames || 90), 0);
          if (contentFrames < audioEndFrame) {
            const extra = audioEndFrame - contentFrames;
            adjustedScenes = adjustedScenes.map((sc, i) =>
              i === outroIdx - 1 ? { ...sc, duration_frames: (sc.duration_frames || 90) + extra } : sc
            );
            console.log(`[RenderService] [BUG3] Scène ${outroIdx - 1} verlengd met ${extra} frames — outro start na audio (${audioDurSec.toFixed(1)}s)`);
          }
        }

        // BUG 2: totale video nooit korter dan audio + 30 frames (1s buffer)
        const totalAfterBug3 = adjustedScenes.reduce((s, sc) => s + (sc.duration_frames || 90), 0);
        const minTotal = audioEndFrame + 30;
        if (totalAfterBug3 < minTotal) {
          const extra = minTotal - totalAfterBug3;
          const lastIdx = adjustedScenes.length - 1;
          adjustedScenes = adjustedScenes.map((sc, i) =>
            i === lastIdx ? { ...sc, duration_frames: (sc.duration_frames || 90) + extra } : sc
          );
          console.log(`[RenderService] [BUG2] Video verlengd: ${totalAfterBug3} → ${totalAfterBug3 + extra} frames (audio ${audioDurSec.toFixed(1)}s + 30 buffer)`);
        }
      }
    }
  }

  const scenesToUse = adjustedScenes || [];

  // Bereken totalDurationInFrames vanuit (aangepaste) scènes
  const totalFrames = scenesToUse.length > 0
    ? scenesToUse.reduce((sum, s) => sum + (s.duration_frames || 90), 0)
    : (job.duration || 60) * FPS;

  let colorThemeObj = null;
  if (job.render_style === '2d' || job.visual_preset) {
    const COLOR_THEMES = {
      default: { primary: '#e53e3e', accent: '#FFD700', bg: '#111111', text: '#ffffff', label: 'default' },
      warm:    { primary: '#e53e3e', accent: '#f6ad55', bg: '#180a00', text: '#ffffff', label: 'warm' },
      cool:    { primary: '#3b82f6', accent: '#93c5fd', bg: '#07101f', text: '#ffffff', label: 'cool' },
      neutral: { primary: '#e53e3e', accent: '#FFD700', bg: '#111111', text: '#ffffff', label: 'neutral' },
      dark:    { primary: '#c53030', accent: '#00d4ff', bg: '#0f0f14', text: '#ffffff', label: 'dark' },
      noir:    { primary: '#e53e3e', accent: '#e53e3e', bg: '#000000', text: '#f5f5f5', label: 'noir' },
      neon:    { primary: '#e53e3e', accent: '#39ff14', bg: '#0a0014', text: '#ffffff', label: 'neon' },
      luxury:  { primary: '#d4af37', accent: '#d4af37', bg: '#0d0d0d', text: '#f8f5ec', label: 'luxury' },
    };
    colorThemeObj = COLOR_THEMES[job.color_theme] || COLOR_THEMES['default'];
  }

  // Preset-specifieke VFX (grain/shake intensiteit)
  const presetVfx = job.visual_preset ? (VISUAL_PRESETS[job.visual_preset]?.vfx || {}) : {};

  // Render-time URLs: de headless browser draait in DEZELFDE container, dus
  // assets via loopback laden — de publieke Railway-URL is traag/onbetrouwbaar
  // vanuit de container zelf en veroorzaakte delayRender-timeouts.
  const LOCAL_BASE = `http://127.0.0.1:${process.env.PORT || 3002}`;
  const toRenderUrl = (url) => {
    if (!url) return null;
    if (url.startsWith(SERVER_BASE_URL)) return LOCAL_BASE + url.slice(SERVER_BASE_URL.length);
    if (url.startsWith('http')) return url; // externe assets (CDN) blijven extern
    return LOCAL_BASE + url;
  };

  // Scène-achtergronden herschrijven naar loopback
  const scenesForRender = (scenesToUse || []).map(s => ({
    ...s,
    background_video_url: toRenderUrl(s.background_video_url),
    background_image_url: toRenderUrl(s.background_image_url),
  }));

  const inputProps = {
    scenes: scenesForRender,
    audioUrl:              toRenderUrl(job.audio_url)  || null,
    musicUrl:              toRenderUrl(job.music_url)  || null,
    wordTimings:           job.word_timings || [],
    subtitleSettings:      job.subtitle_settings,
    mode:                  job.mode || 'documentary',
    totalDurationInFrames: totalFrames,
    renderStyle:           job.render_style || 'ai-cinematic',
    colorTheme:            colorThemeObj,
    sfxUrl:                null,
    vfxSettings: {
      vignette:        true,
      transitionFlash: true,
      filmGrain:       (presetVfx.grainIntensity ?? 1) > 0,
      zoomPunch:       true,
      cameraShake:     (presetVfx.shakeIntensity ?? 1) > 0,
      ...presetVfx,
    },
  };

  console.log(`[RenderService] Start render — frames: ${totalFrames}, scenes: ${scenesToUse?.length}, audio: ${!!job.audio_url}`);

  const { bundle }                         = require('@remotion/bundler');
  const { renderMedia, selectComposition } = require('@remotion/renderer');

  // Gebruik één gedeelde bundleDir — verwijder altijd voor frisse bundle (geen stale cache)
  const bundleDir = path.join(require('os').tmpdir(), 'vaultmotion_bundle');
  if (fs.existsSync(bundleDir)) {
    fs.rmSync(bundleDir, { recursive: true, force: true });
    console.log('[RenderService] Oude bundle-cache verwijderd');
  }
  console.log('[RenderService] Bundling Remotion...');

  let bundled;
  try {
    bundled = await bundle({
      entryPoint: path.join(remotionDir, 'src/index.ts'),
      outDir:     bundleDir,
      webpackOverride: c => c,
    });
  } catch (bundleErr) {
    console.error('[RenderService] ❌ Bundle mislukt:\n', bundleErr.stack || bundleErr.message);
    throw new Error(`Remotion bundle mislukt: ${bundleErr.message}`);
  }

  // Browser bepalen:
  // 1) geldig CHROMIUM_EXECUTABLE_PATH → gebruiken
  // 2) Linux met chromium op PATH (Railway/nix) → gebruiken in 'chrome-for-testing'
  //    modus (nieuwe headless; oude headless is uit moderne chromium verwijderd,
  //    en de downloadbare headless-shell mist systeemlibs zoals libnspr4 in nix)
  // 3) anders: Remotion downloadt zelf chrome-headless-shell
  const { browserExecutable, chromeMode } = (() => {
    const configured = process.env.CHROMIUM_EXECUTABLE_PATH;
    if (configured && fs.existsSync(configured)) return { browserExecutable: configured, chromeMode: 'chrome-for-testing' };
    if (configured) console.warn(`[RenderService] CHROMIUM_EXECUTABLE_PATH bestaat niet (${configured}) — zoek alternatief`);
    if (process.platform !== 'win32') {
      try {
        const found = execSync('which chromium || which chromium-browser', { encoding: 'utf8', timeout: 5000 }).split('\n')[0].trim();
        if (found && fs.existsSync(found)) {
          console.log(`[RenderService] Chromium op PATH: ${found} (chrome-for-testing modus)`);
          return { browserExecutable: found, chromeMode: 'chrome-for-testing' };
        }
      } catch {}
    }
    return { browserExecutable: undefined, chromeMode: 'headless-shell' };
  })();
  let composition;
  try {
    composition = await selectComposition({ serveUrl: bundled, id: 'VaultMotionVideo', inputProps, browserExecutable, chromeMode, timeoutInMilliseconds: 120000 });
    console.log(`[RenderService] Compositie: ${composition.durationInFrames} frames, ${composition.width}x${composition.height}`);
  } catch (compErr) {
    console.error('[RenderService] ❌ selectComposition mislukt:\n', compErr.stack || compErr.message);
    throw new Error(`Remotion selectComposition mislukt: ${compErr.message}`);
  }

  try {
    await renderMedia({
      composition, serveUrl: bundled, codec: 'h264',
      outputLocation: outputFile, inputProps,
      pixelFormat: 'yuv420p', crf: 23, browserExecutable, chromeMode,
      timeoutInMilliseconds: 120000, // ruime marge voor het laden van video-assets
      onProgress: ({ progress }) => {
        if (Math.round(progress * 100) % 10 === 0) {
          console.log(`[RenderService] Render voortgang: ${Math.round(progress * 100)}%`);
        }
      },
    });
  } catch (renderErr) {
    console.error('[RenderService] ❌ renderMedia mislukt:\n', renderErr.stack || renderErr.message);
    throw new Error(`Remotion renderMedia mislukt: ${renderErr.message}`);
  }

  const fileSize = fs.existsSync(outputFile) ? fs.statSync(outputFile).size : 0;
  if (fileSize < 1000) {
    throw new Error(`Render resulteerde in leeg/corrupt bestand (${fileSize} bytes)`);
  }

  // Geheugengebruik vastleggen zodat de gebruiker ziet hoe zwaar de render was
  const peakMemMb = Math.round(process.memoryUsage().rss / 1024 / 1024);
  updateJob(jobId, { peak_memory_mb: peakMemMb });

  console.log(`[RenderService] ✅ Render klaar: ${outputFile} (${Math.round(fileSize / 1024)}KB, piekgeheugen ~${peakMemMb}MB)`);
  return outputFile;
}

async function notifyVaultBoost(workspaceId, videoUrl, filePath) {
  try {
    const axios      = require('axios');
    const vaultboost = process.env.VAULTBOOST_URL || 'http://localhost:3001';
    await axios.put(`${vaultboost}/api/workspace/${workspaceId}`, { video_file_path: filePath, status: 'video_ready' }, { timeout: 5000 });
  } catch (e) { console.warn('[RenderService] VaultBoost notificatie mislukt:', e.message); }
}

module.exports = { startRenderJob, getJob, getAllJobs, updateJob, triggerRemotionRender, continueFromEditing, retryFailedScenes, retryRender };
