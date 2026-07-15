require('dotenv').config({ override: true });
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { OUTPUTS_DIR, JOBS_FILE } = require('./paths');

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

// Opt-in API-auth: als VAULTMOTION_API_KEY gezet is, vereist elke /api route
// (behalve /api/health) een x-api-key header. Zonder env var blijft alles open (lokaal).
const API_KEY = process.env.VAULTMOTION_API_KEY;
if (API_KEY) {
  app.use('/api', (req, res, next) => {
    if (req.path === '/health' || req.path === '/capabilities') return next();
    // Studio-handoff GET: browser haalt het script op via een random UUID met
    // 1u-TTL (bevat enkel door de gebruiker zelf aangeleverd script) — geen key nodig
    if (req.method === 'GET' && /^\/script\/handoff\/[0-9a-f-]+$/.test(req.path)) return next();
    if (req.headers['x-api-key'] === API_KEY) return next();
    res.status(401).json({ error: 'Ongeldige of ontbrekende API key' });
  });
  console.log('🔒 API-key beveiliging actief (VAULTMOTION_API_KEY)');
} else {
  console.log('⚠️  Geen VAULTMOTION_API_KEY ingesteld — API is onbeveiligd (ok voor lokaal, stel in op Railway)');
}

// Eenvoudige in-memory rate limiter: max 120 requests per minuut per IP
const rateBuckets = new Map();
app.use('/api', (req, res, next) => {
  const now = Date.now();
  const key = req.ip;
  const bucket = rateBuckets.get(key) || { count: 0, reset: now + 60_000 };
  if (now > bucket.reset) { bucket.count = 0; bucket.reset = now + 60_000; }
  bucket.count++;
  rateBuckets.set(key, bucket);
  if (rateBuckets.size > 10_000) rateBuckets.clear();
  if (bucket.count > 120) return res.status(429).json({ error: 'Te veel verzoeken — probeer over een minuut opnieuw' });
  next();
});

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

// Frontend serveren op Railway (nixpacks bouwt frontend/dist tijdens install)
const distDir = path.resolve(__dirname, '../../frontend/dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir, {
    setHeaders(res, filePath) {
      if (filePath.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache');
    },
  }));
  console.log(`🖥️  Frontend geserveerd vanuit ${distDir}`);
}

// Publieke deel-link (24u geldig) — buiten de API-key middleware
app.get('/share/:token', (req, res) => {
  try {
    const { JOBS_FILE: jf } = require('./paths');
    const jobs = fs.existsSync(jf) ? JSON.parse(fs.readFileSync(jf, 'utf8')) : {};
    const job = Object.values(jobs).find(j => j.share_token === req.params.token);
    if (!job) return res.status(404).send('<h3 style="font-family:sans-serif;color:#666;text-align:center;margin-top:80px">Link niet gevonden</h3>');
    if (!job.share_expires || new Date(job.share_expires) < new Date()) {
      return res.status(410).send('<h3 style="font-family:sans-serif;color:#666;text-align:center;margin-top:80px">Deze deel-link is verlopen (links zijn 24 uur geldig)</h3>');
    }
    // Simpele afspeelpagina
    res.send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${(job.title || 'VaultMotion video').replace(/</g, '&lt;')}</title></head>
<body style="margin:0;background:#0d0d0d;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif">
<h2 style="color:#e8e3d8;font-weight:600;margin-bottom:16px">${(job.title || 'VaultMotion video').replace(/</g, '&lt;')}</h2>
<video src="${job.video_url}" controls autoplay style="max-height:80vh;max-width:92vw;border-radius:12px"></video>
<p style="color:#555;font-size:12px;margin-top:14px">Gemaakt met VaultMotion · link geldig tot ${new Date(job.share_expires).toLocaleString('nl-BE')}</p>
</body></html>`);
  } catch (e) {
    res.status(500).send('Er ging iets mis');
  }
});

// Capabilities — VaultBoost leest dit bij het openen van de koppeling
app.get('/api/capabilities', async (req, res) => {
  let creditBalance = null;
  try { creditBalance = await require('./services/kieService').getCreditBalance(); } catch {}
  res.json({
    max_duration: 600,
    recommended_max: 300,
    supported_styles: ['ai-cinematic', 'ai-image', 'simple', 'hybrid', 'stock', 'director', 'cinematic_noir', 'documentary', 'social_media_fast', 'luxury'], // 2d/illustrated: enkel nog interne fallback, niet kiesbaar
    illustration_styles: ['flat', 'storybook', 'motion'],
    supported_modes: ['epic', 'documentary', 'story'],
    hybrid_intensities: ['smart', 'low', 'medium', 'high'],
    words_per_second: 2.5,
    credit_balance: creditBalance,
    version: '1.0',
  });
});

// Prompt Intelligence (C3) — geleerde visual-prompt patronen
app.get('/api/prompt-intelligence', (req, res) => {
  try { res.json(require('./services/promptIntelligence').getIntelligence()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

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

// SPA-fallback: deep links (bv. /jobs/:id) naar index.html
if (fs.existsSync(distDir)) {
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/outputs') || req.path.startsWith('/assets') || req.path.startsWith('/share')) return next();
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

// Reset scènes die vastliepen tijdens een vorige server-sessie
function resetStuckPollingScenes() {
  const jobsFile = JOBS_FILE;
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
