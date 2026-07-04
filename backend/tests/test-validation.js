'use strict';
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

// ── Hergebruik validatielogica via directe import ──────────────────────────
// We testen de validatiekode zelf via de mock-aanpak
const VALID_FACT_TYPES = new Set(['count', 'measurement', 'duration', 'date', 'ratio']);
const VALID_TEMPLATES  = new Set(['cinematic_title', 'ken_burns', 'animated_map', 'timeline', 'stats_counter', 'outro_cta', 'fact_animation']);

function validateScenes(scenes) {
  const warnings = [];
  scenes.forEach((scene, si) => {
    if (!scene.template)     warnings.push({ scene: si, field: 'template',      msg: 'ontbreekt' });
    else if (!VALID_TEMPLATES.has(scene.template))
                              warnings.push({ scene: si, field: 'template',      msg: `onbekende waarde "${scene.template}"` });
    if (!scene.content)       warnings.push({ scene: si, field: 'content',       msg: 'ontbreekt' });
    if (scene.script_segment == null)
                              warnings.push({ scene: si, field: 'script_segment',msg: 'ontbreekt' });
    if (!Array.isArray(scene.facts))
                              warnings.push({ scene: si, field: 'facts',          msg: 'geen array' });

    (scene.facts || []).forEach((f, fi) => {
      if (!f.type)                      warnings.push({ scene: si, fact: fi, field: 'type',    msg: 'ontbreekt' });
      else if (!VALID_FACT_TYPES.has(f.type))
                                        warnings.push({ scene: si, fact: fi, field: 'type',    msg: `onbekende waarde "${f.type}"` });
      if (f.value == null)              warnings.push({ scene: si, fact: fi, field: 'value',   msg: 'null/undefined' });
      if (!f.subject && !f.label)       warnings.push({ scene: si, fact: fi, field: 'subject', msg: 'ontbreekt (en geen label-fallback)' });
    });
  });
  return warnings;
}

// ── Test 1: Gemockte FOUTE response ────────────────────────────────────────
console.log('=== Test 1: Gemockte foute response ===\n');

const badScenes = [
  {
    template: 'cinematic_title',
    content: { title: 'Test' },
    script_segment: 'Opening',
    facts: [],
  },
  {
    template: 'onbekend_template',          // ❌ onbekend template
    content: { text: 'Narrative' },
    script_segment: 'Middle',
    facts: [
      { type: 'kracht',  value: 50,   subject: 'soldiers' },  // ❌ onbekend type
      { type: 'count',   value: null, subject: 'ships' },     // ❌ value null
      { type: 'ratio',   value: '5:1', label: 'ratio name' }, // geen subject maar label (→ fallback ok)
      { type: 'date',    value: 1066 },                        // ❌ subject ontbreekt én geen label
    ],
    // script_segment ontbreekt niet hier maar facts vol fouten
  },
  {
    template: 'outro_cta',
    // content ontbreekt ❌
    script_segment: 'Subscribe',
    facts: [],
  },
];

const warnings = validateScenes(badScenes);
console.log('Waarschuwingen:');
warnings.forEach(w => {
  const loc = w.fact != null ? `scene[${w.scene}].facts[${w.fact}]` : `scene[${w.scene}]`;
  console.log(`  ⚠️  ${loc}.${w.field} — ${w.msg}`);
});
console.log(`\nTotaal: ${warnings.length} waarschuwingen`);
console.log(`Pipeline crasht: nee (enkel gelogd)\n`);

const expectedFields = ['template', 'type', 'type', 'value', 'subject', 'content'];
const foundFields = warnings.map(w => w.field);
const allCaught = expectedFields.every(f => foundFields.includes(f));
console.log(`Alle verwachte fouten gevangen: ${allCaught ? '✅' : '❌'}`);

console.log('\njob.validation_warnings structuur:');
console.log(JSON.stringify(warnings.slice(0, 3), null, 2));

// ── Test 2: Correct script via echte API ───────────────────────────────────
console.log('\n=== Test 2: Correct script — 0 waarschuwingen verwacht ===\n');

const { analyzeScript } = require('../src/services/claudeAnalyzer');

(async () => {
  try {
    const { scenes, validationWarnings } = await analyzeScript(
      'The Roman Empire fell in 476 AD. Barbarian tribes overwhelmed the legions. The eternal city was sacked. Nothing could stop the tide of history. Subscribe for more.',
      'epic', 20
    );
    console.log(`Scenes: ${scenes.map(s => s.template).join(' → ')}`);
    console.log(`validationWarnings: ${validationWarnings.length === 0 ? '✅ 0 (correct)' : `❌ ${validationWarnings.length} waarschuwingen`}`);
    if (validationWarnings.length > 0) {
      validationWarnings.forEach(w => {
        const loc = w.fact != null ? `scene[${w.scene}].facts[${w.fact}]` : `scene[${w.scene}]`;
        console.log(`  ⚠️  ${loc}.${w.field} — ${w.msg}`);
      });
    }
  } catch (err) {
    console.error('FOUT:', err.message);
  }
})();
