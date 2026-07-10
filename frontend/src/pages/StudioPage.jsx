import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Sparkles, Play, Film, Clock, Type,
  AlignEndHorizontal, AlignCenter, ToggleLeft, ToggleRight,
  Loader2, Mic, Sword, BookOpen, Heart, Zap, Settings2,
  Gamepad2, Palette, TrendingUp, Dumbbell, Cpu
} from 'lucide-react';
import QuickStartPanel from '../components/QuickStartPanel';
import { StylePreviewCard, StylePreviewKeyframes } from '../components/StylePreviewCard';
import { OnboardingTour } from '../components/OnboardingTour';
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

const DURATIONS = [30, 45, 60, 90, 120, 180, 240, 300];
const MAX_CUSTOM_DURATION = 600; // 10 minuten

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
  { value: 'illustrated',       labelKey: 'studio.render_style.illustrated', descKey: 'studio.render_style.illustrated_desc', labelFb: '🎨 Geïllustreerd', descFb: 'Stilstaande illustraties + Ken Burns — bijna gratis' },
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
  'illustrated':       { credits: '~40',  time: '~5-8 min',   stars: 3, advice: 'Geïllustreerde explainer-stijl — bijna gratis' },
  'hybrid:smart':      { credits: 'variabel', time: '~6-16 min', stars: 4, advice: 'Claude kiest per scène — alleen AI waar het écht impact heeft' },
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
  const [illustrationStyle, setIllustrationStyle] = useState('flat');
  const [script,    setScript]    = useState('');
  const [title,     setTitle]     = useState('');
  const [topic,     setTopic]     = useState('');
  const [duration,  setDuration]  = useState(60);
  const [customDuration, setCustomDuration] = useState('');
  const [uniqueness, setUniqueness] = useState(null);
  const [humanizing, setHumanizing] = useState(false);
  const [humanized, setHumanized]   = useState(null); // { original, humanized }
  const [abGenerating, setAbGenerating] = useState(false);
  const [abVariants, setAbVariants]     = useState(null); // { variant_a, variant_b }
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
  const [previewingVoice, setPreviewingVoice] = useState(false);
  const previewAudioRef = useRef(null);

  function toggleVoicePreview() {
    const v = voices.find(x => x.voice_id === voiceId);
    if (!v?.preview_url) return;
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
      setPreviewingVoice(false);
      return;
    }
    const audio = new window.Audio(v.preview_url);
    previewAudioRef.current = audio;
    setPreviewingVoice(true);
    audio.onended = () => { previewAudioRef.current = null; setPreviewingVoice(false); };
    audio.onerror = () => { previewAudioRef.current = null; setPreviewingVoice(false); };
    audio.play().catch(() => { previewAudioRef.current = null; setPreviewingVoice(false); });
  }

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

  async function handleGenerateAb() {
    if (!topic.trim()) return;
    setAbGenerating(true);
    setError('');
    try {
      const { data } = await axios.post('/api/script/generate-ab', { topic, style: currentMode.style, duration, language: voicesLang, format: mode === 'epic' ? 'narrative' : format });
      setAbVariants(data);
    } catch (e) {
      setError(e.response?.data?.error || 'A/B generatie mislukt');
    } finally {
      setAbGenerating(false);
    }
  }

  function chooseAbVariant(which) {
    if (!abVariants) return;
    const chosen   = which === 'a' ? abVariants.variant_a : abVariants.variant_b;
    const rejected = which === 'a' ? abVariants.variant_b : abVariants.variant_a;
    setScript(chosen.script);
    setUniqueness({ score: chosen.uniqueness_score, perspective: chosen.perspective });
    axios.post('/api/script/ab-choice', { chosen_perspective: chosen.perspective, rejected_perspective: rejected.perspective }).catch(() => {});
    setAbVariants(null);
  }

  async function handleHumanize() {
    if (!script.trim()) return;
    setHumanizing(true);
    setError('');
    try {
      const { data } = await axios.post('/api/script/humanize', { script, language: voicesLang });
      setHumanized(data);
    } catch (e) {
      setError(e.response?.data?.error || 'Humaniseren mislukt');
    } finally {
      setHumanizing(false);
    }
  }

  async function handleGenerateScript() {
    if (!topic.trim()) return;
    setGenerating(true);
    setError('');
    try {
      const endpoint = mode === 'epic' ? '/api/script/generate-epic' : '/api/script/generate';
      const { data } = await axios.post(endpoint, { topic, style: currentMode.style, duration, language: voicesLang, format: mode === 'epic' ? 'narrative' : format });
      setScript(data.script);
      setUniqueness(data.uniqueness_score !== undefined ? { score: data.uniqueness_score, perspective: data.perspective } : null);
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
        illustration_style: illustrationStyle,
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
      {/* Onboarding voor nieuwe gebruikers (localStorage-flag) */}
      <OnboardingTour />

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

      {/* RENDER STYLE — animated preview cards */}
      <StylePreviewKeyframes />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 mb-2">
        {RENDER_STYLE_OPTIONS.map(rs => {
          const costKey = rs.value === 'hybrid' ? `hybrid:${hybridIntensity}` : rs.value;
          const cost = COST_MATRIX[costKey]?.credits?.replace('~', '') || '?';
          return (
            <StylePreviewCard
              key={rs.value}
              value={rs.value}
              name={t(rs.labelKey, rs.labelFb).replace(/^[^\w]*\s?/, '')}
              cost={cost}
              info={t(rs.descKey, rs.descFb)}
              active={renderStyle === rs.value}
              onClick={() => setRenderStyle(rs.value)}
            />
          );
        })}
      </div>

      <p className="text-[10px] mb-2" style={{ color: '#6b6b6b' }}>
        {t('studio.style_cards.disclaimer', 'De kaartjes zijn stijlimpressies — de "👁️ Preview"-knop toont de echte render-pipeline.')}
      </p>

      {/* KOSTENMATRIX — zichtbaar vóór de render start */}
      <CostMatrix renderStyle={renderStyle} hybridIntensity={hybridIntensity} />

      {/* HYBRID INTENSITEIT */}
      {renderStyle === 'hybrid' && (
        <div className="mb-4 p-3 rounded-xl border border-dark-700 bg-dark-800">
          <p className="text-xs text-gray-400 mb-2 font-semibold">{t('studio.hybrid.label', 'Kwaliteitsschuif — hoeveel AI-video wil je?')}</p>
          <div className="flex gap-2">
            {[
              { value: 'smart',  label: '🧠 Smart',       desc: 'AI kiest', hint: 'Claude bepaalt per scène of AI-beeld nodig is — beste prijs/kwaliteit' },
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

      {/* ILLUSTRATIE-SUBSTIJL */}
      {renderStyle === 'illustrated' && (
        <div className="mb-4 p-3 rounded-xl border border-dark-700 bg-dark-800">
          <p className="text-xs text-gray-400 mb-2 font-semibold">{t('studio.illustrated.label', 'Illustratie-stijl — welke look wil je?')}</p>
          <div className="flex gap-2">
            {[
              { value: 'flat',      label: '🟦 Flat Design',      desc: 'Vlakke vormen, felle kleuren' },
              { value: 'storybook', label: '📖 Storybook',        desc: 'Zachte aquarel, prentenboek' },
              { value: 'motion',    label: '🔷 Motion Graphics',  desc: 'Geometrisch, corporate explainer' },
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => setIllustrationStyle(opt.value)}
                title={opt.desc}
                className="flex-1 flex flex-col items-center py-2 px-1 rounded-lg text-xs font-semibold transition-all border-2"
                style={illustrationStyle === opt.value
                  ? { backgroundColor: '#1a1a1a', borderColor: '#e53e3e', color: '#fff' }
                  : { backgroundColor: 'transparent', borderColor: '#374151', color: '#6b7280' }}
              >
                <span>{opt.label}</span>
                <span className="text-xs mt-0.5" style={{ color: illustrationStyle === opt.value ? '#fbbf24' : '#4b5563' }}>{opt.desc}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* MODE SELECTOR */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3 mb-6">
        {MODES.map(m => {
          const Icon    = m.icon;
          const active  = mode === m.value;
          return (
            <button
              key={m.value}
              onClick={() => setMode(m.value)}
              className={`relative rounded-xl border-2 p-3 sm:p-4 text-left transition-all min-w-0 ${
                active ? m.accent + ' scale-[1.02]' : 'border-dark-700 bg-dark-800 hover:border-dark-500'
              }`}
            >
              <div className="flex items-center gap-1.5 sm:gap-2 mb-1 min-w-0">
                <Icon size={16} className="shrink-0" style={{ color: active ? m.color : '#6b7280' }} />
                <span className="font-bold text-xs sm:text-sm truncate" style={{ color: active ? m.color : '#9ca3af' }}>{m.label}</span>
              </div>
              <p className="text-xs text-gray-500 truncate">{t(m.descKey)}</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        {/* Linkerkolom */}
        <div className="lg:col-span-2 space-y-5">
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
              <div className="flex items-center gap-2">
                {uniqueness && (
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full"
                    title={`Vertelperspectief: ${uniqueness.perspective} — score meet hoe anders dit script is t.o.v. je vorige 5`}
                    style={{
                      background: uniqueness.score >= 70 ? 'rgba(74,222,128,0.12)' : uniqueness.score >= 45 ? 'rgba(251,191,36,0.12)' : 'rgba(248,113,113,0.12)',
                      color:      uniqueness.score >= 70 ? '#4ade80' : uniqueness.score >= 45 ? '#fbbf24' : '#f87171',
                    }}
                  >
                    ✨ uniciteit {uniqueness.score}/100 · {uniqueness.perspective}
                  </span>
                )}
                <span className={`text-xs font-mono ${wordCountColor}`}>
                  {wordCount} words ≈ {estimatedDur}s
                </span>
              </div>
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
              <div className="flex flex-col gap-2">
                <button
                  onClick={handleGenerateScript}
                  disabled={generating || abGenerating || !topic.trim()}
                  className="btn-secondary flex items-center gap-2 whitespace-nowrap"
                  style={{ borderColor: generating ? undefined : accentColor + '40' }}
                >
                  {generating ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                  {mode === 'epic' ? t('studio.btn.generate_epic', 'Epic Script') : t('studio.btn.generate', 'Genereer')}
                </button>
                <button
                  onClick={handleGenerateAb}
                  disabled={generating || abGenerating || !topic.trim()}
                  className="btn-secondary flex items-center gap-2 whitespace-nowrap text-xs"
                  title={t('studio.btn.ab_hint', 'Genereer 2 varianten met verschillende hooks en kies de beste')}
                >
                  {abGenerating ? <Loader2 size={13} className="animate-spin" /> : '⚖️'}
                  {abGenerating ? t('studio.btn.ab_busy', '2 varianten...') : t('studio.btn.ab', 'A/B Test')}
                </button>
              </div>
            </div>

            {/* A/B variant-keuze */}
            {abVariants && (
              <div className="mb-3 rounded-xl border p-3" style={{ borderColor: 'rgba(212,160,23,0.35)', background: 'rgba(212,160,23,0.04)' }}>
                <p className="text-xs font-semibold mb-2" style={{ color: '#d4a017' }}>⚖️ {t('studio.ab.title', 'A/B Test — kies de sterkste variant')}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {['a', 'b'].map(which => {
                    const v = which === 'a' ? abVariants.variant_a : abVariants.variant_b;
                    return (
                      <div key={which}>
                        <p className="text-[10px] uppercase tracking-wide mb-1" style={{ color: '#6b6b6b' }}>
                          {t('studio.ab.variant', `Variant ${which.toUpperCase()}`)} · {v.perspective} · ✨{v.uniqueness_score}/100
                        </p>
                        <div className="text-xs rounded-lg p-2.5 max-h-40 overflow-y-auto whitespace-pre-wrap" style={{ background: '#111', color: '#d1d5db' }}>{v.script}</div>
                        <button onClick={() => chooseAbVariant(which)} className="w-full mt-2 text-xs py-1.5 rounded-lg font-semibold text-black" style={{ background: '#d4a017' }}>
                          {t('studio.ab.choose', `Kies ${which.toUpperCase()}`)}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

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
              <button
                onClick={handleHumanize}
                disabled={humanizing || !script.trim()}
                className="absolute bottom-2 right-32 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-40"
                style={{ backgroundColor: '#1a1a2e', border: '1px solid #4ade8050', color: '#4ade80' }}
                title={t('studio.humanize.hint', 'Herschrijf het script zodat het klinkt als een echt mens')}
              >
                {humanizing ? <Loader2 size={12} className="animate-spin" /> : null}
                {humanizing ? 'Humaniseren...' : '🧑 Humaniseer'}
              </button>
            </div>

            {/* Voor/na humanisatie-vergelijking */}
            {humanized && (
              <div className="mt-3 rounded-xl border p-3" style={{ borderColor: 'rgba(74,222,128,0.35)', background: 'rgba(74,222,128,0.04)' }}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold" style={{ color: '#4ade80' }}>🧑 {t('studio.humanize.title', 'Humanisatie — kies welke versie je gebruikt')}</p>
                  {typeof humanized.rewrite_pct === 'number' && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(74,222,128,0.12)', color: '#4ade80' }}>
                      {humanized.rewrite_pct >= 10
                        ? t('studio.humanize.pct', `${humanized.rewrite_pct}% van de zinnen herschreven`)
                        : t('studio.humanize.already_human', 'Script was al menselijk geschreven')}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide mb-1" style={{ color: '#6b6b6b' }}>{t('studio.humanize.before', 'Voor (origineel)')}</p>
                    <div className="text-xs rounded-lg p-2.5 max-h-40 overflow-y-auto whitespace-pre-wrap" style={{ background: '#111', color: '#9ca3af' }}>{humanized.original}</div>
                    <button onClick={() => { setScript(humanized.original); setHumanized(null); }} className="btn-secondary w-full mt-2 text-xs py-1.5">
                      {t('studio.humanize.keep_original', 'Behoud origineel')}
                    </button>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide mb-1" style={{ color: '#4ade80' }}>{t('studio.humanize.after', 'Na (gehumaniseerd)')}</p>
                    <div className="text-xs rounded-lg p-2.5 max-h-40 overflow-y-auto whitespace-pre-wrap" style={{ background: '#111', color: '#e8e3d8', border: '1px solid rgba(74,222,128,0.25)' }}>{humanized.humanized}</div>
                    <button onClick={() => { setScript(humanized.humanized); setHumanized(null); }} className="w-full mt-2 text-xs py-1.5 rounded-lg font-semibold text-black" style={{ background: '#4ade80' }}>
                      {t('studio.humanize.use', 'Gebruik gehumaniseerde versie')}
                    </button>
                  </div>
                </div>
              </div>
            )}

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
            <div className="flex gap-2 flex-wrap">
              {DURATIONS.map(d => (
                <button
                  key={d}
                  onClick={() => { setDuration(d); setCustomDuration(''); }}
                  className="py-2 px-3 rounded-lg text-sm font-medium transition-colors"
                  style={{
                    backgroundColor: duration === d && !customDuration ? accentColor : undefined,
                    color:           duration === d && !customDuration ? '#000' : '#9ca3af',
                    border:          duration === d && !customDuration ? 'none' : '1px solid #374151',
                  }}
                >
                  {d >= 60 ? `${Math.floor(d / 60)}m${d % 60 ? (d % 60) + 's' : ''}` : `${d}s`}
                </button>
              ))}
              <input
                type="number"
                min={15}
                max={MAX_CUSTOM_DURATION}
                value={customDuration}
                onChange={e => {
                  const v = e.target.value;
                  setCustomDuration(v);
                  const n = parseInt(v, 10);
                  if (n >= 15 && n <= MAX_CUSTOM_DURATION) setDuration(n);
                }}
                placeholder={t('studio.duration.custom', 'Aangepast (s)')}
                className="w-28 py-2 px-3 rounded-lg text-sm bg-transparent text-white placeholder-gray-600"
                style={{ border: customDuration ? `1px solid ${accentColor}` : '1px solid #374151' }}
              />
            </div>
            {duration > 180 && (
              <div className="mt-3 p-2.5 rounded-lg text-xs" style={{ backgroundColor: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.35)', color: '#fb923c' }}>
                ⚠️ {t('studio.duration.warning', `Lange render — verwachte tijd: ~${Math.round(duration / 12)}-${Math.round(duration / 7)} minuten. Voldoende RAM vereist op Railway.`)}
              </div>
            )}
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
              <div className="flex items-center gap-2">
                <select className="input text-sm flex-1" value={voiceId} onChange={e => { if (previewAudioRef.current) { previewAudioRef.current.pause(); previewAudioRef.current = null; setPreviewingVoice(false); } setVoiceId(e.target.value); }}>
                  {voices.filter(v => v.lang === voicesLang).map(v => (
                    <option key={v.voice_id} value={v.voice_id}>
                      {v.name}{v.gender ? ` · ${v.gender === 'female' ? 'Vrouw' : 'Man'}` : ''}{v.preview_url ? '' : ' (geen preview)'}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={toggleVoicePreview}
                  disabled={!voices.find(x => x.voice_id === voiceId)?.preview_url}
                  className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-sm bg-dark-700 hover:bg-dark-600 disabled:opacity-30 disabled:cursor-not-allowed"
                  title={previewingVoice
                    ? t('studio.voices.stop_preview', 'Stop voorbeeld')
                    : t('studio.voices.play_preview', 'Beluister deze stem')}
                >
                  {previewingVoice ? '⏸' : '▶️'}
                </button>
              </div>
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
                  <div className="flex gap-1.5 flex-wrap">
                    {[
                      { value: 1, label: '1' },
                      { value: 2, label: '2' },
                      { value: 3, label: '3' },
                      { value: 4, label: '4' },
                      { value: 5, label: '5' },
                      { value: 6, label: '6' },
                      { value: 7, label: '7' },
                      { value: 8, label: '8' },
                      { value: 'random',        label: t('studio.subtitle.random', '🎲 Willekeurig') },
                      { value: 'full_sentence', label: t('studio.subtitle.full_sentence', 'Volledige zin') },
                    ].map(opt => (
                      <button
                        key={String(opt.value)}
                        onClick={() => setSubtitles(s => ({ ...s, wordsPerLine: opt.value }))}
                        className="py-1.5 px-2.5 rounded text-xs font-medium transition-colors"
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
