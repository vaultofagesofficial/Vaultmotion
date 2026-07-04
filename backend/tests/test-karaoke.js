/**
 * Verificatietest karaoke-box ondertitelstijl
 * Test 1: karaoke-box — EN script met korte woorden ("a", "in", "of")
 * Test 2: classic — zelfde script, classic modus (regressietest)
 * Test 3: karaoke-box — NL script met lange woorden (flexWrap-test)
 * Controleert: subtitleStyle opgeslagen op job, bestandsgrootte, geen crash
 */
const axios = require('axios');
const fs    = require('fs');
const BASE  = 'http://localhost:3002';

const EN_SCRIPT = 'In a world of chaos, the rise of a single idea changed everything. It started as a dream in the minds of a few, and grew into a movement that swept across nations.';
const NL_SCRIPT = 'De samengestelde rente is een van de krachtigste financiële instrumenten ter wereld. Het kapitaal groeit exponentieel wanneer de rente opnieuw geïnvesteerd wordt. Nederlanders onderschatten dit fenomeen structureel.';

async function pollEditing(jobId, maxMs = 90000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const { data } = await axios.get(`${BASE}/api/render/${jobId}`);
    process.stdout.write(`\r  [${jobId.slice(0,8)}] ${data.status} (${Math.round((Date.now()-start)/1000)}s)  `);
    if (['editing','failed'].includes(data.status)) { process.stdout.write('\n'); return data; }
    await new Promise(r => setTimeout(r, 3000));
  }
  throw new Error('Timeout editing');
}

async function pollCompleted(jobId, maxMs = 360000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const { data } = await axios.get(`${BASE}/api/render/${jobId}`);
    process.stdout.write(`\r  [${jobId.slice(0,8)}] ${data.status} (${Math.round((Date.now()-start)/1000)}s)  `);
    if (['completed','failed'].includes(data.status)) { process.stdout.write('\n'); return data; }
    await new Promise(r => setTimeout(r, 5000));
  }
  throw new Error('Timeout render');
}

async function startAndRender(opts) {
  const r = await axios.post(`${BASE}/api/render`, opts);
  const jobId = r.data.job_id;
  const job = await pollEditing(jobId);
  if (job.status === 'failed') { console.error('  ❌ Analyse mislukt:', job.error); return null; }

  const ss = job.subtitle_settings || {};
  console.log(`  subtitle_settings.subtitleStyle: "${ss.subtitleStyle || 'ontbreekt'}"`);
  console.log(`  subtitle_settings.enabled: ${ss.enabled}, highlightColor: ${ss.highlightColor}`);

  await axios.post(`${BASE}/api/render/${jobId}/continue`);
  const done = await pollCompleted(jobId);
  if (done.status === 'completed') {
    const size = done.file_path && fs.existsSync(done.file_path) ? fs.statSync(done.file_path).size : 0;
    console.log(`  video_url: ${done.video_url}`);
    console.log(`  Grootte: ${Math.round(size / 1024)} KB`);
    return { size, subtitleStyle: ss.subtitleStyle };
  } else {
    console.error('  ❌ Render mislukt:', done.error);
    return null;
  }
}

async function run() {
  const base = {
    style: 'documentaire', mode: 'documentary', render_style: '2d',
    duration: 30
  };

  // ── Test 1: karaoke-box (EN, korte woorden: "a", "in", "of") ─────────────
  console.log('\n[Test 1] karaoke-box — EN script (korte woorden "a","in","of")');
  const t1 = await startAndRender({
    ...base,
    script: EN_SCRIPT,
    title: 'Karaoke-box Test EN',
    subtitleSettings: { enabled: true, fontSize: 'normaal', highlightColor: '#FFD700', position: 'onder', subtitleStyle: 'karaoke-box' }
  });
  if (t1) {
    console.log(t1.subtitleStyle === 'karaoke-box' ? '  ✅ subtitleStyle="karaoke-box" opgeslagen' : '  ❌ subtitleStyle niet correct');
    console.log(t1.size > 10000 ? '  ✅ Render succesvol' : '  ❌ Bestand te klein');
  }

  await new Promise(r => setTimeout(r, 5000));

  // ── Test 2: classic (regressietest) ──────────────────────────────────────
  console.log('\n[Test 2] classic — zelfde script (regressietest)');
  const t2 = await startAndRender({
    ...base,
    script: EN_SCRIPT,
    title: 'Classic Test EN',
    subtitleSettings: { enabled: true, fontSize: 'normaal', highlightColor: '#FFD700', position: 'onder', subtitleStyle: 'classic' }
  });
  if (t2) {
    console.log(t2.subtitleStyle === 'classic' ? '  ✅ subtitleStyle="classic" opgeslagen' : '  ❌ subtitleStyle niet correct');
    console.log(t2.size > 10000 ? '  ✅ Classic render succesvol (geen regressie)' : '  ❌ Bestand te klein');
  }

  await new Promise(r => setTimeout(r, 5000));

  // ── Test 3: karaoke-box + NL lange woorden ────────────────────────────────
  console.log('\n[Test 3] karaoke-box — NL script (lange woorden, flexWrap-test)');
  const t3 = await startAndRender({
    ...base,
    script: NL_SCRIPT,
    title: 'Karaoke-box NL Test',
    subtitleSettings: { enabled: true, fontSize: 'normaal', highlightColor: '#e53e3e', position: 'onder', subtitleStyle: 'karaoke-box' }
  });
  if (t3) {
    console.log(t3.subtitleStyle === 'karaoke-box' ? '  ✅ subtitleStyle="karaoke-box" opgeslagen' : '  ❌ subtitleStyle niet correct');
    console.log(t3.size > 10000 ? '  ✅ NL render succesvol (geen crash door lange woorden)' : '  ❌ Bestand te klein');
  }

  // ── Samenvatting ──────────────────────────────────────────────────────────
  console.log('\n── Samenvatting ─────────────────────────────────────────────');
  console.log(`Test 1 (karaoke-box EN): ${t1 ? Math.round(t1.size/1024)+'KB ✅' : '❌'}`);
  console.log(`Test 2 (classic EN):     ${t2 ? Math.round(t2.size/1024)+'KB ✅' : '❌'}`);
  console.log(`Test 3 (karaoke-box NL): ${t3 ? Math.round(t3.size/1024)+'KB ✅' : '❌'}`);
  console.log('\nNOTA: Visuele "CapCut-feel" (box-stijl, contrast) vereist handmatige check van de gerenderde video\'s.');
  console.log('      minWidth-effect op korte woorden (<3 chars) is niet automatisch verifieerbaar vanuit de backend.');
}

run().catch(e => { console.error('FOUT:', e.message); process.exit(1); });
