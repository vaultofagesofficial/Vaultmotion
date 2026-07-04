import { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Trash2, Zap, XCircle, RefreshCw, AlertTriangle } from 'lucide-react';
import { useTranslation } from '../i18n/useTranslation';

const MODE_OPTIONS = [
  { value: 'epic',        label: 'Epic' },
  { value: 'documentary', label: 'Documentary' },
  { value: 'story',       label: 'Story' },
];

const DURATION_OPTIONS = [30, 45, 60];

const TEMPLATE_LABELS = {
  cinematic_title: '🎬 Title',
  ken_burns:       '📸 Ken Burns',
  animated_map:    '🗺️ Map',
  timeline:        '📅 Timeline',
  stats_counter:   '📊 Stats',
  data_comparison: '📊 Comparison',
  fact_animation:  '📐 Fact',
  outro_cta:       '🔔 Outro',
};

function emptyItem() {
  return { topic: '', mode: 'epic', duration: 60, _id: Math.random().toString(36).slice(2) };
}

function StoryboardCard({ result, approved, onToggle, batchCreatedAt }) {
  const { t } = useTranslation();
  const ageHours = (Date.now() - new Date(batchCreatedAt).getTime()) / 3_600_000;
  const stale    = ageHours > 24;

  if (result.status === 'failed') {
    return (
      <div className="rounded-xl border border-red-700/40 bg-dark-800 p-4">
        <div className="flex items-center gap-2 mb-2">
          <XCircle size={16} className="text-red-400" />
          <span className="text-sm font-semibold text-red-400">
            {t('batch.item.failed', `Item ${result.index + 1} — Mislukt`, { n: result.index + 1 })}
          </span>
        </div>
        <p className="text-xs text-gray-500 break-all">{result.error}</p>
      </div>
    );
  }

  const scenes = result.scenes || [];

  return (
    <div className={`rounded-xl border p-4 space-y-3 transition-colors ${
      approved ? 'border-green-600/60 bg-dark-800' : 'border-dark-600 bg-dark-800'
    }`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="text-mono text-xs" style={{ color: '#6b6b6b' }}>
            {t('batch.item.label', `Item ${result.index + 1}`, { n: result.index + 1 })}
          </span>
          <h3 className="text-sm font-bold text-white mt-0.5 line-clamp-2">{result.title}</h3>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {stale && (
            <span className="flex items-center gap-1 text-xs" style={{ color: '#d4a017' }}>
              <AlertTriangle size={12} /> {t('batch.stale', '>24u')}
            </span>
          )}
          {approved && (
            <span className="text-xs font-semibold" style={{ color: '#4ade80' }}>
              {t('batch.approved_badge', '✅ Goedgekeurd')}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {scenes.map((s, i) => (
          <span key={i} className="text-mono text-xs px-2 py-0.5 rounded-full bg-dark-700" style={{ color: '#6b6b6b' }}>
            {TEMPLATE_LABELS[s.template] || s.template}
          </span>
        ))}
      </div>

      {result.style_anchor && (
        <p className="text-xs italic line-clamp-2" style={{ color: '#e8e3d8' }}>🎨 {result.style_anchor}</p>
      )}

      {scenes.some(s => s.facts?.length > 0) && (
        <div className="space-y-1">
          {scenes.flatMap(s => s.facts || []).slice(0, 3).map((f, i) => (
            <div key={i} className="text-xs" style={{ color: '#e8e3d8' }}>
              <span className="text-mono uppercase mr-1" style={{ color: '#6b6b6b' }}>{f.type}</span>
              {f.value}{f.unit ? ` ${f.unit}` : ''}{f.subject ? ` — ${f.subject}` : ''}
            </div>
          ))}
        </div>
      )}

      <button
        onClick={onToggle}
        className={approved ? 'btn-secondary w-full text-xs py-1.5' : 'btn-primary w-full text-xs py-1.5'}
      >
        {approved ? t('batch.btn.revoke', '❌ Intrekken') : t('batch.btn.approve', '✅ Goedkeuren')}
      </button>
    </div>
  );
}

function RenderProgressCard({ jobId, index, initialStatus }) {
  const { t } = useTranslation();
  const [job, setJob] = useState(null);
  const [renderStatus, setRenderStatus] = useState(initialStatus || 'queued');

  useEffect(() => {
    let stopped = false;
    async function poll() {
      while (!stopped) {
        try {
          const { data } = await axios.get(`/api/render/${jobId}`);
          setJob(data);
          setRenderStatus(data.status);
          if (['completed', 'failed'].includes(data.status)) break;
        } catch (e) {}
        await new Promise(r => setTimeout(r, 3000));
      }
    }
    poll();
    return () => { stopped = true; };
  }, [jobId]);

  const statusStyle = {
    queued:                 { color: '#6b6b6b' },
    editing:                { color: '#d4a017' },
    generating_audio:       { color: '#d4a017' },
    generating_backgrounds: { color: '#d4a017' },
    rendering:              { color: '#d4a017' },
    completed:              { color: '#4ade80' },
    failed:                 { color: '#e53e3e' },
  };

  const STATUS_KEY_MAP = {
    queued:                 'batch.status.queued',
    editing:                'batch.status.starting',
    generating_audio:       'batch.status.audio',
    generating_backgrounds: 'batch.status.backgrounds',
    rendering:              'batch.status.rendering',
    completed:              'batch.status.completed',
    failed:                 'batch.status.failed',
  };

  const st = renderStatus;

  return (
    <div className="rounded-xl border border-dark-600 bg-dark-800 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-mono text-xs" style={{ color: '#6b6b6b' }}>
          {t('batch.item.label', `Item ${index + 1}`, { n: index + 1 })}
        </span>
        <span className="text-xs font-semibold" style={statusStyle[st] || { color: '#6b6b6b' }}>
          {t(STATUS_KEY_MAP[st] || 'batch.status.queued', st)}
        </span>
      </div>
      {job?.title && <p className="text-sm text-white mb-2 line-clamp-1">{job.title}</p>}
      {job?.progress != null && !['completed', 'failed'].includes(st) && (
        <div className="w-full bg-dark-700 rounded-full h-1.5">
          <div className="h-1.5 rounded-full bg-brand-600 transition-all" style={{ width: `${job.progress}%` }} />
        </div>
      )}
      {st === 'completed' && job?.video_url && (
        <a href={`http://localhost:3002${job.video_url}`} target="_blank" rel="noreferrer"
          className="text-xs text-green-400 underline mt-1 block">
          {t('batch.btn.download', 'Download video')}
        </a>
      )}
      {st === 'failed' && job?.error && (
        <p className="text-xs text-red-400 mt-1 break-all">{job.error.slice(0, 120)}</p>
      )}
    </div>
  );
}

export default function BatchPage() {
  const { t } = useTranslation();
  const [phase,        setPhase]        = useState('input');
  const [items,        setItems]        = useState([emptyItem(), emptyItem()]);
  const [batchResult,  setBatchResult]  = useState(null);
  const [approvedIds,  setApprovedIds]  = useState(new Set());
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState(null);
  const [renderResult, setRenderResult] = useState(null);

  useEffect(() => {
    async function restore() {
      try {
        const saved = localStorage.getItem('vaultmotion_batch');
        if (saved) {
          const { batchResult: br, approvedIds: ai, phase: ph } = JSON.parse(saved);
          if (br && ph === 'storyboard') {
            setBatchResult(br);
            setApprovedIds(new Set(ai || []));
            setPhase('storyboard');
            return;
          }
        }
        const savedBatchId = localStorage.getItem('vaultmotion_batch_id');
        if (!savedBatchId) return;
        const batchResp = await axios.get(`/api/batch/${savedBatchId}`);
        const batch     = batchResp.data;
        if (!batch || !Array.isArray(batch.job_ids) || batch.job_ids.length === 0) return;
        if (['completed', 'rendering'].includes(batch.status)) return;

        const results = await Promise.all(
          batch.job_ids.map(async (jobId, idx) => {
            try {
              const { data: job } = await axios.get(`/api/render/${jobId}`);
              return {
                index:               idx,
                job_id:              jobId,
                status:              'storyboard_ready',
                title:               job.title || '',
                style_anchor:        job.style_anchor || '',
                template_decisions:  job.template_decisions || [],
                validation_warnings: job.validation_warnings || [],
                scenes:              (job.scenes || []).map(s => ({
                  template:        s.template,
                  duration_frames: s.duration_frames,
                  script_segment:  s.script_segment,
                  facts:           s.facts || [],
                  comparison:      s.comparison || null,
                })),
              };
            } catch (e) {
              return { index: idx, job_id: jobId, status: 'failed', error: 'Kon storyboard-data niet ophalen' };
            }
          })
        );

        const succeeded = results.filter(r => r.status === 'storyboard_ready').length;
        const restored  = {
          batch_id:  batch.id,
          total:     batch.job_ids.length,
          succeeded,
          failed:    batch.job_ids.length - succeeded,
          results,
          batch,
        };
        setBatchResult(restored);
        setApprovedIds(new Set(batch.approved_ids || []));
        setPhase('storyboard');
      } catch (e) {}
    }
    restore();
  }, []);

  useEffect(() => {
    if (phase === 'storyboard' && batchResult) {
      localStorage.setItem('vaultmotion_batch', JSON.stringify({
        batchResult, approvedIds: [...approvedIds], phase,
      }));
      if (batchResult.batch_id) localStorage.setItem('vaultmotion_batch_id', batchResult.batch_id);
    } else if (phase === 'input') {
      localStorage.removeItem('vaultmotion_batch');
      localStorage.removeItem('vaultmotion_batch_id');
    }
  }, [phase, batchResult, approvedIds]);

  function addItem()           { if (items.length < 8) setItems(p => [...p, emptyItem()]); }
  function removeItem(id)      { setItems(p => p.filter(i => i._id !== id)); }
  function updateItem(id, k, v) { setItems(p => p.map(i => i._id === id ? { ...i, [k]: v } : i)); }

  function toggleApprove(jobId) {
    setApprovedIds(prev => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId); else next.add(jobId);
      return next;
    });
  }

  async function handleGenerateStoryboards() {
    setLoading(true);
    setError(null);
    try {
      const payload = items.map(({ topic, mode, duration }) => ({ topic, mode, duration }));
      const { data } = await axios.post('/api/batch/storyboards', { items: payload });
      setBatchResult(data);
      const defaultApproved = new Set(
        data.results.filter(r => r.status === 'storyboard_ready' && r.job_id).map(r => r.job_id)
      );
      setApprovedIds(defaultApproved);
      setPhase('storyboard');
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRender() {
    if (approvedIds.size === 0) { setError(t('batch.error.none_approved', 'Geen items goedgekeurd')); return; }
    setLoading(true);
    setError(null);
    try {
      const { data } = await axios.post('/api/batch/render', {
        batch_id:         batchResult.batch_id,
        approved_job_ids: [...approvedIds],
      });
      setRenderResult(data);
      setPhase('render');
      localStorage.removeItem('vaultmotion_batch');
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setPhase('input');
    setBatchResult(null);
    setApprovedIds(new Set());
    setRenderResult(null);
    setError(null);
    localStorage.removeItem('vaultmotion_batch');
  }

  if (phase === 'input') return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="heading-display text-2xl font-bold">{t('batch.title', 'Batch Studio')}</h1>
        <p className="text-sm text-gray-400 mt-1">{t('batch.subtitle', 'Stap 1: storyboards genereren. Stap 2: goedkeuren en renderen.')}</p>
      </div>

      <div className="space-y-3">
        {items.map((item, idx) => (
          <div key={item._id} className="rounded-xl border border-dark-700 bg-dark-800 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 w-5 shrink-0">{idx + 1}</span>
              <input
                value={item.topic}
                onChange={e => updateItem(item._id, 'topic', e.target.value)}
                placeholder={t('batch.topic.placeholder', 'Topic / script...')}
                className="flex-1 text-sm bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white placeholder-gray-600"
              />
              {items.length > 1 && (
                <button onClick={() => removeItem(item._id)} className="text-gray-600 hover:text-red-400 shrink-0 transition-colors">
                  <Trash2 size={15} />
                </button>
              )}
            </div>
            <div className="flex gap-3 ml-7">
              <select
                value={item.mode}
                onChange={e => updateItem(item._id, 'mode', e.target.value)}
                className="text-xs bg-dark-700 border border-dark-600 rounded-lg px-2 py-1.5 text-white"
              >
                {MODE_OPTIONS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
              <select
                value={item.duration}
                onChange={e => updateItem(item._id, 'duration', parseInt(e.target.value))}
                className="text-xs bg-dark-700 border border-dark-600 rounded-lg px-2 py-1.5 text-white"
              >
                {DURATION_OPTIONS.map(d => <option key={d} value={d}>{d}s</option>)}
              </select>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        {items.length < 8 && (
          <button onClick={addItem} className="btn-secondary flex items-center gap-2 text-sm">
            <Plus size={14} /> {t('batch.btn.add_item', 'Item toevoegen')}
          </button>
        )}
        <button
          onClick={handleGenerateStoryboards}
          disabled={loading || items.every(i => !i.topic.trim())}
          className="btn-primary flex items-center gap-2 ml-auto disabled:opacity-50"
        >
          {loading
            ? <><RefreshCw size={14} className="animate-spin" /> {t('batch.btn.generating', 'Genereren...')}</>
            : <><Zap size={14} /> {t('batch.btn.generate', 'Genereer Storyboards')}</>}
        </button>
      </div>

      {error && <div className="p-3 rounded-lg bg-red-900/30 border border-red-700/50 text-red-400 text-sm">{error}</div>}
    </div>
  );

  if (phase === 'storyboard') {
    const results       = batchResult?.results || [];
    const batchTs       = batchResult?.batch?.created_at || new Date().toISOString();
    const approvedCount = approvedIds.size;

    return (
      <div className="max-w-2xl mx-auto p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="heading-display text-2xl font-bold">{t('batch.storyboards.title', 'Storyboards')}</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              {t('batch.storyboards.succeeded', `${batchResult.succeeded}/${batchResult.total} geslaagd`, {
                succeeded: batchResult.succeeded, total: batchResult.total
              })}
              {batchResult.failed > 0 && (
                <span className="text-red-400 ml-2">
                  · {t('batch.storyboards.failed', `${batchResult.failed} mislukt`, { count: batchResult.failed })}
                </span>
              )}
            </p>
          </div>
          <button onClick={handleReset} className="text-xs text-gray-500 hover:text-gray-300 px-3 py-1.5 rounded border border-dark-600">
            {t('batch.btn.new', 'Nieuw')}
          </button>
        </div>

        <div className="space-y-3">
          {results.map(result => (
            <StoryboardCard
              key={result.index}
              result={result}
              approved={!!(result.job_id && approvedIds.has(result.job_id))}
              onToggle={() => result.job_id && toggleApprove(result.job_id)}
              batchCreatedAt={batchTs}
            />
          ))}
        </div>

        {error && <div className="p-3 rounded-lg bg-red-900/30 border border-red-700/50 text-red-400 text-sm">{error}</div>}

        <div className="flex items-center justify-between pt-3 border-t border-dark-700">
          <span className="text-sm text-gray-400">
            {t('batch.approved', `${approvedCount} item(s) goedgekeurd`, { count: approvedCount })}
          </span>
          <button
            onClick={handleRender}
            disabled={loading || approvedCount === 0}
            className="btn-primary flex items-center gap-2 disabled:opacity-50"
          >
            {loading
              ? <><RefreshCw size={14} className="animate-spin" /> {t('batch.btn.starting', 'Starten...')}</>
              : <><Zap size={14} /> {t('batch.btn.render', `Render ${approvedCount} item(s)`, { count: approvedCount })}</>}
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'render') {
    const statuses  = renderResult?.statuses || [];
    const queued    = renderResult?.queued || 0;
    const immediate = renderResult?.immediately_started || 0;

    return (
      <div className="max-w-2xl mx-auto p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="heading-display text-2xl font-bold">{t('batch.rendering.title', 'Rendering')}</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              {t('batch.rendering.stats', `${immediate} gestart · ${queued} in wachtrij · max ${renderResult?.max_concurrent || 2} gelijktijdig`, {
                immediate, queued, max: renderResult?.max_concurrent || 2
              })}
            </p>
          </div>
          <button onClick={handleReset} className="text-xs text-gray-500 hover:text-gray-300 px-3 py-1.5 rounded border border-dark-600">
            {t('batch.btn.new_batch', 'Nieuwe batch')}
          </button>
        </div>

        <div className="space-y-3">
          {statuses.map((s, i) => (
            <RenderProgressCard
              key={s.job_id}
              jobId={s.job_id}
              index={i}
              initialStatus={s.render_status === 'starting' ? 'editing' : 'queued'}
            />
          ))}
        </div>
      </div>
    );
  }

  return null;
}
