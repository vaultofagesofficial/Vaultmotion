/**
 * test-scene-selection.js — Verifieer dat stats_counter niet meer overheerst.
 * Uitvoeren: node test-scene-selection.js
 */
'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const { analyzeScript } = require('./src/services/claudeAnalyzer');

const TEST_SCRIPTS = [
  {
    label: 'Historisch epic (geen expliciete stats)',
    script: 'The Roman Empire fell in 476 AD. Not with a bang — but a whisper. Barbarian tribes had been chipping away for decades. Emperors came and went. The legions grew weak. One by one, the provinces collapsed. What once ruled the world disappeared forever. Subscribe for more lost civilizations.',
    style: 'epic',
    duration: 30,
  },
  {
    label: 'Geografisch — locaties vermeld',
    script: 'The Silk Road connected China to Rome. Merchants crossed deserts, mountains and rivers. From Xi\'an through Persia into Constantinople. Silk, spices and ideas traveled thousands of miles. This network shaped our world. Follow for more ancient trade secrets.',
    style: 'documentaire',
    duration: 30,
  },
  {
    label: 'Met expliciete statistiek',
    script: 'In 1944, over 156,000 Allied soldiers stormed the beaches of Normandy in a single day. The largest seaborne invasion in history. Most were under 25 years old. They changed the course of the war forever. Like and subscribe for more forgotten history.',
    style: 'documentaire',
    duration: 30,
  },
  {
    label: 'Chronologisch verhaal',
    script: 'In 1066 William invaded England. By 1085 the Domesday Book was complete. In 1215 the Magna Carta was signed. By 1348 the Black Death had killed half of Europe. Each event shaped the next. History is a chain — break one link and everything changes.',
    style: 'documentaire',
    duration: 30,
  },
  {
    label: 'Persoonlijk/verhaal (geen stats, geen geo, geen chronologie)',
    script: 'They said he was too old to fight. He was 52. He laced up his boots anyway, grabbed his rifle and walked into the forest alone. Three days later he came back. Nobody asked what happened. Nobody needed to. Some men are just built different. Subscribe to hear more.',
    style: 'story',
    duration: 30,
  },
];

(async () => {
  console.log('=== Scène-selectie verificatie ===\n');

  let statsCounterTotal = 0;
  let totalScenes = 0;

  for (const test of TEST_SCRIPTS) {
    process.stdout.write(`Script: "${test.label}"\n`);
    try {
      const scenes = await analyzeScript(test.script, test.style, test.duration);
      const templates = scenes.map(s => s.template);
      const statsCount = templates.filter(t => t === 'stats_counter').length;
      statsCounterTotal += statsCount;
      totalScenes += scenes.length;

      console.log(`  Scènes (${scenes.length}): ${templates.join(' → ')}`);
      if (statsCount > 0) {
        const sc = scenes.find(s => s.template === 'stats_counter');
        console.log(`  stats_counter segment: "${sc?.script_segment?.slice(0,80)}"`);
      }
      console.log('');
    } catch (err) {
      console.error(`  FOUT: ${err.message}\n`);
    }

    // Kleine pauze om rate-limiting te vermijden
    await new Promise(r => setTimeout(r, 1500));
  }

  console.log('=== SAMENVATTING ===');
  console.log(`stats_counter gekozen: ${statsCounterTotal}× over ${TEST_SCRIPTS.length} videos (${totalScenes} scènes totaal)`);
  console.log(statsCounterTotal <= 1
    ? '✅ stats_counter komt niet meer voor in scripts zonder expliciete cijfers'
    : `⚠️  stats_counter komt ${statsCounterTotal}× voor — controleer of alle gevallen gegrond zijn`);
})();
