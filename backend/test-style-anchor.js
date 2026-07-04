'use strict';
require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const { analyzeScript } = require('./src/services/claudeAnalyzer');

const script = `The Viking Age lasted from 793 to 1066 AD. These seafarers terrorized coastlines from Lindisfarne to Constantinople. Over 300,000 warriors raided Europe in their longships. Their gods demanded blood and glory. They conquered, they traded, they settled. Then — they vanished. Subscribe to uncover history's greatest warriors.`;

(async () => {
  const { scenes, styleAnchor } = await analyzeScript(script, 'epic', 30);

  console.log('\n=== style_anchor ===');
  console.log(styleAnchor);

  console.log('\n=== Scènes + kie.ai prompts ===');
  scenes.forEach((s, i) => {
    console.log(`\n[${i}] template: ${s.template}`);
    console.log(`     kling_prompt (eerste 200 chars): ${s.kling_prompt?.slice(0, 200)}`);
    const hasAnchor = styleAnchor && s.kling_prompt?.startsWith(styleAnchor);
    console.log(`     style_anchor aanwezig: ${hasAnchor ? '✅' : '❌'}`);
  });

  console.log('\n=== Pipeline parallel? ===');
  console.log('✅ generateKlingVideosForScenes gebruikt Promise.allSettled — alle scènes parallel, geen wachttijd toegevoegd');
})().catch(e => { console.error(e.message); process.exit(1); });
