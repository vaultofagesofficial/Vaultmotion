'use strict';
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const { generateAnchorImage, createVideoTask, buildKlingPrompt, selectVideoModel } = require('../src/services/kieService');

// Testscènes — 4 types
const scenes = [
  { template: 'cinematic_title', duration_frames: 90,  script_segment: 'The Great Pyramid of Giza rises above the desert.', content: { title: 'The Great Pyramid', subtitle: 'Wonder of the Ancient World' } },
  { template: 'ken_burns',       duration_frames: 120, script_segment: 'Built by 20,000 workers over 20 years.', content: { text: 'Built by 20,000 workers over 20 years.' } },
  { template: 'timeline',        duration_frames: 120, script_segment: 'For 3,800 years it was the tallest structure on Earth.', content: { events: [] } },
  { template: 'outro_cta',       duration_frames: 90,  script_segment: 'Like and subscribe for more ancient wonders.', content: { title: 'Subscribe', subtitle: 'Like & Follow' } },
];

const ANCHOR_TEMPLATES = new Set(['cinematic_title', 'outro_cta']);
const styleAnchor = 'Ancient Egyptian desert landscape, Great Pyramid of Giza, warm golden-hour lighting, dusty amber atmosphere, cinematic documentary style';
const MODE = 'epic';

function ts() { return new Date().toISOString().slice(11, 23); }

(async () => {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  Variant A — ECHTE kie.ai test (geen mocks)');
  console.log('═══════════════════════════════════════════════════════\n');

  // ── Stap 1: Ankerbeeld genereren ──────────────────────────────────────────
  console.log(`[${ts()}] STAP 1: Ankerbeeld genereren (kling-2.1/text-to-image)...`);
  const anchorStart = Date.now();

  let anchorImageUrl = null;
  try {
    anchorImageUrl = await generateAnchorImage(styleAnchor);
    const anchorElapsed = Math.round((Date.now() - anchorStart) / 1000);
    console.log(`\n✅ Ankerbeeld klaar na ${anchorElapsed}s`);
    console.log(`   anchor_image_url: ${anchorImageUrl}`);
    console.log(`   Model gebruikt:   kling-2.1/text-to-image (zie createTask body hierboven)`);
  } catch (err) {
    console.error(`❌ Ankerbeeld mislukt: ${err.message}`);
    process.exit(1);
  }

  // ── Stap 2: Tasks aanmaken per scène — log payload + response ─────────────
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  STAP 2: Video-tasks aanmaken per scène');
  console.log('═══════════════════════════════════════════════════════\n');

  const taskResults = [];

  for (const [idx, scene] of scenes.entries()) {
    const isAnchor     = ANCHOR_TEMPLATES.has(scene.template);
    const startImgUrl  = isAnchor ? anchorImageUrl : null;
    const prompt       = buildKlingPrompt(scene, MODE, styleAnchor);
    const { model, resolution } = selectVideoModel(MODE, scene.template);

    // Effectief model (geen switch meer — kling-2.6/image-to-video niet beschikbaar op dit account)
    const effectiveModel = model;

    console.log(`── Scène ${idx} (${scene.template}) ──`);
    console.log(`   Anchor-scène:     ${isAnchor ? 'JA' : 'NEE'}`);
    console.log(`   start_image_url:  ${startImgUrl ? startImgUrl.slice(0, 80) + '...' : 'geen'}`);
    console.log(`   Model (gepland):  ${effectiveModel}`);
    console.log(`   Resolution:       ${resolution}`);

    const t0 = Date.now();
    try {
      const taskId = await createVideoTask(prompt, model, resolution, startImgUrl);
      const elapsed = Math.round((Date.now() - t0) / 1000);
      console.log(`   ✅ taskId:         ${taskId} (${elapsed}s)\n`);
      taskResults.push({ scene: idx, template: scene.template, taskId, effectiveModel, hasAnchor: isAnchor, startImgUrl: !!startImgUrl });
    } catch (err) {
      console.error(`   ❌ Fout: ${err.message}\n`);
      taskResults.push({ scene: idx, template: scene.template, error: err.message, hasAnchor: isAnchor, startImgUrl: !!startImgUrl });
    }

    await new Promise(r => setTimeout(r, 800)); // kort pauze tussen calls
  }

  // ── Samenvatting ──────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  VERIFICATIE SAMENVATTING');
  console.log('═══════════════════════════════════════════════════════\n');

  console.log(`anchor_image_url (kling-2.1/text-to-image):`);
  console.log(`  ${anchorImageUrl}\n`);

  console.log('Scene-tasks:');
  taskResults.forEach(r => {
    const anchorMark = r.startImgUrl ? '✅ start_image_url aanwezig' : '✅ geen start_image_url';
    const modelMark  = r.effectiveModel || '—';
    const idMark     = r.taskId ? `taskId=${r.taskId}` : `FOUT: ${r.error}`;
    console.log(`  [${r.scene}] ${r.template.padEnd(18)} ${anchorMark} | model=${modelMark} | ${idMark}`);
  });

  // Verificatie-checks
  const anchorsCreated  = taskResults.filter(r => ANCHOR_TEMPLATES.has(r.template)).every(r => r.taskId);
  const nonAnchorOk     = taskResults.filter(r => !ANCHOR_TEMPLATES.has(r.template)).every(r => !r.startImgUrl);
  const anchorUsedKling = taskResults.filter(r => ANCHOR_TEMPLATES.has(r.template)).every(r => r.effectiveModel?.includes('kling-2.6'));

  console.log(`\nAnker-scènes (cinematic_title/outro_cta) succesvol aangemaakt: ${anchorsCreated ? '✅' : '❌'}`);
  console.log(`Anker-scènes gebruiken kling-2.6/text-to-video:              ${anchorUsedKling ? '✅' : '❌'}`);
  console.log(`Non-anchor scènes hebben geen start_image_url:               ${nonAnchorOk ? '✅' : '❌'}`);
  console.log('\nNoot: kling-2.6/image-to-video retourneert 500 voor alle inputconfiguraties (getest juni 2026).');
  console.log('      Visuele consistentie via style_anchor tekstprefix (Variant B) — Variant A image-to-video uitgeschakeld.');

  const anchorElapsedTotal = Math.round((Date.now() - anchorStart) / 1000);
  console.log(`\nTotale uitvoertijd (incl. ankerbeeld + 4 tasks): ${anchorElapsedTotal}s`);
  console.log('\nNoot: Video-polling (10-40 min per scène) niet uitgevoerd in deze test.');
  console.log('Task-IDs hierboven zijn bewijs dat de echte API de aanvragen heeft geaccepteerd.');
})();
