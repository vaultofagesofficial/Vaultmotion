/**
 * VFX overlay test — vignette, transition flash, film grain
 * Test 1: ai-cinematic (documentary, 15s)
 * Test 2: 2d (15s)
 */
const axios = require('axios');
const fs    = require('fs');
const BASE  = 'http://localhost:3002';

const SCRIPT = 'The Roman Empire fell in 476 AD. At its peak, it controlled 70 million people. From Hadrian\'s Wall to the sands of Egypt, no empire had ever reached so far. Then it was gone. Follow for more epic history.';

async function poll(jobId, targetStatus, maxMs = 360000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const { data } = await axios.get(`${BASE}/api/render/${jobId}`);
    process.stdout.write(`\r  [${jobId.slice(0,8)}] ${data.status} (${Math.round((Date.now()-start)/1000)}s)  `);
    if (data.status === targetStatus || data.status === 'failed') {
      process.stdout.write('\n');
      return data;
    }
    await new Promise(r => setTimeout(r, 3000));
  }
  throw new Error('Timeout');
}

async function runTest(label, opts) {
  console.log(`\n[${label}]`);
  const r = await axios.post(`${BASE}/api/render`, opts);
  const jobId = r.data.job_id;

  const editing = await poll(jobId, 'editing');
  if (editing.status === 'failed') { console.error('  ❌ Analyse mislukt:', editing.error); return null; }

  await axios.post(`${BASE}/api/render/${jobId}/continue`);
  const done = await poll(jobId, 'completed');
  if (done.status === 'failed') { console.error('  ❌ Render mislukt:', done.error); return null; }

  const size = done.file_path && fs.existsSync(done.file_path)
    ? fs.statSync(done.file_path).size : 0;
  console.log(`  file_path : ${done.file_path}`);
  console.log(`  size      : ${Math.round(size / 1024)} KB`);
  console.log(`  video_url : ${done.video_url}`);
  return { size, filePath: done.file_path };
}

(async () => {
  const base = {
    script:  SCRIPT,
    title:   'VFX Test',
    style:   'documentaire',
    mode:    'documentary',
    duration: 15,
    subtitleSettings: { enabled: false },
  };

  const t1 = await runTest('Test 1 — ai-cinematic', { ...base, render_style: 'ai-cinematic' });
  await new Promise(r => setTimeout(r, 3000));
  const t2 = await runTest('Test 2 — 2d', { ...base, render_style: '2d' });

  console.log('\n── Samenvatting ──────────────────────────────────────────');
  console.log(`ai-cinematic: ${t1 ? Math.round(t1.size/1024)+'KB ✅' : '❌'}`);
  console.log(`2d          : ${t2 ? Math.round(t2.size/1024)+'KB ✅' : '❌'}`);
  console.log('\nNOTA: Visuele controle (vignette donker rand, witte flits bij overgang,');
  console.log('      film grain textuur) vereist handmatige video-inspectie.');
  console.log('      Renderservice logt "vfxSettings" niet expliciet — zie inputProps in code.');
})().catch(e => { console.error('FOUT:', e.message); process.exit(1); });
