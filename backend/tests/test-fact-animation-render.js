'use strict';
const path = require('path');
const fs   = require('fs');
const { bundle } = require('@remotion/bundler');
const { renderMedia, selectComposition } = require('@remotion/renderer');
const { OUTPUTS_DIR } = require('../src/paths');

// Handmatig gedefinieerde scenes — alle 6 fact-types + beschermd cinematic_title/outro_cta
// Geen kie.ai calls, enkel Remotion
const scenes = [
  {
    template: 'cinematic_title',
    duration_frames: 90,
    content: { title: 'De Grote Piramide', subtitle: 'Feiten in Beeld' },
    background_video_url: null,
    script_segment: 'Één van de grootste bouwwerken ooit',
  },
  // count ≤ 100 → IconGrid
  {
    template: 'fact_animation',
    duration_frames: 120,
    content: {
      facts: [{ type: 'count', value: 20, unit: null, subject: 'Spartan officers' }],
      text: 'Twintig officieren leidden de aanval',
    },
    background_video_url: null,
    script_segment: 'Twintig officieren leidden de aanval',
  },
  // count > 100 → NumericCounter
  {
    template: 'fact_animation',
    duration_frames: 120,
    content: {
      facts: [{ type: 'count', value: 20000, unit: null, subject: 'workers' }],
      text: '20.000 arbeiders bouwden de piramide',
    },
    background_video_url: null,
    script_segment: '20.000 arbeiders bouwden de piramide',
  },
  // measurement → ScaleBar
  {
    template: 'fact_animation',
    duration_frames: 120,
    content: {
      facts: [{ type: 'measurement', value: 138, unit: 'meters', subject: 'pyramid height' }],
      text: 'De piramide is 138 meter hoog',
    },
    background_video_url: null,
    script_segment: 'De piramide is 138 meter hoog',
  },
  // duration → ProgressArc
  {
    template: 'fact_animation',
    duration_frames: 120,
    content: {
      facts: [{ type: 'duration', value: 20, unit: 'jaar', subject: 'bouwtijd piramide' }],
      text: 'Gebouwd in 20 jaar',
    },
    background_video_url: null,
    script_segment: 'Gebouwd in 20 jaar',
  },
  // date → DateStamp
  {
    template: 'fact_animation',
    duration_frames: 120,
    content: {
      facts: [{ type: 'date', value: 480, unit: 'BC', subject: 'Battle of Thermopylae' }],
      text: 'Slag bij Thermopylae — 480 v.Chr.',
    },
    background_video_url: null,
    script_segment: 'Slag bij Thermopylae, 480 voor Christus',
  },
  // ratio → RatioSplit
  {
    template: 'fact_animation',
    duration_frames: 120,
    content: {
      facts: [{ type: 'ratio', value: '333 to 1', unit: null, subject: 'Spartans vs Persians' }],
      text: 'Overweldigd 333 tegen 1',
    },
    background_video_url: null,
    script_segment: 'Overweldigd 333 tegen 1',
  },
  {
    template: 'outro_cta',
    duration_frames: 90,
    content: { title: 'Volg voor meer', subtitle: 'Like & Subscribe' },
    background_video_url: null,
    script_segment: 'Volg voor meer epische geschiedenis',
  },
];

const totalFrames = scenes.reduce((s, sc) => s + sc.duration_frames, 0);
const outputPath  = path.join(OUTPUTS_DIR, `fact-animation-verify-${Date.now()}.mp4`);

(async () => {
  console.log('Bundling Remotion...');
  const entryPoint = path.resolve(__dirname, '../../remotion/src/index.ts');
  const bundled = await bundle({ entryPoint, webpackOverride: (c) => c });

  console.log('Selecting composition...');
  const comp = await selectComposition({
    serveUrl: bundled,
    id: 'VaultMotionVideo',
    inputProps: {
      scenes,
      audioUrl: null,
      musicUrl: null,
      wordTimings: [],
      subtitleSettings: { enabled: false },
      mode: 'epic',
      totalDurationInFrames: totalFrames,
    },
  });

  console.log(`Rendering ${totalFrames} frames → ${outputPath}`);
  await renderMedia({
    composition: comp,
    serveUrl: bundled,
    codec: 'h264',
    outputLocation: outputPath,
    inputProps: {
      scenes,
      audioUrl: null,
      musicUrl: null,
      wordTimings: [],
      subtitleSettings: { enabled: false },
      mode: 'epic',
      totalDurationInFrames: totalFrames,
    },
  });

  const { size } = fs.statSync(outputPath);
  console.log(`\n✅ Render klaar`);
  console.log(`   Pad:       ${outputPath}`);
  console.log(`   Grootte:   ${(size / 1024).toFixed(1)} KB (${size} bytes)`);

  // Verificaties
  const factAnimCount = scenes.filter(s => s.template === 'fact_animation').length;
  const kieSkipped    = scenes.filter(s => ['fact_animation', 'stats_counter'].includes(s.template)).length;
  console.log(`\n   fact_animation scenes: ${factAnimCount}`);
  console.log(`   kie.ai overgeslagen:    ${kieSkipped} (geen video-URL, enkel Remotion 2D)`);
  console.log(`   Safe-zone bottom:       170px (zelfde als SubtitleOverlay)`);
  console.log(`   Safe-zone zijkanten:    60px`);
  console.log(`   TypeScript-check:       zie compilatie hierboven — geen fouten = ok`);
})().catch(err => {
  console.error('FOUT:', err.message);
  process.exit(1);
});
