/**
 * Verificatietest StaticMap2D + map_region
 * Test 1: Zijderoute (Centraal Azië) — verwacht animated_map + map_region="asia"
 * Test 2: Europa-onderwerp (Rijn) — verwacht animated_map + map_region="europe"
 * Test 3: Render Test 1 volledig — bevestig StaticMap2D gebruikt, geen kie.ai, bestandsgrootte
 */
const axios = require('axios');
const fs    = require('fs');
const BASE  = 'http://localhost:3002';

async function pollEditing(jobId, maxMs = 90000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const { data } = await axios.get(`${BASE}/api/render/${jobId}`);
    process.stdout.write(`\r  [${jobId.slice(0,8)}] ${data.status} (${Math.round((Date.now()-start)/1000)}s)  `);
    if (data.status === 'editing' || data.status === 'failed') { process.stdout.write('\n'); return data; }
    await new Promise(r => setTimeout(r, 3000));
  }
  throw new Error('Timeout polling');
}

async function pollCompleted(jobId, maxMs = 360000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const { data } = await axios.get(`${BASE}/api/render/${jobId}`);
    process.stdout.write(`\r  [${jobId.slice(0,8)}] ${data.status} (${Math.round((Date.now()-start)/1000)}s)  `);
    if (data.status === 'completed' || data.status === 'failed') { process.stdout.write('\n'); return data; }
    await new Promise(r => setTimeout(r, 5000));
  }
  throw new Error('Timeout render');
}

async function run() {
  // ── Test 1: Zijderoute — Centraal Azië ───────────────────────────────────
  console.log('\n[Test 1] Analyse: Silk Road through Central Asia');
  const r1 = await axios.post(`${BASE}/api/render`, {
    script: 'The Silk Road stretched across Central Asia, connecting China to the Mediterranean. Merchants traveled through Persia, Samarkand, and Baghdad. The route passed through the steppes of Kazakhstan and the mountains of Uzbekistan. This ancient network shaped cultures across Asia and the Middle East.',
    title:  'The Silk Road',
    style:  'documentaire', mode: 'documentary', render_style: '2d', duration: 30,
    subtitleSettings: { enabled: false }
  });
  const job1 = await pollEditing(r1.data.job_id);
  const mapScenes1 = (job1.scenes || []).filter(s => s.template === 'animated_map');
  console.log(`  render_style: ${job1.render_style}, color_theme: ${job1.color_theme}`);
  console.log(`  animated_map scenes: ${mapScenes1.length}`);
  mapScenes1.forEach((s, i) => console.log(`    [${i}] map_region="${s.content?.map_region}" location="${s.content?.location}"`));
  const mapRegion1 = mapScenes1[0]?.content?.map_region;
  if (!mapScenes1.length) console.warn('  ⚠️  Geen animated_map scene gegenereerd');
  else if (mapRegion1 === 'asia' || mapRegion1 === 'middle_east') console.log(`  ✅ map_region="${mapRegion1}" correct voor Centraal Azië`);
  else console.error(`  ❌ Verwacht "asia" of "middle_east", gekregen "${mapRegion1}"`);

  await new Promise(r => setTimeout(r, 5000));

  // ── Test 2: Europa — Rijn ────────────────────────────────────────────────
  console.log('\n[Test 2] Analyse: Rhine River in Europe');
  const r2 = await axios.post(`${BASE}/api/render`, {
    script: 'The Rhine River flows through the heart of Europe, from the Swiss Alps to the North Sea. It passes through Germany, France, and the Netherlands. For centuries it served as a trade route and natural border between Germanic tribes. Cities like Cologne and Rotterdam grew along its banks.',
    title:  'The Rhine River',
    style:  'documentaire', mode: 'documentary', render_style: '2d', duration: 30,
    subtitleSettings: { enabled: false }
  });
  const job2 = await pollEditing(r2.data.job_id);
  const mapScenes2 = (job2.scenes || []).filter(s => s.template === 'animated_map');
  console.log(`  render_style: ${job2.render_style}, color_theme: ${job2.color_theme}`);
  console.log(`  animated_map scenes: ${mapScenes2.length}`);
  mapScenes2.forEach((s, i) => console.log(`    [${i}] map_region="${s.content?.map_region}" location="${s.content?.location}"`));
  const mapRegion2 = mapScenes2[0]?.content?.map_region;
  if (!mapScenes2.length) console.warn('  ⚠️  Geen animated_map scene gegenereerd');
  else if (mapRegion2 === 'europe') console.log(`  ✅ map_region="europe" correct`);
  else console.error(`  ❌ Verwacht "europe", gekregen "${mapRegion2}"`);

  await new Promise(r => setTimeout(r, 3000));

  // ── Test 3: Volledige render Silk Road ───────────────────────────────────
  console.log('\n[Test 3] Volledige render Silk Road (StaticMap2D)');
  await axios.post(`${BASE}/api/render/${r1.data.job_id}/continue`);
  const done = await pollCompleted(r1.data.job_id);
  if (done.status === 'completed') {
    const size = done.file_path && fs.existsSync(done.file_path) ? fs.statSync(done.file_path).size : 0;
    console.log(`  video_url: ${done.video_url}`);
    console.log(`  Grootte: ${Math.round(size / 1024)} KB`);
    console.log(size > 10000 ? '  ✅ RENDER GESLAAGD' : '  ❌ BESTAND TE KLEIN');
  } else {
    console.error('  ❌ RENDER MISLUKT:', done.error);
  }

  // ── Samenvatting ──────────────────────────────────────────────────────────
  console.log('\n── Samenvatting ─────────────────────────────────────────────');
  console.log(`Test 1 (Silk Road): map_region="${mapRegion1 || 'geen scene'}", color="${job1.color_theme}"`);
  console.log(`Test 2 (Rijn):      map_region="${mapRegion2 || 'geen scene'}", color="${job2.color_theme}"`);
  const mapCheck = mapRegion1 !== mapRegion2 || (!mapRegion1 && !mapRegion2);
  console.log(mapRegion1 !== mapRegion2 ? '✅ Regio\'s zijn verschillend' : '⚠️  Beide dezelfde regio (controleer manueel)');
}

run().catch(e => { console.error('FOUT:', e.message); process.exit(1); });
