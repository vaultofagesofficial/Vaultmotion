// Eenmalig test-script: roept renderWithRemotion direct aan
require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const os   = require('os');

const OUTPUTS_DIR = path.resolve(__dirname, '../../outputs');
const jobId       = '57e837ee-a1b9-4cbf-b241-36d50d26d885';
const jobsPath    = path.resolve(__dirname, 'jobs.json');

console.log('=== TEST-RENDER START ===');
console.log('Node:', process.version);
console.log('PID:', process.pid);
console.log('jobs.json:', jobsPath);
console.log('outputs:', OUTPUTS_DIR);

const jobs = JSON.parse(fs.readFileSync(jobsPath, 'utf8'));
const job  = jobs[jobId];
if (!job) { console.error('JOB NIET GEVONDEN'); process.exit(1); }

console.log('Job status:', job.status);
console.log('Scenes:', job.scenes?.length);
job.scenes?.forEach((s, i) => console.log(` Scène ${i}: ${s.template} | kling: ${s.kling_status} | bg: ${s.background_video_url ? 'JA' : 'NEE'}`));

// Exact dezelfde logica als renderWithRemotion
const scenes = job.scenes;
const totalFrames = scenes && scenes.length > 0
  ? scenes.reduce((sum, s) => sum + (s.duration_frames || 90), 0)
  : (job.duration || 60) * 30;

console.log('totalFrames (berekend):', totalFrames);

const inputProps = {
  scenes,
  audioUrl:              job.audio_url   || null,
  musicUrl:              job.music_url   || null,
  wordTimings:           job.word_timings || [],
  subtitleSettings:      job.subtitle_settings,
  mode:                  job.mode || 'documentary',
  totalDurationInFrames: totalFrames,
};

const outputFile  = path.join(OUTPUTS_DIR, `${jobId}.mp4`);
const remotionDir = path.resolve(__dirname, '../remotion');
const bundleDir   = path.join(os.tmpdir(), 'vaultmotion_bundle');

console.log('outputFile:', outputFile);
console.log('remotionDir:', remotionDir);
console.log('bundleDir:', bundleDir);

const { bundle }                         = require('@remotion/bundler');
const { renderMedia, selectComposition } = require('@remotion/renderer');
console.log('@remotion/bundler versie:', require('@remotion/bundler/package.json').version);
console.log('@remotion/renderer versie:', require('@remotion/renderer/package.json').version);

if (fs.existsSync(bundleDir)) {
  fs.rmSync(bundleDir, { recursive: true, force: true });
  console.log('Oude bundle-cache verwijderd');
}

console.log('\n--- BUNDLING ---');
bundle({ entryPoint: path.join(remotionDir, 'src/index.ts'), outDir: bundleDir, webpackOverride: c => c })
  .then(bundled => {
    console.log('Bundle OK:', bundled);
    return selectComposition({ serveUrl: bundled, id: 'VaultMotionVideo', inputProps });
  })
  .then(comp => {
    console.log(`Compositie OK: ${comp.durationInFrames} frames, ${comp.width}x${comp.height}`);
    console.log('\n--- RENDER START ---');
    return renderMedia({
      composition: comp,
      serveUrl: bundleDir,
      codec: 'h264',
      outputLocation: outputFile,
      inputProps,
      pixelFormat: 'yuv420p',
      crf: 23,
      onProgress: ({ progress, renderedFrames }) => {
        process.stdout.write(`\r[${Math.round(progress * 100)}%] ${renderedFrames} frames   `);
      },
    });
  })
  .then(() => {
    const sz = fs.existsSync(outputFile) ? fs.statSync(outputFile).size : 0;
    console.log('\n\n--- RESULTAAT ---');
    console.log('Bestandsgrootte:', sz, 'bytes /', Math.round(sz / 1024), 'KB');
    console.log(sz < 1000 ? '❌ BESTAND TE KLEIN' : '✅ RENDER GESLAAGD');
  })
  .catch(err => {
    console.error('\n\n--- FOUT ---');
    console.error('Message:', err.message);
    console.error('Stack:', err.stack);
    process.exit(1);
  });
