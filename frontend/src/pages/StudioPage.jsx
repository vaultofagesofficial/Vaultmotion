import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Sparkles, Play, Film, Clock, Type,
  AlignEndHorizontal, AlignCenter, ToggleLeft, ToggleRight,
  Loader2, Mic, Sword, BookOpen, Heart, Zap, Settings2,
  Gamepad2, Palette, TrendingUp, Dumbbell, Cpu
} from 'lucide-react';
import QuickStartPanel from '../components/QuickStartPanel';
import { useTranslation } from '../i18n';

// ── Modes ───────────────────────────────────────────────────────────────────

const MODES = [
  {
    value:   'documentary',
    label:   'Documentary',
    icon:    BookOpen,
    color:   '#e53e3e',
    accent:  'border-red-600 bg-red-900/20',
    descKey: 'studio.mode.documentary.desc',
    style:   'documentaire',
  },
  {
    value:   'epic',
    label:   'Epic',
    icon:    Sword,
    color:   '#FFD700',
    accent:  'border-yellow-500 bg-yellow-900/20',
    descKey: 'studio.mode.epic.desc',
    style:   'epic',
  },
  {
    value:   'story',
    label:   'Story',
    icon:    Heart,
    color:   '#FF8C00',
    accent:  'border-orange-500 bg-orange-900/20',
    descKey: 'studio.mode.story.desc',
    style:   'story',
  },
  {
    value:   'gaming',
    label:   '🎮 Gaming',
    icon:    Gamepad2,
    color:   '#a855f7',
    accent:  'border-purple-500 bg-purple-900/20',
    descKey: 'studio.mode.gaming.desc',
    style:   'gaming',
  },
  {
    value:   'beauty',
    label:   '✨ Beauty',
    icon:    Palette,
    color:   '#ec4899',
    accent:  'border-pink-500 bg-pink-900/20',
    descKey: 'studio.mode.beauty.desc',
    style:   'beauty',
  },
  {
    value:   'finance',
    label:   '📈 Finance',
    icon:    TrendingUp,
    color:   '#22c55e',
    accent:  'border-green-500 bg-green-900/20',
    descKey: 'studio.mode.finance.desc',
    style:   'finance',
  },
  {
    value:   'sport',
    label:   '🏆 Sport',
    icon:    Dumbbell,
    color:   '#3b82f6',
    accent:  'border-blue-500 bg-blue-900/20',
    descKey: 'studio.mode.sport.desc',
    style:   'sport',
  },
  {
    value:   'tech',
    label:   '🤖 Tech',
    icon:    Cpu,
    color:   '#06b6d4',
    accent:  'border-cyan-500 bg-cyan-900/20',
    descKey: 'studio.mode.tech.desc',
    style:   'tech',
  },
];

const DURATIONS = [15, 30, 45, 60];

const HIGHLIGHT_COLORS = [
  { value: '#FFD700', label: 'studio.highlight.geel',  fallback: 'Geel', class: 'bg-yellow-400' },
  { value: '#ffffff', label: 'studio.highlight.wit',   fallback: 'Wit',  class: 'bg-white' },
  { value: '#e53e3e', label: 'studio.highlight.rood',  fallback: 'Rood', class: 'bg-red-500' },
];

const FONT_SIZES = [
  { value: 'klein',   key: 'studio.subtitle.size.klein',   fallback: 'Klein'   },
  { value: 'normaal', key: 'studio.subtitle.size.normaal', fallback: 'Normaal' },
  { value: 'groot',   key: 'studio.subtitle.size.groot',   fallback: 'Groot'   },
];

const RENDER_STYLE_OPTIONS = [
  { value: 'ai-cinematic',      labelKey: 'studio.render_style.ai',       descKey: 'studio.render_style.ai_desc',       labelFb: '🎬 AI-cinematic', descFb: 'Kling AI video achtergronden' },
  { value: 'ai-image',          labelKey: 'studio.render_style.ai_image', descKey: 'studio.render_style.ai_image_desc', labelFb: '🖼️ AI-beeld',     descFb: 'Stilstaand AI-beeld + Ken Burns zoom' },
  { value: '2d',                labelKey: 'studio.render_style.2d',       descKey: 'studio.render_style.2d_desc',       labelFb: '📐 2D-gratis',    descFb: 'Code-only, geen AI credits' },
  { value: 'simple',            labelKey: 'studio.render_style.simple',   descKey: 'studio.render_style.simple_desc',   labelFb: '🎯 Simpel',       descFb: 'T2I + I2V per scène, enkel ken_burns' },
  { value: 'hybrid',            labelKey: 'studio.render_style.hybrid',   descKey: 'studio.render_style.hybrid_desc',   labelFb: '⚡ Hybride',      descFb: 'Mix KIE + 2D op basis van kwaliteitsschuif' },
  { value: 'cinematic_noir',    labelKey: 'studio.render_style.noir',     descKey: 'studio.render_style.noir_desc',     labelFb: '🎞️ Noir',        descFb: 'Zwart-wit hoog contrast, zware grain, intense shake' },
  { value: 'documentary',       labelKey: 'studio.render_style.docu',     descKey: 'studio.render_style.docu_desc',     labelFb: '📽️ Documentary', descFb: 'Rustige cuts, neutrale kleuren, tekstoverlays' },
  { value: 'social_media_fast', labelKey: 'studio.render_style.social',   descKey: 'studio.render_style.social_desc',   labelFb: '📱 Social Fast',  descFb: 'Max 2s per scène, grote tekst, neon (TikTok-stijl)' },
  { value: 'luxury',            labelKey: 'studio.render_style.luxury',   descKey: 'studio.render_style.luxury_desc',   labelFb: '👑 Luxury',       descFb: 'Slow pacing, goud/zwart, elegante typografie' },
];

// Kostenmatrix: credits/tijd/kwaliteit per stijl (en per hybrid-intensiteit)
const COST_MATRIX = {
  'ai-cinematic':      { credits: '~800',  time: '~15-25 min', stars: 5, advice: 'Voor je allerbeste video\'s' },
  'ai-image':          { credits: '~200',  time: '~8-12 min',  stars: 3, advice: 'Goede middenweg met AI-beelden' },
  '2d':                { credits: '0',     time: '~3-5 min',   stars: 2, advice: 'Ideaal voor dagelijkse content, gratis' },
  'simple':            { credits: '~600',  time: '~12-20 min', stars: 4, advice: 'Consistente AI-look per scène' },
  'hybrid:low':        { credits: '~150',  time: '~6-10 min',  stars: 3, advice: 'Beste prijs/kwaliteit voor dagelijkse posts' },
  'hybrid:medium':     { credits: '~400',  time: '~10-16 min', stars: 4, advice: 'Voor belangrijke video\'s' },
  'hybrid:high':       { credits: '~800',  time: '~15-25 min', stars: 5, advice: 'Voor je beste video\'s' },
  'cinematic_noir':    { credits: '~150-800', time: '~6-25 min', stars: 4, advice: 'Mysteries, true crime, drama' },
  'documentary':       { credits: '0',     time: '~3-5 min',   stars: 3, advice: 'Educatieve en feitelijke content' },
  'social_media_fast': { credits: '0',     time: '~3-5 min',   stars: 3, advice: 'TikTok/Shorts met hoge energie' },
  'luxury':            { credits: '0',     time: '~3-5 min',   stars: 3, advice: 'Lifestyle, financiën, premium merken' },
};

function CostMatrix({ renderStyle, hybridIntensity }) {
  const key = renderStyle === 'hybrid' ? `hybrid:${hybridIntensity}` : renderStyle;
  const c = COST_MATRIX[key];
  if (!c) return null;
  return (
    <div className="mb-4 flex items-center gap-4 flex-wrap px-4 py-2.5 rounded-xl border border-dark-700 bg-dark-800 text-xs">
      <span className="text-gray-400">💳 Credits: <span className="text-amber-400 font-semibold">{c.credits}</span></span>
      <span className="text-gray-400">⏱️ Tijd: <span className="text-white font-semibold">{c.time}</span></span>
      <span className="text-gray-400">Kwaliteit: <span className="text-yellow-400">{'★'.repeat(c.stars)}<span className="text-gray-600">{'★'.repeat(5 - c.stars)}</span></span></span>
      <span className="text-gray-500 italic">{c.advice}</span>
    </div>
  );
}

// ── Component ───────────────────────────────────────────────────────────────

export default function StudioPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  // ── Snelstart / Volledig tab — persisteer in localStorage ─────────────────
  const [studioTab, setStudioTab] = useState(
    () => localStorage.getItem('studioMode') || 'quick'
  );

  function switchTab(tab) {
    setStudioTab(tab);
    localStorage.setItem('studioMode', tab);
  }

  // ── Snelstart handler — hergebruikt onderstaande functies ─────────────────
  async function handleQuickStart({ topic, title, mode: qMode, style, render_style: qRenderStyle, hybrid_intensity: qHybridIntensity, duration: qDur, voiceId, subtitleSettings, setStatus, setError, preview = false }) {
    setStatus('generating');
    try {
      const endpoint = qMode === 'epic' ? '/api/script/generate-epic' : '/api/script/generate';
      const { data: scriptData } = await axios.post(endpoint, { topic, style, duration: qDur });
      setStatus('rendering');
      const { data: renderData } = await axios.post('/api/render', {
        script: scriptData.script,
        title,
        style,
        mode: qMode,
        duration: qDur,
        voiceKey: voiceId,
        subtitleSettings,
        render_style:     qRenderStyle || 'ai-cinematic',
        hybrid_intensity: qHybridIntensity || 'low',
        preview,
      });
      navigate(`/jobs/${renderData.job_id}`);
    } catch (e) {
      setStatus('error');
      setError(e.response?.data?.error || 'Generatie of render mislukt');
    }
  }

  const [mode,           setMode]           = useState('documentary');
  const [renderStyle,    setRenderStyle]    = useState('ai-cinematic');
  const [hybridIntensity, setHybridIntensity] = useState('low');
  const [script,    setScript]    = useState('');
  const [title,     setTitle]     = useState('');
  const [topic,     setTopic]     = useState('');
  const [duration,  setDuration]  = useState(60);
  const [loading,        setLoading]        = useState(false);
  const [generating,     setGenerating]     = useState(false);
  const [analyzing,      setAnalyzing]      = useState(false);
  const [error,          setError]          = useState('');
  const [format,         setFormat]         = useState('narrative');
  const [recommendation, setRecommendation] = useState(null);

  const detectedFormat = (() => {
    const t = topic.trim();
    if (/^\d+\s/.test(t) || /\b\d+\s+(reasons?|tips?|facts?|ways?|things?|redenen|feiten)\b/i.test(t)) return 'listicle';
    if (/^How to\b/i.test(t) || /^Hoe\b/i.test(t) || /\bsteps?\b/i.test(t) || /\bstappen\b/i.test(t)) return 'howto';
    if (/\bvs\.?\b/i.test(t) || /\bversus\b/i.test(t) || /\bbetter than\b/i.test(t) || /\bcompared to\b/i.test(t) || /\bvergelijking\b/i.test(t)) return 'comparison';
    if (/^Why\b/i.test(t) || /^What if\b/i.test(t) || /^How did\b/i.test(t) || /^Waarom\b/i.test(t) || /^Wat als\b/i.test(t)) return 'mystery';
    return 'narrative';
  })();

  const currentMode  = MODES.find(m => m.value === mode) || MODES[0];
  const accentColor  = currentMode.color;

  // Voice-over — voicesLang is VIDEOTAAL, volledig onafhankelijk van UI-taal
  const [voices,      setVoices]      = useState([]);
  const [voicesLang,  setVoicesLang]  = useState('en');
  const [voiceId,     setVoiceId]     = useState('EXAVITQu4vr4xnSDxMaL');
  const [voicesError, setVoicesError] = useState(false);

  useEffect(() => {
    axios.get('/api/voices').then(r => {
      const loaded = r.data.voices || [];
      setVoices(loaded);
      const hasEn = loaded.some(v => v.lang === 'en');
      const hasNl = loaded.some(v => v.lang === 'nl');
      if (hasEn) { setVoicesLang('en'); setVoiceId(loaded.find(v => v.lang === 'en').voice_id); }
      else if (hasNl) { setVoicesLang('nl'); setVoiceId(loaded.find(v => v.lang === 'nl').voice_id); }
    }).catch(() => setVoicesError(true));
  }, []);

  // Subtitels — standaard geel voor viral stijl
  const [subtitles, setSubtitles] = useState({
    enabled: true, fontSize: 'normaal', highlightColor: '#FFD700', position: 'onder', subtitleStyle: 'classic', wordsPerLine: 4
  });

  // Update highlight kleur mee als mode wisselt
  useEffect(() => {
    setSubtitles(s => ({ ...s, highlightColor: accentColor === '#FFD700' ? '#FFD700' : '#FFD700' }));
  }, [mode]);

  async function handleGenerateScript() {
    if (!topic.trim()) return;
    setGenerating(true);
    setError('');
    try {
      const endpoint = mode === 'epic' ? '/api/script/generate-epic' : '/api/script/generate';
      const { data } = await axios.post(endpoint, { topic, style: currentMode.style, duration, language: voicesLang, format: mode === 'epic' ? 'narrative' : format });
      setScript(data.script);
    } catch (e) {
      setError(e.response?.data?.error || 'Script generatie mislukt');
    } finally {
      setGenerating(false);
    }
  }

  async function handleAnalyzeSettings() {
    if (!script.trim()) return;
    setAnalyzing(true);
    setError('');
    setRecommendation(null);
    try {
      const { data } = await axios.post('/api/script/analyze-settings', { script });
      setFormat(data.format || format);
      setMode(data.mode || mode);
      setRenderStyle(data.render_style || renderStyle);
      setRecommendation(data);
    } catch (e) {
      setError(e.response?.data?.error || 'Script-analyse mislukt');
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleStartRender(preview = false) {
    if (!script.trim()) return;
    setLoading(true);
    setError('');
    try {
      const { data } = await axios.post('/api/render', {
        script,
        title: title || topic || 'Untitled Short',
        style: currentMode.style,
        mode,
        duration,
        voiceKey: voiceId,
        subtitleSettings: subtitles,
        render_style:     renderStyle,
        hybrid_intensity: hybridIntensity,
        format: mode === 'epic' ? 'narrative' : format,
        preview,
      });
      navigate(`/jobs/${data.job_id}`);
    } catch (e) {
      setError(e.response?.data?.error || 'Render starten mislukt');
      setLoading(false);
    }
  }

  const wordCount       = script.trim().split(/\s+/).filter(Boolean).length;
  const estimatedDur    = Math.round(wordCount / (130 / 60));
  const wordCountColor  = wordCount > duration * 2.5 ? 'text-red-400' : wordCount > duration * 1.8 ? 'text-yellow-400' : 'text-green-400';

  function scriptPlaceholder() {
    if (mode === 'epic')  return t('studio.script_placeholder.epic',        '⚔️ Topic: "Battle of Thermopylae"');
    if (mode === 'story') return t('studio.script_placeholder.story',       '❤️ Topic: bijv. "groeien met tegenslag"');
    return                       t('studio.script_placeholder.documentary', '📚 Topic: bijv. "Bermuda Triangle mysteries"');
  }

  const step3Label =
    renderStyle === '2d'       ? t('studio.pipeline.step3_2d',      '2D-templates (geen AI credits)')       :
    renderStyle === 'simple'   ? t('studio.pipeline.step3_simple',  'T2I + I2V per scène (Grok + Kling)')   :
    renderStyle === 'hybrid'   ? t('studio.pipeline.step3_hybrid',  'Hybride KIE + 2D-mix')                 :
    renderStyle === 'ai-image' ? t('studio.pipeline.step3_aiimage', 'AI stilstaande beelden (Qwen2)')       :
    mode === 'epic'            ? t('studio.pipeline.step3_epic',    'Kling AI video achtergronden')         :
                                 t('studio.pipeline.step3_default', 'Gradient achtergronden');

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="heading-display text-3xl font-bold mb-1">{t('studio.title', 'Studio')}</h1>
        <p className="text-gray-400">{t('studio.subtitle', 'AI-gegenereerde YouTube Shorts in één klik')}</p>
      </div>

      {/* Tab-switcher */}
      <div className="flex gap-1.5 mb-6 p-1 bg-dark-800 border border-dark-700 rounded-xl w-fit">
        <button
          onClick={() => switchTab('quick')}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
          style={studioTab === 'quick'
            ? { backgroundColor: '#d4a017', color: '#000' }
            : { color: '#9ca3af' }}
        >
          <Zap size={14} /> {t('studio.tab.quick', 'Snelstart')}
        </button>
        <button
          onClick={() => switchTab('full')}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
          style={studioTab === 'full'
            ? { backgroundColor: '#374151', color: '#fff' }
            : { color: '#9ca3af' }}
        >
          <Settings2 size={14} /> {t('studio.tab.full', 'Volledig')}
        </button>
      </div>

      {/* Snelstart-modus */}
      {studioTab === 'quick' && (
        <QuickStartPanel voices={voices} onStart={handleQuickStart} onPreview={handleQuickStart} />
      )}

      {/* Volledige modus */}
      {studioTab === 'full' && (<>

      {/* RENDER STYLE TOGGLE */}
      <div className="flex gap-2 mb-2 p-1 bg-dark-800 border border-dark-700 rounded-xl w-fit flex-wrap">
        {RENDER_STYLE_OPTIONS.map(rs => (
          <button
            key={rs.value}
            onClick={() => setRenderStyle(rs.value)}
            title={t(rs.descKey, rs.descFb)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all border-2"
            style={renderStyle === rs.value
              ? { backgroundColor: '#1a1a1a', borderColor: '#e53e3e', color: '#fff' }
              : { backgroundColor: 'transparent', borderColor: 'transparent', color: '#6b7280' }}
          >
            {t(rs.labelKey, rs.labelFb)}
          </button>
        ))}
      </div>

      {/* KOSTENMATRIX — zichtbaar vóór de render start */}
      <CostMatrix renderStyle={renderStyle} hybridIntensity={hybridIntensity} />

      {/* HYBRID INTENSITEIT */}
      {renderStyle === 'hybrid' && (
        <div className="mb-4 p-3 rounded-xl border border-dark-700 bg-dark-800">
          <p className="text-xs text-gray-400 mb-2 font-semibold">{t('studio.hybrid.label', 'Kwaliteitsschuif — hoeveel AI-video wil je?')}</p>
          <div className="flex gap-2">
            {[
              { value: 'low',    label: '💰 Economisch',  desc: '~150 cr',  hint: 'Alleen titel + outro KIE' },
              { value: 'medium', label: '⚖️ Gebalanceerd', desc: '~400 cr', hint: 'Helft KIE + helft 2D' },
              { value: 'high',   label: '🎬 Premium',     desc: '~800 cr',  hint: 'Alle scènes KIE' },
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => setHybridIntensity(opt.value)}
                title={opt.hint}
                className="flex-1 flex flex-col items-center py-2 px-1 rounded-lg text-xs font-semibold transition-all border-2"
                style={hybridIntensity === opt.value
                  ? { backgroundColor: '#1a1a1a', borderColor: '#e53e3e', color: '#fff' }
                  : { backgroundColor: 'transparent', borderColor: '#374151', color: '#6b7280' }}
              >
                <span>{opt.label}</span>
                <span className="text-xs mt-0.5" style={{ color: hybridIntensity === opt.value ? '#fbbf24' : '#4b5563' }}>{opt.desc}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* MODE SELECTOR */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {MODES.map(m => {
          const Icon    = m.icon;
          const active  = mode === m.value;
          return (
            <button
              key={m.value}
              onClick={() => setMode(m.value)}
              className={`relative rounded-xl border-2 p-4 text-left transition-all ${
                active ? m.accent + ' scale-[1.02]' : 'border-dark-700 bg-dark-800 hover:border-dark-500'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Icon size={16} style={{ color: active ? m.color : '#6b7280' }} />
                <span className="font-bold text-sm" style={{ color: active ? m.color : '#9ca3af' }}>{m.label}</span>
              </div>
              <p className="text-xs text-gray-500">{t(m.descKey)}</p>
              {active && (
                <div className="absolute top-2 right-2 w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: m.color }} />
              )}
            </button>
          );
        })}
      </div>

      {/* FORMAT TOGGLE — verborgen voor Epic mode */}
      {mode !== 'epic' && (
        <div className="flex items-center gap-3 mb-4">
          <div className="flex gap-1 p-1 bg-dark-800 border border-dark-700 rounded-xl w-fit">
            {[
              { value: 'narrative',  label: '📖 Narrative'   },
              { value: 'listicle',   label: '📋 Listicle'    },
              { value: 'howto',      label: '🔧 How-to'      },
              { value: 'comparison', label: '⚖️ Vergelijking' },
              { value: 'mystery',    label: '🔍 Mystery'     },
            ].map(f => (
              <button
                key={f.value}
                onClick={() => setFormat(f.value)}
                className="px-3 py-1.5 rounded-lg text-sm font-semibold transition-all"
                style={format === f.value ? { backgroundColor: '#d4a017', color: '#000' } : { color: '#6b7280' }}
              >
                {f.label}
              </button>
            ))}
          </div>
          {detectedFormat !== 'narrative' && format !== detectedFormat && (
            <span className="text-xs text-yellow-400 flex items-center gap-1">
              {detectedFormat} gedetecteerd —{' '}
              <button onClick={() => setFormat(detectedFormat)} className="underline hover:text-yellow-300">Overschakelen</button>
            </span>
          )}
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        {/* Linkerkolom */}
        <div className="col-span-2 space-y-5">
          {/* Titel */}
          <div className="card">
            <label className="block text-sm font-semibold text-gray-300 mb-2">{t('studio.label.title', 'Video Titel')}</label>
            <input
              className="input"
              placeholder={t('studio.title_placeholder', 'bijv. The Rise of the Viking Empire')}
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </div>

          {/* Script */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-semibold text-gray-300">{t('studio.label.script', 'Script')}</label>
              <span className={`text-xs font-mono ${wordCountColor}`}>
                {wordCount} words ≈ {estimatedDur}s
              </span>
            </div>

            <div className="flex gap-2 mb-3 items-start">
              <textarea
                className="input flex-1 resize-y"
                rows={5}
                placeholder={scriptPlaceholder()}
                value={topic}
                onChange={e => setTopic(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && e.ctrlKey && handleGenerateScript()}
              />
              <button
                onClick={handleGenerateScript}
                disabled={generating || !topic.trim()}
                className="btn-secondary flex items-center gap-2 whitespace-nowrap"
                style={{ borderColor: generating ? undefined : accentColor + '40' }}
              >
                {generating ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                {mode === 'epic' ? t('studio.btn.generate_epic', 'Epic Script') : t('studio.btn.generate', 'Genereer')}
              </button>
            </div>

            <div className="relative">
              <textarea
                className="input min-h-[200px] resize-none font-mono text-sm w-full"
                placeholder={t('studio.script_area_placeholder', 'Plak of typ hier je script...')}
                value={script}
                onChange={e => setScript(e.target.value)}
              />
              <button
                onClick={handleAnalyzeSettings}
                disabled={analyzing || !script.trim()}
                className="absolute bottom-2 right-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-40"
                style={{ backgroundColor: '#1a1a2e', border: '1px solid #d4a01750', color: '#d4a017' }}
              >
                {analyzing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                {analyzing ? 'Analyseren...' : '✨ Analyseer'}
              </button>
            </div>

            {recommendation && (
              <div className="mt-2 rounded-lg px-3 py-2 text-xs flex items-start justify-between gap-2" style={{ backgroundColor: '#1a1a2e', border: '1px solid #d4a01740' }}>
                <div className="space-y-0.5">
                  <div className="font-semibold text-yellow-500/90 mb-1">
                    ✨ Aanbevolen: {recommendation.format} · {recommendation.mode} · {recommendation.render_style}
                  </div>
                  {recommendation.reasoning && (
                    <div className="text-gray-400 space-y-0.5">
                      <div>📋 {recommendation.reasoning.format}</div>
                      <div>🎭 {recommendation.reasoning.mode}</div>
                      <div>🎬 {recommendation.reasoning.render_style}</div>
                    </div>
                  )}
                </div>
                <button onClick={() => setRecommendation(null)} className="text-gray-500 hover:text-gray-300 shrink-0 mt-0.5">✕</button>
              </div>
            )}
          </div>

          {/* Duur */}
          <div className="card">
            <label className="block text-sm font-semibold text-gray-300 mb-3">
              <Clock size={14} className="inline mr-1" /> {t('studio.label.duration', 'Duur')}
            </label>
            <div className="flex gap-2">
              {DURATIONS.map(d => (
                <button
                  key={d}
                  onClick={() => setDuration(d)}
                  className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors"
                  style={{
                    backgroundColor: duration === d ? accentColor : undefined,
                    color:           duration === d ? '#000' : '#9ca3af',
                    border:          duration === d ? 'none' : '1px solid #374151',
                  }}
                >
                  {d}s
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Rechterkolom */}
        <div className="space-y-4">
          {/* Voice-over */}
          <div className="card">
            <h3 className="font-semibold text-white mb-3 flex items-center gap-2 text-sm">
              <Mic size={14} /> {t('studio.label.voiceover', 'Voice-over')}
            </h3>
            {/* NL/EN knoppen zijn VIDEOTAAL — ongewijzigd, onafhankelijk van UI-taal */}
            <div className="flex gap-1.5 mb-3">
              {['en', 'nl'].map(lang => (
                <button
                  key={lang}
                  onClick={() => {
                    setVoicesLang(lang);
                    const first = voices.find(v => v.lang === lang);
                    if (first) setVoiceId(first.voice_id);
                  }}
                  className={`flex-1 py-1.5 rounded text-sm font-semibold transition-colors ${
                    voicesLang === lang ? 'text-black' : 'bg-dark-700 text-gray-400 hover:text-white'
                  }`}
                  style={voicesLang === lang ? { backgroundColor: accentColor } : {}}
                >
                  {lang === 'nl' ? '🇳🇱 NL' : '🇬🇧 EN'}
                </button>
              ))}
            </div>

            {voicesError ? (
              <div className="text-xs text-red-400 py-2 text-center">{t('studio.error.voices', 'Stemmen laden mislukt')}</div>
            ) : voices.length === 0 ? (
              <div className="text-xs text-gray-500 py-2 text-center flex items-center justify-center gap-1">
                <Loader2 size={11} className="animate-spin" /> {t('studio.voices.loading', 'Laden...')}
              </div>
            ) : voices.filter(v => v.lang === voicesLang).length === 0 ? (
              <div className="text-xs text-gray-500 py-2 text-center">
                {t('studio.voices.none', `Geen ${voicesLang.toUpperCase()} stemmen`)}
              </div>
            ) : (
              <select className="input text-sm" value={voiceId} onChange={e => setVoiceId(e.target.value)}>
                {voices.filter(v => v.lang === voicesLang).map(v => (
                  <option key={v.voice_id} value={v.voice_id}>
                    {v.name}{v.gender ? ` · ${v.gender === 'female' ? 'Vrouw' : 'Man'}` : ''}
                  </option>
                ))}
              </select>
            )}
            {voices.length > 0 && (
              <p className="text-xs mt-1.5 text-center text-green-500">
                {t('studio.voices.count', `✓ ${voices.length} stemmen`)}
              </p>
            )}
          </div>

          {/* Ondertitels */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-white flex items-center gap-2 text-sm">
                <Type size={14} /> {t('studio.label.subtitles', 'Ondertitels')}
              </h3>
              <button onClick={() => setSubtitles(s => ({ ...s, enabled: !s.enabled }))}>
                {subtitles.enabled
                  ? <ToggleRight size={22} style={{ color: accentColor }} />
                  : <ToggleLeft size={22} className="text-gray-500" />}
              </button>
            </div>

            {subtitles.enabled && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1.5 block">{t('studio.label.size', 'Grootte')}</label>
                  <div className="flex gap-1.5">
                    {FONT_SIZES.map(fs => (
                      <button
                        key={fs.value}
                        onClick={() => setSubtitles(s => ({ ...s, fontSize: fs.value }))}
                        className="flex-1 py-1.5 rounded text-xs font-medium transition-colors"
                        style={{
                          backgroundColor: subtitles.fontSize === fs.value ? accentColor : undefined,
                          color: subtitles.fontSize === fs.value ? '#000' : '#9ca3af',
                          border: subtitles.fontSize === fs.value ? 'none' : '1px solid #374151',
                        }}
                      >
                        {t(fs.key, fs.fallback)}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-gray-400 mb-1.5 block">{t('studio.label.color', 'Kleur')}</label>
                  <div className="flex gap-2">
                    {HIGHLIGHT_COLORS.map(c => (
                      <button
                        key={c.value}
                        onClick={() => setSubtitles(s => ({ ...s, highlightColor: c.value }))}
                        title={t(c.label, c.fallback)}
                        className={`flex-1 h-7 rounded-lg transition-all ${c.class} ${
                          subtitles.highlightColor === c.value ? 'ring-2 ring-white scale-95' : 'opacity-60 hover:opacity-100'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-gray-400 mb-1.5 block">{t('studio.label.position', 'Positie')}</label>
                  <div className="flex gap-1.5">
                    {[
                      { value: 'onder',  key: 'studio.subtitle.position.onder',  fallback: 'Onder',  icon: AlignEndHorizontal },
                      { value: 'midden', key: 'studio.subtitle.position.midden', fallback: 'Midden', icon: AlignCenter },
                    ].map(p => (
                      <button
                        key={p.value}
                        onClick={() => setSubtitles(s => ({ ...s, position: p.value }))}
                        className="flex-1 py-1.5 rounded text-xs font-medium flex items-center justify-center gap-1 transition-colors"
                        style={{
                          backgroundColor: subtitles.position === p.value ? accentColor : undefined,
                          color: subtitles.position === p.value ? '#000' : '#9ca3af',
                          border: subtitles.position === p.value ? 'none' : '1px solid #374151',
                        }}
                      >
                        <p.icon size={12} /> {t(p.key, p.fallback)}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-gray-400 mb-1.5 block">{t('studio.label.style', 'Stijl')}</label>
                  <div className="flex gap-1.5">
                    {[
                      { value: 'classic',     key: 'studio.subtitle.style.classic', fallback: 'Klassiek'    },
                      { value: 'karaoke-box', key: 'studio.subtitle.style.karaoke', fallback: '🎤 Karaoke'  },
                    ].map(st => (
                      <button
                        key={st.value}
                        onClick={() => setSubtitles(s => ({ ...s, subtitleStyle: st.value }))}
                        className="flex-1 py-1.5 rounded text-xs font-medium transition-colors"
                        style={{
                          backgroundColor: subtitles.subtitleStyle === st.value ? accentColor : undefined,
                          color: subtitles.subtitleStyle === st.value ? '#000' : '#9ca3af',
                          border: subtitles.subtitleStyle === st.value ? 'none' : '1px solid #374151',
                        }}
                      >
                        {t(st.key, st.fallback)}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-gray-400 mb-1.5 block">{t('studio.label.words_per_group', 'Woorden per groep')}</label>
                  <div className="flex gap-1.5">
                    {[
                      { value: 3,               label: '3' },
                      { value: 4,               label: '4' },
                      { value: 6,               label: '6' },
                      { value: 'full_sentence', label: t('studio.subtitle.full_sentence', 'Volledige zin') },
                    ].map(opt => (
                      <button
                        key={String(opt.value)}
                        onClick={() => setSubtitles(s => ({ ...s, wordsPerLine: opt.value }))}
                        className="flex-1 py-1.5 rounded text-xs font-medium transition-colors"
                        style={{
                          backgroundColor: subtitles.wordsPerLine === opt.value ? accentColor : undefined,
                          color: subtitles.wordsPerLine === opt.value ? '#000' : '#9ca3af',
                          border: subtitles.wordsPerLine === opt.value ? 'none' : '1px solid #374151',
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-900/30 border border-red-700 text-red-300 text-sm rounded-lg p-3">{error}</div>
          )}

          {/* Render knoppen */}
          <div className="flex gap-2">
            <button
              onClick={() => handleStartRender(false)}
              disabled={loading || !script.trim()}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-base font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: accentColor,
                color: accentColor === '#FFD700' ? '#000' : '#fff',
              }}
            >
              {loading
                ? <><Loader2 size={18} className="animate-spin" /> {t('studio.btn.loading', 'Starten...')}</>
                : <><Play size={18} /> {mode === 'epic' ? t('studio.btn.render_epic', '⚔️ Epic Render') : t('studio.btn.render', 'Render Starten')}</>
              }
            </button>
            <button
              onClick={() => handleStartRender(true)}
              disabled={loading || !script.trim()}
              title={t('studio.btn.preview_title', 'Preview — geen AI-credits, enkel voice-over + gradient')}
              className="flex items-center justify-center gap-1 px-4 py-3 rounded-lg text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: '#B8860B', color: '#fff' }}
            >
              👁️ {t('studio.btn.preview', 'Preview')}
            </button>
          </div>

          {/* Pipeline info — signatuurelement */}
          <div className="card text-xs text-stone space-y-0">
            <div className="heading-display font-semibold text-sm mb-3 flex items-center gap-2">
              <Film size={12} /> {t('studio.pipeline.title', 'Pipeline')}
            </div>
            <div className="relative pl-2">
              <div className="absolute left-[11px] top-2 bottom-2 w-px bg-dark-600" />
              {[
                { label: t('studio.pipeline.step1', 'Claude analyseert script'), active: false },
                { label: t('studio.pipeline.step2', 'ElevenLabs voice-over'),    active: false },
                { label: step3Label,                                              active: true  },
                { label: t('studio.pipeline.step4', 'Remotion render → MP4'),    active: false },
              ].map((step, i) => (
                <div key={i} className="relative flex items-center gap-3 py-1.5">
                  <span
                    className={`heading-display relative z-10 w-[22px] h-[22px] rounded-full text-[11px] flex items-center justify-center shrink-0 ${step.active ? 'animate-pulse' : ''}`}
                    style={{
                      backgroundColor: step.active ? '#e53e3e' : '#1a1a1a',
                      border: `1px solid ${step.active ? '#e53e3e' : '#3a3a3a'}`,
                      color: step.active ? '#fff' : '#d4a017',
                    }}
                  >
                    {i + 1}
                  </span>
                  <span className="text-mono text-[11px]" style={{ color: step.active ? '#d4a017' : '#6b6b6b' }}>
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      </>)} {/* einde studioTab === 'full' */}
    </div>
  );
}
