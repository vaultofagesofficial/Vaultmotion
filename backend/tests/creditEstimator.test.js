/**
 * Unit tests voor de business-kritieke creditraming (CLAUDE.md §1.3).
 *
 * Deze suite bewijst:
 *  - de exacte kost per render_style,
 *  - dat gratis stijlen aantoonbaar €0 kosten,
 *  - dat SKIP-templates en per-scène skip_kie niet meetellen,
 *  - de monotonie-invariant: een premium-stijl kost MEER dan de stijl
 *    waarvan hij een superset is (dit ging al eens fout — zie CLAUDE.md).
 *
 * Puur en side-effect-vrij: geen netwerk, geen kie.ai, geen render.
 */

import { describe, it, expect } from 'vitest';
import creditEstimator from '../src/services/creditEstimator.js';

const { estimateJobCredits, SKIP_TEMPLATES } = creditEstimator;

// ── Scène-fabrieken ────────────────────────────────────────────────────────
const scene = (over = {}) => ({ template: 'cinematic_scene', ...over });
const title = (over = {}) => ({ template: 'cinematic_title', ...over });
const outro = (over = {}) => ({ template: 'outro_cta', ...over });

/** n gewone (betaalde) videoscènes. */
const videoScenes = (n) => Array.from({ length: n }, () => scene());

describe('estimateJobCredits — gratis stijlen', () => {
  it('stock kost altijd 0 credits, ongeacht scèneaantal', () => {
    expect(estimateJobCredits(videoScenes(8), 'stock')).toBe(0);
  });

  it('2d (interne mechaniek) kost 0 credits', () => {
    expect(estimateJobCredits(videoScenes(8), '2d')).toBe(0);
  });

  it('gratis stijl blijft 0 zelfs met facts-only scènes', () => {
    const scenes = [scene(), { template: 'stats_counter' }, { template: 'fact_animation' }];
    expect(estimateJobCredits(scenes, 'stock')).toBe(0);
  });
});

describe('estimateJobCredits — betaalde stijlen (exacte kost)', () => {
  it('ai-image = 5 credits per videoscène (enkel T2I)', () => {
    expect(estimateJobCredits(videoScenes(4), 'ai-image')).toBe(20);
  });

  it('illustrated = 5 credits per videoscène (alias van ai-image-mechaniek)', () => {
    expect(estimateJobCredits(videoScenes(4), 'illustrated')).toBe(20);
  });

  it('simple = 75 credits per videoscène (T2I 5 + Kling 70)', () => {
    expect(estimateJobCredits(videoScenes(4), 'simple')).toBe(300);
  });

  it('director = 15 (character sheet) + 75 per videoscène', () => {
    expect(estimateJobCredits(videoScenes(4), 'director')).toBe(15 + 300);
  });

  it('director kost 15 credits ook zonder betaalde scènes (character sheet)', () => {
    expect(estimateJobCredits([{ template: 'fact_animation' }], 'director')).toBe(15);
  });
});

describe('estimateJobCredits — ai-cinematic / visuele presets (default-tak)', () => {
  it('titels kosten 70 (Kling), overige videoscènes 30 (Seedance), + 5 anker', () => {
    // 1 title (70) + 1 outro (70) + 3 gewone scènes (30 elk) + 5 anker
    const scenes = [title(), ...videoScenes(3), outro()];
    expect(estimateJobCredits(scenes, 'ai-cinematic')).toBe(5 + 2 * 70 + 3 * 30);
  });

  it('onbekende/preset stijlnaam valt in dezelfde default-tak', () => {
    const scenes = [title(), ...videoScenes(2)];
    const expected = 5 + 1 * 70 + 2 * 30;
    for (const style of ['cinematic_noir', 'documentary', 'social_media_fast', 'luxury']) {
      expect(estimateJobCredits(scenes, style)).toBe(expected);
    }
  });
});

describe('estimateJobCredits — hybrid intensiteiten', () => {
  const scenes = videoScenes(10); // n = 10

  it('low = enkel titel + outro → 2 kie-scènes × 75', () => {
    expect(estimateJobCredits(scenes, 'hybrid', 'low')).toBe(2 * 75);
  });

  it('high = alle scènes via kie → n × 75', () => {
    expect(estimateJobCredits(scenes, 'hybrid', 'high')).toBe(10 * 75);
  });

  it('medium = ceil(n/2)+2, geplafonneerd op n', () => {
    // ceil(10/2)+2 = 7
    expect(estimateJobCredits(scenes, 'hybrid', 'medium')).toBe(7 * 75);
  });

  it('medium plafonneert op n bij kleine jobs', () => {
    // n=2 → ceil(2/2)+2 = 3, geplafonneerd op 2
    expect(estimateJobCredits(videoScenes(2), 'hybrid', 'medium')).toBe(2 * 75);
  });

  it('smart = aantal needs_ai-scènes + 2, geplafonneerd op n', () => {
    const smartScenes = [
      scene({ needs_ai: true }),
      scene({ needs_ai: true }),
      scene({ needs_ai: false }),
      scene(),
    ];
    // 2 needs_ai + 2 = 4 (n=4, geen plafond-effect)
    expect(estimateJobCredits(smartScenes, 'hybrid', 'smart')).toBe(4 * 75);
  });

  it('smart telt geen scènes met skip_kie als needs_ai', () => {
    const smartScenes = [
      scene({ needs_ai: true, skip_kie: true }), // telt NIET
      scene({ needs_ai: true }),                 // telt wel
      scene(),
    ];
    // 1 needs_ai + 2 = 3 (n=3)
    expect(estimateJobCredits(smartScenes, 'hybrid', 'smart')).toBe(3 * 75);
  });

  it('ontbrekende intensiteit valt terug op low-gedrag (2 scènes)', () => {
    expect(estimateJobCredits(scenes, 'hybrid')).toBe(2 * 75);
  });
});

describe('estimateJobCredits — SKIP-templates & skip_kie tellen niet mee', () => {
  it('SKIP_TEMPLATES bevat de in-code Remotion-templates', () => {
    expect([...SKIP_TEMPLATES].sort()).toEqual(
      ['data_comparison', 'fact_animation', 'stats_counter'],
    );
  });

  it('SKIP-templates kosten niets in een betaalde stijl', () => {
    const scenes = [
      scene(),
      { template: 'fact_animation' },
      { template: 'stats_counter' },
      { template: 'data_comparison' },
    ];
    // slechts 1 betaalde scène → 75
    expect(estimateJobCredits(scenes, 'simple')).toBe(75);
  });

  it('per-scène skip_kie sluit een scène uit van de raming', () => {
    const scenes = [scene(), scene({ skip_kie: true }), scene()];
    // 2 van 3 betaald → 150
    expect(estimateJobCredits(scenes, 'simple')).toBe(150);
  });
});

describe('estimateJobCredits — monotonie-invarianten (CLAUDE.md §1.3c)', () => {
  const scenes = videoScenes(5);

  it('director (superset van simple) kost MEER dan simple', () => {
    expect(estimateJobCredits(scenes, 'director'))
      .toBeGreaterThan(estimateJobCredits(scenes, 'simple'));
  });

  it('simple (T2I + Kling) kost MEER dan ai-image (enkel T2I)', () => {
    expect(estimateJobCredits(scenes, 'simple'))
      .toBeGreaterThan(estimateJobCredits(scenes, 'ai-image'));
  });

  it('elke betaalde stijl kost strikt meer dan de gratis stock-stijl', () => {
    const free = estimateJobCredits(scenes, 'stock');
    for (const style of ['ai-image', 'simple', 'director', 'ai-cinematic']) {
      expect(estimateJobCredits(scenes, style)).toBeGreaterThan(free);
    }
  });

  it('hybrid high ≥ medium ≥ low (meer intensiteit is nooit goedkoper)', () => {
    const high = estimateJobCredits(scenes, 'hybrid', 'high');
    const medium = estimateJobCredits(scenes, 'hybrid', 'medium');
    const low = estimateJobCredits(scenes, 'hybrid', 'low');
    expect(high).toBeGreaterThanOrEqual(medium);
    expect(medium).toBeGreaterThanOrEqual(low);
  });
});

describe('estimateJobCredits — randgevallen', () => {
  it('lege scènelijst kost 0 in gebruikelijke stijlen (behalve vaste opstartkosten)', () => {
    expect(estimateJobCredits([], 'simple')).toBe(0);
    expect(estimateJobCredits([], 'ai-image')).toBe(0);
    expect(estimateJobCredits([], 'stock')).toBe(0);
    // ai-cinematic heeft een vaste ankerkost van 5
    expect(estimateJobCredits([], 'ai-cinematic')).toBe(5);
    // director heeft een vaste character-sheet-kost van 15
    expect(estimateJobCredits([], 'director')).toBe(15);
  });

  it('niet-array input crasht niet en geeft 0/basiskost', () => {
    expect(estimateJobCredits(undefined, 'simple')).toBe(0);
    expect(estimateJobCredits(null, 'stock')).toBe(0);
  });
});
