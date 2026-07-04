require('dotenv').config({ override: true });
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { OUTPUTS_DIR } = require('./paths');

const app = express();
const PORT = process.env.PORT || 3002;

// Zorg dat outputs map bestaat
const outputsDir = OUTPUTS_DIR;
if (!fs.existsSync(outputsDir)) {
  fs.mkdirSync(outputsDir, { recursive: true });
}

const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(s => s.trim())
  : ['http://localhost:5174', 'http://localhost:3001'];
app.use(cors({ origin: corsOrigins }));
app.use(express.json({ limit: '10mb' }));

// Statische output bestanden serveren
app.use('/outputs', express.static(outputsDir));

// Achtergrondmuziek assets serveren
const musicDir = path.resolve(__dirname, '../assets/music');
if (!fs.existsSync(musicDir)) fs.mkdirSync(musicDir, { recursive: true });
app.use('/assets/music', express.static(musicDir));

// SFX assets serveren
const sfxDir = path.resolve(__dirname, '../assets/sfx');
if (!fs.existsSync(sfxDir)) fs.mkdirSync(sfxDir, { recursive: true });
app.use('/assets/sfx', express.static(sfxDir));

// Routes
app.use('/api/render',      require('./routes/render'));
app.use('/api/batch',       require('./routes/batch'));
app.use('/api/script',      require('./routes/script'));
app.use('/api/templates',   require('./routes/templates'));
app.use('/api/voices',      require('./routes/voices'));
app.use('/api/vaultboost',  require('./routes/vaultboost'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'VaultMotion Backend',
    version: '1.0.0',
    port: PORT,
    timestamp: new Date().toISOString()
  });
});

// Reset scènes die vastliepen tijdens een vorige server-sessie
function resetStuckPollingScenes() {
  // server.js zit in backend/src/ → jobs.json zit in backend/ → één niveau omhoog
  const jobsFile = path.resolve(__dirname, '../jobs.json');
  console.log(`♻️  [Startup] Checking stuck scenes in: ${jobsFile}`);
  try {
    if (!fs.existsSync(jobsFile)) {
      console.log('♻️  [Startup] jobs.json niet gevonden, niets te resetten');
      return;
    }
    const jobs = JSON.parse(fs.readFileSync(jobsFile, 'utf8'));
    let resetCount = 0;
    let jobCount   = 0;
    for (const job of Object.values(jobs)) {
      if (job.status !== 'generating_backgrounds') continue;
      let anyStuck = false;
      job.scenes = (job.scenes || []).map(s => {
        if (s.kling_status === 'polling' || s.kling_status === 'generating') {
          anyStuck = true;
          resetCount++;
          return { ...s, kling_status: 'failed', kling_error: 'Server herstart tijdens generatie — klik Opnieuw proberen' };
        }
        return s;
      });
      if (anyStuck) { job.status = 'failed'; jobCount++; }
    }
    if (resetCount > 0) {
      fs.writeFileSync(jobsFile, JSON.stringify(jobs, null, 2));
      console.log(`♻️  [Startup] ${resetCount} scène(s) in ${jobCount} job(s) gereset naar 'failed' → klik "Opnieuw proberen"`);
    } else {
      console.log('♻️  [Startup] Geen vastgelopen scènes gevonden');
    }
  } catch (e) {
    console.warn('⚠️  [Startup] Reset stuck scenes mislukt:', e.message);
  }
}
resetStuckPollingScenes();

app.listen(PORT, async () => {
  console.log(`\n🎬 VaultMotion Backend draait op http://localhost:${PORT}`);
  console.log(`📁 Outputs map: ${outputsDir}`);
  console.log(`📁 [paths.js] OUTPUTS_DIR: ${OUTPUTS_DIR}`);

  // ── kie.ai health-check ─────────────────────────────────────────────────
  const kieKey = process.env.KIE_API_KEY;
  if (!kieKey) {
    console.log('⚠️  kie.ai: KIE_API_KEY niet ingesteld — video-generatie uitgeschakeld');
  } else {
    try {
      const https = require('https');
      const result = await new Promise((resolve, reject) => {
        const req = https.request(
          { hostname: 'api.kie.ai', path: '/api/v1/jobs/recordInfo?taskId=healthcheck', method: 'GET',
            headers: { Authorization: `Bearer ${kieKey}`, 'Content-Type': 'application/json' } },
          res => {
            let body = '';
            res.on('data', d => body += d);
            res.on('end', () => resolve({ status: res.statusCode, body }));
          }
        );
        req.on('error', reject);
        req.setTimeout(8000, () => { req.destroy(); reject(new Error('timeout')); });
        req.end();
      });
      // HTTP 200 + code 422 ("recordInfo is null") = key geldig, API bereikbaar
      // HTTP 401 = ongeldige key
      if (result.status === 200) {
        const parsed = JSON.parse(result.body);
        if (parsed.code === 401 || parsed.msg?.toLowerCase().includes('unauthorized')) {
          console.log(`❌ kie.ai: API key ongeldig (401 Unauthorized)`);
        } else {
          console.log(`✅ kie.ai verbinding OK`);
        }
      } else if (result.status === 401) {
        console.log(`❌ kie.ai: API key ongeldig (401 Unauthorized)`);
      } else {
        console.log(`⚠️  kie.ai antwoord ${result.status}: ${result.body.slice(0, 150)}`);
      }
    } catch (err) {
      console.log(`❌ kie.ai verbinding MISLUKT: ${err.message}`);
    }
  }
  console.log('');
});
