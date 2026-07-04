'use strict';
require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const { analyzeScript } = require('./src/services/claudeAnalyzer');

const SCRIPTS = [
  {
    label: '1. Sfeer/verhaal — geen concrete feiten',
    script: 'The Roman Empire was the greatest power the ancient world had ever seen. Emperors rose and fell. Legions marched across continents. The eternal city burned and was rebuilt. Nothing could stop Rome — until it stopped itself. Follow for more forgotten empires.',
    style: 'epic', duration: 25,
  },
  {
    label: '2. Concrete aantallen + afmetingen',
    script: 'The Great Pyramid of Giza stands 138 meters tall. It was built by 20,000 workers over 20 years. Each stone block weighs 2.5 tons. There are 2.3 million blocks in total. For 3,800 years it was the tallest structure on Earth. Like and subscribe for more ancient wonders.',
    style: 'documentaire', duration: 25,
  },
  {
    label: '3. Geografisch — locaties, geen feiten',
    script: 'The Silk Road stretched from China through Persia into Rome. Merchants crossed the Gobi Desert, the Hindu Kush mountains, and the Persian Gulf. Silk, spices, and ideas flowed in both directions. This network lasted for centuries. Subscribe for more ancient trade routes.',
    style: 'documentaire', duration: 25,
  },
  {
    label: '4. Ratio + datum + sfeer gemengd',
    script: 'At the Battle of Thermopylae in 480 BC, 300 Spartans held off an army of 100,000 Persians for three days. Outnumbered 333 to 1. They knew they would die. They stood anyway. Their sacrifice bought Greece enough time to survive. Follow for more legendary last stands.',
    style: 'epic', duration: 25,
  },
  {
    label: '5. Chronologisch — datums, geen dimensies',
    script: 'In 27 BC Augustus became the first Roman Emperor. In 64 AD Rome burned under Nero. In 79 AD Pompeii was buried by Vesuvius. In 312 AD Constantine converted to Christianity. In 476 AD the Western Empire fell. Each event changed the world forever. Subscribe for more.',
    style: 'documentaire', duration: 25,
  },
];

(async () => {
  console.log('=== Fact Extraction + Beslissingsregel Verificatie ===\n');

  let totalScenes = 0;
  let factAnimTotal = 0;
  let cinTitle_converted = 0;
  let outroCTA_converted = 0;
  let kieSkipped = 0;

  for (const test of SCRIPTS) {
    console.log(`\n── ${test.label} ──`);
    try {
      const { scenes } = await analyzeScript(test.script, test.style, test.duration);
      totalScenes += scenes.length;

      scenes.forEach((s, i) => {
        const facts = s.facts || [];
        const isFA  = s.template === 'fact_animation';
        if (isFA) factAnimTotal++;
        if (s.template === 'cinematic_title' && isFA) cinTitle_converted++;
        if (s.template === 'outro_cta'       && isFA) outroCTA_converted++;
        if (['fact_animation','stats_counter'].includes(s.template)) kieSkipped++;

        const factsStr = facts.length > 0
          ? facts.map(f => `{${f.type} ${f.value}${f.unit ? ' '+f.unit : ''} — ${f.subject}}`).join(', ')
          : '[]';

        console.log(`  [${i}] ${s.template.padEnd(18)} facts: ${factsStr}`);
      });

      const templates = scenes.map(s => s.template);
      const faCount   = templates.filter(t => t === 'fact_animation').length;
      console.log(`  → Templates: ${templates.join(' → ')}`);
      console.log(`  → fact_animation: ${faCount}/${scenes.length} (${Math.round(faCount/scenes.length*100)}%)`);

    } catch (err) {
      console.error(`  FOUT: ${err.message}`);
    }
    await new Promise(r => setTimeout(r, 1500));
  }

  const overallPct = Math.round(factAnimTotal / totalScenes * 100);
  console.log('\n═══════════════════════════════════');
  console.log('SAMENVATTING');
  console.log(`Totaal scenes      : ${totalScenes}`);
  console.log(`fact_animation     : ${factAnimTotal} (${overallPct}%)`);
  console.log(`cinematic_title→FA : ${cinTitle_converted} (moet 0 zijn)`);
  console.log(`outro_cta→FA       : ${outroCTA_converted} (moet 0 zijn)`);
  console.log(`kie.ai overgeslagen: ${kieSkipped}`);
  console.log('');
  if (cinTitle_converted > 0) console.log('❌ cinematic_title werd omgezet naar fact_animation — bug!');
  else                         console.log('✅ cinematic_title nooit omgezet');
  if (outroCTA_converted > 0) console.log('❌ outro_cta werd omgezet naar fact_animation — bug!');
  else                         console.log('✅ outro_cta nooit omgezet');
  if (overallPct > 50)        console.log(`⚠️  OVERGEBRUIK: ${overallPct}% van scenes is fact_animation`);
  else                         console.log(`✅ fact_animation gebruik: ${overallPct}% (acceptabel)`);
})();
