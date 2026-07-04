const path = require('path');

// Op Railway: DATA_DIR=/data (persistent volume), lokaal: vaultmotion/
const DATA_DIR = process.env.DATA_DIR || path.resolve(__dirname, '../..');

const OUTPUTS_DIR   = process.env.OUTPUTS_DIR   || path.join(DATA_DIR, 'outputs');
const JOBS_FILE     = process.env.JOBS_FILE      || path.join(DATA_DIR, 'jobs.json');
const BATCHES_FILE  = process.env.BATCHES_FILE   || path.join(DATA_DIR, 'batches.json');

// Public base URL voor file-links die teruggegeven worden aan frontend/Remotion
// Op Railway: stel SERVER_BASE_URL in als https://<jouw-app>.up.railway.app
const SERVER_BASE_URL = process.env.SERVER_BASE_URL || `http://localhost:${process.env.PORT || 3002}`;

module.exports = { OUTPUTS_DIR, JOBS_FILE, BATCHES_FILE, SERVER_BASE_URL };
