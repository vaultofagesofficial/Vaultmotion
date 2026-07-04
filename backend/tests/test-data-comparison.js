'use strict';
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

// ── Deel 1: Rendertest — alle 4 comparison-types ──────────────────────────────
const path = require('path');
const fs   = require('fs');
const { bundle }              = require('@remotion/bundler');
const { renderMedia, selectComposition } = require('@remotion/renderer');
const { OUTPUTS_DIR }         = require('../src/paths');

const scenes = [
  {
    template: 'cinematic_title',
    duration_frames: 90,
    content: { title: 'Data Comparison', subtitle: 'Vier Grafiekstijlen' },
    background_video_url: null,
    script_segment: 'Historische data in beeld',
  },
  // ranking
  {
    template: 'data_comparison',
    duration_frames: 150,
    content: {
      comparison: {
        type: 'ranking', unit: 'million', title: 'Ancient City Populations',
        entries: [
          { label: 'Rome',        value: 1.0  },
          { label: 'Alexandria',  value: 0.5  },
          { label: 'Carthage',    value: 0.4  },
          { label: 'Athens',      value: 0.15 },
        ],
      },
      text: 'Rome was the largest city of the ancient world',
    },
    background_video_url: null,
    script_segment: 'Rome 1 million, Alexandria 500K, Carthage 400K, Athens 150K',
  },
  // scale
  {
    template: 'data_comparison',
    duration_frames: 150,
    content: {
      comparison: {
        type: 'scale', unit: 'meters', title: 'Monument Heights',
        entries: [
          { label: 'Great Pyramid', value: 138 },
          { label: 'Colosseum',     value: 48  },
          { label: 'Parthenon',     value: 14  },
        ],
      },
      text: 'The Great Pyramid dwarfs every other ancient monument',
    },
    background_video_url: null,
    script_segment: 'Pyramid 138m, Colosseum 48m, Parthenon 14m',
  },
  // before_after
  {
    template: 'data_comparison',
    duration_frames: 150,
    content: {
      comparison: {
        type: 'before_after', unit: 'million', title: 'Aztec Population',
        entries: [
          { label: 'Before 1519', value: 25 },
          { label: 'After 1600',  value: 1  },
        ],
      },
      text: 'The Aztec Empire lost 96% of its population',
    },
    background_video_url: null,
    script_segment: 'Aztec population: 25 million before 1519, just 1 million by 1600',
  },
  // timeline
  {
    template: 'data_comparison',
    duration_frames: 150,
    content: {
      comparison: {
        type: 'timeline', unit: 'BC', title: 'Ancient Empires Founded',
        entries: [
          { label: 'Babylon',    value: 1894 },
          { label: 'Carthage',   value: 814  },
          { label: 'Rome',       value: 753  },
          { label: 'Alexander',  value: 336  },
        ],
      },
      text: 'Empires rose across millennia',
    },
    background_video_url: null,
    script_segment: 'Babylon 1894 BC, Carthage 814 BC, Rome 753 BC, Alexander 336 BC',
  },
  {
    template: 'outro_cta',
    duration_frames: 90,
    content: { title: 'Subscribe', subtitle: 'More ancient data' },
    background_video_url: null,
    script_segment: 'Like and subscribe for more epic history',
  },
];

const totalFrames = scenes.reduce((s, sc) => s + sc.duration_frames, 0);
const outputPath  = path.join(OUTPUTS_DIR, `data-comparison-verify-${Date.now()}.mp4`);

async function runRender() {
  console.log('=== Deel 1: Remotion render (alle 4 comparison-types) ===\n');
  console.log('Bundling...');
  const entryPoint = path.resolve(__dirname, '../../remotion/src/index.ts');
  const bundled    = await bundle({ entryPoint, webpackOverride: c => c });

  console.log('Selecting composition...');
  const comp = await selectComposition({
    serveUrl: bundled, id: 'VaultMotionVideo',
    inputProps: { scenes, audioUrl: null, musicUrl: null, wordTimings: [], subtitleSettings: { enabled: false }, mode: 'epic', totalDurationInFrames: totalFrames },
  });

  console.log(`Rendering ${totalFrames} frames → ${outputPath}`);
  await renderMedia({
    composition: comp, serveUrl: bundled, codec: 'h264', outputLocation: outputPath,
    inputProps: { scenes, audioUrl: null, musicUrl: null, wordTimings: [], subtitleSettings: { enabled: false }, mode: 'epic', totalDurationInFrames: totalFrames },
  });

  const { size } = fs.statSync(outputPath);
  console.log(`\n✅ Render klaar`);
  console.log(`   Pad:     ${outputPath}`);
  console.log(`   Grootte: ${(size / 1024).toFixed(1)} KB (${size} bytes)`);

  const dcScenes   = scenes.filter(s => s.template === 'data_comparison').length;
  console.log(`\n   data_comparison scenes: ${dcScenes}`);
  console.log(`   kie.ai overgeslagen:     ${dcScenes} (SKIP_KIE_TEMPLATES)`);
  console.log(`   Safe-zone bottom:        170px`);
  console.log(`   Safe-zone zijkanten:     60px`);
}

// ── Deel 2: API-test — 5 vergelijkende scripts ────────────────────────────────
async function runApiTests() {
  console.log('\n=== Deel 2: Claude API — 5 scripts met vergelijkingsdata ===\n');
  const { analyzeScript } = require('../src/services/claudeAnalyzer');

  const SCRIPTS = [
    {
      label: '1. Steden-vergelijking (ranking)',
      script: 'At its peak, Rome had 1 million inhabitants. Alexandria had 500,000. Carthage 400,000, Athens only 150,000. Rome was the undisputed capital of the ancient world. Subscribe for more ancient cities.',
      style: 'documentaire', duration: 25,
    },
    {
      label: '2. Gebouwhoogtes (scale)',
      script: 'The Great Pyramid of Giza stands 138 meters tall. The Colosseum in Rome reaches 48 meters. The Parthenon is just 14 meters high. Ancient builders achieved incredible heights. Like and follow for more.',
      style: 'epic', duration: 25,
    },
    {
      label: '3. Vóór/na bevolking (before_after)',
      script: 'The Aztec Empire had a population of 25 million people before the Spanish arrived in 1519. By 1600, only 1 million remained — a 96% collapse. Disease, war, and famine destroyed a civilization. Subscribe.',
      style: 'documentaire', duration: 25,
    },
    {
      label: '4. Tijdlijn van rijken (timeline)',
      script: 'Babylon was founded in 1894 BC. Carthage in 814 BC. Rome in 753 BC. The empire of Alexander in 336 BC. Each empire rose from the ashes of the last. Follow for more ancient history.',
      style: 'epic', duration: 25,
    },
    {
      label: '5. Sfeer-script (geen vergelijking — geen data_comparison verwacht)',
      script: 'The Roman Empire was the greatest power the ancient world had ever seen. Legions marched across continents. The eternal city burned and was rebuilt. Nothing could stop Rome — until it stopped itself. Follow for more.',
      style: 'epic', duration: 25,
    },
  ];

  const PROTECTED = new Set(['cinematic_title', 'outro_cta']);
  let totalScenes = 0, dcTotal = 0, protectedConverted = 0;

  for (const test of SCRIPTS) {
    console.log(`── ${test.label} ──`);
    try {
      const { scenes: s } = await analyzeScript(test.script, test.style, test.duration);
      totalScenes += s.length;

      const dcScenes = s.filter(x => x.template === 'data_comparison');
      dcTotal += dcScenes.length;

      const wrongConvert = s.filter(x => PROTECTED.has(x.template) && x.template === 'data_comparison').length;
      protectedConverted += wrongConvert;

      console.log(`   Templates: ${s.map(x => x.template).join(' → ')}`);
      dcScenes.forEach(x => {
        const c = x.comparison || (x.content && x.content.comparison);
        console.log(`   data_comparison: type=${c && c.type} entries=${c && c.entries && c.entries.length} title="${c && c.title}"`);
      });
      const dcPct = Math.round(dcScenes.length / s.length * 100);
      console.log(`   data_comparison: ${dcScenes.length}/${s.length} (${dcPct}%)\n`);
    } catch (e) {
      console.log(`   FOUT (overgeslagen): ${e.message.slice(0, 120)}\n`);
    }
    await new Promise(r => setTimeout(r, 5000));
  }

  console.log('═══════════════════════════════════════════════════════');
  console.log('SAMENVATTING');
  console.log(`Totaal scenes:           ${totalScenes}`);
  console.log(`data_comparison totaal:  ${dcTotal} (${Math.round(dcTotal/totalScenes*100)}%)`);
  console.log(`cinematic_title/outro_cta → data_comparison: ${protectedConverted} (moet 0 zijn) ${protectedConverted === 0 ? '✅' : '❌'}`);
}

(async () => {
  try {
    await runRender();
    await runApiTests();
  } catch (err) {
    console.error('FOUT:', err.message);
    process.exit(1);
  }
})();
