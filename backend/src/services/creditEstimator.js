/**
 * creditEstimator.js
 *
 * BUSINESS-KRITIEK (zie CLAUDE.md §1.3). Pure, side-effect-vrije creditraming
 * per render_style. Bewust apart gehouden van renderService zodat deze logica
 * zonder de volledige render-pipeline (Remotion/kie/native deps) getest kan
 * worden. Raming is conservatief: liever over- dan onderschatten.
 *
 * Regel bij een nieuwe render_style: (a) case hier toevoegen, (b) entry in de
 * UI-kostenmatrix, (c) een premium-stijl kost logisch MEER dan de stijl waarvan
 * hij een superset is (Regisseur = Simpel + extra's → duurder dan Simpel),
 * (d) e2e-test van de gate met een saldo dat nét te laag is.
 */

'use strict';

// Templates die volledig in-code (Remotion) gerenderd worden en dus geen
// betaalde beeld-generatie (kie.ai) vereisen.
const SKIP_TEMPLATES = new Set(['fact_animation', 'stats_counter', 'data_comparison']);

/**
 * Raam het benodigde kie.ai-creditsaldo voor een job.
 * @param {Array<object>} scenes            Scènes uit de analyse (kunnen skip_kie/needs_ai dragen).
 * @param {string}        renderStyle       De gekozen render_style.
 * @param {string}        [hybridIntensity] Alleen relevant voor 'hybrid': 'smart'|'low'|'medium'|'high'.
 * @returns {number} Geschat aantal credits (0 voor gratis stijlen).
 */
function estimateJobCredits(scenes, renderStyle, hybridIntensity) {
  const list = Array.isArray(scenes) ? scenes : [];
  const vid = list.filter(s => !SKIP_TEMPLATES.has(s.template) && !s.skip_kie);
  switch (renderStyle) {
    case 'stock':
    case '2d':
      return 0;
    case 'ai-image':
    case 'illustrated':
      return vid.length * 5;                     // enkel T2I per scène
    case 'simple':
      return vid.length * 75;                    // T2I (5) + Kling I2V (70)
    case 'director':
      return 15 + vid.length * 75;               // character sheet + T2I + Kling per scène
    case 'hybrid': {
      const n = list.length;
      const kieN = hybridIntensity === 'high'   ? n
                 : hybridIntensity === 'medium' ? Math.min(n, Math.ceil(n / 2) + 2)
                 : hybridIntensity === 'smart'  ? Math.min(n, list.filter(s => s.needs_ai && !s.skip_kie).length + 2)
                 : 2;                            // low: enkel titel + outro
      return kieN * 75;
    }
    default: {
      // ai-cinematic + visuele presets (noir/documentary/social/luxury)
      const titles = vid.filter(s => ['cinematic_title', 'outro_cta'].includes(s.template)).length;
      return 5 + titles * 70 + Math.max(0, vid.length - titles) * 30; // anker + Kling-titels + Seedance-rest
    }
  }
}

module.exports = { estimateJobCredits, SKIP_TEMPLATES };
