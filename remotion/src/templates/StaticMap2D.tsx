import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';
import { ColorTheme, getTheme } from '../colorThemes';

interface Props {
  content:          Record<string, any>;
  backgroundVideoUrl?: string | null;
  durationInFrames: number;
  colorTheme?:      ColorTheme;
  sceneIndex?:      number;
}

// Continent polygon points (1000×500 Mercator viewport)
const CONTINENT_POLYGONS: Record<string, string> = {
  north_america: '33,75 80,50 160,42 250,38 320,45 356,62 358,90 340,120 330,155 310,185 270,205 230,215 185,220 150,205 110,185 80,160 55,140 38,115 30,90',
  south_america: '220,215 272,215 310,230 345,255 358,285 350,330 325,375 290,405 260,415 230,410 200,390 185,360 180,320 188,280 200,250',
  europe:        '472,56 490,44 520,40 545,45 568,55 580,68 582,88 568,108 548,120 525,130 505,135 480,130 460,118 452,100 454,76',
  africa:        '450,145 485,138 525,135 565,140 600,155 622,175 638,210 640,250 630,295 610,335 578,350 540,355 500,345 465,320 448,290 438,250 440,195',
  middle_east:   '569,128 608,120 645,126 666,140 676,158 668,195 645,212 610,218 578,210 558,192 546,168 551,142',
  asia:          '569,26 650,20 750,16 850,18 960,22 1000,40 1000,250 960,268 900,280 850,285 800,278 760,258 745,225 730,190 718,155 695,138 666,130 638,120 610,112 590,96 575,72',
  oceania:       '818,252 870,240 920,245 960,255 985,272 988,295 965,330 930,355 885,365 845,360 810,340 792,315 788,285',
};

// Region → which continents to highlight + pulse dot position [cx, cy] in 1000×500
const REGION_CONFIG: Record<string, { highlight: string[]; dot: [number, number]; label: string }> = {
  north_america: { highlight: ['north_america'],                        dot: [190, 130], label: 'NORTH AMERICA' },
  south_america: { highlight: ['south_america'],                        dot: [270, 315], label: 'SOUTH AMERICA' },
  europe:        { highlight: ['europe'],                               dot: [520, 88],  label: 'EUROPE'        },
  africa:        { highlight: ['africa'],                               dot: [538, 248], label: 'AFRICA'        },
  middle_east:   { highlight: ['middle_east'],                          dot: [612, 168], label: 'MIDDLE EAST'  },
  asia:          { highlight: ['asia', 'middle_east'],                  dot: [752, 148], label: 'ASIA'          },
  oceania:       { highlight: ['oceania'],                              dot: [890, 302], label: 'OCEANIA'       },
  world:         { highlight: Object.keys(CONTINENT_POLYGONS),          dot: [500, 250], label: 'WORLD'         },
};

const GREY_FILL = '#252525';
const GREY_STROKE = '#3a3a3a';

export function StaticMap2D({ content, durationInFrames, colorTheme }: Props) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = colorTheme ?? getTheme('default');

  const region    = (content?.map_region || 'world') as string;
  const config    = REGION_CONFIG[region] ?? REGION_CONFIG['world'];
  const locationLabel = content?.location || config.label;
  const scriptText    = content?.script_segment || content?.title || '';

  // ── Animaties ─────────────────────────────────────────────────────────────
  const mapSpring  = spring({ frame, fps, config: { damping: 200 } });
  const mapOp      = interpolate(mapSpring, [0, 1], [0, 1]);
  const mapY       = interpolate(mapSpring, [0, 1], [30, 0]);

  const labelSpring = spring({ frame: frame - 4, fps, config: { damping: 160 } });
  const labelOp     = interpolate(labelSpring, [0, 1], [0, 1]);

  const textSpring = spring({ frame: frame - 10, fps, config: { damping: 180 } });
  const textOp     = interpolate(textSpring, [0, 1], [0, 1]);
  const textY      = interpolate(textSpring, [0, 1], [40, 0]);

  // Pulserende stip — sinusgolf
  const pulse = 1 + 0.22 * Math.sin(frame * 0.22);
  const dotOp = interpolate(frame, [8, 20], [0, 1], { extrapolateRight: 'clamp' });

  const barOp  = interpolate(frame, [0, 8],  [0, 1], { extrapolateRight: 'clamp' });
  const lineW  = interpolate(frame, [4, 22], [0, 180], { extrapolateRight: 'clamp' });

  // ── Map viewport schaling naar 1080 breedte ──────────────────────────────
  // SVG is 1000×500; we tonen hem op 960px breed gecentreerd → 960/1000=0.96 scale, height=480
  const MAP_W = 960;
  const MAP_H = 480;
  const MAP_X = (1080 - MAP_W) / 2; // 60px zijmarge

  return (
    <AbsoluteFill style={{ backgroundColor: theme.bg, overflow: 'hidden' }}>
      {/* Linker accentbalk */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 8,
        backgroundColor: theme.primary,
        opacity: barOp,
      }} />

      {/* Regio-label bovenaan */}
      <div style={{
        position: 'absolute', left: 60, top: 160,
        opacity: labelOp,
      }}>
        <div style={{
          color: theme.accent, fontSize: 28, fontFamily: 'Impact',
          letterSpacing: 6, textTransform: 'uppercase',
        }}>
          {locationLabel}
        </div>
        <div style={{
          width: lineW, height: 3, backgroundColor: theme.primary,
          borderRadius: 2, marginTop: 10,
        }} />
      </div>

      {/* Kaart SVG */}
      <div style={{
        position: 'absolute',
        left: MAP_X, top: 280,
        width: MAP_W, height: MAP_H,
        opacity: mapOp,
        transform: `translateY(${mapY}px)`,
      }}>
        <svg
          viewBox="0 0 1000 500"
          width={MAP_W}
          height={MAP_H}
          style={{ display: 'block' }}
        >
          {/* Graticule */}
          <g stroke="#1a1a1a" strokeWidth="0.5" fill="none">
            <line x1="0" y1="125" x2="1000" y2="125"/>
            <line x1="0" y1="250" x2="1000" y2="250"/>
            <line x1="0" y1="375" x2="1000" y2="375"/>
            <line x1="250" y1="0"  x2="250"  y2="500"/>
            <line x1="500" y1="0"  x2="500"  y2="500"/>
            <line x1="750" y1="0"  x2="750"  y2="500"/>
          </g>

          {/* Continenten — grijs, niet gehighlight */}
          {Object.entries(CONTINENT_POLYGONS).map(([id, pts]) => {
            const isHighlighted = config.highlight.includes(id);
            return (
              <polygon
                key={id}
                points={pts}
                fill={isHighlighted ? theme.accent : GREY_FILL}
                stroke={isHighlighted ? theme.accent : GREY_STROKE}
                strokeWidth={isHighlighted ? 1.5 : 0.5}
                opacity={isHighlighted ? 0.85 : 1}
              />
            );
          })}

          {/* Pulserende stip op regio-middelpunt */}
          {region !== 'world' && (
            <>
              {/* Buitenste ring (pulse) */}
              <circle
                cx={config.dot[0]}
                cy={config.dot[1]}
                r={12 * pulse}
                fill="none"
                stroke={theme.accent}
                strokeWidth={1.5}
                opacity={dotOp * 0.5}
              />
              {/* Kern */}
              <circle
                cx={config.dot[0]}
                cy={config.dot[1]}
                r={5}
                fill={theme.accent}
                opacity={dotOp}
              />
            </>
          )}
        </svg>
      </div>

      {/* Script tekst in het lege middenvlak — onderaan botste hij met de ondertitels */}
      <div style={{
        position: 'absolute',
        left: 60, right: 60, top: '52%',
        textAlign: 'center',
        opacity: textOp,
        transform: `translateY(${textY}px)`,
      }}>
        <div style={{
          color: theme.text, fontSize: 44, fontFamily: 'Impact',
          lineHeight: 1.3, letterSpacing: 0.5,
        }}>
          {scriptText}
        </div>
      </div>
    </AbsoluteFill>
  );
}
