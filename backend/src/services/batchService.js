'use strict';
const fs   = require('fs');
const { v4: uuidv4 } = require('uuid');
const { BATCHES_FILE } = require('../paths');

function loadBatches() {
  try {
    if (fs.existsSync(BATCHES_FILE)) return JSON.parse(fs.readFileSync(BATCHES_FILE, 'utf8'));
  } catch (e) { console.error('[batchService] Laden batches.json:', e.message); }
  return {};
}

function saveBatches(batches) {
  try { fs.writeFileSync(BATCHES_FILE, JSON.stringify(batches, null, 2)); }
  catch (e) { console.error('[batchService] Opslaan batches.json:', e.message); }
}

function getBatch(batchId) {
  return loadBatches()[batchId] || null;
}

function createBatch({ items }) {
  const batchId = uuidv4();
  const batch = {
    id:           batchId,
    status:       'pending',
    job_ids:      [],
    approved_ids: [],
    created_at:   new Date().toISOString(),
    updated_at:   new Date().toISOString(),
    items,
  };
  const batches = loadBatches();
  batches[batchId] = batch;
  saveBatches(batches);
  return batch;
}

function updateBatch(batchId, updates) {
  const batches = loadBatches();
  if (!batches[batchId]) return null;
  batches[batchId] = { ...batches[batchId], ...updates, updated_at: new Date().toISOString() };
  saveBatches(batches);
  return batches[batchId];
}

function getAllBatches() {
  return Object.values(loadBatches()).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

module.exports = { getBatch, createBatch, updateBatch, getAllBatches };
