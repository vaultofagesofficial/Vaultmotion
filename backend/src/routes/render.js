const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const router  = express.Router();
const { startRenderJob, getJob, getAllJobs, updateJob, triggerRemotionRender, continueFromEditing, retryFailedScenes, retryRender } = require('../services/renderService');
const { OUTPUTS_DIR } = require('../paths');

const THUMBNAILS_DIR = path.join(OUTPUTS_DIR, 'thumbnails');
if (!fs.existsSync(THUMBNAILS_DIR)) fs.mkdirSync(THUMBNAILS_DIR, { recursive: true });

// Sanitize jobId zodat een gemanipuleerde URL (bv. ..%2F) nooit buiten de map schrijft
const safeJobId = (id) => String(id || '').replace(/[^a-zA-Z0-9_-]/g, '');

const thumbnailUpload = multer({
  storage: multer.diskStorage({
    destination: THUMBNAILS_DIR,
    filename: (req, _file, cb) => cb(null, `${safeJobId(req.params.jobId)}.jpg`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Alleen afbeeldingen toegestaan'));
  },
});

// POST /api/render — Start een nieuwe render job (VaultBoost koppeling)
router.post('/', async (req, res) => {
  try {
    const { script, title, style, duration, workspace_id, subtitleSettings, voiceKey, render_style, mode, format, preview, hybrid_intensity } = req.body;

    if (!script || script.trim().length < 10) {
      return res.status(400).json({ error: 'Script is verplicht (min. 10 tekens)' });
    }

    const result = await startRenderJob({ script, title, style, duration, workspace_id, subtitleSettings, voiceKey, render_style, mode, format, preview: !!preview, hybrid_intensity });

    res.json(result);
  } catch (err) {
    console.error('[POST /api/render]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/render — Alle jobs ophalen
router.get('/', (req, res) => {
  try {
    const jobs = getAllJobs();
    res.json(jobs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/render/:jobId — Status van een specifieke job
router.get('/:jobId', (req, res) => {
  try {
    const job = getJob(req.params.jobId);
    if (!job) return res.status(404).json({ error: 'Job niet gevonden' });

    res.json({
      status: job.status,
      progress: job.progress,
      video_url: job.video_url,
      file_path: job.file_path,
      scenes: job.scenes,
      word_timings: job.word_timings,
      subtitle_settings: job.subtitle_settings,
      error: job.error,
      current_scene: job.current_scene,
      total_scenes: job.total_scenes,
      created_at: job.created_at,
      completed_at: job.completed_at || null,
      title: job.title,
      id: job.id,
      thumbnail_url: job.thumbnail_url || null,
      thumbnail_options: job.thumbnail_options || [],
      partial_failure: job.partial_failure || 0,
      youtube_url: job.youtube_url || null,
      youtube_shorts_url: job.youtube_shorts_url || null,
      // Storyboard-velden (voor batch refresh-herstel)
      style_anchor:        job.style_anchor        || null,
      template_decisions:  job.template_decisions  || [],
      validation_warnings: job.validation_warnings || [],
      batch_id:            job.batch_id            || null,
      batch_index:         job.batch_index         ?? null,
      script:              job.script              || null,
      mode:                job.mode                || null,
      duration:            job.duration            || null,
      render_style:        job.render_style        || 'ai-cinematic',
      color_theme:         job.color_theme         || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/render/:jobId/scene/:sceneIdx — Update scène met Higgsfield video URL
// Wordt aangeroepen door Claude na MCP video generatie
router.patch('/:jobId/scene/:sceneIdx', (req, res) => {
  try {
    const { jobId, sceneIdx } = req.params;
    const { video_url, status, error } = req.body;

    const job = getJob(jobId);
    if (!job) return res.status(404).json({ error: 'Job niet gevonden' });

    const idx = parseInt(sceneIdx);
    if (!job.scenes || idx >= job.scenes.length) {
      return res.status(400).json({ error: 'Scène index ongeldig' });
    }

    const { updateJob } = require('../services/renderService');
    const scenes = [...job.scenes];
    scenes[idx] = {
      ...scenes[idx],
      higgsfield_video_url: video_url || null,
      background_video_url: video_url || null,
      higgsfield_status: status || (video_url ? 'completed' : 'failed'),
      higgsfield_error: error || null
    };

    updateJob(jobId, { scenes });
    res.json({ ok: true, scene: scenes[idx] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/render/:jobId/scene-prompts — Geeft Kling/Higgsfield prompts per scène (voor MCP flow)
router.get('/:jobId/scene-prompts', (req, res) => {
  try {
    const job = getJob(req.params.jobId);
    if (!job) return res.status(404).json({ error: 'Job niet gevonden' });

    res.json({
      job_id: job.id,
      title:  job.title,
      status: job.status,
      scenes: (job.scenes || []).map((scene, i) => ({
        scene_id:         i,
        template:         scene.template || null,
        duration_seconds: Math.round((scene.duration_frames || 90) / 30),
        kling_prompt:     scene.kling_prompt || scene.higgsfield_prompt || null,
        status:           scene.background_video_url ? 'done' : 'waiting',
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/render/:jobId/higgsfield-prompts — Geeft Higgsfield prompts terug per scène
router.get('/:jobId/higgsfield-prompts', (req, res) => {
  try {
    const job = getJob(req.params.jobId);
    if (!job) return res.status(404).json({ error: 'Job niet gevonden' });

    const prompts = (job.scenes || []).map((scene, i) => ({
      scene_id: i,
      prompt: scene.higgsfield_prompt || null,
      duration_seconds: Math.round((scene.duration_frames || 90) / 30)
    }));

    res.json(prompts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/render/:jobId/scene/:sceneId/video — Sla Higgsfield video URL op per scène
// Als alle scènes een video_url hebben → start Remotion automatisch
router.patch('/:jobId/scene/:sceneId/video', async (req, res) => {
  try {
    const { jobId, sceneId } = req.params;
    const { video_url } = req.body;

    if (!video_url) return res.status(400).json({ error: 'video_url is verplicht' });

    const job = getJob(jobId);
    if (!job) return res.status(404).json({ error: 'Job niet gevonden' });

    const idx = parseInt(sceneId);
    if (isNaN(idx) || !job.scenes || idx >= job.scenes.length) {
      return res.status(400).json({ error: 'Scène ID ongeldig' });
    }

    const scenes = [...job.scenes];
    scenes[idx] = {
      ...scenes[idx],
      background_video_url: video_url,
      higgsfield_video_url: video_url,
      higgsfield_status: 'completed'
    };

    updateJob(jobId, { scenes });

    const allReady = scenes.every(s => s.background_video_url || s.higgsfield_video_url);
    if (allReady) {
      updateJob(jobId, { status: 'backgrounds_ready', progress: 70 });
      triggerRemotionRender(jobId).catch(err => {
        console.error(`[Route] Remotion trigger fout voor ${jobId}:`, err.message);
      });
    }

    res.json({ ok: true, scene: scenes[idx], all_ready: allReady });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/render/:jobId/retry — Herstart alleen mislukte scènes, behoud bestaande data
router.post('/:jobId/retry', async (req, res) => {
  try {
    const job = getJob(req.params.jobId);
    if (!job) return res.status(404).json({ error: 'Job niet gevonden' });
    const failedCount = (job.scenes || []).filter(s => s.kling_status === 'failed').length;
    if (failedCount === 0) return res.status(400).json({ error: 'Geen mislukte scènes' });
    await retryFailedScenes(req.params.jobId);
    res.json({ ok: true, retrying_scenes: failedCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/render/:jobId/scenes — Vervang scènes array na bewerking
router.put('/:jobId/scenes', (req, res) => {
  try {
    const job = getJob(req.params.jobId);
    if (!job) return res.status(404).json({ error: 'Job niet gevonden' });

    const { scenes, subtitle_settings, voice_key, music_url, speaking_style } = req.body;
    if (!Array.isArray(scenes) || scenes.length === 0) {
      return res.status(400).json({ error: 'scenes array verplicht en mag niet leeg zijn' });
    }

    const updates = { scenes };
    if (subtitle_settings) updates.subtitle_settings = subtitle_settings;
    if (voice_key)        updates.voice_key          = voice_key;
    if (music_url)        updates.music_url          = music_url;
    if (speaking_style)   updates.speaking_style     = speaking_style;

    updateJob(req.params.jobId, updates);
    res.json({ ok: true, scene_count: scenes.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/render/:jobId/continue — Hervat pipeline na scène-bewerking
router.post('/:jobId/continue', async (req, res) => {
  try {
    const job = getJob(req.params.jobId);
    if (!job) return res.status(404).json({ error: 'Job niet gevonden' });

    await continueFromEditing(req.params.jobId);
    res.json({ ok: true, status: 'generating_audio' });
  } catch (err) {
    console.error('[POST /continue]', err.message);
    res.status(400).json({ error: err.message });
  }
});

// POST /api/render/:jobId/retry-render — Herrender zonder scènes opnieuw te genereren
router.post('/:jobId/retry-render', async (req, res) => {
  try {
    const job = getJob(req.params.jobId);
    if (!job) return res.status(404).json({ error: 'Job niet gevonden' });
    retryRender(req.params.jobId).catch(err => console.error('[retry-render]', err.message));
    res.json({ ok: true, status: 'rendering' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/render/:jobId/thumbnail — Upload eigen thumbnail afbeelding
router.post('/:jobId/thumbnail', thumbnailUpload.single('thumbnail'), (req, res) => {
  try {
    const job = getJob(req.params.jobId);
    if (!job) return res.status(404).json({ error: 'Job niet gevonden' });
    if (!req.file) return res.status(400).json({ error: 'Geen bestand ontvangen' });

    const thumbnailUrl = `/outputs/thumbnails/${req.params.jobId}.jpg`;
    updateJob(req.params.jobId, { thumbnail_url: thumbnailUrl });
    res.json({ ok: true, thumbnail_url: thumbnailUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/render/:jobId/upload-youtube — Upload voltooide video naar YouTube als unlisted
router.post('/:jobId/upload-youtube', async (req, res) => {
  try {
    const job = getJob(req.params.jobId);
    if (!job) return res.status(404).json({ error: 'Job niet gevonden' });
    if (job.status !== 'completed') return res.status(400).json({ error: 'Video nog niet klaar' });
    if (!job.file_path) return res.status(400).json({ error: 'Geen video bestand aanwezig' });

    const { uploadVideoToYouTube } = require('../services/youtubeService');
    const result = await uploadVideoToYouTube(job);

    updateJob(req.params.jobId, {
      youtube_id: result.youtube_id,
      youtube_url: result.youtube_url,
      youtube_shorts_url: result.youtube_shorts_url
    });

    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('[POST upload-youtube]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/render/:jobId/generate-higgsfield — Vraag Claude om Higgsfield te genereren
// Frontend roept dit aan; backend markeert job als klaar voor MCP generatie
router.post('/:jobId/generate-higgsfield', (req, res) => {
  try {
    const job = getJob(req.params.jobId);
    if (!job) return res.status(404).json({ error: 'Job niet gevonden' });

    const { updateJob } = require('../services/renderService');
    updateJob(req.params.jobId, {
      higgsfield_mcp_requested: true,
      higgsfield_mcp_requested_at: new Date().toISOString()
    });

    res.json({
      ok: true,
      message: 'Higgsfield MCP generatie aangevraagd',
      scenes: job.scenes?.map((s, i) => ({
        index: i,
        template: s.template,
        prompt: s.higgsfield_prompt,
        duration_seconds: Math.round((s.duration_frames || 90) / 30)
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
