const express  = require('express');
const fs        = require('fs');
const path      = require('path');
const router    = express.Router();
const { startRenderJob, getJob } = require('../services/renderService');
const { selectModeFromTopic }    = require('../services/claudeAnalyzer');
const { OUTPUTS_DIR } = require('../paths');

const FEEDBACK_FILE = path.join(OUTPUTS_DIR, 'feedback.json');

function loadFeedback() {
  try {
    if (fs.existsSync(FEEDBACK_FILE)) return JSON.parse(fs.readFileSync(FEEDBACK_FILE, 'utf8'));
  } catch {}
  return {};
}

function saveFeedback(data) {
  try { fs.writeFileSync(FEEDBACK_FILE, JSON.stringify(data, null, 2)); } catch {}
}

// POST /api/vaultboost/webhook — start een render job vanuit VaultBoost
router.post('/webhook', async (req, res) => {
  try {
    const { topic, script, trending_score, source, mode, auto_upload = false, voice_key, duration, render_style, hybrid_intensity, workspace_id } = req.body;
    if (!topic || topic.trim().length < 3) {
      return res.status(400).json({ error: 'topic is verplicht (min. 3 tekens)' });
    }

    const resolvedMode = mode || selectModeFromTopic(topic);

    const result = await startRenderJob({
      script:   (script && script.trim().length >= 10) ? script.trim() : topic,
      title:    topic,
      mode:     resolvedMode,
      duration: duration || 60,
      voiceKey: voice_key || 'en_male',
      render_style: render_style || undefined,
      hybrid_intensity: hybrid_intensity || undefined,
      workspace_id: workspace_id || undefined,
      subtitleSettings: { enabled: true, fontSize: 'normaal', highlightColor: '#FFD700', position: 'onder' },
      vaultboost_meta: { trending_score, source, auto_upload, resolved_mode: resolvedMode },
    });

    res.json({ job_id: result.job_id, status: result.status, estimated_time: result.estimated_time, mode: resolvedMode });
  } catch (err) {
    console.error('[VaultBoost webhook]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/vaultboost/status/:jobId
router.get('/status/:jobId', (req, res) => {
  try {
    const job = getJob(req.params.jobId);
    if (!job) return res.status(404).json({ error: 'Job niet gevonden' });

    res.json({
      job_id:           job.id,
      status:           job.status,
      progress:         job.progress,
      mode:             job.mode,
      video_url:        job.video_url || null,
      error:            job.error     || null,
      ready_for_upload: job.status === 'completed',
      youtube_url:      job.youtube_url || null,
      created_at:       job.created_at,
      completed_at:     job.completed_at || null,
      vaultboost_meta:  job.vaultboost_meta || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/vaultboost/feedback — sla performance data op
router.post('/feedback', (req, res) => {
  try {
    const { job_id, views, ctr, retention } = req.body;
    if (!job_id) return res.status(400).json({ error: 'job_id is verplicht' });

    const job = getJob(job_id);
    const feedback = loadFeedback();

    feedback[job_id] = {
      job_id,
      views:     views     ?? null,
      ctr:       ctr       ?? null,
      retention: retention ?? null,
      mode:      job?.mode || null,
      title:     job?.title || null,
      recorded_at: new Date().toISOString(),
    };

    saveFeedback(feedback);
    res.json({ ok: true, job_id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
