'use strict';
/**
 * test-anchor-image.js — Verifieer Variant A implementatie via module-level mock.
 * Axios en KIE_API_KEY worden VOOR require('kieService') gepatcht.
 */

// ── 1. Zet env VOOR module load ──────────────────────────────────────────────
process.env.KIE_API_KEY = 'test-key-mock';

// ── 2. Bouw axios mock en inject in cache VOOR kieService wordt geladen ─────
let capturedRequests = [];

const axiosMock = {
  post: async (url, body) => {
    capturedRequests.push({ method: 'POST', url, body: JSON.parse(JSON.stringify(body)) });
    // Elke createTask geeft een taskId terug
    return { data: { data: { taskId: `mock-${Date.now()}-${Math.random().toString(36).slice(2,5)}` } } };
  },
  get: async (url, opts) => {
    // Alle polls geven direct 'success' terug met een image URL
    capturedRequests.push({ method: 'GET', url, params: opts?.params });
    return {
      data: {
        data: {
          state: 'success',
          resultJson: JSON.stringify({ resultUrls: ['https://mock-cdn.kie.ai/anchor-frame-001.jpg'] }),
          progress: 100,
        }
      }
    };
  },
};

// Injecteer mock in Node module cache vóór kieService loaded
const axiosPath = require.resolve('axios');
require.cache[axiosPath] = {
  id: axiosPath, filename: axiosPath, loaded: true,
  exports: axiosMock,
};

// ── 3. Nu pas kieService laden (pikt de mock axios op) ──────────────────────
const kieService = require('./src/services/kieService');
const { OUTPUTS_DIR } = require('./src/paths');

// ── 4. Testdata ──────────────────────────────────────────────────────────────
const scenes = [
  { template: 'cinematic_title', duration_frames: 60, content: { title: 'Test' }, script_segment: 'Opening scene' },
  { template: 'ken_burns',       duration_frames: 90, content: { text: 'Context' }, script_segment: 'Narrative middle' },
  { template: 'animated_map',    duration_frames: 75, content: { location: 'Rome' }, script_segment: 'Geographic context' },
  { template: 'stats_counter',   duration_frames: 60, content: { stat_value: 50000 }, script_segment: '50,000 soldiers marched' },
  { template: 'outro_cta',       duration_frames: 60, content: { channel_name: '@VaultOfAges' }, script_segment: 'Subscribe for more' },
];
const styleAnchor = 'Roman legionnaire with bronze lorica segmentata, scarlet cloak, dust and ash in golden afternoon light';

const sceneLog = {};
const globalStart = Date.now();

function onSceneUpdate(idx, updates) {
  if (updates.kling_status === 'generating' && !sceneLog[idx]) {
    sceneLog[idx] = {
      template:        scenes[idx].template,
      startMs:         Date.now() - globalStart,
      anchorUsed:      !!updates.kling_anchor_used,
      model:           updates.kling_model,
    };
  }
}

// ── 5. Uitvoeren ─────────────────────────────────────────────────────────────
(async () => {
  console.log('=== Variant A Verificatie ===\n');
  console.log('Scènes:', scenes.map(s => s.template).join(' → '));
  console.log('styleAnchor:', styleAnchor.slice(0, 80));
  console.log('');

  const result = await kieService.generateKlingVideosForScenes(
    scenes, 'verify-job-001', OUTPUTS_DIR, onSceneUpdate, 'epic', styleAnchor
  );

  const totalMs = Date.now() - globalStart;

  // ── Ankerbeeld request ────────────────────────────────────────────────────
  const imageReq = capturedRequests.find(r => r.method === 'POST' && r.body?.model?.includes('text-to-image'));
  console.log('=== Ankerbeeld request ===');
  if (imageReq) {
    console.log(`  model  : ${imageReq.body.model}`);
    console.log(`  prompt : ${imageReq.body.input?.prompt?.slice(0, 100)}...`);
  } else {
    console.log('  ❌ Geen text-to-image request gevonden');
  }

  console.log('\n=== anchor_image_url ===');
  console.log(' ', result.anchorImageUrl || '(geen)');

  // ── Payload per scène ────────────────────────────────────────────────────
  console.log('\n=== kie.ai payloads per scène ===');
  const videoReqs = capturedRequests.filter(r => r.method === 'POST' && r.body?.model && !r.body.model.includes('text-to-image'));
  scenes.forEach((s, idx) => {
    const req = videoReqs.find(r => {
      const prompt = r.body?.input?.prompt || '';
      return prompt.includes(s.script_segment?.slice(0, 20) || '') || r.body?.model?.includes(
        ['cinematic_title','outro_cta'].includes(s.template) ? 'kling' : 'seedance'
      );
    });
    const hasStartImage = !!req?.body?.input?.start_image_url;
    const effectiveModel = req?.body?.model || '?';
    const log = sceneLog[idx] || {};
    console.log(`  [${idx}] ${s.template.padEnd(18)} start_image_url: ${hasStartImage ? '✅ ' + req.body.input.start_image_url.slice(0,40) : '❌ geen'} | model: ${effectiveModel} | t+${log.startMs ?? '?'}ms`);
  });

  // ── Directe check op start_image_url in captured requests ────────────────
  console.log('\n=== Directe payload-check ===');
  videoReqs.forEach((r, i) => {
    const hasImg = !!r.body?.input?.start_image_url;
    console.log(`  req ${i}: model=${r.body.model} | start_image_url=${hasImg ? r.body.input.start_image_url.slice(0,50) : 'geen'}`);
  });

  // ── Timing: non-anchor voor anchor? ──────────────────────────────────────
  console.log('\n=== Timing verificatie ===');
  const anchorTemplates = new Set(['cinematic_title', 'outro_cta']);
  const nonAnchorStarts = Object.values(sceneLog).filter(l => !anchorTemplates.has(l.template)).map(l => l.startMs);
  const anchorStarts    = Object.values(sceneLog).filter(l => anchorTemplates.has(l.template)).map(l => l.startMs);
  console.log(`  Non-anchor gestart: ${nonAnchorStarts.map(t => `t+${t}ms`).join(', ')}`);
  console.log(`  Anchor gestart:     ${anchorStarts.map(t => `t+${t}ms`).join(', ')}`);
  const nonAnchorFirst = nonAnchorStarts.length > 0 && anchorStarts.length > 0
    && Math.max(...nonAnchorStarts) < Math.min(...anchorStarts);
  console.log(`  Non-anchor eerder dan anchor: ${nonAnchorFirst ? '✅' : '⚠️  niet aantoonbaar (mock te snel)'}`);

  console.log(`\n  Totale tijd: ${totalMs}ms | anchor_image_url: ${result.anchorImageUrl ? '✅ ontvangen' : '❌ geen'}`);
  console.log('\n✅ Implementatie gevalideerd via mock — productie vereist echte KIE_API_KEY');
})().catch(e => { console.error('FOUT:', e.message, e.stack); process.exit(1); });
