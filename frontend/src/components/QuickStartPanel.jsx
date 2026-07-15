import { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { useTranslation } from '../i18n/useTranslation';

const DURATIONS = [30, 60];
// Modus = TOON (belichting/camera-taal/stijl van het script) — bepaalt nooit
// de achtergrond-bron. Bron = waar de beelden vandaan komen (AI of gratis stock).
// Elke toon is met elke bron te combineren (bv. Epic + Stock Footage).
const MODES = [
  { value: 'documentary', label: 'Documentary', style: 'documentaire' },
  { value: 'epic',        label: '⚔️ Epic',      style: 'epic'         },
  { value: 'story',       label: 'Story',        style: 'story'        },
  { value: 'gaming',      label: '🎮 Gaming',     style: 'gaming'       },
  { value: 'beauty',      label: '✨ Beauty',     style: 'beauty'       },
  { value: 'finance',     label: '📈 Finance',    style: 'finance'      },
  { value: 'sport',       label: '🏆 Sport',      style: 'sport'        },
  { value: 'tech',        label: '🤖 Tech',       style: 'tech'         },
];

const SOURCES = [
  { value: 'ai-cinematic', label: '🎬 AI-video',   hint: '~800cr' },
  { value: 'hybrid',       label: '⚡ Hybride',    hint: '~150cr' },
  { value: 'stock',        label: '📹 Stock',      hint: '€0'     },
];

export default function QuickStartPanel({ voices, onStart, onPreview }) {
  const { t } = useTranslation();
  const [topic,    setTopic]    = useState('');
  const [duration, setDuration] = useState(60);
  const [mode,     setMode]     = useState('epic');
  const [source,   setSource]   = useState('ai-cinematic');
  const [status,   setStatus]   = useState('idle');
  const [error,    setError]    = useState('');

  const modeObj = MODES.find(m => m.value === mode);

  function resolveMaleEnVoice() {
    const enVoices = voices.filter(v => v.lang === 'en');
    const male = enVoices.find(v => v.gender === 'male' || v.gender === 'man');
    return (male || enVoices[0] || voices[0])?.voice_id || null;
  }

  async function handleGo(preview = false) {
    const topicVal = topic.trim();
    if (!topicVal || status === 'generating' || status === 'rendering') return;

    setError('');
    const voiceId = resolveMaleEnVoice();
    const handler = preview && onPreview ? onPreview : onStart;

    await handler({
      topic:        topicVal,
      title:        topicVal,
      mode,
      style:            modeObj.style,
      render_style:     source,
      hybrid_intensity: source === 'hybrid' ? 'low' : undefined,
      duration,
      voiceId,
      subtitleSettings: { enabled: true, fontSize: 'normaal', highlightColor: '#FFD700', position: 'onder', subtitleStyle: 'karaoke-box', wordsPerLine: 4 },
      setStatus,
      setError,
      preview,
    });
  }

  const busy = status === 'generating' || status === 'rendering';

  return (
    <div className="max-w-xl mx-auto space-y-6 py-4">
      <div className="card">
        <label className="block text-sm font-semibold text-gray-300 mb-3">{t('quickstart.topic.label', 'Waar gaat je Short over?')}</label>
        <div className="flex gap-2">
          <textarea
            className="input flex-1 resize-none"
            rows={3}
            placeholder={t('quickstart.topic.placeholder', 'bijv. "The Fall of the Roman Empire" of "Battle of Thermopylae"')}
            value={topic}
            onChange={e => setTopic(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleGo(); }}
            disabled={busy}
          />
        </div>
        <p className="text-xs text-gray-600 mt-1.5">{t('quickstart.topic.hint', 'Ctrl+Enter om direct te starten')}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card">
          <label className="heading-display text-xs mb-2 block">{t('studio.label.duration', 'Duur')}</label>
          <div className="flex gap-2 flex-wrap">
            {DURATIONS.map(d => (
              <button
                key={d}
                onClick={() => setDuration(d)}
                disabled={busy}
                className="flex-1 min-w-[56px] py-2 rounded-lg text-sm font-semibold transition-all border-2"
                style={duration === d
                  ? { backgroundColor: '#1a1a1a', borderColor: '#e53e3e', color: '#fff' }
                  : { backgroundColor: 'transparent', borderColor: '#374151', color: '#9ca3af' }}
              >
                {d}s
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          <label className="heading-display text-xs mb-2 block">{t('quickstart.mode.label', 'Modus')}</label>
          <div className="grid grid-cols-2 gap-1.5">
            {MODES.map(m => (
              <button
                key={m.value}
                onClick={() => setMode(m.value)}
                disabled={busy}
                className="py-1.5 px-1 rounded-lg text-xs font-semibold transition-all border-2 truncate min-w-0"
                title={m.label}
                style={mode === m.value
                  ? { backgroundColor: '#1a1a1a', borderColor: '#e53e3e', color: '#fff' }
                  : { backgroundColor: 'transparent', borderColor: '#374151', color: '#9ca3af' }}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bron: bepaalt de achtergrond-beelden, los van de gekozen toon */}
      <div className="card">
        <label className="heading-display text-xs mb-2 block">{t('quickstart.source.label', 'Beeldbron')}</label>
        <div className="grid grid-cols-3 gap-1.5">
          {SOURCES.map(s => (
            <button
              key={s.value}
              onClick={() => setSource(s.value)}
              disabled={busy}
              className="py-2 px-1 rounded-lg text-xs font-semibold transition-all border-2 min-w-0"
              style={source === s.value
                ? { backgroundColor: '#1a1a1a', borderColor: '#e53e3e', color: '#fff' }
                : { backgroundColor: 'transparent', borderColor: '#374151', color: '#9ca3af' }}
            >
              <span className="block truncate">{s.label}</span>
              <span className="block text-[10px] font-normal" style={{ color: s.hint === '€0' ? '#4ade80' : '#fbbf24' }}>{s.hint}</span>
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700 text-red-300 text-sm rounded-lg p-3">{error}</div>
      )}

      <button
        onClick={() => handleGo(false)}
        disabled={busy || !topic.trim()}
        className="btn-primary w-full flex items-center justify-center gap-2 py-4 rounded-xl text-lg font-bold"
      >
        {status === 'generating' && <><Loader2 size={20} className="animate-spin" /> {t('quickstart.btn.generating', 'Script genereren...')}</>}
        {status === 'rendering'  && <><Loader2 size={20} className="animate-spin" /> {t('quickstart.btn.rendering', 'Render starten...')}</>}
        {(status === 'idle' || status === 'error') && <><Sparkles size={20} /> {t('quickstart.btn.go', 'Genereer & Start')}</>}
      </button>

      {(status === 'idle' || status === 'error') && (
        <button
          onClick={() => handleGo(true)}
          disabled={busy || !topic.trim()}
          className="w-full text-center text-xs py-1.5 rounded-lg transition-colors disabled:opacity-50"
          style={{ color: '#B8860B', backgroundColor: 'rgba(184,134,11,0.1)' }}
        >
          👁️ {t('quickstart.btn.preview', 'Preview (geen AI-credits)')}
        </button>
      )}

      <p className="text-center text-xs text-gray-600">
        {t('quickstart.defaults', 'Vaste defaults: EN · Male voice · Ondertitels aan · Geel')}
        {' · '}<span className="text-gray-500">{t('quickstart.full_hint', 'Wil je meer controle? Gebruik de tab "Volledig".')}</span>
      </p>
    </div>
  );
}
