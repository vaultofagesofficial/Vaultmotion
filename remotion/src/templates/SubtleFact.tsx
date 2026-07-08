/**
 * SubtleFact.tsx — vervanger van FactAnimation bij AI-achtergronden.
 * Bij render-stijlen met een AI-achtergrond (simple/hybrid/ai-cinematic/ai-image)
 * domineerde de grote FactAnimation-tekst het beeld én dubbelde hij met de
 * ondertitels. Deze variant toont het AI-beeld full-bleed met een kleine,
 * transparante tekstregel die rustig in-fadet — de ondertitels onderaan blijven
 * de primaire tekstbron.
 */
import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, OffthreadVideo, Img } from 'remotion';

interface Props {
  content: {
    title?: string;
    text?: string;
    facts?: any[];
  };
  backgroundVideoUrl?: string | null;
  backgroundImageUrl?: string | null;
  durationInFrames: number;
  sfxUrl?: string | null;
}

const SAFE_TOP   = 150;
const SAFE_SIDES = 60;

export function SubtleFact({ content, backgroundVideoUrl, backgroundImageUrl, durationInFrames }: Props) {
  const frame  = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Kies de kortste zinvolle tekstregel: een feit-waarde of de titel
  const fact = content?.facts?.[0];
  const label = fact && fact.value !== undefined
    ? `${fact.value}${fact.unit ? ` ${fact.unit}` : ''}${fact.subject ? ` — ${fact.subject}` : ''}`
    : (content?.title || content?.text || '');

  const appear = spring({ frame: Math.max(0, frame - 8), fps, config: { damping: 200 } });
  const fadeOut = interpolate(
    frame,
    [durationInFrames - 20, durationInFrames - 6],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  return (
    <AbsoluteFill style={{ backgroundColor: '#0f0f0f' }}>
      {backgroundVideoUrl ? (
        <OffthreadVideo src={backgroundVideoUrl} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : backgroundImageUrl ? (
        <Img src={backgroundImageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <AbsoluteFill style={{ background: 'linear-gradient(160deg, #16161d 0%, #0f0f0f 100%)' }} />
      )}

      {/* Lichte gradient bovenaan zodat de tekst leesbaar blijft zonder het beeld te domineren */}
      {label ? (
        <AbsoluteFill style={{ pointerEvents: 'none' }}>
          <div style={{
            position:   'absolute',
            top:        SAFE_TOP,
            left:       SAFE_SIDES,
            right:      SAFE_SIDES,
            display:    'flex',
            justifyContent: 'center',
            opacity:    appear * 0.88 * fadeOut,
            transform:  `translateY(${(1 - appear) * -14}px)`,
          }}>
            <span style={{
              fontFamily:      '"Anton", "Impact", "Arial Black", sans-serif',
              fontSize:        46,
              fontWeight:      400,
              letterSpacing:   1.5,
              textTransform:   'uppercase',
              color:           '#ffffff',
              textAlign:       'center',
              lineHeight:      1.25,
              padding:         '10px 22px',
              borderRadius:    12,
              background:      'rgba(0,0,0,0.38)',
              backdropFilter:  'blur(4px)',
              textShadow:      '0 2px 12px rgba(0,0,0,0.8)',
              maxWidth:        '100%',
            }}>
              {label}
            </span>
          </div>
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
}
