import React from 'react';
import { AbsoluteFill, Audio, useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { CinematicTitle }   from './templates/CinematicTitle';
import { KenBurns }         from './templates/KenBurns';
import { AnimatedMap }      from './templates/AnimatedMap';
import { Timeline }         from './templates/Timeline';
import { StatsCounter }     from './templates/StatsCounter';
import { OutroCTA }         from './templates/OutroCTA';
import { FactAnimation }    from './templates/FactAnimation';
import { DataComparison }   from './templates/DataComparison';
import { CinematicTitle2D } from './templates/CinematicTitle2D';
import { OutroCTA2D }       from './templates/OutroCTA2D';
import { TextFocus2D }      from './templates/TextFocus2D';
import { StaticMap2D }      from './templates/StaticMap2D';
import { SubtitleOverlay }     from './SubtitleOverlay';
import { EpicSubtitleOverlay } from './EpicSubtitleOverlay';
import { ColorTheme, getTheme } from './colorThemes';
import { FilmGrainOverlay } from './FilmGrainOverlay';

const TRANSITION_FRAMES = 12; // 0.4s bij 30fps

// Flash duration (frames) and peak opacity for transition flash
const FLASH_FRAMES       = 8;
const FLASH_PEAK_OPACITY = 0.3;

interface Scene {
  template:              string;
  duration_frames:       number;
  content:               Record<string, any>;
  background_video_url?: string | null;
  background_image_url?: string | null;
  script_segment?:       string;
  facts?:                any[] | null;
  comparison?:           any | null;
}

interface WordTiming {
  word:       string;
  start_time: number;
  end_time:   number;
}

interface SubtitleSettings {
  enabled:        boolean;
  fontSize:       'klein' | 'normaal' | 'groot';
  highlightColor: string;
  position:       'onder' | 'midden';
  wordsPerLine?:  number;
  subtitleStyle?: 'classic' | 'karaoke-box';
}

interface VfxSettings {
  vignette:         boolean;
  transitionFlash:  boolean;
  filmGrain:        boolean;
  zoomPunch?:       boolean;
  cameraShake?:     boolean;
}

const DEFAULT_VFX: VfxSettings = {
  vignette:        true,
  transitionFlash: true,
  filmGrain:       true,
  zoomPunch:       true,
  cameraShake:     true,
};

interface Props {
  scenes:                Scene[];
  audioUrl?:             string | null;
  musicUrl?:             string | null;
  sfxUrl?:               string | null;
  wordTimings:           WordTiming[];
  subtitleSettings:      SubtitleSettings;
  mode?:                 string;
  totalDurationInFrames: number;
  renderStyle?:          string;      // 'ai-cinematic' | '2d'
  colorTheme?:           ColorTheme | null;
  vfxSettings?:          VfxSettings;
}

// ── Zoom-punch wrapper — schaal van 1.04 → 1.0 over eerste 5 frames van elke scene ──
function ZoomPunchWrapper({ enabled, fps, children }: { enabled: boolean; fps: number; children: React.ReactNode }) {
  const frame = useCurrentFrame();
  if (!enabled) return <>{children}</>;
  const scale = interpolate(
    spring({ frame, fps, config: { damping: 200 } }),
    [0, 1],
    [1.04, 1.0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );
  return (
    <AbsoluteFill style={{ transform: `scale(${scale})`, transformOrigin: 'center center' }}>
      {children}
    </AbsoluteFill>
  );
}

// ── AI-cinematic template map ─────────────────────────────────────────────────
const TEMPLATE_MAP: Record<string, React.ComponentType<any>> = {
  cinematic_title: CinematicTitle,
  ken_burns:       KenBurns,
  animated_map:    AnimatedMap,
  timeline:        Timeline,
  stats_counter:   StatsCounter,
  outro_cta:       OutroCTA,
  fact_animation:  FactAnimation,
  data_comparison: DataComparison,
  text_focus_2d:   TextFocus2D,   // simple-mode fallback wanneer KIE credits op zijn
};

// ── 2D template map — code-only, geen kie.ai ─────────────────────────────────
const TEMPLATE_MAP_2D: Record<string, React.ComponentType<any>> = {
  cinematic_title: CinematicTitle2D,
  ken_burns:       TextFocus2D,
  animated_map:    StaticMap2D,
  timeline:        TextFocus2D,   // Ronde 3: Timeline2D
  stats_counter:   StatsCounter,
  outro_cta:       OutroCTA2D,
  fact_animation:  FactAnimation,
  data_comparison: DataComparison,
};

export function VaultMotionVideo({ scenes, audioUrl, musicUrl, sfxUrl, wordTimings, subtitleSettings, mode, totalDurationInFrames, renderStyle, colorTheme, vfxSettings }: Props) {
  const frame  = useCurrentFrame();
  const { fps } = useVideoConfig();
  const isEpic = mode === 'epic';
  const is2D   = renderStyle === '2d';
  const theme  = is2D ? (colorTheme ?? getTheme('default')) : null;
  const map    = is2D ? TEMPLATE_MAP_2D : TEMPLATE_MAP;
  const vfx    = { ...DEFAULT_VFX, ...vfxSettings };

  if (!scenes || scenes.length === 0) {
    return (
      <AbsoluteFill style={{ backgroundColor: '#0f0f0f', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#e53e3e', fontSize: 48, fontFamily: 'Impact' }}>VaultMotion</div>
      </AbsoluteFill>
    );
  }

  // ── Transition flash: compute opacity at current frame ─────────────────────
  let flashOpacity = 0;
  if (vfx.transitionFlash) {
    let acc = 0;
    for (let i = 0; i < scenes.length - 1; i++) {
      acc += scenes[i].duration_frames || 90;
      const mid  = acc + Math.floor(TRANSITION_FRAMES / 2);
      const dist = Math.abs(frame - mid);
      if (dist <= FLASH_FRAMES / 2) {
        const t = dist / (FLASH_FRAMES / 2);
        flashOpacity = Math.max(flashOpacity, Math.cos(t * Math.PI / 2) * FLASH_PEAK_OPACITY);
      }
    }
  }

  // ── Camera shake: local frame offset per scene (epic only) ─────────────────
  // Compute which scene we're in and the local frame within that scene.
  let cameraShakeX = 0;
  let cameraShakeY = 0;
  if (vfx.cameraShake && isEpic) {
    let accShake = 0;
    let localFrame = frame;
    for (let i = 0; i < scenes.length; i++) {
      const dur = scenes[i].duration_frames || 90;
      if (frame < accShake + dur) {
        localFrame = frame - accShake;
        break;
      }
      accShake += dur;
    }
    const decay  = Math.exp(-localFrame * 0.08);
    cameraShakeX = Math.sin(localFrame * 0.7) * 2 * decay;
    cameraShakeY = Math.sin(localFrame * 1.1) * 1.5 * decay;
  }

  return (
    <AbsoluteFill style={{ backgroundColor: '#0f0f0f' }}>
      {audioUrl && <Audio src={audioUrl} startFrom={0} volume={1} />}
      {musicUrl && (
        <Audio
          src={musicUrl}
          startFrom={0}
          loop
          volume={interpolate(
            frame,
            [0, 15, totalDurationInFrames - 15, totalDurationInFrames],
            [0.15, 0.05, 0.05, 0.15],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
          )}
        />
      )}

      {/* ── Scene content (camera-shake wrapper voor epic mode) ──────────── */}
      <AbsoluteFill
        style={{
          transform: (vfx.cameraShake && isEpic)
            ? `translateX(${cameraShakeX}px) translateY(${cameraShakeY}px)`
            : undefined,
        }}
      >
        <TransitionSeries>
          {scenes.map((scene, i) => {
            const TemplateComponent = map[scene.template] || (is2D ? TextFocus2D : CinematicTitle);
            const baseDur  = scene.duration_frames || 90;
            const isLast   = i === scenes.length - 1;
            const seqDur   = isLast ? baseDur : baseDur + TRANSITION_FRAMES;

            return (
              <React.Fragment key={i}>
                <TransitionSeries.Sequence durationInFrames={seqDur}>
                  <ZoomPunchWrapper enabled={vfx.zoomPunch ?? false} fps={fps}>
                    <TemplateComponent
                      content={{ ...(scene.content || {}), facts: scene.facts || [], comparison: scene.comparison || null }}
                      backgroundVideoUrl={scene.background_video_url || null}
                      backgroundImageUrl={scene.background_image_url || null}
                      durationInFrames={baseDur}
                      sfxUrl={sfxUrl || null}
                      {...(is2D ? { colorTheme: theme, sceneIndex: i } : {})}
                    />
                  </ZoomPunchWrapper>
                </TransitionSeries.Sequence>

                {!isLast && (
                  <TransitionSeries.Transition
                    presentation={fade()}
                    timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
                  />
                )}
              </React.Fragment>
            );
          })}
        </TransitionSeries>
      </AbsoluteFill>

      {/* ── VFX overlays (compositie-breed, boven alle scenes) ─────────────── */}

      {/* 1. Globale vignette — altijd bovenop elke scene */}
      {vfx.vignette && (
        <AbsoluteFill
          style={{
            background:    'radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.55) 100%)',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* 2. Transition flash — witte puls op scene-overgangsmomenten */}
      {vfx.transitionFlash && flashOpacity > 0 && (
        <AbsoluteFill
          style={{
            backgroundColor: '#ffffff',
            opacity:         flashOpacity,
            pointerEvents:   'none',
          }}
        />
      )}

      {/* 3. Film grain overlay — noise2D-gedreven, overlay blend mode */}
      <FilmGrainOverlay enabled={vfx.filmGrain} />

      {/* ── Subtitles (boven VFX overlays) ────────────────────────────────── */}
      {subtitleSettings?.enabled && wordTimings?.length > 0 && (
        isEpic ? (
          <EpicSubtitleOverlay wordTimings={wordTimings} currentFrame={frame} settings={subtitleSettings} />
        ) : (
          <SubtitleOverlay wordTimings={wordTimings} currentFrame={frame} settings={subtitleSettings} />
        )
      )}
    </AbsoluteFill>
  );
}
