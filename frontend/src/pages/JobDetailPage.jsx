import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import {
  ArrowLeft, CheckCircle2, XCircle, Loader2, Video,
  Download, Clock, Layers, Captions, Zap, Youtube, Wand2, Copy, Check, RefreshCw, ImageIcon, Upload
} from 'lucide-react';
import SceneEditorPage from './SceneEditorPage.jsx';
import { useTranslation } from '../i18n/useTranslation';

const TEMPLATE_ICONS = {
  cinematic_title: '🎬',
  ken_burns: '📸',
  animated_map: '🗺️',
  timeline: '📅',
  stats_counter: '📊',
  outro_cta: '🔔'
};

const TEMPLATE_NAMES = {
  cinematic_title: 'Cinematic Title',
  ken_burns: 'Ken Burns',
  animated_map: 'Animated Map',
  timeline: 'Timeline',
  stats_counter: 'Stats Counter',
  outro_cta: 'Outro CTA'
};

const PIPELINE_STEPS = [
  { key: 'analyzing',               stepKey: 'job.step.analyzing',   pct: [0, 20]   },
  { key: 'editing',                 stepKey: 'job.step.editing',     pct: [20, 25]  },
  { key: 'generating_audio',        stepKey: 'job.step.audio',       pct: [25, 45]  },
  { key: 'waiting_for_backgrounds', stepKey: 'job.step.backgrounds', pct: [45, 75]  },
  { key: 'generating_backgrounds',  stepKey: 'job.step.backgrounds', pct: [45, 75]  },
  { key: 'rendering',               stepKey: 'job.step.rendering',   pct: [75, 100] },
  { key: 'completed',               stepKey: 'job.step.done',        pct: [100, 100] }
];

function WaitingForBackgroundsBanner({ jobId }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  function copyJobId() {
    navigator.clipboard.writeText(jobId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  return (
    <div className="mt-4 rounded-xl border p-4" style={{ borderColor: 'rgba(212,160,23,0.4)', backgroundColor: 'rgba(212,160,23,0.07)' }}>
      <div className="flex items-center gap-2 mb-3">
        <Wand2 size={16} style={{ color: '#d4a017' }} />
        <span className="heading-display text-sm" style={{ color: '#d4a017' }}>
          {t('job.waiting_bg.title', 'Wachten op AI achtergronden')}
        </span>
      </div>
      <p className="text-xs text-gray-400 mb-3 leading-relaxed">
        {t('job.waiting_bg.desc', 'De scène-analyse is klaar. Higgsfield video\'s worden gegenereerd via Claude MCP. Kopieer het Job ID en geef het aan Claude om de achtergronden te genereren.')}
      </p>
      <div className="flex gap-2">
        <code className="text-mono flex-1 bg-dark-900 px-3 py-2 rounded-lg truncate" style={{ color: '#d4a017' }}>
          {jobId}
        </code>
        <button
          onClick={copyJobId}
          className="btn-secondary flex items-center gap-1.5 px-3 py-2 text-xs"
        >
          {copied
            ? <><Check size={12} /> {t('job.btn.copied', 'Gekopieerd!')}</>
            : <><Copy size={12} /> {t('job.btn.copy_id', 'Kopieer Job ID')}</>}
        </button>
      </div>
      <div className="mt-3 text-xs text-gray-600 italic">
        💡 {t('job.claude_hint', `Zeg tegen Claude: "Genereer Higgsfield achtergronden voor job ${jobId}"`, { jobId })}
      </div>
    </div>
  );
}

function CaptionsEditor({ job, jobId, onUpdated }) {
  const { t } = useTranslation();
  const [drafts, setDrafts] = useState(() => (job.scenes || []).map(s => s.script_segment || ''));
  const [savingIdx, setSavingIdx] = useState(null);

  const scenes = job.scenes || [];
  const anyEdited = scenes.some(s => s.caption_edited);

  async function saveScene(idx) {
    setSavingIdx(idx);
    try {
      const { data } = await axios.patch(`/api/render/${jobId}/scene/${idx}/caption`, { script_segment: drafts[idx] });
      onUpdated(data.scene, idx);
    } catch (e) {
      console.error('[CaptionsEditor] opslaan mislukt', e.message);
    } finally {
      setSavingIdx(null);
    }
  }

  if (scenes.length === 0) return null;

  return (
    <div className="card">
      <h3 className="font-semibold text-white mb-3 text-sm flex items-center gap-2">
        <Captions size={15} /> {t('job.captions.title', 'Ondertitel-tekst bewerken')}
      </h3>

      {anyEdited && (
        <div className="p-3 rounded-lg text-xs mb-3" style={{ backgroundColor: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.35)', color: '#fb923c' }}>
          ⚠️ {t('job.captions.resync_warning', 'Tekst aangepast — dit past alleen de tekst-overlay/template aan. De voice-over en ondertitel-timing zijn NIET automatisch bijgewerkt en blijven op de oorspronkelijke tekst gebaseerd. Wil je dat de audio ook klopt, genereer dan een nieuwe render vanaf het aangepaste script in Studio.')}
        </div>
      )}

      <div className="space-y-3">
        {scenes.map((scene, idx) => (
          <div key={idx} className="rounded-lg border border-dark-700 bg-dark-900 p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-gray-500">{TEMPLATE_ICONS[scene.template] || '🎞️'} {t('job.captions.scene', `Scène ${idx + 1}`, { n: idx + 1 })}</span>
              {scene.caption_edited && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(251,146,60,0.15)', color: '#fb923c' }}>
                  {t('job.captions.edited', 'bewerkt — sync nog niet bijgewerkt')}
                </span>
              )}
            </div>
            <textarea
              value={drafts[idx] ?? ''}
              onChange={e => setDrafts(d => { const n = [...d]; n[idx] = e.target.value; return n; })}
              rows={2}
              className="w-full text-sm bg-dark-800 border border-dark-600 rounded-lg px-3 py-2 text-white resize-none"
            />
            <div className="flex justify-end mt-1.5">
              <button
                onClick={() => saveScene(idx)}
                disabled={savingIdx === idx || drafts[idx] === (scene.script_segment || '')}
                className="btn-secondary text-xs px-3 py-1 disabled:opacity-40"
              >
                {savingIdx === idx ? t('job.captions.saving', 'Opslaan…') : t('job.captions.save', 'Opslaan')}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SceneCard({ scene, index }) {
  const { t } = useTranslation();
  const kStatus   = scene.kling_status || scene.higgsfield_status || 'pending';
  const kProgress = scene.kling_progress ?? scene.higgsfield_progress ?? (kStatus === 'completed' ? 100 : 0);
  const videoUrl  = scene.background_video_url || scene.higgsfield_video_url || null;
  const prompt    = scene.kling_prompt || scene.higgsfield_prompt || null;
  const kError    = scene.kling_error || null;

  const STATUS_COLOR = {
    pending:    '#6b6b6b',
    generating: '#d4a017',
    polling:    '#d4a017',
    completed:  '#4ade80',
    failed:     '#e53e3e',
  };

  const STATUS_LABEL_KEY = {
    pending:    'job.scene.status.waiting',
    generating: 'job.scene.status.generating',
    polling:    'job.scene.status.kling',
    completed:  'job.scene.status.completed',
    failed:     'job.scene.status.failed',
  };

  const isActive = kStatus === 'generating' || kStatus === 'polling';

  return (
    <div className="rounded-xl border p-4 transition-all border-dark-700 bg-dark-800" style={
      kStatus === 'completed' ? { borderColor: 'rgba(74,222,128,0.3)',  backgroundColor: 'rgba(74,222,128,0.05)' } :
      kStatus === 'failed'    ? { borderColor: 'rgba(229,62,62,0.3)',   backgroundColor: 'rgba(229,62,62,0.05)'  } :
      isActive                ? { borderColor: 'rgba(212,160,23,0.35)', backgroundColor: 'rgba(212,160,23,0.05)' } :
      {}
    }>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="text-2xl">{TEMPLATE_ICONS[scene.template] || '🎬'}</div>
          <div>
            <div className="font-semibold text-white text-sm">
              Scène {index + 1} — {TEMPLATE_NAMES[scene.template] || scene.template}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              {Math.round((scene.duration_frames || 90) / 30)}s
              {scene.script_segment && (
                <span className="ml-2 italic">"{scene.script_segment.slice(0, 45)}..."</span>
              )}
            </div>
          </div>
        </div>

        <span className="text-mono flex items-center gap-1 text-xs font-semibold" style={{ color: STATUS_COLOR[kStatus] || '#6b6b6b' }}>
          {isActive && <Loader2 size={11} className="animate-spin" />}
          {kStatus === 'completed' && <CheckCircle2 size={11} />}
          {kStatus === 'failed'    && <XCircle size={11} />}
          {t(STATUS_LABEL_KEY[kStatus] || 'job.scene.status.waiting', kStatus)}
        </span>
      </div>

      {isActive && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-[10px] text-gray-500 mb-1">
            <span>{t('job.kling.generating', 'Kling AI genereren...')}</span>
            <span>{kProgress}%</span>
          </div>
          <div className="h-1.5 bg-dark-700 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${kProgress}%`, backgroundColor: '#d4a017' }}
            />
          </div>
        </div>
      )}

      {kStatus === 'completed' && videoUrl && (
        <div className="mt-3">
          <video
            src={videoUrl}
            className="w-full max-h-32 object-cover rounded-lg"
            autoPlay loop muted playsInline
          />
        </div>
      )}

      {kStatus === 'failed' && kError && (
        <div className="mt-2 text-xs text-red-400 bg-red-900/20 rounded px-2 py-1">
          {kError}
        </div>
      )}

      {prompt && (
        <details className="mt-2">
          <summary className="text-xs text-gray-600 cursor-pointer hover:text-gray-400 transition-colors">
            {t('job.kling.view_prompt', 'AI prompt bekijken...')}
          </summary>
          <div className="mt-1 text-xs text-gray-500 italic leading-relaxed bg-dark-900 rounded p-2">
            {prompt}
          </div>
        </details>
      )}
    </div>
  );
}

export default function JobDetailPage() {
  const { jobId } = useParams();
  const { t } = useTranslation();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ytUpload, setYtUpload]   = useState({ loading: false, url: null, shortsUrl: null, error: null });
  const [retrying, setRetrying]         = useState(false);
  const [rerendering, setRerendering]   = useState(false);
  const [thumbnail, setThumbnail]   = useState({ uploading: false, url: null, error: null });
  const [sharing, setSharing]       = useState(false);
  const [shareUrl, setShareUrl]     = useState(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareJobs, setCompareJobs] = useState([]);
  const [compareWith, setCompareWith] = useState(null);
  const thumbInputRef = useRef(null);
  const intervalRef   = useRef(null);

  async function handleRetry() {
    setRetrying(true);
    try { await axios.post(`/api/render/${jobId}/retry`); } catch (e) { console.error(e); }
    setRetrying(false);
  }

  async function handleRetryRender() {
    setRerendering(true);
    try { await axios.post(`/api/render/${jobId}/retry-render`); } catch (e) { console.error(e); }
    setRerendering(false);
  }

  async function handleShare() {
    setSharing(true);
    try {
      const { data } = await axios.post(`/api/render/${jobId}/share`);
      setShareUrl(data.share_url);
      navigator.clipboard?.writeText(data.share_url).catch(() => {});
    } catch (e) {
      console.error('[share]', e.message);
    }
    setSharing(false);
  }

  async function openCompare() {
    try {
      const { data } = await axios.get('/api/render');
      const prev = (Array.isArray(data) ? data : []).filter(j =>
        j.id !== jobId && j.status === 'completed' && j.video_url
      );
      setCompareJobs(prev.slice(0, 10));
      setCompareWith(prev[0] || null);
      setCompareOpen(true);
    } catch (e) { console.error('[compare]', e.message); }
  }

  async function handleYouTubeUpload() {
    setYtUpload({ loading: true, url: null, shortsUrl: null, error: null });
    try {
      const { data } = await axios.post(`/api/render/${jobId}/upload-youtube`);
      setYtUpload({ loading: false, url: data.youtube_url, shortsUrl: data.youtube_shorts_url, error: null });
    } catch (e) {
      setYtUpload({ loading: false, url: null, shortsUrl: null, error: e.response?.data?.error || e.message });
    }
  }

  async function handleThumbnailUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setThumbnail({ uploading: true, url: null, error: null });
    try {
      const form = new FormData();
      form.append('thumbnail', file);
      const { data } = await axios.post(`/api/render/${jobId}/thumbnail`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setThumbnail({ uploading: false, url: data.thumbnail_url, error: null });
    } catch (e) {
      setThumbnail({ uploading: false, url: null, error: e.response?.data?.error || e.message });
    }
  }

  async function fetchJob() {
    try {
      const { data } = await axios.get(`/api/render/${jobId}`);
      setJob(data);
      if (data.thumbnail_url && !thumbnail.url) {
        setThumbnail(prev => ({ ...prev, url: data.thumbnail_url }));
      }
      if (data.youtube_url && !ytUpload.url) {
        setYtUpload(prev => ({ ...prev, url: data.youtube_url, shortsUrl: data.youtube_shorts_url }));
      }
      if (data.status === 'completed' || data.status === 'failed') {
        clearInterval(intervalRef.current);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchJob();
    intervalRef.current = setInterval(fetchJob, 3000);
    return () => clearInterval(intervalRef.current);
  }, [jobId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <Loader2 size={24} className="animate-spin mr-2" /> {t('common.loading', 'Laden...')}
      </div>
    );
  }

  if (!job) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-400">{t('job.not_found', 'Job niet gevonden')}</p>
        <Link to="/jobs" className="btn-secondary mt-4 inline-flex items-center gap-2">
          <ArrowLeft size={15} /> {t('common.back', 'Terug')}
        </Link>
      </div>
    );
  }

  if (job.status === 'editing') {
    return <SceneEditorPage job={job} />;
  }

  const isActive = !['completed', 'failed'].includes(job.status);
  const isWaitingForBg = job.status === 'waiting_for_backgrounds';
  const failedScenes = (job.scenes || []).filter(s => s.kling_status === 'failed' || s.kling_status === 'polling');

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <Link to="/jobs" className="inline-flex items-center gap-1 text-gray-400 hover:text-white text-sm mb-6 transition-colors">
        <ArrowLeft size={15} /> {t('job.back', 'Alle jobs')}
      </Link>

      {job.preview && (
        <div className="flex items-center gap-3 mb-6 px-4 py-3 rounded-lg border text-sm font-semibold"
          style={{ backgroundColor: 'rgba(184,134,11,0.15)', borderColor: '#B8860B', color: '#FFD700' }}>
          ⚠️ {t('job.preview_banner', 'PREVIEW — Geen AI-achtergronden (kie.ai overgeslagen). Voice-over en timing zijn wel correct.')}
        </div>
      )}

      {job.render_style === 'hybrid' && !job.preview && (
        <div className="flex items-center gap-3 mb-6 px-4 py-3 rounded-lg border text-sm"
          style={{ backgroundColor: 'rgba(59,130,246,0.1)', borderColor: 'rgba(59,130,246,0.4)', color: '#93c5fd' }}>
          ⚡ {t('job.hybrid_banner', 'HYBRIDE')}&nbsp;
          <span className="font-semibold">
            {job.hybrid_intensity === 'low'    && '💰 Economisch — ~150 credits (titel + outro KIE)'}
            {job.hybrid_intensity === 'medium' && '⚖️ Gebalanceerd — ~400 credits (helft KIE + helft 2D)'}
            {job.hybrid_intensity === 'high'   && '🎬 Premium — ~800 credits (alle scènes KIE)'}
            {!job.hybrid_intensity             && '💰 Economisch — ~150 credits'}
          </span>
        </div>
      )}

      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="heading-display text-2xl font-bold mb-1">{job.title || 'Untitled Short'}</h1>
          <p className="text-mono text-stone">{job.id}</p>
        </div>
        {job.status === 'completed' && job.video_url && (
          <a
            href={job.video_url}
            download={`${(job.title || job.id).replace(/[^a-zA-Z0-9\s_-]/g, '').replace(/\s+/g, '_')}.mp4`}
            className="btn-primary flex items-center gap-2"
          >
            <Download size={16} /> {t('job.btn.download_mp4', 'Download MP4')}
          </a>
        )}
      </div>

      <div className="card mb-6">
        <div className="flex items-center justify-between mb-3">
          <span className="font-semibold text-white">{t('job.progress.title', 'Overall voortgang')}</span>
          <span className="text-brand-500 font-bold">{job.progress || 0}%</span>
        </div>

        <div className="h-3 bg-dark-700 rounded-full overflow-hidden mb-4">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              job.status === 'failed' ? 'bg-red-500' :
              job.status === 'completed' ? 'bg-green-500' : 'bg-brand-600'
            }`}
            style={{ width: `${job.progress || 0}%` }}
          />
        </div>

        <div className="flex items-center gap-0">
          {PIPELINE_STEPS.map((step, i) => {
            const isDone = (job.progress || 0) >= step.pct[1] || job.status === 'completed';
            const isActiveStep = job.status === step.key;
            return (
              <div key={step.key} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mb-1 ${
                    isDone ? 'bg-green-500 text-white' :
                    isActiveStep ? 'bg-brand-600 text-white animate-pulse' :
                    'bg-dark-700 text-gray-500'
                  }`}>
                    {isDone ? '✓' : isActiveStep
                      ? <span className="inline-block w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      : i + 1}
                  </div>
                  <span className="text-mono text-[10px] text-center leading-tight" style={{
                    color: isDone ? '#4ade80' : isActiveStep ? '#e8e3d8' : '#6b6b6b'
                  }}>
                    {t(step.stepKey, step.stepKey)}
                  </span>
                </div>
                {i < PIPELINE_STEPS.length - 1 && (
                  <div className={`h-0.5 flex-1 -mt-4 ${isDone ? 'bg-green-500' : 'bg-dark-700'}`} />
                )}
              </div>
            );
          })}
        </div>

        {job.status === 'generating_backgrounds' && job.total_scenes && (
          <div className="text-mono mt-4 text-sm text-gray-400 flex items-center gap-2">
            <Zap size={14} style={{ color: '#d4a017' }} />
            {t('job.kling_progress', `Kling AI: ${(job.scenes || []).filter(s => s.kling_status === 'completed').length} / ${job.total_scenes} scènes`, {
              done: (job.scenes || []).filter(s => s.kling_status === 'completed').length,
              total: job.total_scenes,
            })}
          </div>
        )}

        {isWaitingForBg && <WaitingForBackgroundsBanner jobId={job.id} />}

        {/* Onvoldoende credits: expliciete keuze — bijvullen of gratis verder met Stock */}
        {job.status === 'insufficient_credits' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-dark-800 border border-dark-700 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                💳 {t('job.credits.title', 'Onvoldoende credits')}
              </h2>
              <p className="text-sm text-gray-300">
                {t('job.credits.body', `Onvoldoende credits voor deze stijl (nodig: ~${job.credit_choice?.needed ?? job.estimated_credits}, beschikbaar: ${job.credit_choice?.balance ?? job.kie_balance}).`, { needed: job.credit_choice?.needed, balance: job.credit_choice?.balance })}
              </p>
              <div className="space-y-2">
                <a
                  href="https://kie.ai/billing"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 py-2.5 text-sm rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold transition-colors"
                >
                  💳 {t('job.credits.topup', 'Credits bijvullen op kie.ai')}
                </a>
                <button
                  onClick={async () => { try { await axios.post(`/api/render/${job.id}/credit-choice`, { choice: 'retry' }); } catch (e) { alert(e.response?.data?.error || e.message); } }}
                  className="w-full py-2.5 text-sm rounded-xl border border-dark-600 text-gray-300 hover:text-white hover:border-dark-500 transition-colors"
                >
                  🔄 {t('job.credits.retry', 'Ik heb bijgevuld — opnieuw proberen')}
                </button>
                <button
                  onClick={async () => { try { await axios.post(`/api/render/${job.id}/credit-choice`, { choice: 'stock' }); } catch (e) { alert(e.response?.data?.error || e.message); } }}
                  className="w-full py-2.5 text-sm rounded-xl font-semibold transition-colors"
                  style={{ backgroundColor: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.4)', color: '#4ade80' }}
                >
                  🎬 {t('job.credits.stock', 'Gratis verder met Stock Footage (€0)')}
                </button>
              </div>
              <p className="text-[11px] text-gray-500">
                {t('job.credits.note', 'Er is nog niets verbruikt — de render start pas na je keuze.')}
              </p>
            </div>
          </div>
        )}

        {job.status === 'failed' && job.error && (
          <div className="mt-3 text-sm text-red-400 bg-red-900/20 border border-red-700/50 rounded-lg p-3">
            ❌ {job.error}
          </div>
        )}

        {job.status === 'failed' && (
          <div className="mt-3 flex flex-wrap gap-2">
            {failedScenes.length > 0 && (
              <button
                onClick={handleRetry}
                disabled={retrying}
                className="btn-secondary flex items-center gap-2"
              >
                <RefreshCw size={14} className={retrying ? 'animate-spin' : ''} />
                {retrying
                  ? t('job.btn.retrying', 'Opnieuw starten...')
                  : t('job.btn.retry_scenes', `Scènes opnieuw (${failedScenes.length})`, { count: failedScenes.length })}
              </button>
            )}
            <button
              onClick={handleRetryRender}
              disabled={rerendering}
              className="btn-secondary flex items-center gap-2"
            >
              <RefreshCw size={14} className={rerendering ? 'animate-spin' : ''} />
              {rerendering
                ? t('job.btn.rerendering', 'Renderen...')
                : t('job.btn.retry_render', 'Alleen render herhalen')}
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <h2 className="font-semibold text-white mb-3 flex items-center gap-2">
            <Layers size={15} />
            {t('job.scenes_heading', `Scènes (${job.scenes?.length || 0})`, { count: job.scenes?.length || 0 })}
          </h2>
          {job.scenes?.length > 0 ? (
            <div className="space-y-3">
              {job.scenes.map((scene, i) => (
                <SceneCard key={i} scene={scene} index={i} />
              ))}
            </div>
          ) : (
            <div className="card text-center py-10 text-gray-500">
              <Loader2 size={20} className="animate-spin mx-auto mb-2" />
              {t('job.analyzing', 'Claude analyseert het script...')}
            </div>
          )}
        </div>

        <div className="space-y-4">
          {job.subtitle_settings && (
            <div className="card">
              <h3 className="font-semibold text-white mb-3 flex items-center gap-2 text-sm">
                <Captions size={14} /> {t('job.subtitles.title', 'Ondertitels')}
              </h3>
              <div className="space-y-1.5 text-xs text-gray-400">
                <div className="flex justify-between">
                  <span>{t('job.subtitles.status', 'Status')}</span>
                  <span className={job.subtitle_settings.enabled ? 'text-green-400' : 'text-gray-600'}>
                    {job.subtitle_settings.enabled ? t('job.subtitles.on', 'Aan') : t('job.subtitles.off', 'Uit')}
                  </span>
                </div>
                {job.subtitle_settings.enabled && (
                  <>
                    <div className="flex justify-between">
                      <span>{t('job.subtitles.size', 'Grootte')}</span>
                      <span className="text-white capitalize">{job.subtitle_settings.fontSize}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>{t('job.subtitles.highlight', 'Highlight')}</span>
                      <div
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: job.subtitle_settings.highlightColor }}
                      />
                    </div>
                    <div className="flex justify-between">
                      <span>{t('job.subtitles.position', 'Positie')}</span>
                      <span className="text-white capitalize">{job.subtitle_settings.position}</span>
                    </div>
                  </>
                )}
                {job.word_timings?.length > 0 && (
                  <div className="flex justify-between pt-1 border-t border-dark-700">
                    <span>{t('job.subtitles.words', 'Woorden')}</span>
                    <span className="text-white">{job.word_timings.length}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {job.credit_warning && (
            <div className="p-3 rounded-lg text-xs mb-3" style={{ backgroundColor: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.35)', color: '#fb923c' }}>
              ⚠️ {job.credit_warning}
            </div>
          )}

          {(job.estimated_credits !== null && job.estimated_credits !== undefined) && (
            <div className="p-3 rounded-lg text-xs mb-3 flex items-center justify-between" style={{ backgroundColor: 'rgba(212,160,23,0.06)', border: '1px solid rgba(212,160,23,0.25)', color: '#d4a017' }}>
              <span>💳 {t('job.credits.label', 'Geschat verbruik')}: <strong>{job.estimated_credits} credits</strong></span>
              {job.credit_breakdown && <span style={{ color: '#6b6b6b' }}>{job.credit_breakdown}</span>}
            </div>
          )}

          {job.status === 'completed' && job.output_quality && (
            <div
              className="p-3 rounded-lg text-xs mb-3 flex items-center justify-between"
              style={job.output_quality.acceptable
                ? { backgroundColor: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.25)', color: '#4ade80' }
                : { backgroundColor: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.35)', color: '#f87171' }}
            >
              <span>
                {job.output_quality.acceptable ? '✅' : '⚠️'} {t('job.quality.label', 'Videokwaliteit')}: <strong>{job.output_quality.bitrate_kbps} kbps</strong> ({job.output_quality.resolution})
              </span>
              {job.output_quality.warning && <span style={{ color: '#f87171' }}>{job.output_quality.warning}</span>}
            </div>
          )}

          {job.status === 'completed' && job.partial_failure > 0 && (
            <div className="p-3 rounded-lg text-xs mb-3" style={{ backgroundColor: 'rgba(212,160,23,0.08)', border: '1px solid rgba(212,160,23,0.35)', color: '#d4a017' }}>
              {t('job.partial_failure', `⚠️ ${job.partial_failure} scène(s) zonder achtergrond — video is gerenderd met gradient fallback.`, { count: job.partial_failure })}
            </div>
          )}

          {job.status === 'completed' && job.scenes?.length > 0 && (
            <CaptionsEditor
              job={job}
              jobId={jobId}
              onUpdated={(scene, idx) => setJob(prev => {
                const scenes = [...prev.scenes];
                scenes[idx] = scene;
                return { ...prev, scenes, needs_resync: scenes.some(s => s.caption_edited) };
              })}
            />
          )}

          {job.status === 'completed' && job.thumbnail_options?.length > 0 && (
            <div className="card">
              <h3 className="font-semibold text-white mb-3 text-sm">🖼️ {t('job.thumbs.title', 'Auto-thumbnails')} ({job.thumbnail_options.length})</h3>
              <div className="grid grid-cols-1 gap-2">
                {job.thumbnail_options.map((url, i) => (
                  <div key={url} className="relative group rounded-lg overflow-hidden border border-dark-600">
                    <img src={url} alt={`Thumbnail ${i + 1}`} className="w-full aspect-video object-cover" />
                    <a
                      href={url}
                      download={`${(job.title || job.id).replace(/[^a-zA-Z0-9\s_-]/g, '').replace(/\s+/g, '_')}_thumb_${i + 1}.jpg`}
                      className="absolute bottom-2 right-2 flex items-center gap-1 text-xs px-2 py-1 rounded bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Download size={11} /> {t('job.thumbs.download', 'Download')}
                    </a>
                  </div>
                ))}
              </div>
              <p className="text-[10px] mt-2" style={{ color: '#6b6b6b' }}>
                {t('job.thumbs.hint', 'Tip: upload je favoriet in VaultBoost → Thumbnail → A/B Tracker om de CTR te vergelijken.')}
              </p>
            </div>
          )}

          {job.status === 'completed' && job.video_url && (
            <div className="card">
              <h3 className="font-semibold text-white mb-3 text-sm">{t('job.video.title', 'Video')}</h3>
              <video
                src={job.video_url}
                controls
                className="w-full rounded-lg"
                style={{ aspectRatio: '9/16', maxHeight: '300px', objectFit: 'contain' }}
              />
              <a
                href={job.video_url}
                download={`${(job.title || job.id).replace(/[^a-zA-Z0-9\s_-]/g, '').replace(/\s+/g, '_')}.mp4`}
                className="btn-primary w-full flex items-center justify-center gap-2 mt-3 text-sm"
              >
                <Download size={14} /> {t('job.btn.download', 'Download')}
              </a>

              {/* Deel + Vergelijk */}
              <div className="flex gap-2 mt-2">
                <button
                  onClick={handleShare}
                  disabled={sharing}
                  className="btn-secondary flex-1 flex items-center justify-center gap-1.5 text-xs py-2"
                >
                  {sharing ? '⏳' : '🔗'} {shareUrl ? t('job.btn.shared', 'Gekopieerd!') : t('job.btn.share', 'Deel (24u)')}
                </button>
                <button
                  onClick={openCompare}
                  className="btn-secondary flex-1 flex items-center justify-center gap-1.5 text-xs py-2"
                >
                  ⚖️ {t('job.btn.compare', 'Vergelijk')}
                </button>
              </div>
              {shareUrl && (
                <p className="text-[10px] mt-1.5 break-all" style={{ color: '#6b6b6b' }}>
                  {t('job.share.hint', 'Link gekopieerd — 24 uur geldig:')} <span style={{ color: '#d4a017' }}>{shareUrl}</span>
                </p>
              )}

              {!ytUpload.url ? (
                <button
                  onClick={handleYouTubeUpload}
                  disabled={ytUpload.loading}
                  className="w-full flex items-center justify-center gap-2 mt-2 text-sm px-4 py-2 rounded-lg font-medium transition-colors bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white"
                >
                  {ytUpload.loading
                    ? <><Loader2 size={14} className="animate-spin" /> {t('common.uploading', 'Uploaden...')}</>
                    : <><Youtube size={14} /> {t('job.btn.youtube', 'Upload naar YouTube')}</>
                  }
                </button>
              ) : (
                <div className="mt-2 space-y-1">
                  <a
                    href={ytUpload.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 text-sm px-4 py-2 rounded-lg font-medium bg-red-900/30 border border-red-700/50 text-red-400 hover:text-red-300 transition-colors"
                  >
                    <Youtube size={14} /> {t('job.btn.view_youtube', 'Bekijk op YouTube')}
                  </a>
                  {ytUpload.shortsUrl && (
                    <a
                      href={ytUpload.shortsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center justify-center gap-2 text-xs px-3 py-1.5 rounded-lg text-gray-400 hover:text-white transition-colors border border-dark-700"
                    >
                      <Youtube size={12} /> {t('job.btn.view_short', 'Bekijk als Short')}
                    </a>
                  )}
                </div>
              )}
              {ytUpload.error && (
                <p className="mt-2 text-xs text-red-400 bg-red-900/20 rounded-lg px-3 py-2">
                  ❌ {ytUpload.error}
                </p>
              )}
            </div>
          )}

          {job.status === 'completed' && (
            <div className="card">
              <h3 className="font-semibold text-white mb-3 text-sm flex items-center gap-2">
                <ImageIcon size={14} /> {t('job.thumbnail.title', 'Thumbnail')}
              </h3>

              {thumbnail.url ? (
                <img
                  src={thumbnail.url}
                  alt="Thumbnail"
                  className="w-full rounded-lg mb-3 object-cover"
                  style={{ aspectRatio: '16/9', maxHeight: '120px' }}
                />
              ) : (
                <div
                  className="w-full rounded-lg mb-3 flex items-center justify-center bg-dark-800 border border-dark-700 text-gray-600 text-xs"
                  style={{ aspectRatio: '16/9', maxHeight: '120px' }}
                >
                  {t('job.thumbnail.none', 'Geen thumbnail')}
                </div>
              )}

              <input
                ref={thumbInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleThumbnailUpload}
              />
              <button
                onClick={() => thumbInputRef.current?.click()}
                disabled={thumbnail.uploading}
                className="w-full flex items-center justify-center gap-2 text-sm px-3 py-2 rounded-lg font-medium transition-colors bg-dark-700 hover:bg-dark-600 disabled:opacity-50 text-gray-300"
              >
                {thumbnail.uploading
                  ? <><Loader2 size={13} className="animate-spin" /> {t('common.uploading', 'Uploaden...')}</>
                  : <><Upload size={13} /> {thumbnail.url
                      ? t('job.btn.thumbnail_change', 'Wijzigen')
                      : t('job.btn.thumbnail_upload', 'Thumbnail uploaden')}</>
                }
              </button>

              {thumbnail.error && (
                <p className="mt-2 text-xs text-red-400 bg-red-900/20 rounded px-2 py-1">
                  ❌ {thumbnail.error}
                </p>
              )}
              {thumbnail.url && !thumbnail.uploading && (
                <p className="mt-1.5 text-[10px] text-green-500 text-center">
                  {t('job.thumbnail.youtube_note', '✓ Wordt meegestuurd bij YouTube upload')}
                </p>
              )}
            </div>
          )}

          <div className="card text-xs space-y-1.5" style={{ color: '#6b6b6b' }}>
            <div className="flex justify-between">
              <span>{t('job.info.style', 'Stijl')}</span>
              <span className="text-white capitalize">{job.style || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span>{t('job.info.created', 'Aangemaakt')}</span>
              <span className="text-mono text-white">{new Date(job.created_at).toLocaleTimeString('nl-BE')}</span>
            </div>
            {job.completed_at && (
              <div className="flex justify-between">
                <span>{t('job.info.done', 'Klaar')}</span>
                <span className="text-mono" style={{ color: '#4ade80' }}>{new Date(job.completed_at).toLocaleTimeString('nl-BE')}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Vergelijk-modal: twee renders naast elkaar */}
      {compareOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)' }} onClick={() => setCompareOpen(false)}>
          <div onClick={e => e.stopPropagation()} className="rounded-2xl p-5 w-full max-w-3xl" style={{ background: '#161616', border: '1px solid #2a2a2a' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white">⚖️ {t('job.compare.title', 'Vergelijk renders')}</h3>
              <button onClick={() => setCompareOpen(false)} className="text-gray-500 hover:text-white">✕</button>
            </div>
            {compareJobs.length === 0 ? (
              <p className="text-sm text-gray-400 py-6 text-center">{t('job.compare.none', 'Geen andere voltooide renders om mee te vergelijken.')}</p>
            ) : (
              <>
                <select
                  value={compareWith?.id || ''}
                  onChange={e => setCompareWith(compareJobs.find(j => j.id === e.target.value) || null)}
                  className="w-full text-sm bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white mb-4"
                >
                  {compareJobs.map(j => (
                    <option key={j.id} value={j.id}>{j.title || j.id.slice(0, 8)} — {new Date(j.created_at).toLocaleDateString('nl-BE')}</option>
                  ))}
                </select>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs mb-2 font-semibold" style={{ color: '#d4a017' }}>{t('job.compare.current', 'Deze render')}: {job.title}</p>
                    <video src={job.video_url} controls muted className="w-full rounded-lg" style={{ aspectRatio: '9/16', maxHeight: 340, objectFit: 'contain', background: '#000' }} />
                  </div>
                  <div>
                    <p className="text-xs mb-2 font-semibold" style={{ color: '#9ca3af' }}>{compareWith?.title || '—'}</p>
                    {compareWith && (
                      <video src={compareWith.video_url} controls muted className="w-full rounded-lg" style={{ aspectRatio: '9/16', maxHeight: 340, objectFit: 'contain', background: '#000' }} />
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
