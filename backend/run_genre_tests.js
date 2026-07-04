/**
 * Sequentiële testrenders voor howto / comparison / mystery formats.
 * Uitvoeren vanuit backend/ map.
 */
require('dotenv').config({ path: '.env' });

const fs      = require('fs');
const path    = require('path');
const express = require('express');
const { startRenderJob, getJob, continueFromEditing } = require('./src/services/renderService');
const { OUTPUTS_DIR } = require('./src/paths');

// Remotion's browser loads media via http://localhost:PORT/outputs/...
// Start a minimal static file server so those requests resolve.
const ASSETS_DIR = path.resolve(__dirname, 'assets');
const PORT = process.env.PORT || 3002;
const staticServer = express();
staticServer.use('/outputs', express.static(OUTPUTS_DIR));
staticServer.use('/assets', express.static(ASSETS_DIR));
staticServer.listen(PORT, () => console.log(`[TestRunner] Statische server gestart op poort ${PORT}`));

const VAULT_OF_AGES_SCRIPT = `Did you know some ancient discoveries completely erased what we thought we knew about civilization? Göbekli Tepe pushed human organized society back 6,000 years. The Antikythera Mechanism proved ancient Greeks built a working computer 2,000 years ago. The Voynich Manuscript remains completely undeciphered after 600 years. Follow VaultOfAges for more.`;

const TESTS = [
  {
    label:            'Vault of Ages — hybrid/low / 30s',
    topic:            VAULT_OF_AGES_SCRIPT,
    format:           'mystery',
    mode:             'epic',
    style:            'epic',
    render_style:     'hybrid',
    hybrid_intensity: 'high',
    duration:         30,
    voiceKey:         'en_male',
    subtitleStyle:    'karaoke-box',
    wordsPerLine:     4,
    preview:          false,
    adaptive_strategy: true,
  },
];

async function poll(jobId, label, timeoutMs = 1800000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await new Promise(r => setTimeout(r, 8000));
    const job = getJob(jobId);
    if (!job) { console.log(`[${label}] Job niet gevonden`); return null; }
    const { status, progress } = job;
    console.log(`[${label}] status=${status} progress=${progress}%`);
    if (status === 'completed' || status === 'failed') return job;
    // Scène-editor stap: direct doorgaan
    if (status === 'editing') {
      console.log(`[${label}] editing — continue pipeline`);
      await continueFromEditing(jobId);
    }
  }
  return null;
}

async function runTest(test) {
  console.log(`\n${'='.repeat(60)}\n${test.label}\n${'='.repeat(60)}`);

  const result = await startRenderJob({
    script:       test.topic,
    title:        test.topic,
    style:        test.style,
    mode:         test.mode,
    format:       test.format,
    duration:     test.duration,
    render_style:      test.render_style,
    hybrid_intensity:  test.hybrid_intensity,
    voiceKey:          test.voiceKey,
    preview:           test.preview || false,
    adaptive_strategy: test.adaptive_strategy || false,
    subtitleSettings: {
      enabled:       true,
      fontSize:      'normaal',
      highlightColor:'#FFD700',
      position:      'onder',
      subtitleStyle: test.subtitleStyle || 'standard',
      wordsPerLine:  test.wordsPerLine  || 3,
    },
  });

  const jobId = result.job_id;
  console.log(`[${test.label}] Job gestart: ${jobId}`);

  const job = await poll(jobId, test.label);
  if (!job) { console.log(`[${test.label}] TIMEOUT`); return; }

  console.log(`\n--- ${test.label} RAPPORT ---`);
  console.log(`Status:           ${job.status}`);
  if (job.error) console.log(`Fout:             ${job.error}`);

  const templates = (job.scenes || []).map(s => s.template).join(', ');
  console.log(`Templates:        ${templates}`);
  console.log(`Fact-anim:        ${(job.scenes||[]).some(s=>s.template==='fact_animation')}`);
  console.log(`Data-comparison:  ${(job.scenes||[]).some(s=>s.template==='data_comparison')}`);
  console.log(`Anchor image:     ${job.anchor_image_url || 'n/a'}`);
  console.log(`Audio URL:        ${job.audio_url || 'ONTBREEKT'}`);
  console.log(`Warnings:         ${JSON.stringify(job.validation_warnings || [])}`);

  // Script eerste 3 zinnen
  const fullScript = (job.scenes || []).map(s => s.script_segment || '').join(' ');
  const sentences  = fullScript.match(/[^.!?]+[.!?]+/g) || [];
  console.log(`Script (3 zinnen):`);
  sentences.slice(0, 3).forEach((s, i) => console.log(`  ${i+1}. ${s.trim()}`));

  // Outputbestand
  if (job.video_url) {
    const fname    = path.basename(job.video_url);
    const fullPath = path.join(OUTPUTS_DIR, fname);
    const exists   = fs.existsSync(fullPath);
    const size     = exists ? fs.statSync(fullPath).size : 0;
    console.log(`Output:           ${fullPath}`);
    console.log(`Bestandsgrootte:  ${exists ? Math.round(size/1024) + ' KB' : 'BESTAND NIET GEVONDEN'}`);
  }

  // Achtergrondbeelden 1080×1920 check (ai-image)
  if (test.render_style === 'ai-image' && job.scenes) {
    const sharp = require('sharp');
    for (const [i, scene] of job.scenes.entries()) {
      if (scene.background_image_url) {
        const imgPath = path.join(OUTPUTS_DIR, 'backgrounds', `${jobId}_scene${i}.jpg`);
        if (fs.existsSync(imgPath)) {
          const meta = await sharp(imgPath).metadata();
          console.log(`  Scène ${i} beeld: ${meta.width}×${meta.height} (verwacht 1080×1920)`);
        }
      }
    }
  }
}

(async () => {
  for (const test of TESTS) {
    try {
      await runTest(test);
    } catch (e) {
      console.error(`[${test.label}] FOUT:`, e.message);
    }
  }
  console.log('\n=== ALLE TESTS KLAAR ===');
  process.exit(0);
})();
