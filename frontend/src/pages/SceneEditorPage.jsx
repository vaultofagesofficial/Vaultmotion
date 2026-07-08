import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors
} from '@dnd-kit/core';
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical, Trash2, Plus, Play, ChevronDown
} from 'lucide-react';
import { useTranslation } from '../i18n/useTranslation';

const TEMPLATE_OPTIONS = [
  { value: 'cinematic_title', label: '🎬 Cinematic Title' },
  { value: 'ken_burns',       label: '📸 Ken Burns' },
  { value: 'animated_map',    label: '🗺️ Animated Map' },
  { value: 'timeline',        label: '📅 Timeline' },
  { value: 'stats_counter',   label: '📊 Stats Counter' },
  { value: 'outro_cta',       label: '🔔 Outro CTA' },
  { value: 'fact_animation',  label: '📐 Fact Animation' },
  { value: 'data_comparison', label: '📊 Data Comparison' },
];

const MUSIC_OPTIONS = [
  { value: 'epic',         label: 'Epic' },
  { value: 'documentary',  label: 'Documentary' },
  { value: 'story',        label: 'Story' },
];

// ── Storyboard-helpers ──────────────────────────────────────────────────────

const TEMPLATE_ICONS = {
  cinematic_title: '🎬', ken_burns: '📸', animated_map: '🗺️', timeline: '📅',
  stats_counter: '🔢', outro_cta: '🔔', fact_animation: '📐', data_comparison: '📊',
  text_focus_2d: '📝',
};

// Kleurthema's — zelfde waarden als remotion/src/colorThemes.ts
const EDITOR_THEMES = {
  default: { bg: '#111111', accent: '#FFD700' },
  warm:    { bg: '#180a00', accent: '#f6ad55' },
  cool:    { bg: '#07101f', accent: '#93c5fd' },
  neutral: { bg: '#111111', accent: '#FFD700' },
  dark:    { bg: '#0f0f14', accent: '#00d4ff' },
  noir:    { bg: '#000000', accent: '#e53e3e' },
  neon:    { bg: '#0a0014', accent: '#39ff14' },
  luxury:  { bg: '#0d0d0d', accent: '#d4af37' },
};

// Kosten per scène: KIE-scènes ≈ 75cr (T2I + Kling I2V), 2D = gratis
function sceneCost(scene, renderStyle) {
  if (renderStyle === '2d' || scene.skip_kie || scene.template === 'text_focus_2d' || scene.chapter_card) return 'gratis';
  if (renderStyle === 'simple') return '~75cr';
  if (renderStyle === 'hybrid') {
    if (scene.template === 'cinematic_title' || scene.template === 'outro_cta' || scene.needs_ai) return '~75cr';
    return 'gratis';
  }
  return '~50cr'; // ai-cinematic/ai-image gemiddeld
}

// Miniatuur-preview: visual_focus als quote op themakleur-achtergrond + template-icoon
function ScenePreviewThumb({ scene, theme, onClick }) {
  const text = scene.visual_focus || scene.script_segment || '';
  const icon = TEMPLATE_ICONS[scene.template] || '🎞️';
  return (
    <button
      onClick={onClick}
      className="shrink-0 w-24 h-[168px] rounded-lg border border-dark-600 overflow-hidden flex flex-col items-center justify-center p-1.5 gap-1 hover:border-red-500/60 transition-colors cursor-pointer"
      style={{ background: `linear-gradient(160deg, ${theme.bg} 0%, #050505 100%)` }}
      title={`${text} — klik voor preview`}
    >
      <span style={{ fontSize: 22 }}>{icon}</span>
      <span className="text-[9px] leading-tight text-center" style={{ color: theme.accent, display: '-webkit-box', WebkitLineClamp: 6, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {text ? `"${text.slice(0, 90)}"` : '—'}
      </span>
      <span className="text-[8px]" style={{ color: '#6b6b6b' }}>▶ preview</span>
    </button>
  );
}

// Gesimuleerde live preview: CSS-animatie die de Remotion-template nabootst
function ScenePreviewModal({ scene, theme, onClose }) {
  if (!scene) return null;
  const isTitle = scene.template === 'cinematic_title' || scene.template === 'outro_cta';
  const isData  = ['data_comparison', 'stats_counter', 'fact_animation', 'timeline'].includes(scene.template);
  const title   = scene.content?.title || scene.visual_focus || scene.script_segment || '';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.8)' }} onClick={onClose}>
      <style>{`
        @keyframes sePrevTitle { 0% { opacity: 0; transform: scale(1.3); letter-spacing: 12px; } 100% { opacity: 1; transform: scale(1); letter-spacing: 3px; } }
        @keyframes sePrevText  { 0% { opacity: 0; transform: translateX(-30px); } 100% { opacity: 1; transform: translateX(0); } }
        @keyframes sePrevBar   { 0% { width: 0; } 100% { width: var(--w); } }
        @keyframes sePrevZoom  { 0% { transform: scale(1); } 100% { transform: scale(1.12); } }
      `}</style>
      <div onClick={e => e.stopPropagation()} className="rounded-2xl overflow-hidden border border-dark-600" style={{ width: 240, height: 426, position: 'relative', background: theme.bg }}>
        <div style={{ position: 'absolute', inset: 0, animation: 'sePrevZoom 6s ease-out forwards', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 18 }}>
          {isTitle ? (
            <span style={{ fontFamily: 'Impact', fontSize: 24, color: '#fff', textAlign: 'center', animation: 'sePrevTitle 1.2s ease-out forwards', textShadow: `0 2px 16px ${theme.accent}` }}>
              {title.slice(0, 40)}
            </span>
          ) : isData ? (
            <div className="w-full space-y-2.5">
              <span style={{ fontSize: 12, color: theme.accent, animation: 'sePrevText 0.5s ease-out forwards' }}>{title.slice(0, 50)}</span>
              {[80, 55, 35].map((w, i) => (
                <div key={i} style={{ height: 14, borderRadius: 4, background: theme.accent, opacity: 0.85 - i * 0.2, '--w': `${w}%`, width: `${w}%`, animation: `sePrevBar 1s ease-out ${0.3 + i * 0.3}s both` }} />
              ))}
            </div>
          ) : (
            <span style={{ fontSize: 15, color: '#fff', textAlign: 'center', lineHeight: 1.5, animation: 'sePrevText 0.8s ease-out forwards' }}>
              "{(scene.script_segment || title).slice(0, 110)}"
            </span>
          )}
        </div>
        <div style={{ position: 'absolute', bottom: 10, left: 0, right: 0, textAlign: 'center' }}>
          <span style={{ fontSize: 9, color: '#6b6b6b' }}>{TEMPLATE_ICONS[scene.template]} {scene.template} · gesimuleerde preview</span>
        </div>
        <button onClick={onClose} style={{ position: 'absolute', top: 8, right: 10, color: '#9ca3af', fontSize: 16 }}>✕</button>
      </div>
    </div>
  );
}

function SortableSceneCard({ scene, index, onChange, onDelete, t, theme, renderStyle, onPreview }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: scene._editorId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="rounded-xl border border-dark-700 bg-dark-800 p-4 mb-3">
      <div className="flex items-start gap-3">
        <button
          {...attributes}
          {...listeners}
          className="mt-1 text-gray-600 hover:text-gray-400 cursor-grab active:cursor-grabbing"
        >
          <GripVertical size={18} />
        </button>

        <ScenePreviewThumb scene={scene} theme={theme} onClick={onPreview} />

        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-mono text-xs w-16" style={{ color: '#6b6b6b' }}>
              {t('editor.scene.label', `Scène ${index + 1}`, { n: index + 1 })}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full shrink-0" style={{
              background: sceneCost(scene, renderStyle) === 'gratis' ? 'rgba(74,222,128,0.12)' : 'rgba(251,191,36,0.12)',
              color:      sceneCost(scene, renderStyle) === 'gratis' ? '#4ade80' : '#fbbf24',
            }}>
              {sceneCost(scene, renderStyle)}
            </span>
            <div className="relative flex-1">
              <select
                value={scene.template}
                onChange={e => onChange({ template: e.target.value })}
                className="w-full text-sm bg-dark-700 border border-dark-600 rounded-lg px-3 py-1.5 text-white appearance-none pr-8"
              >
                {TEMPLATE_OPTIONS.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <ChevronDown size={13} className="absolute right-2 top-2.5 text-gray-500 pointer-events-none" />
            </div>
          </div>

          <textarea
            value={scene.script_segment || ''}
            onChange={e => onChange({ script_segment: e.target.value })}
            rows={2}
            placeholder={t('editor.scene.placeholder', 'Scène tekst / ondertitel inhoud...')}
            className="w-full text-sm bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white resize-none placeholder-gray-600"
          />

          <div>
            <label className="text-xs text-gray-500 block mb-1">{t('editor.scene.visual_focus', 'Visueel onderwerp (voor AI-achtergrond)')}</label>
            <input
              type="text"
              value={scene.visual_focus || ''}
              onChange={e => onChange({ visual_focus: e.target.value })}
              placeholder={t('editor.scene.visual_focus_ph', 'bijv. ancient Roman colosseum at sunset')}
              className="w-full text-sm bg-dark-700 border border-dark-600 rounded-lg px-3 py-1.5 text-white placeholder-gray-600"
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer w-fit" title={t('editor.scene.skip_kie_hint', 'Deze scène rendert code-only (2D) — bespaart AI-credits')}>
            <input
              type="checkbox"
              checked={!!scene.skip_kie}
              onChange={e => onChange({ skip_kie: e.target.checked })}
              className="accent-red-600"
            />
            💰 {t('editor.scene.skip_kie', 'Skip AI-video (code-only, bespaart credits)')}
          </label>

          {scene.template === 'data_comparison' && scene.comparison && Array.isArray(scene.comparison.entries) && (
            <div className="rounded-lg bg-dark-900 border border-dark-600 p-3 space-y-1.5">
              <div className="heading-display text-xs mb-2" style={{ color: '#6b6b6b' }}>
                {t('editor.comparison.label', `Comparison · ${scene.comparison.type}`, { type: `${scene.comparison.type}${scene.comparison.unit ? ` (${scene.comparison.unit})` : ''}` })}
              </div>
              {scene.comparison.title && (
                <div className="text-mono text-xs italic mb-1" style={{ color: '#6b6b6b' }}>{scene.comparison.title}</div>
              )}
              {scene.comparison.entries.map((e, ei) => (
                <div key={ei} className="flex items-center gap-2 text-xs" style={{ color: '#6b6b6b' }}>
                  <span className="text-mono font-semibold" style={{ color: '#e8e3d8' }}>{e.value}{scene.comparison.unit ? ` ${scene.comparison.unit}` : ''}</span>
                  <span>— {e.label}</span>
                </div>
              ))}
            </div>
          )}

          {scene.template === 'fact_animation' && Array.isArray(scene.facts) && scene.facts.length > 0 && (
            <div className="rounded-lg bg-dark-900 border border-dark-600 p-3 space-y-1.5">
              <div className="heading-display text-xs mb-2" style={{ color: '#6b6b6b' }}>
                {t('editor.facts.label', 'Facts (read-only)')}
              </div>
              {scene.facts.map((f, fi) => (
                <div key={fi} className="flex items-start gap-2 text-xs" style={{ color: '#6b6b6b' }}>
                  <span className="text-mono shrink-0 rounded px-1.5 py-0.5 bg-dark-700 uppercase" style={{ color: '#6b6b6b' }}>{f.type}</span>
                  <span className="text-mono font-semibold" style={{ color: '#e8e3d8' }}>{f.value}{f.unit ? ` ${f.unit}` : ''}</span>
                  {f.subject && <span>— {f.subject}</span>}
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 w-10">{t('editor.duration.label', 'Duur')}</span>
            <input
              type="range"
              min={2}
              max={15}
              step={0.5}
              value={Math.round((scene.duration_frames || 90) / 30 * 2) / 2}
              onChange={e => onChange({ duration_frames: Math.round(parseFloat(e.target.value) * 30) })}
              className="flex-1 accent-red-600"
            />
            <span className="text-mono text-xs w-10 text-right" style={{ color: '#d4a017' }}>
              {(Math.round((scene.duration_frames || 90) / 30 * 2) / 2).toFixed(1)}s
            </span>
          </div>
        </div>

        <button
          onClick={onDelete}
          className="mt-1 text-gray-600 hover:text-red-400 transition-colors"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}

export default function SceneEditorPage({ job }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [scenes, setScenes] = useState(() =>
    (job.scenes || []).map((s, i) => ({ ...s, _editorId: `scene-${i}-${Date.now()}` }))
  );
  const [subtitleSettings, setSubtitleSettings] = useState(
    job.subtitle_settings || { enabled: true, fontSize: 'normaal', highlightColor: '#FFD700', position: 'onder', wordsPerLine: 3 }
  );
  const [voiceKey, setVoiceKey] = useState(job.voice_key || 'en_male');
  const [speakingStyle, setSpeakingStyle] = useState(job.speaking_style || 'neutral');
  const [musicMode, setMusicMode] = useState(job.mode || 'documentary');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const [addTemplate, setAddTemplate] = useState('ken_burns');
  const [previewScene, setPreviewScene] = useState(null);
  const theme = EDITOR_THEMES[job.color_theme] || EDITOR_THEMES.default;

  const sensors = useSensors(useSensor(PointerSensor));

  function handleDragEnd(event) {
    const { active, over } = event;
    if (active.id !== over?.id) {
      const oldIdx = scenes.findIndex(s => s._editorId === active.id);
      const newIdx = scenes.findIndex(s => s._editorId === over.id);
      setScenes(arrayMove(scenes, oldIdx, newIdx));
    }
  }

  function updateScene(idx, patch) {
    setScenes(prev => prev.map((s, i) => i === idx ? { ...s, ...patch } : s));
  }

  function deleteScene(idx) {
    if (scenes.length <= 1) return;
    setScenes(prev => prev.filter((_, i) => i !== idx));
  }

  function addScene() {
    setScenes(prev => [...prev, {
      _editorId:      `scene-new-${Date.now()}`,
      template:       addTemplate,
      script_segment: '',
      duration_frames: 90,
      content:        {},
    }]);
  }

  async function handleStart() {
    setLoading(true);
    setError(null);
    try {
      const cleanScenes = scenes.map(({ _editorId, ...s }) => s);

      await axios.put(`/api/render/${job.id}/scenes`, {
        scenes:            cleanScenes,
        subtitle_settings: { ...subtitleSettings },
        voice_key:         voiceKey,
        speaking_style:    speakingStyle,
        music_url:         `/assets/music/${musicMode}.mp3`,
      });

      await axios.post(`/api/render/${job.id}/continue`);
      navigate(`/jobs/${job.id}`);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full min-h-screen">
      {previewScene && <ScenePreviewModal scene={previewScene} theme={theme} onClose={() => setPreviewScene(null)} />}
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-2xl mx-auto">
          <h1 className="heading-display text-2xl font-bold mb-1">{t('editor.title', 'Scène Editor')}</h1>
          <p className="text-gray-400 text-sm mb-6">
            {t('editor.subtitle', 'Versleep, bewerk of verwijder scènes voor je render start.')}
          </p>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={scenes.map(s => s._editorId)} strategy={verticalListSortingStrategy}>
              {scenes.map((scene, i) => (
                <div key={scene._editorId}>
                  {scene.chapter && scene.chapter !== scenes[i - 1]?.chapter && (
                    <div className="flex items-center gap-2 mt-4 mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#d4a017' }}>
                        📖 {scene.chapter}
                      </span>
                      <div className="flex-1 h-px bg-dark-700" />
                    </div>
                  )}
                  <SortableSceneCard
                    scene={scene}
                    index={i}
                    onChange={patch => updateScene(i, patch)}
                    onDelete={() => deleteScene(i)}
                    t={t}
                    theme={theme}
                    renderStyle={job.render_style || 'ai-cinematic'}
                    onPreview={() => setPreviewScene(scene)}
                  />
                </div>
              ))}
            </SortableContext>
          </DndContext>

          <div className="flex gap-2 mt-2 mb-8">
            <div className="relative">
              <select
                value={addTemplate}
                onChange={e => setAddTemplate(e.target.value)}
                className="text-sm bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white appearance-none pr-8"
              >
                {TEMPLATE_OPTIONS.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <ChevronDown size={13} className="absolute right-2 top-3 text-gray-500 pointer-events-none" />
            </div>
            <button
              onClick={addScene}
              className="btn-secondary flex items-center gap-2 text-sm"
            >
              <Plus size={15} /> {t('editor.btn.add_scene', 'Scène toevoegen')}
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-900/30 border border-red-700/50 text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleStart}
            disabled={loading || scenes.length === 0}
            className="btn-primary w-full flex items-center justify-center gap-3 py-4 rounded-xl font-bold text-lg"
          >
            {loading
              ? <><span className="animate-spin">⏳</span> {t('editor.btn.starting', 'Starten...')}</>
              : <><Play size={20} fill="currentColor" /> {t('editor.btn.start', 'Render Starten')}</>
            }
          </button>
        </div>
      </div>

      <div className="w-72 border-l border-dark-700 p-5 overflow-y-auto bg-dark-800 space-y-6">
        <div>
          <h3 className="heading-display text-sm mb-3">{t('editor.subtitles.title', 'Ondertitels')}</h3>
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={subtitleSettings.enabled}
                onChange={e => setSubtitleSettings(s => ({ ...s, enabled: e.target.checked }))}
                className="accent-red-600"
              />
              {t('editor.subtitles.enabled', 'Ingeschakeld')}
            </label>

            <div>
              <label className="text-xs text-gray-500 block mb-1">{t('editor.subtitles.size', 'Lettergrootte')}</label>
              <select
                value={subtitleSettings.fontSize}
                onChange={e => setSubtitleSettings(s => ({ ...s, fontSize: e.target.value }))}
                className="w-full text-sm bg-dark-700 border border-dark-600 rounded-lg px-3 py-1.5 text-white"
              >
                <option value="klein">{t('studio.subtitle.size.klein', 'Klein')}</option>
                <option value="normaal">{t('studio.subtitle.size.normaal', 'Normaal')}</option>
                <option value="groot">{t('studio.subtitle.size.groot', 'Groot')}</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-500 block mb-1">{t('editor.subtitles.words_per_line', 'Woorden per regel')}</label>
              <select
                value={subtitleSettings.wordsPerLine ?? 3}
                onChange={e => setSubtitleSettings(s => ({ ...s, wordsPerLine: e.target.value === 'random' ? 'random' : parseInt(e.target.value) }))}
                className="w-full text-sm bg-dark-700 border border-dark-600 rounded-lg px-3 py-1.5 text-white"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                  <option key={n} value={n}>
                    {n} {n === 1 ? t('editor.subtitles.word', 'woord') : t('editor.subtitles.words', 'woorden')}
                  </option>
                ))}
                <option value="random">🎲 {t('editor.subtitles.random', 'Willekeurig (2-6)')}</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-500 block mb-1">{t('editor.subtitles.highlight', 'Markeerkleur')}</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={subtitleSettings.highlightColor}
                  onChange={e => setSubtitleSettings(s => ({ ...s, highlightColor: e.target.value }))}
                  className="w-10 h-8 rounded cursor-pointer bg-transparent border-0"
                />
                <span className="text-mono text-xs" style={{ color: '#6b6b6b' }}>{subtitleSettings.highlightColor}</span>
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-500 block mb-1">{t('editor.subtitles.position', 'Positie')}</label>
              <select
                value={subtitleSettings.position}
                onChange={e => setSubtitleSettings(s => ({ ...s, position: e.target.value }))}
                className="w-full text-sm bg-dark-700 border border-dark-600 rounded-lg px-3 py-1.5 text-white"
              >
                <option value="onder">{t('editor.subtitles.bottom', 'Onderaan')}</option>
                <option value="midden">{t('editor.subtitles.middle', 'Midden')}</option>
              </select>
            </div>
          </div>
        </div>

        <div>
          <h3 className="heading-display text-sm mb-3">{t('editor.speaking_style.label', 'Spreekstijl')}</h3>
          <select
            value={speakingStyle}
            onChange={e => setSpeakingStyle(e.target.value)}
            className="w-full text-sm bg-dark-700 border border-dark-600 rounded-lg px-3 py-1.5 text-white"
          >
            <option value="neutral">{t('editor.speaking_style.neutral', '🎙️ Neutraal (standaard)')}</option>
            <option value="conversational">{t('editor.speaking_style.conversational', '💬 Conversational — klinkt als praten, niet voorlezen')}</option>
            <option value="dramatic">{t('editor.speaking_style.dramatic', '🎭 Dramatisch — trager, meer expressie')}</option>
            <option value="energetic">{t('editor.speaking_style.energetic', '⚡ Energiek — sneller, levendiger')}</option>
          </select>
        </div>

        <div>
          <h3 className="heading-display text-sm mb-3">{t('editor.music.label', 'Muziekstijl')}</h3>
          <select
            value={musicMode}
            onChange={e => setMusicMode(e.target.value)}
            className="w-full text-sm bg-dark-700 border border-dark-600 rounded-lg px-3 py-1.5 text-white"
          >
            {MUSIC_OPTIONS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>

        <div className="pt-4 border-t border-dark-700 text-xs space-y-1" style={{ color: '#6b6b6b' }}>
          <div className="flex justify-between">
            <span>{t('editor.stats.scenes', 'Scènes')}</span>
            <span className="text-mono" style={{ color: '#e8e3d8' }}>{scenes.length}</span>
          </div>
          <div className="flex justify-between">
            <span>{t('editor.stats.duration', 'Totale duur')}</span>
            <span className="text-mono" style={{ color: '#e8e3d8' }}>
              {scenes.reduce((total, s) => total + (s.duration_frames || 90) / 30, 0).toFixed(1)}s
            </span>
          </div>
          <div className="flex justify-between">
            <span>{t('editor.stats.job_id', 'Job ID')}</span>
            <span className="text-mono" style={{ color: '#6b6b6b' }}>{job.id.slice(0, 8)}…</span>
          </div>
        </div>
      </div>
    </div>
  );
}
