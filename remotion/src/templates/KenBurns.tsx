import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, OffthreadVideo, Img } from 'remotion';

interface Props {
  content: { title?: string; text?: string; image_url?: string };
  backgroundVideoUrl?: string | null;
  backgroundImageUrl?: string | null;
  durationInFrames: number;
}

export function KenBurns({ content, backgroundVideoUrl, backgroundImageUrl, durationInFrames }: Props) {
  const frame = useCurrentFrame();

  const scale      = interpolate(frame, [0, durationInFrames], [1.0, 1.15], { extrapolateRight: 'clamp' });
  const translateX = interpolate(frame, [0, durationInFrames], [0, -3],    { extrapolateRight: 'clamp' });
  // Kleurovergang donkerblauw → donkerpaars over de tijd
  const blueR = 5, blueG = 15, blueB = 60;
  const redR = 55, redG = 5, redB = 80;
  const t = interpolate(frame, [0, durationInFrames], [0, 1], { extrapolateRight: 'clamp' });
  const r1 = Math.round(blueR + (redR - blueR) * t);
  const g1 = Math.round(blueG + (redG - blueG) * t);
  const b1 = Math.round(blueB + (redB - blueB) * t);
  const r2 = Math.round(r1 * 0.3);
  const g2 = Math.round(g1 * 0.3);
  const b2 = Math.round(b1 * 0.3);

  // Lichstraal die langzaam beweegt
  const rayX = interpolate(frame, [0, durationInFrames], [20, 80], { extrapolateRight: 'clamp' });
  const _rayFade   = Math.min(30, Math.floor(durationInFrames / 3));
  const rayOpacity = interpolate(frame, [0, _rayFade, durationInFrames - _rayFade, durationInFrames], [0, 0.15, 0.15, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ backgroundColor: `rgb(${r2},${g2},${b2})`, overflow: 'hidden' }}>
      {/* Geanimeerde gradient achtergrond */}
      <div style={{
        position: 'absolute', inset: '-10%',
        transform: `scale(${scale}) translateX(${translateX}%)`,
        transformOrigin: 'center center',
      }}>
        {backgroundImageUrl ? (
          <Img src={backgroundImageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : backgroundVideoUrl ? (
          <OffthreadVideo src={backgroundVideoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{
            width: '100%', height: '100%',
            background: `linear-gradient(135deg, rgb(${r1},${g1},${b1}) 0%, rgb(${r2},${g2},${b2}) 60%, rgb(${Math.round(r1*0.5)},${g2},${Math.round(b1*0.8)}) 100%)`
          }} />
        )}
      </div>

      {(backgroundImageUrl || backgroundVideoUrl) && (
        <AbsoluteFill style={{ backgroundColor: 'rgba(0,0,0,0.45)' }} />
      )}

      {/* Bewegende lichstraal */}
      <AbsoluteFill style={{ opacity: rayOpacity }}>
        <div style={{
          position: 'absolute',
          left: `${rayX}%`,
          top: 0,
          width: 3,
          height: '100%',
          background: 'linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.6) 50%, transparent 100%)',
          filter: 'blur(20px)',
          transform: 'rotate(-15deg)',
          transformOrigin: 'top center'
        }} />
      </AbsoluteFill>

      {/* Diagonale lichtbalken */}
      {[15, 35, 60, 78].map((pos, i) => (
        <div key={i} style={{
          position: 'absolute',
          left: `${pos}%`, top: 0,
          width: 1, height: '100%',
          background: `linear-gradient(180deg, transparent, rgba(255,255,255,${0.03 + i * 0.01}), transparent)`,
          transform: 'rotate(-20deg) scaleY(1.5)',
          transformOrigin: 'top'
        }} />
      ))}

    </AbsoluteFill>
  );
}
