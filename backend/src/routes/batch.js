'use strict';
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router  = express.Router();

const { analyzeScript }      = require('../services/claudeAnalyzer');
const { createBatch, getBatch, updateBatch, getAllBatches } = require('../services/batchService');
const { getJob, updateJob, continueFromEditing }            = require('../services/renderService');
const { JOBS_FILE }          = require('../paths');
const fs   = require('fs');

const MAX_CONCURRENT_RENDERS = 2;

// ── helpers voor job-aanmaak zonder analyse ─────────────────────────────────

function loadJobs() {
  try {
    if (fs.existsSync(JOBS_FILE)) return JSON.parse(fs.readFileSync(JOBS_FILE, 'utf8'));
  } catch (e) {}
  return {};
}
function saveJobs(jobs) {
  try { fs.writeFileSync(JOBS_FILE, JSON.stringify(jobs, null, 2)); } catch (e) {}
}

function createStoryboardJob({ jobId, script, title, style, mode, duration, scenes, styleAnchor, validationWarnings, templateDecisions, batchId, batchIndex }) {
  const job = {
    id:          jobId,
    title:       title || 'Untitled Short',
    script:      script || '',
    style:       style || 'documentaire',
    mode:        mode  || (style === 'epic' ? 'epic' : 'documentary'),
    duration:    duration || 60,
    voice_key:   'en_male',
    audio_url:   null,
    music_url:   null,
    status:      'storyboard_ready',
    progress:    20,
    scenes:      scenes || [],
    style_anchor:  styleAnchor || '',
    word_timings:  [],
    subtitle_settings: { enabled: true, fontSize: 'normaal', highlightColor: '#FFD700', position: 'onder' },
    video_url:   null,
    file_path:   null,
    error:       null,
    batch_id:    batchId,
    batch_index: batchIndex,
    template_decisions:  templateDecisions  || [],
    validation_warnings: validationWarnings || [],
    created_at:  new Date().toISOString(),
    updated_at:  new Date().toISOString(),
  };
  const jobs = loadJobs();
  jobs[jobId] = job;
  saveJobs(jobs);
  return job;
}

// ── POST /api/batch/storyboards ──────────────────────────────────────────────
// body: { items: [{ topic, mode, duration }], title_prefix? }
router.post('/storyboards', async (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items array verplicht' });
  }
  if (items.length > 8) {
    return res.status(400).json({ error: 'Maximum 8 items per batch' });
  }

  const batch = createBatch({ items });
  const results = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const jobId = uuidv4();

    if (!item.topic || item.topic.trim().length < 3) {
      results.push({ index: i, job_id: null, status: 'failed', error: 'Topic te kort of leeg' });
      continue;
    }

    try {
      const style    = item.mode === 'epic' ? 'epic' : 'documentaire';
      const duration = item.duration || 60;
      const { scenes, styleAnchor, validationWarnings, templateDecisions } =
        await analyzeScript(item.topic, style, duration);

      const job = createStoryboardJob({
        jobId, script: item.topic, title: item.topic.slice(0, 60),
        style, mode: item.mode || 'documentary', duration,
        scenes, styleAnchor, validationWarnings, templateDecisions,
        batchId: batch.id, batchIndex: i,
      });

      results.push({
        index:     i,
        job_id:    jobId,
        status:    'storyboard_ready',
        title:     job.title,
        style_anchor:       styleAnchor,
        template_decisions: templateDecisions,
        validation_warnings: validationWarnings,
        scenes:    scenes.map(s => ({ template: s.template, duration_frames: s.duration_frames, script_segment: s.script_segment, facts: s.facts || [], comparison: s.comparison || null })),
      });

      // Voeg job_id toe aan batch
      const currentBatch = getBatch(batch.id);
      updateBatch(batch.id, { job_ids: [...(currentBatch.job_ids || []), jobId] });

    } catch (err) {
      console.error(`[batch/storyboards] Item ${i} mislukt:`, err.message);
      results.push({ index: i, job_id: null, status: 'failed', error: err.message.slice(0, 200) });
    }

    // Korte pauze tussen Claude-calls
    if (i < items.length - 1) await new Promise(r => setTimeout(r, 1500));
  }

  const finalBatch = getBatch(batch.id);
  res.json({
    batch_id:    batch.id,
    total:       items.length,
    succeeded:   results.filter(r => r.status === 'storyboard_ready').length,
    failed:      results.filter(r => r.status === 'failed').length,
    results,
    batch:       finalBatch,
  });
});

// ── POST /api/batch/render ───────────────────────────────────────────────────
// body: { batch_id, approved_job_ids: [jobId, ...] }
router.post('/render', async (req, res) => {
  const { batch_id, approved_job_ids } = req.body;
  if (!batch_id) return res.status(400).json({ error: 'batch_id verplicht' });
  if (!Array.isArray(approved_job_ids) || approved_job_ids.length === 0) {
    return res.status(400).json({ error: 'approved_job_ids verplicht' });
  }

  const batch = getBatch(batch_id);
  if (!batch) return res.status(404).json({ error: 'Batch niet gevonden' });

  // Valideer: enkel job_ids die tot deze batch behoren
  const validIds = approved_job_ids.filter(id => batch.job_ids.includes(id));
  if (validIds.length === 0) return res.status(400).json({ error: 'Geen geldige job_ids voor deze batch' });

  updateBatch(batch_id, { approved_ids: validIds, status: 'rendering' });

  // Stel status in: eerste MAX_CONCURRENT_RENDERS → 'editing' (start render)
  // overige → 'queued'
  const renderStatuses = validIds.map((jobId, idx) => {
    const status = idx < MAX_CONCURRENT_RENDERS ? 'starting' : 'queued';
    updateJob(jobId, { status: idx < MAX_CONCURRENT_RENDERS ? 'editing' : 'queued', error: null });
    return { job_id: jobId, render_status: status };
  });

  res.json({
    batch_id,
    approved_count:        validIds.length,
    max_concurrent:        MAX_CONCURRENT_RENDERS,
    immediately_started:   Math.min(validIds.length, MAX_CONCURRENT_RENDERS),
    queued:                Math.max(0, validIds.length - MAX_CONCURRENT_RENDERS),
    statuses:              renderStatuses,
  });

  // Start renders asynchroon (na response)
  startBatchRenders(batch_id, validIds).catch(err => {
    console.error('[batch/render] Async render fout:', err.message);
  });
});

async function startBatchRenders(batchId, jobIds) {
  let running = 0;
  let idx     = 0;

  async function launchNext() {
    while (idx < jobIds.length && running < MAX_CONCURRENT_RENDERS) {
      const jobId = jobIds[idx++];
      running++;
      // Zet status altijd naar 'editing' zodat continueFromEditing kan starten (ook voor queued items)
      updateJob(jobId, { status: 'editing', error: null });
      console.log(`[BatchRender] Start render job ${jobId} (slot ${running}/${MAX_CONCURRENT_RENDERS})`);
      continueFromEditing(jobId)
        .catch(err => {
          console.error(`[BatchRender] Job ${jobId} mislukt:`, err.message);
          updateJob(jobId, { status: 'failed', error: err.message });
        })
        .finally(() => {
          running--;
          launchNext();
        });
    }
    if (idx >= jobIds.length && running === 0) {
      updateBatch(batchId, { status: 'completed' });
      console.log(`[BatchRender] Batch ${batchId} voltooid`);
    }
  }

  await launchNext();
}

// ── GET /api/batch/:batchId ──────────────────────────────────────────────────
router.get('/:batchId', (req, res) => {
  const batch = getBatch(req.params.batchId);
  if (!batch) return res.status(404).json({ error: 'Batch niet gevonden' });
  res.json(batch);
});

// ── GET /api/batch ───────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  res.json(getAllBatches());
});

module.exports = router;
