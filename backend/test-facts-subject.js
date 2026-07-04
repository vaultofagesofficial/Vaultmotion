'use strict';
require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });

// ── Deel 1: Normalisatie-unit test (mock) ───────────────────────────────────
console.log('=== Deel 1: Normalisatie-fallback (mock) ===\n');

// Simuleer wat de normalisatie-code doet op facts met "label" i.p.v. "subject"
function normalizeFacts(facts) {
  return (facts || []).map(f => ({
    type:    f.type    || 'count',
    value:   f.value   ?? null,
    unit:    f.unit    ?? null,
    subject: f.subject || f.label || null,
  }));
}

const mockFacts = [
  { type: 'count',       value: 300,        unit: null,      label: 'Spartan warriors' },      // label, geen subject
  { type: 'measurement', value: 138,         unit: 'meters',  subject: 'pyramid height' },      // correct
  { type: 'ratio',       value: '333 to 1',  unit: null,      label: 'outnumbered ratio' },     // label, geen subject
  { type: 'date',        value: 480,         unit: 'BC',      subject: 'Battle of Thermopylae' }, // correct
];

const normalized = normalizeFacts(mockFacts);
normalized.forEach((f, i) => {
  const src = mockFacts[i];
  const had_label   = 'label'   in src && !('subject' in src);
  const had_subject = 'subject' in src;
  console.log(`  [${i}] type=${f.type} value=${f.value} subject="${f.subject}" ${had_label ? '← van label' : '← direct subject'} ${f.subject ? '✅' : '❌ NULL'}`);
});

const allHaveSubject = normalized.every(f => f.subject !== null);
console.log(`\n  Normalisatie: ${allHaveSubject ? '✅ alle facts hebben subject' : '❌ sommige facts missen subject'}\n`);

// ── Deel 2: Echte API — piramide + Thermopylae ──────────────────────────────
console.log('=== Deel 2: Echte API-test ===\n');

const { analyzeScript } = require('./src/services/claudeAnalyzer');

const SCRIPTS = [
  {
    label: 'Piramide (138m, 20k workers, 2.3M blokken)',
    script: 'The Great Pyramid of Giza stands 138 meters tall. It was built by 20,000 workers over 20 years. Each stone block weighs 2.5 tons. There are 2.3 million blocks in total. Like and subscribe for more ancient wonders.',
    style: 'documentaire', duration: 20,
  },
  {
    label: 'Thermopylae (300 vs 100k, 333:1)',
    script: 'At the Battle of Thermopylae in 480 BC, 300 Spartans held off an army of 100,000 Persians for three days. Outnumbered 333 to 1. They knew they would die. Follow for more legendary last stands.',
    style: 'epic', duration: 20,
  },
];

(async () => {
  for (const test of SCRIPTS) {
    console.log(`── ${test.label} ──`);
    try {
      const { scenes } = await analyzeScript(test.script, test.style, test.duration);

      const factsScenes = scenes.filter(s => (s.facts || []).length > 0);
      factsScenes.forEach(s => {
        console.log(`  Scene: ${s.template}`);
        s.facts.forEach(f => {
          const subjectOk = f.subject !== null && f.subject !== undefined;
          console.log(`    { type:"${f.type}" value:${JSON.stringify(f.value)} unit:${JSON.stringify(f.unit)} subject:${JSON.stringify(f.subject)} } ${subjectOk ? '✅' : '❌ subject ontbreekt'}`);
        });
      });

      const allOk = scenes.every(s => (s.facts || []).every(f => f.subject !== null && f.subject !== undefined));
      console.log(`  → subject altijd gevuld: ${allOk ? '✅' : '❌'}\n`);
    } catch (err) {
      console.error(`  FOUT: ${err.message}\n`);
    }
    await new Promise(r => setTimeout(r, 1500));
  }
})();
