'use strict';
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { analyzeScript } = require('../src/services/claudeAnalyzer');

const SCRIPTS = [
  {
    label: 'Piramide (facts: count + measurement)',
    script: 'The Great Pyramid of Giza stands 138 meters tall. It was built by 20,000 workers over 20 years. There are 2.3 million stone blocks in total. Like and subscribe for more ancient wonders.',
    style: 'documentaire', duration: 20,
  },
  {
    label: 'Sfeer-script (geen concrete facts)',
    script: 'The Roman Empire was the greatest power the ancient world had ever seen. Emperors rose and fell. Legions marched across continents. Nothing could stop Rome — until it stopped itself. Follow for more forgotten empires.',
    style: 'epic', duration: 20,
  },
];

(async () => {
  for (const test of SCRIPTS) {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`Script: ${test.label}`);
    console.log('═'.repeat(60));

    const { scenes, validationWarnings, templateDecisions } = await analyzeScript(test.script, test.style, test.duration);

    console.log('\ntemplate_decisions:');
    templateDecisions.forEach(d => {
      console.log(`  [${d.scene}] ${d.chosen_template.padEnd(18)} — ${d.reason}`);
    });

    // Bevestig protected-template-geval
    const protectedLog = templateDecisions.filter(d => d.reason.includes('protected'));
    console.log(`\nProtected templates gelogd: ${protectedLog.length} (cinematic_title + outro_cta)`);
    protectedLog.forEach(d => console.log(`  ✅ scene[${d.scene}] ${d.chosen_template}: ${d.reason}`));

    // Bevestig validationWarnings ongewijzigd
    console.log(`validationWarnings: ${validationWarnings.length === 0 ? '✅ 0' : `⚠️ ${validationWarnings.length}`}`);

    // Structuur-check
    const allValid = templateDecisions.every(d =>
      typeof d.scene === 'number' &&
      typeof d.chosen_template === 'string' &&
      typeof d.reason === 'string'
    );
    console.log(`Schema-check (scene/chosen_template/reason): ${allValid ? '✅' : '❌'}`);

    await new Promise(r => setTimeout(r, 1500));
  }

  // Extra: cinematic_title MET facts → moet "protected" loggen
  console.log(`\n${'═'.repeat(60)}`);
  console.log('Geforceerde test: cinematic_title met count-fact (via mock)');
  console.log('═'.repeat(60));
  // We testen de beslissingslogica direct zonder API door de logica te simuleren
  const FACT_ANIMATION_TYPES = new Set(['count', 'measurement', 'ratio']);
  const PROTECTED_TEMPLATES  = new Set(['cinematic_title', 'outro_cta']);

  const mockScenes = [
    { template: 'cinematic_title', facts: [{ type: 'count', value: 300, unit: null, subject: 'warriors' }], script_segment: 'Opening' },
    { template: 'ken_burns',       facts: [{ type: 'count', value: 300, unit: null, subject: 'warriors' }], script_segment: 'Battle' },
  ];

  const decisions = [];
  mockScenes.forEach((scene, si) => {
    const hasTrigger = (scene.facts || []).some(f => FACT_ANIMATION_TYPES.has(f.type));
    const triggerTypes = (scene.facts || []).filter(f => FACT_ANIMATION_TYPES.has(f.type)).map(f => f.type);
    if (PROTECTED_TEMPLATES.has(scene.template)) {
      decisions.push({ scene: si, chosen_template: scene.template,
        reason: hasTrigger
          ? `protected template (${scene.template}), fact_animation overgeslagen ondanks aanwezige facts [${triggerTypes.join(', ')}]`
          : `protected template (${scene.template}), altijd behouden` });
    } else if (hasTrigger) {
      decisions.push({ scene: si, chosen_template: 'fact_animation',
        reason: `facts bevatten trigger-type(s) [${triggerTypes.join(', ')}], omgezet van "${scene.template}"` });
    }
  });

  decisions.forEach(d => console.log(`  [${d.scene}] ${d.chosen_template.padEnd(18)} — ${d.reason}`));

  const protectedWithFacts = decisions.find(d => d.scene === 0);
  console.log(`\n✅ cinematic_title met facts logt "protected": ${protectedWithFacts?.reason.includes('fact_animation overgeslagen') ? 'JA' : 'NEE'}`);
  console.log(`✅ ken_burns met facts → fact_animation: ${decisions.find(d => d.scene === 1)?.chosen_template === 'fact_animation' ? 'JA' : 'NEE'}`);
})();
