/**
 * test-verify.js — Verificatierender voor alle fixes in deze sessie.
 * Uitvoeren vanuit backend/: node test-verify.js
 */
'use strict';

const path = require('path');
const fs   = require('fs');

// Gebruik paths.js zoals voorgeschreven in CLAUDE.md
const { OUTPUTS_DIR } = require('./src/paths');

const { bundle }                         = require('@remotion/bundler');
const { renderMedia, selectComposition } = require('@remotion/renderer');

const JOB_ID     = 'verify-' + Date.now();
const outputFile = path.join(OUTPUTS_DIR, `${JOB_ID}.mp4`);
const remotionDir = path.resolve(__dirname, '../remotion');
const bundleDir   = path.join(require('os').tmpdir(), 'vm_verify_bundle');

// ── Testdata: 3 scènes via 3 templates (dekt TransitionSeries + StatsCounter + outro) ──
const scenes = [
  {
    template:        'cinematic_title',
    duration_frames: 60,
    content:         { title: 'Verify Test', subtitle: 'Spring Animaties' },
    background_video_url: null,
  },
  {
    template:        'stats_counter',
    duration_frames: 90,
    content:         { stat_value: 1234567, stat_label: 'Views — tnum test', prefix: '' },
    background_video_url: null,
  },
  {
    template:        'outro_cta',
    duration_frames: 60,
    content:         { channel_name: '@VaultOfAges', subscribe_text: 'Abonneer Nu' },
    background_video_url: null,
  },
];

// Word timings voor subtitle safe-zone test
const wordTimings = [
  { word: 'Safe',     start_time: 0.0, end_time: 0.5 },
  { word: 'zone',     start_time: 0.5, end_time: 1.0 },
  { word: 'test',     start_time: 1.0, end_time: 1.5 },
  { word: 'ondertitel', start_time: 1.5, end_time: 2.2 },
];

const totalDurationInFrames = scenes.reduce((s, sc) => s + sc.duration_frames, 0); // 210

const inputProps = {
  scenes,
  audioUrl:              null,
  musicUrl:              null,
  wordTimings,
  subtitleSettings: {
    enabled:        true,
    fontSize:       'normaal',
    highlightColor: '#FFD700',
    position:       'onder',
    wordsPerLine:   3,
  },
  mode:                  'epic',
  totalDurationInFrames,
};

(async () => {
  console.log('=== VaultMotion Verificatierender ===');
  console.log(`OUTPUTS_DIR : ${OUTPUTS_DIR}`);
  console.log(`outputFile  : ${outputFile}`);
  console.log(`remotionDir : ${remotionDir}`);
  console.log(`totalFrames : ${totalDurationInFrames} (${(totalDurationInFrames/30).toFixed(1)}s)`);
  console.log(`scenes      : ${scenes.length}`);

  if (!fs.existsSync(OUTPUTS_DIR)) fs.mkdirSync(OUTPUTS_DIR, { recursive: true });
  if (fs.existsSync(bundleDir)) {
    fs.rmSync(bundleDir, { recursive: true, force: true });
    console.log('Bundle-cache gewist');
  }

  console.log('\n[1/3] Bundling Remotion...');
  const bundled = await bundle({
    entryPoint: path.join(remotionDir, 'src/index.ts'),
    outDir:     bundleDir,
    webpackOverride: c => c,
  });
  console.log('[1/3] Bundle klaar:', bundled);

  console.log('\n[2/3] Compositie selecteren...');
  const composition = await selectComposition({ serveUrl: bundled, id: 'VaultMotionVideo', inputProps });
  console.log(`[2/3] Compositie: ${composition.durationInFrames} frames, ${composition.width}x${composition.height}`);

  console.log('\n[3/3] Renderen...');
  await renderMedia({
    composition, serveUrl: bundled, codec: 'h264',
    outputLocation: outputFile, inputProps,
    pixelFormat: 'yuv420p', crf: 23,
    onProgress: ({ progress }) => {
      const pct = Math.round(progress * 100);
      if (pct % 10 === 0) process.stdout.write(`\r  voortgang: ${pct}%   `);
    },
  });
  process.stdout.write('\n');

  const stat     = fs.statSync(outputFile);
  const sizeKB   = Math.round(stat.size / 1024);
  const sizeMB   = (stat.size / 1024 / 1024).toFixed(2);

  console.log('\n=== RESULTAAT ===');
  console.log(`Pad         : ${outputFile}`);
  console.log(`Grootte     : ${stat.size} bytes (${sizeKB} KB / ${sizeMB} MB)`);
  console.log(`Aangemaakt  : ${stat.mtime.toISOString()}`);

  if (stat.size < 1000) {
    console.error('❌ FOUT: Bestand te klein — render mislukt (zelfde symptoom als 32-bytes-bug)');
    process.exit(1);
  }

  console.log('\n✅ Render geslaagd. Controleer visueel in een mediaspeler:');
  console.log('   — Scène 1→2 en 2→3: fade-overgang zonder hapering (TransitionSeries fix)');
  console.log('   — Ondertitels zichtbaar ≥170px van onder, ≥150px van boven (safe-zone fix)');
  console.log('   — CinematicTitle/OutroCTA: verende instap vs lineair (spring vs interpolate)');
  console.log('   — Stats counter: cijfers stabiel breed tijdens optellen (tabular-nums fix)');
})().catch(err => {
  console.error('\n❌ Render mislukt:', err.message);
  console.error(err.stack);
  process.exit(1);
});
