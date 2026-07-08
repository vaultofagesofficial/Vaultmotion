import { useState, useEffect } from 'react';
import axios from 'axios';
import { CheckCircle2, XCircle, Loader2, RefreshCw, Copy, Check, Zap } from 'lucide-react';
import { useTranslation } from '../i18n/useTranslation';

function ServiceStatus({ name, url, t }) {
  const [status, setStatus] = useState('checking');

  async function ping() {
    setStatus('checking');
    try {
      await axios.get(url, { timeout: 3000 });
      setStatus('online');
    } catch {
      setStatus('offline');
    }
  }

  useEffect(() => { ping(); }, []);

  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <div className="font-medium text-white">{name}</div>
        <div className="text-mono text-xs" style={{ color: '#6b6b6b' }}>{url}</div>
      </div>
      <div className="flex items-center gap-2">
        {status === 'checking' && <Loader2 size={16} className="animate-spin text-gray-400" />}
        {status === 'online'   && <CheckCircle2 size={16} className="text-green-400" />}
        {status === 'offline'  && <XCircle size={16} className="text-red-400" />}
        <span className={`text-sm ${
          status === 'online' ? 'text-green-400' : status === 'offline' ? 'text-red-400' : 'text-gray-400'
        }`}>
          {status === 'checking'
            ? t('settings.services.checking', 'Controleren...')
            : status === 'online'
              ? t('settings.services.online', 'Online')
              : t('settings.services.offline', 'Offline')}
        </span>
        <button onClick={ping} className="text-gray-500 hover:text-white transition-colors ml-1">
          <RefreshCw size={13} />
        </button>
      </div>
    </div>
  );
}

// API-key voor beveiligde backends (VAULTMOTION_API_KEY op Railway)
function ApiKeyCard({ t }) {
  const [key, setKey] = useState(() => { try { return localStorage.getItem('vm_api_key') || ''; } catch { return ''; } });
  const [saved, setSaved] = useState(false);
  function save() {
    try {
      if (key.trim()) localStorage.setItem('vm_api_key', key.trim());
      else localStorage.removeItem('vm_api_key');
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    } catch {}
  }
  return (
    <div className="card mb-6">
      <h2 className="heading-display font-semibold mb-1">🔑 {t('settings.apikey.title', 'API-sleutel')}</h2>
      <p className="text-gray-500 text-sm mb-3">
        {t('settings.apikey.desc', 'Alleen nodig als de backend beveiligd is met VAULTMOTION_API_KEY (Railway). Wordt lokaal bewaard en automatisch meegestuurd.')}
      </p>
      <div className="flex gap-2">
        <input
          type="password"
          value={key}
          onChange={e => setKey(e.target.value)}
          placeholder={t('settings.apikey.placeholder', 'x-api-key waarde')}
          className="input flex-1 text-sm font-mono"
        />
        <button onClick={save} className="btn-primary px-4 text-sm">
          {saved ? <Check size={14} /> : t('settings.apikey.save', 'Opslaan')}
        </button>
      </div>
    </div>
  );
}

// C3: Prompt Intelligence — geleerde visual-prompt patronen uit eerdere renders
function PromptIntelligenceCard({ t }) {
  const [intel, setIntel] = useState(null);
  useEffect(() => {
    axios.get('/api/prompt-intelligence').then(r => setIntel(r.data)).catch(() => {});
  }, []);
  if (!intel) return null;
  return (
    <div className="card mb-6">
      <div className="flex items-center gap-2 mb-1">
        <span>🧠</span>
        <h2 className="heading-display font-semibold">{t('settings.promptintel.title', 'Prompt Intelligence')}</h2>
      </div>
      <p className="text-gray-500 text-sm mb-3">
        {t('settings.promptintel.desc', 'VaultMotion leert welke visuele prompts de rijkste AI-beelden opleveren en past die patronen automatisch toe.')}
      </p>
      <div className="flex gap-4 text-xs mb-3" style={{ color: '#6b6b6b' }}>
        <span>{t('settings.promptintel.renders', 'Renders geanalyseerd')}: <span className="text-white font-mono">{intel.renders_analyzed}</span></span>
        <span>{t('settings.promptintel.samples', 'Prompt-metingen')}: <span className="text-white font-mono">{intel.results_count}</span></span>
      </div>
      {intel.patterns?.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold" style={{ color: '#d4a017' }}>{t('settings.promptintel.patterns', 'Geleerde patronen')} ({new Date(intel.patterns_updated_at).toLocaleDateString('nl-BE')}):</p>
          {intel.patterns.map((p, i) => (
            <p key={i} className="text-xs pl-3 border-l-2" style={{ color: '#9ca3af', borderColor: '#d4a01740' }}>{p}</p>
          ))}
        </div>
      ) : (
        <p className="text-xs" style={{ color: '#6b6b6b' }}>
          {t('settings.promptintel.pending', `Patronen worden geëxtraheerd na 10 renders met AI-beelden (nu: ${intel.renders_analyzed}).`)}
        </p>
      )}
    </div>
  );
}

function VaultBoostSection({ t }) {
  const WEBHOOK_URL = 'http://localhost:3002/api/vaultboost/webhook';
  const [copied, setCopied] = useState(false);
  const [autoUpload, setAutoUpload] = useState(false);

  function copy() {
    navigator.clipboard.writeText(WEBHOOK_URL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="card mb-6">
      <div className="flex items-center gap-2 mb-1">
        <Zap size={16} className="text-yellow-400" />
        <h2 className="heading-display font-semibold">{t('settings.vaultboost.title', 'VaultBoost Koppeling')}</h2>
        <span className="text-xs bg-dark-700 text-gray-400 px-2 py-0.5 rounded-full">
          {t('settings.vaultboost.soon', 'Binnenkort')}
        </span>
      </div>
      <p className="text-gray-500 text-sm mb-4">
        {t('settings.vaultboost.desc', "Automatisch video's renderen op basis van trending onderwerpen uit VaultBoost.")}
      </p>

      <div className="mb-4">
        <div className="text-xs text-gray-400 mb-1">{t('settings.vaultboost.webhook', 'Webhook URL')}</div>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-mono text-xs bg-dark-700 text-green-400 px-3 py-2 rounded-lg truncate">
            {WEBHOOK_URL}
          </code>
          <button onClick={copy} className="p-2 bg-dark-700 hover:bg-dark-600 rounded-lg transition-colors">
            {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} className="text-gray-400" />}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between py-3 border-t border-dark-700">
        <div>
          <div className="text-sm text-white">{t('settings.vaultboost.autoupload', 'Auto-upload naar YouTube')}</div>
          <div className="text-xs text-gray-500">
            {t('settings.vaultboost.autoupload_desc', 'Upload automatisch na render (vereist YouTube OAuth)')}
          </div>
        </div>
        <button
          onClick={() => setAutoUpload(v => !v)}
          className={`w-11 h-6 rounded-full transition-colors relative ${autoUpload ? 'bg-brand-500' : 'bg-dark-600'}`}
        >
          <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${autoUpload ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
      </div>

      <div className="mt-3 p-3 bg-dark-700 rounded-lg text-xs text-gray-400">
        <strong className="text-white">{t('settings.vaultboost.example', 'Voorbeeld request:')}</strong><br />
        <code className="text-green-400">POST /api/vaultboost/webhook</code><br />
        <code>{`{ "topic": "The Viking Age", "trending_score": 94, "source": "vaultboost" }`}</code>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { t } = useTranslation();

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="heading-display text-3xl font-bold mb-1">{t('settings.title', 'Instellingen')}</h1>
        <p className="text-gray-400">{t('settings.subtitle', 'Service status en configuratie')}</p>
      </div>

      <VaultBoostSection t={t} />

      <ApiKeyCard t={t} />

      <PromptIntelligenceCard t={t} />

      <div className="card mb-6">
        <h2 className="heading-display font-semibold mb-1">{t('settings.services.title', 'Service Status')}</h2>
        <p className="text-gray-500 text-sm mb-4">
          {t('settings.services.desc', 'Real-time verbindingsstatus van alle services')}
        </p>
        <div className="divide-y divide-dark-700">
          <ServiceStatus name="VaultMotion Backend" url="/api/health" t={t} />
          <ServiceStatus name="VaultBoost"          url="http://localhost:3001/api/health" t={t} />
        </div>
      </div>

      <div className="card mb-6">
        <h2 className="heading-display font-semibold mb-4">{t('settings.api.title', 'API Sleutels')}</h2>
        <div className="space-y-3 text-sm" style={{ color: '#6b6b6b' }}>
          <div className="flex items-center justify-between">
            <span>ANTHROPIC_API_KEY</span>
            <span className="text-mono text-xs bg-dark-700 px-2 py-1 rounded" style={{ color: '#6b6b6b' }}>backend/.env</span>
          </div>
          <div className="flex items-center justify-between">
            <span>HIGGSFIELD_API_KEY</span>
            <span className="text-mono text-xs bg-dark-700 px-2 py-1 rounded" style={{ color: '#6b6b6b' }}>backend/.env</span>
          </div>
        </div>
        <div className="mt-4 p-3 bg-dark-700 rounded-lg text-xs text-gray-400">
          <strong className="text-white">{t('settings.api.higgsfield_hint', 'Higgsfield API key ophalen:')}</strong><br />
          Ga naar <a href="https://higgsfield.ai" className="text-brand-500 hover:underline" target="_blank" rel="noreferrer">higgsfield.ai</a> → Account → API Keys<br />
          {t('settings.api.no_key', 'Zonder key werkt VaultMotion in simulatiemodus.')}
        </div>
      </div>

      <div className="card">
        <h2 className="heading-display font-semibold mb-4">{t('settings.about.title', 'Over VaultMotion')}</h2>
        <div className="space-y-1.5 text-sm" style={{ color: '#6b6b6b' }}>
          <div className="flex justify-between"><span>{t('settings.about.version', 'Versie')}</span><span className="text-mono" style={{ color: '#6b6b6b' }}>1.0.0</span></div>
          <div className="flex justify-between"><span>{t('settings.about.frontend_port', 'Frontend poort')}</span><span className="text-mono" style={{ color: '#6b6b6b' }}>5174</span></div>
          <div className="flex justify-between"><span>{t('settings.about.backend_port', 'Backend poort')}</span><span className="text-mono" style={{ color: '#6b6b6b' }}>3002</span></div>
          <div className="flex justify-between"><span>{t('settings.about.ai_model', 'AI model')}</span><span className="text-mono" style={{ color: '#6b6b6b' }}>claude-opus-4-5</span></div>
          <div className="flex justify-between"><span>{t('settings.about.video_model', 'Video model')}</span><span className="text-mono" style={{ color: '#6b6b6b' }}>seedance_2_0</span></div>
          <div className="flex justify-between"><span>{t('settings.about.aspect', 'Aspect ratio')}</span><span className="text-mono" style={{ color: '#6b6b6b' }}>9:16 (Shorts)</span></div>
        </div>
      </div>
    </div>
  );
}
