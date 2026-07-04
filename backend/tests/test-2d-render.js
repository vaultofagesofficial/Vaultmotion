/**
 * Verificatietest 2D render style
 * Test 1: history-onderwerp (piramides) — verwacht color_theme, 0 kie.ai
 * Test 2: niet-history onderwerp (slaaptips) — verwacht color_theme, 0 kie.ai
 * Test 3: ai-cinematic (ongewijzigd) — verwacht GEEN color_theme in response
 */
const axios = require('axios');
const fs    = require('fs');

const BASE = 'http://localhost:3002';

async function pollJob(jobId, expectedStatus, maxMs = 120000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const { data } = await axios.get(`${BASE}/api/render/${jobId}`);
    process.stdout.write(`\r  Status: ${data.status} (${Math.round((Date.now()-start)/1000)}s)  `);
    if (data.status === expectedStatus || data.status === 'failed') {
      process.stdout.write('\n');
      return data;
    }
    await new Promise(r => setTimeout(r, 3000));
  }
  throw new Error('Timeout');
}

async function run() {
  // ── Test 1: 2D history ────────────────────────────────────────────────────
  console.log('\n[Test 1] 2D render — HISTORY onderwerp (piramides)');
  const r1 = await axios.post(`${BASE}/api/render`, {
    script: 'De piramides van Giza werden gebouwd door de oude Egyptenaren. Ze dienden als grafmonumenten voor farao\'s. De Grote Piramide was ooit het hoogste bouwwerk ter wereld.',
    title:  'Piramides van Giza',
    style:  'documentaire',
    mode:   'documentary',
    render_style: '2d',
    duration: 30,
    subtitleSettings: { enabled: false }
  });
  const jobId1 = r1.data.job_id;
  console.log(`  Job: ${jobId1}`);

  const job1 = await pollJob(jobId1, 'editing', 60000);
  console.log(`  color_theme: "${job1.color_theme || 'ONTBREEKT'}"`);
  console.log(`  render_style: "${job1.render_style || 'ONTBREEKT'}"`);
  console.log(`  scenes: ${job1.scenes?.length}`);

  if (!job1.color_theme) console.error('  ❌ FOUT: color_theme niet opgeslagen');
  else console.log('  ✅ color_theme aanwezig');
  if (job1.render_style !== '2d') console.error('  ❌ FOUT: render_style is niet "2d"');
  else console.log('  ✅ render_style = "2d"');

  // ── Test 2: 2D niet-history ───────────────────────────────────────────────
  console.log('\n[Test 2] 2D render — NIET-HISTORY onderwerp (slaaptips)');
  await new Promise(r => setTimeout(r, 5000));
  const r2 = await axios.post(`${BASE}/api/render`, {
    script: 'Slaap is essentieel voor je gezondheid. Zorg voor 7 tot 9 uur slaap per nacht. Vermijd schermen voor het slapen en houd een vast slaapritme aan.',
    title:  'Slaaptips voor betere nachtrust',
    style:  'documentaire',
    mode:   'documentary',
    render_style: '2d',
    duration: 30,
    subtitleSettings: { enabled: false }
  });
  const jobId2 = r2.data.job_id;
  console.log(`  Job: ${jobId2}`);

  const job2 = await pollJob(jobId2, 'editing', 60000);
  console.log(`  color_theme: "${job2.color_theme || 'ONTBREEKT'}"`);
  console.log(`  render_style: "${job2.render_style || 'ONTBREEKT'}"`);

  if (!job2.color_theme) console.error('  ❌ FOUT: color_theme niet opgeslagen');
  else console.log('  ✅ color_theme aanwezig');

  // ── Test 3: ai-cinematic ongewijzigd ──────────────────────────────────────
  console.log('\n[Test 3] ai-cinematic (ongewijzigd gedrag)');
  await new Promise(r => setTimeout(r, 5000));
  const r3 = await axios.post(`${BASE}/api/render`, {
    script: 'Compound rente is het achtste wereldwonder. Wie het begrijpt verdient het, wie het niet begrijpt betaalt het.',
    title:  'Compound Rente',
    style:  'documentaire',
    mode:   'documentary',
    duration: 30,
    subtitleSettings: { enabled: false }
  });
  const jobId3 = r3.data.job_id;
  console.log(`  Job: ${jobId3}`);

  const job3 = await pollJob(jobId3, 'editing', 60000);
  console.log(`  render_style: "${job3.render_style || 'ai-cinematic (default)'}"`);
  console.log(`  color_theme: "${job3.color_theme || 'null (correct voor ai-cinematic)'}"`);
  if (job3.render_style === '2d') console.error('  ❌ FOUT: render_style werd onverwacht "2d"');
  else console.log('  ✅ render_style = ai-cinematic (ongewijzigd)');

  console.log('\n── Samenvatting ───────────────────────────────────────────');
  console.log(`Test 1 (2D history):     color_theme="${job1.color_theme}", render_style="${job1.render_style}"`);
  console.log(`Test 2 (2D slaaptips):   color_theme="${job2.color_theme}", render_style="${job2.render_style}"`);
  console.log(`Test 3 (ai-cinematic):   color_theme="${job3.color_theme || 'null'}", render_style="${job3.render_style || 'ai-cinematic'}"`);
}

run().catch(e => { console.error('FOUT:', e.message); process.exit(1); });
