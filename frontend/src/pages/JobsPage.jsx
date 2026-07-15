import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Video, Clock, CheckCircle2, XCircle, Loader2, Search } from 'lucide-react';
import { useTranslation } from '../i18n/useTranslation';

const STATUS_CONFIG = {
  analyzing:              { key: 'jobs.status.analyzing',  textColor: '#6b6b6b', bgColor: 'rgba(107,107,107,0.12)', icon: Loader2,      spin: true  },
  generating_backgrounds: { key: 'jobs.status.background', textColor: '#6b6b6b', bgColor: 'rgba(107,107,107,0.12)', icon: Loader2,      spin: true  },
  storyboard_ready:       { key: 'jobs.status.waiting',    textColor: '#6b6b6b', bgColor: 'rgba(107,107,107,0.12)', icon: Loader2,      spin: false },
  rendering:              { key: 'jobs.status.rendering',  textColor: '#d4a017', bgColor: 'rgba(212,160,23,0.12)',  icon: Loader2,      spin: true  },
  queued:                 { key: 'jobs.status.queued',     textColor: '#6b6b6b', bgColor: 'rgba(107,107,107,0.12)', icon: Loader2,      spin: false },
  completed:              { key: 'jobs.status.completed',  textColor: '#4ade80', bgColor: 'rgba(74,222,128,0.1)',   icon: CheckCircle2, spin: false },
  insufficient_credits:   { key: 'jobs.status.credits',    textColor: '#fb923c', bgColor: 'rgba(251,146,60,0.12)',  icon: XCircle,      spin: false },
  failed:                 { key: 'jobs.status.failed',     textColor: '#e53e3e', bgColor: 'rgba(229,62,62,0.12)',   icon: XCircle,      spin: false },
};

function StatusBadge({ status }) {
  const { t } = useTranslation();
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.analyzing;
  const Icon = cfg.icon;
  return (
    <span className="badge flex items-center gap-1" style={{ color: cfg.textColor, backgroundColor: cfg.bgColor }}>
      <Icon size={11} className={cfg.spin ? 'animate-spin' : ''} />
      {t(cfg.key, status)}
    </span>
  );
}

export default function JobsPage() {
  const { t } = useTranslation();
  const [jobs, setJobs] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let interval;
    async function fetchJobs() {
      try {
        const { data } = await axios.get('/api/render');
        setJobs(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchJobs();
    interval = setInterval(fetchJobs, 5000);
    return () => clearInterval(interval);
  }, []);

  const ACTIVE_STATUSES = ['analyzing', 'generating_backgrounds', 'storyboard_ready', 'rendering', 'queued', 'editing', 'generating_audio', 'waiting_for_backgrounds', 'insufficient_credits'];
  const filtered = jobs.filter(j => {
    const matchesSearch = j.title?.toLowerCase().includes(search.toLowerCase()) || j.id?.includes(search);
    const matchesStatus =
      statusFilter === 'all'       ? true :
      statusFilter === 'active'    ? ACTIVE_STATUSES.includes(j.status) :
      j.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const FILTERS = [
    { value: 'all',       label: t('jobs.filter.all', 'Alle') },
    { value: 'active',    label: t('jobs.filter.active', 'Actief') },
    { value: 'completed', label: t('jobs.filter.completed', 'Voltooid') },
    { value: 'failed',    label: t('jobs.filter.failed', 'Mislukt') },
  ];

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="heading-display text-3xl font-bold mb-1">{t('jobs.title', 'Render Jobs')}</h1>
          <p className="text-gray-400">{t('jobs.total', `${jobs.length} jobs totaal`, { count: jobs.length })}</p>
        </div>
        <Link to="/studio" className="btn-primary flex items-center gap-2">
          <Video size={16} /> {t('jobs.btn.new', 'Nieuwe Short')}
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            className="input pl-9"
            placeholder={t('jobs.search.placeholder', 'Zoek op titel of job ID...')}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className="px-3 py-2 rounded-lg text-xs font-semibold transition-colors border"
              style={statusFilter === f.value
                ? { backgroundColor: '#1a1a1a', borderColor: '#e53e3e', color: '#fff' }
                : { backgroundColor: 'transparent', borderColor: '#3a3a3a', color: '#9ca3af' }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 text-gray-500">
          <Loader2 size={24} className="animate-spin mr-2" /> {t('jobs.loading', 'Laden...')}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-16">
          <Video size={40} className="text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">{t('jobs.empty', 'Nog geen render jobs')}</p>
          <Link to="/studio" className="btn-primary inline-flex items-center gap-2 mt-4">
            <Video size={15} /> {t('jobs.btn.first', 'Start je eerste Short')}
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(job => (
            <Link
              key={job.id}
              to={`/jobs/${job.id}`}
              className="card flex items-center gap-4 hover:border-dark-600 transition-colors group"
            >
              <div className="w-14 h-14 bg-dark-700 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-dark-600 transition-colors">
                <Video size={20} className="text-gray-500" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="font-semibold text-white truncate">{job.title || 'Untitled Short'}</div>
                <div className="text-mono text-gray-500 mt-0.5 flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <Clock size={11} /> {new Date(job.created_at).toLocaleString('nl-BE')}
                  </span>
                  {job.scenes?.length > 0 && (
                    <span>{t('jobs.scenes', `${job.scenes.length} scènes`, { count: job.scenes.length })}</span>
                  )}
                </div>
              </div>

              {job.status !== 'completed' && job.status !== 'failed' && (
                <div className="w-24">
                  <div className="h-1.5 bg-dark-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-600 transition-all duration-500"
                      style={{ width: `${job.progress || 0}%` }}
                    />
                  </div>
                  <div className="text-xs text-gray-500 text-right mt-0.5">{job.progress || 0}%</div>
                </div>
              )}

              <div className="flex flex-col items-end gap-1">
                <StatusBadge status={job.status} />
                {job.audio_failed && (
                  <span className="badge flex items-center gap-1" style={{ color: '#e53e3e', backgroundColor: 'rgba(229,62,62,0.12)' }}>
                    {t('jobs.no_audio', '⚠️ Geen geluid')}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
