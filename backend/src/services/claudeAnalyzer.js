/**
 * claudeAnalyzer.js
 * Analyseert YouTube Short scripts met Claude en genereert scène planning.
 * Ondersteunt Documentary, Epic en Story modes.
 */

require('dotenv').config({ override: true });
const Anthropic = require('@anthropic-ai/sdk');
const { buildKlingPrompt } = require('./kieService');

let _client = null;
function getClient() {
  if (!_client) {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key || key === 'sk-ant-...') {
      throw new Error('ANTHROPIC_API_KEY niet ingesteld in backend/.env');
    }
    _client = new Anthropic({ apiKey: key });
  }
  return _client;
}

// ── Word timings ─────────────────────────────────────────────────────────────

/**
 * Berekent frame-nauwkeurige timestamps per woord.
 * Standaard 130wpm; gebruikt audio duur als beschikbaar.
 */
function calculateWordTimings(script, scenes, audioDurationSeconds = null) {
  const words = script
    .replace(/[^\w\s'-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 0);

  if (words.length === 0) return [];

  const FPS = 30;
  const WPM = 130;

  const speechFrames = audioDurationSeconds
    ? Math.round(audioDurationSeconds * FPS)
    : Math.round(words.length * (FPS * 60 / WPM));

  const framesPerWord = speechFrames / words.length;

  let sceneStart = 0;
  const sceneRanges = scenes.map(s => {
    const start = sceneStart;
    const end   = sceneStart + (s.duration_frames || 90);
    sceneStart  = end;
    return { start, end };
  });

  return words.map((word, idx) => {
    const wordStart = Math.round(idx * framesPerWord);
    const wordEnd   = Math.round((idx + 1) * framesPerWord);

    let sceneIndex = 0;
    for (let i = 0; i < sceneRanges.length; i++) {
      if (wordStart >= sceneRanges[i].start && wordStart < sceneRanges[i].end) {
        sceneIndex = i;
        break;
      }
    }

    const localStart = wordStart - sceneRanges[sceneIndex].start;
    const localEnd   = wordEnd   - sceneRanges[sceneIndex].start;

    return {
      word,
      globalStartFrame: wordStart,
      globalEndFrame:   wordEnd,
      sceneIndex,
      startFrame: Math.max(0, localStart),
      endFrame:   Math.max(0, localEnd),
    };
  });
}

// ── Scene analyse ────────────────────────────────────────────────────────────

// ── Format detection helper ──────────────────────────────────────────────────
function detectFormat(topic) {
  if (!topic) return 'narrative';
  const t = topic.trim();
  if (/^\d+\s/i.test(t) || /\b\d+\s+(reasons?|tips?|facts?|ways?|things?|redenen|feiten)\b/i.test(t)) return 'listicle';
  if (/^How to\b/i.test(t) || /^Hoe\b/i.test(t) || /\bsteps?\b/i.test(t) || /\bstappen\b/i.test(t)) return 'howto';
  if (/\bvs\.?\b/i.test(t) || /\bversus\b/i.test(t) || /\bbetter than\b/i.test(t) || /\bcompared to\b/i.test(t) || /\bvergelijking\b/i.test(t)) return 'comparison';
  if (/^Why\b/i.test(t) || /^What if\b/i.test(t) || /^How did\b/i.test(t) || /^Waarom\b/i.test(t) || /^Wat als\b/i.test(t)) return 'mystery';
  return 'narrative';
}

// ── Menselijkheid Engine: vaste schrijfstijl-regels voor elke script-generatie ──
const HUMAN_STYLE_BLOCK = `
HUMAN WRITING STYLE (mandatory — this must NOT read like AI):
- NEVER open with: "In de wereld van...", "Het is geen geheim dat...", "Stel je voor dat...", "In deze video...", "In the world of...", "It's no secret that...", "Imagine..."
- Vary sentence length: alternate short punchlines (3-5 words) with longer sentences (15-20 words)
- Use concrete, specific details instead of vague generalities: not "een groot gebouw" but "een toren van 47 verdiepingen"
- Write in the second person where possible: address the viewer directly
- Include ONE unexpected, surprising detail the viewer would never expect
- End sentences on an unexpected word, not the most obvious one
- Use active verbs: not "werd gebouwd" but "bouwden ze"`;

const VALID_RENDER_ENGINES = new Set(['cinematic_title', 'ken_burns', 'animated_map', 'timeline', 'stats_counter', 'fact_animation', 'data_comparison', 'outro_cta']);
const CODE_ONLY_TEMPLATES  = new Set(['fact_animation', 'data_comparison', 'stats_counter', 'timeline', 'animated_map']);

async function analyzeScript(script, style = 'documentaire', durationSeconds = 60, renderStyle = 'ai-cinematic', format = 'narrative', adaptiveStrategy = true, pacing = null) {
  const is2D = renderStyle === '2d';

  // ── Energy niveau bepaalt max frame-duur per scène ───────────────────────
  const isHighEnergy = ['gaming', 'sport'].includes(style);
  const isLowEnergy  = ['beauty', 'finance'].includes(style);
  let maxFrames    = isHighEnergy ? 90 : isLowEnergy ? 150 : 120;
  // Visual-preset pacing overschrijft het energieniveau
  if (pacing === 'fast') maxFrames = 60;   // max 2s per scène (TikTok-stijl)
  if (pacing === 'slow') maxFrames = 150;  // rustige cuts

  const isListicle   = format === 'listicle';
  const isHowto      = format === 'howto';
  const isComparison = format === 'comparison';
  const isMystery    = format === 'mystery';

  // ── Adaptive prompt (Fase 3) ─────────────────────────────────────────────
  if (adaptiveStrategy) {
    const styleGuidance = {
      gaming:      `Fast cuts. Use stats_counter for scores/KD ratios. fact_animation for shocking records. ken_burns for player moments. AVOID timeline. Prefer short scenes (${maxFrames} frames max).`,
      sport:       `Dynamic pacing. fact_animation for world records. stats_counter for personal bests. animated_map for race routes/venues. Build to climax. Max ${maxFrames} frames.`,
      beauty:      `Slow, deliberate pace. ken_burns for product/technique close-ups. fact_animation for counterintuitive ingredient stats. AVOID stats_counter as filler. Max ${maxFrames} frames.`,
      finance:     `Data-driven. data_comparison for rankings/fund comparisons. fact_animation for counterintuitive money facts. timeline for market history. Logical structured flow. Max ${maxFrames} frames.`,
      tech:        `Forward-looking. ken_burns for concept visualization. fact_animation for paradigm-shift statistics. timeline only for technology evolution. ken_burns as default. Max ${maxFrames} frames.`,
      epic:        `Dramatic. fact_animation for shocking historical facts (dates, casualties, spans). animated_map for ancient empires/locations. timeline for historical sequences. Max ${maxFrames} frames.`,
      documentaire: `Educational. animated_map for locations. timeline for chronological events. fact_animation for surprising statistics. ken_burns as default. Max ${maxFrames} frames.`,
      story:       `Personal, emotional. ken_burns predominantly. Light on data templates. fact_animation only for truly striking personal stats. Max ${maxFrames} frames.`,
    }[style] || `Use ken_burns as default. Add variety with stats_counter/fact_animation only when explicit data supports it. Max ${maxFrames} frames.`;

    const adaptivePrompt = `You are a YouTube Shorts video editor. Design the optimal scene layout for this script.

Script:
"${script}"

Genre/Style: ${style}
Total duration: ${durationSeconds} seconds (${durationSeconds * 30} frames at 30fps)
Max frames per non-protected scene: ${maxFrames}

RENDER ENGINE MENU — choose the best engine for each scene:
• cinematic_title  (60-90 fr)   — dramatic title card with title+subtitle. ALWAYS scene 0.
• ken_burns        (60-${maxFrames} fr) — slow zoom b-roll with text overlay. Default for narrative/context/demos.
• animated_map     (60-${maxFrames} fr) — animated map zooming to a location. Use for geographic references.
• timeline         (90-${maxFrames} fr) — horizontal timeline. Use for chronological sequences or evolution.
• stats_counter    (60-90 fr)   — animated number counter. Only when an explicit statistic is in the segment.
• fact_animation   (60-90 fr)   — bold full-screen fact card. For shocking stats, records, reveal numbers.
• data_comparison  (90-${maxFrames} fr) — animated bar/ranking chart. Only when comparing 2-4 named items with measurable values. Requires "comparison" field in JSON.
• outro_cta        (60-90 fr)   — CTA end screen. ALWAYS last scene. Must have a CTA in script_segment.

Genre guidance for "${style}": ${styleGuidance}

HARD CONSTRAINTS:
1. First scene MUST be cinematic_title
2. Last scene MUST be outro_cta with a non-empty call-to-action script_segment
3. Total duration_frames MUST sum to ${durationSeconds * 30}
4. Max ${maxFrames} frames per non-protected scene (cinematic_title and outro_cta may use 60-90)
5. For EVERY scene, extract "facts": ONLY facts LITERALLY stated in script_segment — never infer or invent. Leave [] if no explicit number/date/measurement is stated.
   CRITICAL: subject = exact noun from script; value = exact numeric value from script. Never combine facts across segments.
   Fact types: "count", "measurement", "duration", "date", "ratio". Fields: type, value, unit (null if none), subject.
6. data_comparison: fill the "comparison" field with { "type": "ranking"|"scale"|"before_after"|"timeline", "unit": string, "title": string, "entries": [{"label": string, "value": number, "color": null}] }. Min 2 entries, max 4, same unit.
7. For EVERY scene, add "visual_focus": a description of a PERSON interacting with the primary object/action from script_segment. Include person's action + specific object. Max 20 words. Never just the object alone.
8. For EVERY scene, add:
   - "lighting_mood": specific lighting atmosphere matching this genre and scene energy. NOT generic "dramatic rim lighting" for non-epic content.
   - "camera_style": camera movement, max 12 words, matching the energy (gaming→fast handheld; beauty→slow macro; finance→clean static).
   Choose based on GENRE — do NOT default to history/epic values for non-history content.
9. For EVERY scene, add "needs_ai": true|false. TRUE only when the scene shows a CONCRETE visual object/place/person that is hard to convey with text/2D graphics (a battlefield, a temple, a creature). FALSE for abstract concepts, numbers, statistics, timelines, comparisons, lists — those work fine as 2D text/graphics. Be strict: fewer TRUE = cheaper renders.
${durationSeconds > 60 ? `9b. LONG-FORM CHAPTER STRUCTURE (video is ${durationSeconds}s): divide the video into chapters — "Intro" (10-15% of duration), 2-4 core chapters with a short descriptive name (70-80%), "Conclusie" (10-15%, ends with outro_cta). Add "chapter": "<chapter name>" to EVERY scene. At the START of each core chapter (not Intro), insert an extra short title-card scene: template "${is2D ? 'text_focus_2d' : 'cinematic_title'}", duration_frames 45-60, content: { "title": "<chapter name>" }, script_segment: "", chapter: "<chapter name>", chapter_card: true, needs_ai: false.` : ''}
${is2D ? `10. Add "color_theme" to the root JSON: "warm"|"cool"|"neutral"|"dark"|"default" based on topic mood (NOT geography).
11. For animated_map scenes: add "map_region" to content: "world"|"europe"|"asia"|"middle_east"|"africa"|"north_america"|"south_america"|"oceania".` : ''}

${require('./uniquenessService').visualDnaBlock()}
${require('./uniquenessService').visualAvoidBlock()}
${require('./promptIntelligence').patternsBlock()}

Return ONLY a JSON object, no explanation:

{
  "style_anchor": "One sentence: consistent visual identity for ALL scenes (subject appearance, palette, lighting, atmosphere). Prepended to every video prompt.",${is2D ? `
  "color_theme": "neutral",` : ''}
  "scenes": [
    {
      "template": "cinematic_title",
      "duration_frames": 75,
      "content": { "title": "main title", "subtitle": "optional subtitle" },
      "script_segment": "opening hook text",
      "visual_focus": "person dramatically reacting to main subject",
      "lighting_mood": "specific lighting for this scene and genre",
      "camera_style": "specific camera movement for this scene",
      "needs_ai": true,
      "facts": [],
      "comparison": null
    }
  ]
}`;

    const adaptiveResponse = await getClient().messages.create({
      model: 'claude-opus-4-5',
      max_tokens: durationSeconds > 60 ? 16000 : 4096, // long-form heeft veel meer scènes
      messages: [{ role: 'user', content: adaptivePrompt }],
    });

    const adaptiveText   = adaptiveResponse.content[0].text;
    const adaptiveObjM   = adaptiveText.match(/\{[\s\S]*\}/);
    if (!adaptiveObjM) throw new Error('Claude returned no valid JSON (adaptive)');

    const adaptiveParsed = JSON.parse(adaptiveObjM[0]);
    let styleAnchor      = adaptiveParsed.style_anchor || '';
    let scenes           = adaptiveParsed.scenes || [];
    let colorTheme       = null;
    if (is2D) {
      const VALID_THEMES = new Set(['warm', 'cool', 'neutral', 'dark', 'default']);
      colorTheme = VALID_THEMES.has(adaptiveParsed.color_theme) ? adaptiveParsed.color_theme : 'default';
    }

    // ── Adaptive post-processing ─────────────────────────────────────────────
    const PROTECTED_TEMPLATES_A = new Set(['cinematic_title', 'outro_cta']);
    const validationWarnings    = [];
    const templateDecisions     = [];

    scenes = scenes.map((scene, si) => {
      // Whitelist validation — unknown engine → ken_burns
      if (!VALID_RENDER_ENGINES.has(scene.template)) {
        validationWarnings.push({ scene: si, field: 'template', msg: `onbekende render_engine "${scene.template}" → vervangen door ken_burns` });
        console.warn(`[claudeAnalyzer] ⚠️  Scene ${si}: onbekende render_engine "${scene.template}" → ken_burns`);
        scene = { ...scene, template: 'ken_burns' };
      }

      // Duration clamp (protected templates keep their own value)
      if (!PROTECTED_TEMPLATES_A.has(scene.template)) {
        const raw = scene.duration_frames || maxFrames;
        if (raw > maxFrames) {
          scene = { ...scene, duration_frames: maxFrames };
        }
      }

      // render_method tagging (informational; enforcement is in kieService)
      const renderMethod = CODE_ONLY_TEMPLATES.has(scene.template) ? 'code_only' : 'kie_ai';
      scene = { ...scene, render_method: renderMethod };

      templateDecisions.push({ scene: si, chosen_template: scene.template, reason: `adaptive — Claude keuze (${renderMethod})` });
      return scene;
    });

    // Force first = cinematic_title, last = outro_cta
    if (scenes.length > 0 && scenes[0].template !== 'cinematic_title') {
      validationWarnings.push({ scene: 0, field: 'template', msg: 'eerste scène is geen cinematic_title — geforceerd' });
      scenes[0] = { ...scenes[0], template: 'cinematic_title' };
    }
    if (scenes.length > 1 && scenes[scenes.length - 1].template !== 'outro_cta') {
      const last = scenes.length - 1;
      validationWarnings.push({ scene: last, field: 'template', msg: 'laatste scène is geen outro_cta — geforceerd' });
      scenes[last] = { ...scenes[last], template: 'outro_cta' };
    }

    // Normalize facts + duration scaling + kling_prompt
    scenes = scenes.map(scene => ({
      ...scene,
      facts: (scene.facts || []).map(f => ({
        type:    f.type    || 'count',
        value:   f.value   ?? null,
        unit:    f.unit    ?? null,
        subject: f.subject || f.label || null,
      })),
    }));

    // ── Duration afstemmen op target ─────────────────────────────────────────
    // Bij opschalen: non-protected scènes nooit boven maxFrames.
    // outro_cta absorbeert resterende frames, maar nooit meer dan MAX_OUTRO_FRAMES.
    // Kortere video is beter dan een eindeloze outro.
    const MAX_OUTRO_FRAMES = 150;
    {
      const targetTotal  = durationSeconds * 30;
      const currentTotal = scenes.reduce((sum, s) => sum + (s.duration_frames || maxFrames), 0);
      if (currentTotal !== targetTotal) {
        const scale = targetTotal / currentTotal;
        scenes = scenes.map(s => {
          if (PROTECTED_TEMPLATES_A.has(s.template)) return s;
          const scaled = Math.round((s.duration_frames || maxFrames) * scale);
          return { ...s, duration_frames: scale > 1 ? Math.min(scaled, maxFrames) : scaled };
        });
        const newTotal = scenes.reduce((sum, s) => sum + (s.duration_frames || 0), 0);
        const diff     = targetTotal - newTotal;
        if (diff !== 0) {
          const outroIdx    = scenes.length - 1;
          const currentOutro = scenes[outroIdx].duration_frames || 75;
          const cappedOutro  = Math.min(currentOutro + diff, MAX_OUTRO_FRAMES);
          scenes[outroIdx]  = { ...scenes[outroIdx], duration_frames: cappedOutro };
        }
      }
      // Enforce cap ook als Claude zelf te veel frames aan outro gaf
      const outroIdx = scenes.length - 1;
      if (scenes[outroIdx]?.template === 'outro_cta' && scenes[outroIdx].duration_frames > MAX_OUTRO_FRAMES) {
        scenes[outroIdx] = { ...scenes[outroIdx], duration_frames: MAX_OUTRO_FRAMES };
      }
    }

    scenes = scenes.map(scene => ({
      ...scene,
      kling_prompt:         buildKlingPrompt(scene, style, styleAnchor),
      kling_status:         'pending',
      kling_progress:       0,
      background_video_url: null,
    }));

    const factAnimCount = scenes.filter(s => s.template === 'fact_animation').length;
    const dataCompFinal = scenes.filter(s => s.template === 'data_comparison').length;
    console.log(`[claudeAnalyzer] [ADAPTIVE] style: ${style} | maxFrames: ${maxFrames} | style_anchor: "${styleAnchor}"`);
    console.log(`[claudeAnalyzer] [ADAPTIVE] fact_animation: ${factAnimCount} | data_comparison: ${dataCompFinal} | warnings: ${validationWarnings.length}`);
    console.log(`[claudeAnalyzer] [ADAPTIVE] templates: ${scenes.map((s, i) => `[${i}]${s.template}`).join(' ')}`);
    if (validationWarnings.length > 0) {
      validationWarnings.forEach(w => console.warn(`[claudeAnalyzer] ⚠️  ${w.scene}.${w.field}: ${w.msg}`));
    }

    require('./uniquenessService').recordScenes(scenes, styleAnchor);
  return { scenes, styleAnchor, validationWarnings, templateDecisions, colorTheme };
  }

  // ── LEGACY MODE (adaptiveStrategy === false) ─────────────────────────────
  const formatBlock = isListicle ? `
FORMAT: listicle
The script is structured as a numbered list of items. Additional scene rules for listicle format:
- Keep cinematic_title as scene 1, outro_cta as last scene (same as always)
- Each numbered item in the script = 1 scene, max 120 duration_frames (4 seconds)
- For each item scene: set content.subtitle to the item label (max 5 words), content.title to the item number ("01", "02", etc.)
- Template per item: use stats_counter or fact_animation if the item contains an explicit number/statistic; otherwise use ken_burns
- Maximum 3 fact_animation scenes total — if more items trigger facts, use ken_burns for those extra scenes instead
- Do NOT use animated_map or timeline unless the item is explicitly geographic/chronological`
  : isHowto ? `
FORMAT: howto
The script is a step-by-step tutorial. Scene rules:
- cinematic_title as scene 1, outro_cta as last scene
- Each "Step N:" in the script = 1 scene; preferred template: ken_burns (for clarity and legibility)
- Set content.subtitle to the step number ("Step 1", "Step 2", etc.) and content.title to the step instruction (max 8 words)
- Do NOT use fact_animation, data_comparison, animated_map, or timeline for step scenes`
  : isComparison ? `
FORMAT: comparison
The script compares two or more subjects. Scene rules:
- cinematic_title as scene 1, outro_cta as last scene
- Use data_comparison for the core comparison scene (REQUIRED — must appear exactly once)
- Use ken_burns for intro/context scenes and the verdict scene
- stats_counter is allowed if an explicit number/statistic is present in a scene
- Do NOT use fact_animation for this format`
  : isMystery ? `
FORMAT: mystery reveal
The script builds suspense then delivers a reveal. Scene rules:
- cinematic_title as scene 1, outro_cta as last scene
- Opening hook scene: ken_burns with a provocative question as content.title
- Evidence/buildup scenes: use fact_animation if the scene's key point is an explicit date, year, century, or large number > 999 (e.g. "9,600 BC", "6,000 years", "2,000 years ago"); otherwise ken_burns
- Reveal scene: fact_animation if the reveal contains an explicit date, time span, or number > 999; stats_counter for smaller explicit numbers; otherwise ken_burns
- When using fact_animation for dates/durations, populate the facts array with type "date" or "duration" and the numeric value
- Do NOT use data_comparison, animated_map, or timeline`
  : '';

  const prompt = `You are a YouTube Shorts video editor. Analyze this script and determine the optimal scene layout.

Script:
"${script}"

Style: ${style}
Total duration: ${durationSeconds} seconds (${durationSeconds * 30} frames at 30fps)

Available templates:
- cinematic_title: Dramatic title opening (3-5 sec) — always use as FIRST scene
- ken_burns: Slow zoom with text overlay (5-15 sec) — PRIMARY template for narrative/context; use this as the default for most scenes
- animated_map: Animated location map (5-10 sec) — use when script mentions specific places, countries or geography
- timeline: Horizontal timeline (5-10 sec) — use when script covers a chronological sequence of events
- stats_counter: Animated stat counter (3-6 sec) — use ONLY when the script segment contains an explicit specific number or statistic (e.g. "1 million", "90%", "3,000 soldiers"); maximum 1 per video; NEVER use as a filler scene
- data_comparison: Animated comparison chart (4-8 sec) — use ONLY when the script segment compares 2-4 named entities with measurable values (e.g. city populations, building heights, empire sizes before/after); maximum 1 per video unless script contains multiple explicit comparisons; NEVER use as filler
- outro_cta: Call-to-action end screen (5 sec) — always use as LAST scene

Rules:
1. First scene ALWAYS cinematic_title
2. Last scene ALWAYS outro_cta — MUST have a non-empty script_segment with a call-to-action (e.g. "Follow for more epic history" or "Like and subscribe for more"). Never leave outro_cta script_segment empty.
3. Split the script into logical scenes; default to ken_burns for general narrative scenes
4. Total duration_frames MUST equal ${durationSeconds * 30}
5. Fill content from the script
6. stats_counter: only include it if there is a clear, explicit number or statistic in that part of the script; if in doubt, use ken_burns instead
6b. data_comparison: only use when comparing 2-4 named entities with explicit values. Fill the "comparison" field; leave it null for all other templates. Types: "ranking" (sort by size/population/count), "scale" (physical size comparison), "before_after" (same entity at two points in time), "timeline" (events on a time axis). Max 4 entries. Use the SAME unit for all entries.
   Example: "comparison": { "type": "ranking", "unit": "million", "title": "City Populations", "entries": [{"label": "Rome", "value": 1, "color": null}, {"label": "Carthage", "value": 0.4, "color": null}] }
7. For EVERY scene, extract "facts": an array of concrete, verifiable facts EXPLICITLY AND VERBATIM stated in script_segment. CRITICAL RULES:
   - Extract ONLY what is LITERALLY written in the script_segment — NEVER paraphrase, infer, combine, or invent
   - The "subject" field MUST contain the exact noun/entity name from the script (e.g. if script says "Baghdad Battery", subject = "Baghdad Battery", NOT "electricity discovery")
   - The "value" field MUST be the exact numeric value from the script (e.g. if script says "600 years", value = 600)
   - Do NOT combine facts from different script_segments — each scene only gets facts from its own segment
   - Leave [] if no explicit number, measurement, date, or time span is directly stated in this segment
   Each fact MUST use EXACTLY these field names: "type", "value", "unit" (null if none), "subject". NEVER use "label" or any other field name instead of "subject".
   Fact types: "count" (number of people/objects), "measurement" (height/distance/area with unit), "duration" (time span with unit), "date" (specific year or date), "ratio" (X to Y comparison)
   Example: { "type": "count", "value": 300, "unit": null, "subject": "Spartan warriors" }
   Example: { "type": "measurement", "value": 138, "unit": "meters", "subject": "pyramid height" }
   Example: { "type": "ratio", "value": "333 to 1", "unit": null, "subject": "outnumbered Spartans vs Persians" }
8. For EVERY scene, add a "visual_focus" field: a description of a PERSON interacting with or reacting to the primary object/discovery from the script_segment. Include: (1) the person's action or emotion, (2) the specific object from the script. Max 20 words. NEVER describe just the object alone without a human element.
   GOOD: "archaeologist carefully excavating T-shaped stone pillars at Göbekli Tepe"
   GOOD: "scientist examining corroded bronze Antikythera mechanism with interlocking gears"
   GOOD: "researcher staring in disbelief at tightly fitted Sacsayhuamán stone blocks"
   BAD: "ancient stone pillars in dramatic lighting" (no human element)
   BAD: "mysterious bronze mechanism" (no person)
   For cinematic_title and outro_cta: a person or silhouette in dramatic reaction to the main subject is fine.

9. For EVERY scene, add:
   - "lighting_mood": a short description of the specific lighting atmosphere for THIS scene. Match the genre and energy — NOT the generic historical epic defaults.
     Examples: "neon-lit night street with rain reflections", "bright studio lighting with clean white background", "warm golden sunset over open countryside", "cold blue moonlight through fog"
     Do NOT default to "dramatic rim lighting" or "volumetric god rays" unless the topic genuinely calls for it.
   - "camera_style": camera movement description, max 12 words, specific to what makes this scene's content feel dynamic.
     Examples: "slow push-in on face revealing shock", "quick cut wide-to-close establishing product detail", "gentle drift across landscape horizon"
     Choose based on GENRE: mystery = slow reveal, howto = clean static or subtle zoom, comparison = side-lock or reveal-swipe, narrative = smooth dolly.
${formatBlock}

${is2D ? `IMPORTANT — 2D render mode (no AI video backgrounds). Add a "color_theme" field to the root JSON object.
Choose based on the TONE and MOOD of the topic — NOT based on historical period, culture, or geography:
- "warm"    — energetic, passionate, adventurous, inspiring (fitness, lifestyle, travel, action, epic stories)
- "cool"    — analytical, calm, measured, professional (finance, technology, science, business, data)
- "dark"    — intense, mysterious, dramatic, serious (true crime, thriller, dark history, horror, conspiracy)
- "neutral" — balanced, educational, informative, general (tutorials, explainers, news, trivia, general knowledge)
- "default" — when the topic doesn't clearly match any of the above, or you are unsure
Only output the theme label (one of the five above), nothing else for that field.

For animated_map scenes in 2D mode: add a "map_region" field to the scene's content object.
Choose from exactly these values based on the geographic location mentioned in script_segment:
- "world"         — global, worldwide, no specific region, or unclear
- "europe"        — Europe (including Russia-in-Europe)
- "asia"          — Asia (East Asia, South Asia, Southeast Asia, Central Asia, Siberia)
- "middle_east"   — Middle East, Arabian Peninsula, Levant, Mesopotamia, Persia
- "africa"        — Africa (all regions)
- "north_america" — North America (USA, Canada, Mexico, Central America)
- "south_america" — South America
- "oceania"       — Australia, New Zealand, Pacific Islands
Default to "world" when the location is unclear or spans multiple continents.` : ''}

Return ONLY a JSON object (not an array), no explanation:

{
  "style_anchor": "One sentence describing the consistent visual identity for ALL scenes: main subject appearance, color palette, lighting mood, atmosphere. This will be prepended to every background video prompt to ensure visual consistency across scenes.",${is2D ? `
  "color_theme": "neutral",` : ''}
  "scenes": [
    {
      "template": "cinematic_title",
      "duration_frames": 90,
      "content": { "title": "main title here", "subtitle": "optional subtitle" },
      "script_segment": "part of script for this scene",
      "visual_focus": "dramatic wide shot of the main subject emerging from darkness",
      "lighting_mood": "dramatic rim lighting, deep shadows, volumetric god rays",
      "camera_style": "slow dolly-in revealing silhouette through smoke",
      "facts": [{ "type": "count", "value": 300, "unit": null, "subject": "example warriors" }],
      "comparison": null
    }${is2D ? `,
    {
      "template": "animated_map",
      "duration_frames": 180,
      "content": { "title": "Location Name", "location": "Human-readable place", "map_region": "asia" },
      "script_segment": "part of script mentioning this location",
      "visual_focus": "aerial view of the specific geographic location mentioned in this scene",
      "lighting_mood": "soft golden hour side lighting, natural warm tones",
      "camera_style": "slow aerial drone descending from high altitude",
      "facts": [],
      "comparison": null
    }` : ''}
  ]
}`;

  const response = await getClient().messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].text;

  // Probeer eerst object-formaat { style_anchor, scenes }, val terug op array
  const objMatch   = text.match(/\{[\s\S]*\}/);
  const arrMatch   = text.match(/\[[\s\S]*\]/);
  let styleAnchor  = '';
  let scenes;

  let colorTheme = null;

  if (objMatch) {
    const parsed = JSON.parse(objMatch[0]);
    styleAnchor  = parsed.style_anchor || '';
    scenes       = parsed.scenes;
    if (is2D) {
      const VALID_THEMES = new Set(['warm', 'cool', 'neutral', 'dark', 'default']);
      colorTheme = VALID_THEMES.has(parsed.color_theme) ? parsed.color_theme : 'default';
    }
  } else if (arrMatch) {
    scenes = JSON.parse(arrMatch[0]);
  } else {
    throw new Error('Claude returned no valid JSON');
  }

  // ── Schema-validatie direct na parsen ────────────────────────────────────
  const VALID_FACT_TYPES  = new Set(['count', 'measurement', 'duration', 'date', 'ratio']);
  const VALID_TEMPLATES   = new Set(['cinematic_title', 'ken_burns', 'animated_map', 'timeline', 'stats_counter', 'outro_cta', 'fact_animation', 'data_comparison']);
  const VALID_COMP_TYPES  = new Set(['ranking', 'scale', 'before_after', 'timeline']);
  const validationWarnings = [];

  scenes.forEach((scene, si) => {
    const tag = `scene[${si}]`;

    // Scene-niveau
    if (!scene.template)      validationWarnings.push({ scene: si, field: 'template',      msg: 'ontbreekt' });
    else if (!VALID_TEMPLATES.has(scene.template))
                               validationWarnings.push({ scene: si, field: 'template',      msg: `onbekende waarde "${scene.template}"` });
    if (!scene.content)        validationWarnings.push({ scene: si, field: 'content',       msg: 'ontbreekt' });
    if (scene.script_segment == null)
                               validationWarnings.push({ scene: si, field: 'script_segment',msg: 'ontbreekt' });
    if (!Array.isArray(scene.facts))
                               validationWarnings.push({ scene: si, field: 'facts',         msg: 'geen array' });

    // Comparison-validatie
    if (scene.comparison != null) {
      const c = scene.comparison;
      if (!c.type)                          validationWarnings.push({ scene: si, field: 'comparison.type',    msg: 'ontbreekt' });
      else if (!VALID_COMP_TYPES.has(c.type)) validationWarnings.push({ scene: si, field: 'comparison.type',  msg: `onbekend type "${c.type}"` });
      if (!Array.isArray(c.entries))        validationWarnings.push({ scene: si, field: 'comparison.entries', msg: 'geen array' });
      else {
        if (c.entries.length > 4)           validationWarnings.push({ scene: si, field: 'comparison.entries', msg: `${c.entries.length} entries (max 4)` });
        if (c.entries.length < 2)           validationWarnings.push({ scene: si, field: 'comparison.entries', msg: 'minder dan 2 entries' });
        c.entries.forEach((e, ei) => {
          if (!e.label)  validationWarnings.push({ scene: si, field: `comparison.entries[${ei}].label`,  msg: 'ontbreekt' });
          if (e.value == null) validationWarnings.push({ scene: si, field: `comparison.entries[${ei}].value`, msg: 'null/undefined' });
        });
      }
    }

    // Facts-niveau
    (scene.facts || []).forEach((f, fi) => {
      const ftag = `${tag}.facts[${fi}]`;
      if (!f.type)                        validationWarnings.push({ scene: si, fact: fi, field: 'type',    msg: 'ontbreekt' });
      else if (!VALID_FACT_TYPES.has(f.type))
                                          validationWarnings.push({ scene: si, fact: fi, field: 'type',    msg: `onbekende waarde "${f.type}"` });
      if (f.value == null)                validationWarnings.push({ scene: si, fact: fi, field: 'value',   msg: 'null/undefined' });
      if (!f.subject && !f.label)         validationWarnings.push({ scene: si, fact: fi, field: 'subject', msg: 'ontbreekt (en geen label-fallback)' });
      else if (f.subject && typeof f.subject !== 'string')
                                          validationWarnings.push({ scene: si, fact: fi, field: 'subject', msg: `geen string (${typeof f.subject})` });
    });
  });

  if (validationWarnings.length > 0) {
    validationWarnings.forEach(w => {
      const loc = w.fact != null ? `scene[${w.scene}].facts[${w.fact}]` : `scene[${w.scene}]`;
      console.warn(`[claudeAnalyzer] ⚠️  Validatie: ${loc}.${w.field} — ${w.msg}`);
    });
  }

  // Fix totaal duration_frames
  const targetTotal  = durationSeconds * 30;
  const currentTotal = scenes.reduce((sum, s) => sum + (s.duration_frames || 90), 0);
  if (currentTotal !== targetTotal) {
    const scale = targetTotal / currentTotal;
    scenes = scenes.map(s => ({ ...s, duration_frames: Math.round((s.duration_frames || 90) * scale) }));
  }

  // ── Normaliseer facts: "label" → "subject" fallback ──────────────────────
  scenes = scenes.map(scene => ({
    ...scene,
    facts: (scene.facts || []).map(f => ({
      type:    f.type    || 'count',
      value:   f.value   ?? null,
      unit:    f.unit    ?? null,
      subject: f.subject || f.label || null,  // fallback: label → subject
    })),
  }));

  // ── Beslissingsregel: data_comparison > fact_animation > default ─────────────
  // cinematic_title en outro_cta worden NOOIT omgezet (PROTECTED).
  const FACT_ANIMATION_TYPES = new Set(['count', 'measurement', 'ratio']);
  const PROTECTED_TEMPLATES  = new Set(['cinematic_title', 'outro_cta']);
  const templateDecisions    = [];

  // Overgebruik-check data_comparison (max 1, tenzij script meerdere expliciete vergelijkingen bevat)
  const dataCompCount = scenes.filter(s => s.comparison != null && Array.isArray(s.comparison?.entries) && s.comparison.entries.length >= 2 && !PROTECTED_TEMPLATES.has(s.template)).length;
  if (dataCompCount > 1) {
    console.log(`[claudeAnalyzer] data_comparison: ${dataCompCount} scenes — acceptabel als script meerdere expliciete vergelijkingen bevat`);
  }

  scenes = scenes.map((scene, si) => {
    const facts          = scene.facts || [];
    const hasTriggerFact = facts.some(f => FACT_ANIMATION_TYPES.has(f.type));
    const triggerTypes   = facts.filter(f => FACT_ANIMATION_TYPES.has(f.type)).map(f => f.type);
    const comp           = scene.comparison;
    const hasComparison  = comp != null && Array.isArray(comp.entries) && comp.entries.length >= 2;

    if (PROTECTED_TEMPLATES.has(scene.template)) {
      const reason = hasComparison
        ? `protected template (${scene.template}), data_comparison overgeslagen ondanks aanwezige comparison`
        : hasTriggerFact
          ? `protected template (${scene.template}), fact_animation overgeslagen ondanks aanwezige facts [${triggerTypes.join(', ')}]`
          : `protected template (${scene.template}), altijd behouden`;
      templateDecisions.push({ scene: si, chosen_template: scene.template, reason });
      return scene;
    }

    // data_comparison heeft hogere prioriteit dan fact_animation
    // Disabled voor howto en mystery (Claude's template-keuze is leidend voor deze formats)
    if (hasComparison && !isHowto && !isMystery) {
      const prev = scene.template;
      templateDecisions.push({
        scene: si, chosen_template: 'data_comparison',
        reason: `comparison aanwezig (type=${comp.type}, ${comp.entries.length} entries), omgezet van "${prev}"`,
      });
      console.log(`[claudeAnalyzer] Scène "${prev}" → data_comparison (type=${comp.type})`);
      return { ...scene, template: 'data_comparison' };
    }

    // Mystery: alleen fact_animation voor date/duration-types of grote getallen (>999)
    const hasMysteryFact = isMystery && facts.some(f =>
      f.type === 'date' || f.type === 'duration' ||
      (typeof f.value === 'number' && f.value > 999)
    );
    const mysteryTriggerTypes = hasMysteryFact
      ? facts.filter(f => f.type === 'date' || f.type === 'duration' || (typeof f.value === 'number' && f.value > 999)).map(f => f.type)
      : [];

    if ((hasTriggerFact && !isHowto && !isMystery) || hasMysteryFact) {
      const effectiveTypes = isMystery ? mysteryTriggerTypes : triggerTypes;
      const prev = scene.template;
      templateDecisions.push({
        scene: si,
        chosen_template: 'fact_animation',
        reason: `facts bevatten trigger-type(s) [${effectiveTypes.join(', ')}], omgezet van "${prev}"`,
      });
      console.log(`[claudeAnalyzer] Scène "${prev}" → fact_animation (facts: ${JSON.stringify(facts)})`);
      return { ...scene, template: 'fact_animation' };
    }

    // Geen trigger-facts — behoud Claude's keuze, log reden
    const segment = (scene.script_segment || '').toLowerCase();
    const geoWords = ['country', 'city', 'region', 'continent', 'map', 'location', 'land', 'territory', 'empire', 'kingdom', 'province'];
    const hasGeo   = geoWords.some(w => segment.includes(w)) || scene.template === 'animated_map';
    const hasDates = scene.template === 'timeline';

    let reason;
    if (scene.template === 'animated_map' || hasGeo) {
      reason = 'geografische verwijzing gevonden of template was al animated_map';
    } else if (scene.template === 'timeline' || hasDates) {
      reason = 'chronologische reeks of template was al timeline';
    } else if (scene.template === 'stats_counter') {
      if (isMystery) {
        const hasValidMysteryStats = facts.some(f =>
          (f.type === 'count' || f.type === 'duration') && typeof f.value === 'number' && f.value > 999
        );
        if (!hasValidMysteryStats) {
          templateDecisions.push({ scene: si, chosen_template: 'ken_burns', reason: 'mystery gate: stats_counter → ken_burns (geen getal >999 met type count/duration)' });
          console.log(`[claudeAnalyzer] Mystery gate: stats_counter → ken_burns (scène ${si})`);
          return { ...scene, template: 'ken_burns' };
        }
      }
      reason = 'expliciete statistiek/getal in script, stats_counter gekozen door Claude';
    } else if (scene.template === 'ken_burns') {
      reason = 'geen specifieke trigger, default narratief template';
    } else {
      reason = `geen trigger-facts, Claude-keuze "${scene.template}" behouden`;
    }

    templateDecisions.push({ scene: si, chosen_template: scene.template, reason });
    return scene;
  });

  // ── Listicle fact_animation cap (max 3) ─────────────────────────────────────
  if (isListicle) {
    let factAnimUsed = 0;
    scenes = scenes.map(scene => {
      if (PROTECTED_TEMPLATES.has(scene.template)) return scene;
      if (scene.template === 'fact_animation') {
        if (factAnimUsed >= 3) {
          console.log(`[claudeAnalyzer] Listicle cap: fact_animation → ken_burns (scene ${scenes.indexOf(scene)})`);
          return { ...scene, template: 'ken_burns' };
        }
        factAnimUsed++;
      }
      return scene;
    });
    console.log(`[claudeAnalyzer] Listicle: ${factAnimUsed} fact_animation scene(s) (cap=3)`);
  }

  // Voeg Kling prompt toe per scène (met style_anchor als prefix)
  scenes = scenes.map(scene => ({
    ...scene,
    facts:           scene.facts || [],
    kling_prompt:    buildKlingPrompt(scene, 'epic', styleAnchor),
    kling_status:    'pending',
    kling_progress:  0,
    background_video_url: null,
  }));

  const factAnimCount = scenes.filter(s => s.template === 'fact_animation').length;
  const dataCompFinal = scenes.filter(s => s.template === 'data_comparison').length;
  const pct = Math.round(factAnimCount / scenes.length * 100);
  console.log(`[claudeAnalyzer] style_anchor: "${styleAnchor}"`);
  console.log(`[claudeAnalyzer] fact_animation: ${factAnimCount}/${scenes.length} scènes (${pct}%)${pct > 50 ? ' ⚠️  OVERGEBRUIK' : ''}`);
  console.log(`[claudeAnalyzer] data_comparison: ${dataCompFinal}/${scenes.length} scènes`);
  console.log(`[claudeAnalyzer] validatiewaarschuwingen: ${validationWarnings.length}`);
  console.log(`[claudeAnalyzer] template_decisions: ${templateDecisions.map(d => `[${d.scene}]${d.chosen_template}`).join(' ')}`);
  if (is2D) console.log(`[claudeAnalyzer] color_theme: "${colorTheme}"`);
  require('./uniquenessService').recordScenes(scenes, styleAnchor);
  return { scenes, styleAnchor, validationWarnings, templateDecisions, colorTheme };
}

// ── Script generatie ─────────────────────────────────────────────────────────

function truncateToWordLimit(text, maxWords, label = 'Script') {
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) return text.trim();

  // Truncate at the last sentence-ending punctuation within the word limit
  const limited = words.slice(0, maxWords).join(' ');
  const sentenceEnd = Math.max(
    limited.lastIndexOf('. '),
    limited.lastIndexOf('! '),
    limited.lastIndexOf('? '),
    limited.lastIndexOf('.\n'),
    limited.lastIndexOf('!\n'),
    limited.lastIndexOf('?\n'),
  );
  const truncated = sentenceEnd > 0 ? limited.slice(0, sentenceEnd + 1).trim() : limited.trim();
  const finalWords = truncated.split(/\s+/).length;
  console.log(`[Script] ${words.length} woorden gegenereerd, max ${maxWords} — ingekort naar ${finalWords} woorden`);
  return truncated;
}

async function generateScript(topic, style = 'documentaire', durationSeconds = 60, language = 'en', format = 'narrative') {
  const maxWords  = Math.round(durationSeconds * 2.5);
  const wordCount = maxWords; // kept for backward-compat references below
  const langName  = language === 'nl' ? 'Dutch' : 'English';

  const structureBlock = format === 'listicle'
    ? `Structure: listicle
- Open with a hook line: "Here are [N] [facts/reasons/tips] about [topic]:" or equivalent in ${langName}
- Present each item as a numbered point (1. 2. 3. etc.)
- Each item: one short punchy label (1-5 words) followed by exactly 1 sentence of explanation
- Include an explicit number or statistic in at least 2 items where possible
- Close with a strong call-to-action`
    : format === 'howto'
    ? `Structure: howto
- Open with the problem or desired result (hook the viewer with what they will be able to do)
- Present exactly 3-5 steps, each starting with "Step [N]:" followed by a concise instruction sentence
- Close with what the viewer now knows how to do and a call-to-action`
    : format === 'comparison'
    ? `Structure: comparison
- Open with a sharp question: "Which is better/bigger/faster: A or B?" (or equivalent in ${langName})
- Present one concise paragraph for each side with at least one concrete, measurable fact
- Give a clear verdict
- End with a call-to-action`
    : format === 'mystery'
    ? `Structure: mystery reveal
- Open with a shocking or counterintuitive question the viewer doesn't know the answer to
- Build tension across 2-3 sentences of evidence or clues
- Deliver the reveal clearly and concisely
- End with a call-to-action`
    : `Structure: narrative
- Start immediately with a powerful hook (first 3 seconds)
- Be engaging, fast-paced and informative
- End with a strong call-to-action`;

  const toneBlock = style === 'gaming'
    ? `Tone: high-energy, fast-paced, competitive. Use gaming terminology naturally. Hook: shocking stat or clutch moment. Build tension per item. CTA: challenge the viewer directly.`
    : style === 'beauty'
    ? `Tone: warm, personal, aspirational. Use first-person or second-person. Hook: relatable skin/beauty problem. Body: solution-focused steps. CTA: soft encouragement.`
    : style === 'finance'
    ? `Tone: authoritative but accessible. Data-driven. Hook: counterintuitive money fact or myth. Body: clear logical progression with numbers. CTA: one actionable insight.`
    : style === 'sport'
    ? `Tone: explosive, motivational, physical. Hook: record or seemingly impossible achievement. Build to a climax. CTA: inspire the viewer to act or move.`
    : style === 'tech'
    ? `Tone: precise, forward-looking, slightly awe-inspiring. Hook: paradigm shift or unexpected capability. Body: implication-focused. CTA: thought-provoking question about the future.`
    : '';

  // Uniciteit Engine: perspectief-rotatie + anti-herhaling
  const { pickPerspective, scriptAvoidBlock, recordScript, uniquenessScore } = require('./uniquenessService');
  const perspective = pickPerspective();

  const prompt = `CRITICAL: This is a ${durationSeconds}-second video. Your script MUST NOT exceed ${maxWords} words total. Count every word carefully before submitting. A script that is too long will ruin the video.

Write a YouTube Shorts script about: "${topic}"

Style: ${style}
Duration: ${durationSeconds} seconds — Speaking pace: ~150 words per minute (fast-paced YouTube Shorts)
${toneBlock ? `\n${toneBlock}\n` : ''}
NARRATIVE PERSPECTIVE (mandatory for this video): ${perspective.hint}
Build the entire hook and framing around this angle.
${HUMAN_STYLE_BLOCK}
${scriptAvoidBlock()}

Rules:
- Write in ${langName} only
- ${structureBlock}
- HARD LIMIT: Maximum ${maxWords} words — do not exceed this under any circumstances
- FACTUAL ACCURACY: If specific facts, names, numbers, or dates are provided in the topic, use them EXACTLY as given. Do not paraphrase, alter, or guess at factual details. If a detail is ambiguous or not explicitly stated, omit it rather than inventing or assuming information.

Return ONLY the spoken narration — no markdown headers, no bold/italic formatting (**text** or *text*), no bullet points, no numbered list prefixes like "**1.**", no [SCENE] markers, no stage directions. Plain sentences only.`;

  const response = await getClient().messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  // Strip any markdown that slipped through (headers, bold, italic)
  const raw = response.content[0].text.trim();
  const cleaned = raw
    .replace(/^#{1,6}\s+.+$/gm, '')           // # headers
    .replace(/\*\*(.+?)\*\*/g, '$1')           // **bold**
    .replace(/\*(.+?)\*/g, '$1')               // *italic*
    .replace(/^[\-\*]\s+/gm, '')               // bullet points
    .replace(/\n{3,}/g, '\n\n')                // excessive blank lines
    .trim();
  const finalScript = truncateToWordLimit(cleaned, maxWords);

  // Score berekenen vóór registratie (anders vergelijkt hij met zichzelf)
  const score = uniquenessScore(finalScript);
  recordScript(finalScript);
  console.log(`[Uniqueness] perspectief: ${perspective.key} | score: ${score}/100`);
  return { script: finalScript, perspective: perspective.key, uniqueness_score: score };
}

async function generateEpicScript(topic, durationSeconds = 60, language = 'en') {
  const maxWords = Math.round(durationSeconds * 2.5);
  const langName = language === 'nl' ? 'Dutch' : 'English';

  const prompt = `CRITICAL: This is a ${durationSeconds}-second video. Your script MUST NOT exceed ${maxWords} words total. Count every word carefully before submitting. A script that is too long will ruin the video.

Write a DRAMATIC, EPIC YouTube Shorts narration about: "${topic}"

Duration: ${durationSeconds} seconds — Speaking pace: ~150 words per minute (fast-paced YouTube Shorts)
Style: Dark fantasy / historical epic / viking warrior / ancient civilization

Rules:
- Write in ${langName} only
- FIRST LINE must be shocking and grab attention instantly
- Use powerful, dramatic, visceral language
- Short punchy sentences — maximum impact per word
- Build tension relentlessly
- Include a powerful statistic or fact if possible
- End with an epic call to action
- HARD LIMIT: Maximum ${maxWords} words — every word must count. Do not exceed this.
- FACTUAL ACCURACY: If specific facts, names, numbers, or dates are provided in the topic, use them EXACTLY as given. Do not paraphrase, alter, or guess at factual details. Omit rather than invent.

Tone examples: "They were outnumbered 10 to 1. They didn't care." / "History forgot them. We won't."
${HUMAN_STYLE_BLOCK}
${require('./uniquenessService').scriptAvoidBlock()}

Return ONLY the spoken narration text — no directions, no labels.`;

  const response = await getClient().messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const finalScript = truncateToWordLimit(response.content[0].text.trim(), maxWords);
  require('./uniquenessService').recordScript(finalScript);
  return finalScript;
}

function selectModeFromTopic(topic) {
  const t = (topic || '').toLowerCase();

  const epicKeywords    = ['ancient', 'viking', 'warrior', 'battle', 'empire', 'dynasty', 'war', 'legend', 'myth', 'dragon', 'medieval', 'pharaoh', 'gladiator', 'samurai', 'conquest', 'ruins', 'fallen', 'dark', 'forbidden', 'lost civilization'];
  const storyKeywords   = ['funny', 'daily life', 'personal', 'story', 'moment', 'experience', 'journey', 'people', 'animals', 'kids', 'family', 'love', 'friendship', 'adventure', 'travel', 'food', 'culture'];
  const gamingKeywords  = ['game', 'gaming', 'gamer', 'player', 'clutch', 'valorant', 'minecraft', 'fortnite', 'fps', 'esports', 'streamer', 'twitch', 'playstation', 'xbox', 'nintendo', 'moba', 'rpg'];
  const beautyKeywords  = ['skincare', 'makeup', 'routine', 'glow', 'beauty', 'skin', 'hair', 'moisturizer', 'serum', 'foundation', 'lipstick', 'eyeshadow', 'blush', 'concealer', 'retinol', 'spf'];
  const financeKeywords = ['money', 'invest', 'investing', 'stock', 'crypto', 'bitcoin', 'budget', 'wealth', 's&p', 'market', 'dividend', 'etf', 'finance', 'savings', 'debt', 'income', 'passive income'];
  const sportKeywords   = ['athlete', 'fitness', 'training', 'record', 'marathon', 'nba', 'soccer', 'football', 'workout', 'gym', 'run', 'sprint', 'olympic', 'champion', 'world record', 'sport'];
  const techKeywords    = ['ai', 'artificial intelligence', 'robot', 'startup', 'code', 'software', 'innovation', 'future', 'tech', 'technology', 'machine learning', 'algorithm', 'silicon', 'openai', 'neural'];

  if (gamingKeywords.some(k  => t.includes(k)))  return 'gaming';
  if (beautyKeywords.some(k  => t.includes(k)))  return 'beauty';
  if (financeKeywords.some(k => t.includes(k)))  return 'finance';
  if (sportKeywords.some(k   => t.includes(k)))  return 'sport';
  if (techKeywords.some(k    => t.includes(k)))  return 'tech';
  if (epicKeywords.some(k    => t.includes(k)))  return 'epic';
  if (storyKeywords.some(k   => t.includes(k)))  return 'story';
  return 'documentary';
}

/**
 * Analyseert een script en geeft aanbevolen format/mode/render_style terug als JSON.
 */
async function analyzeScriptSettings(script) {
  const client = getClient();
  const prompt = `You are a YouTube Shorts video producer. Analyze this script and recommend the optimal production settings.

Script:
"""
${script}
"""

Return ONLY valid JSON (no markdown, no explanation) with this exact structure:
{
  "format": "narrative"|"listicle"|"howto"|"comparison"|"mystery",
  "mode": "epic"|"documentary"|"story"|"gaming"|"beauty"|"finance"|"sport"|"tech",
  "render_style": "ai-cinematic"|"ai-image"|"2d",
  "reasoning": {
    "format": "<one sentence, same language as script>",
    "mode": "<one sentence, same language as script>",
    "render_style": "<one sentence, same language as script>"
  }
}

Decision criteria:
- format: steps/tutorial → howto; numbered list → listicle; A vs B → comparison; question+reveal/mystery → mystery; otherwise → narrative
- mode: gaming/esports/clutch/fps → gaming; skincare/makeup/beauty/routine → beauty; money/invest/crypto/stock/s&p → finance; athlete/gym/record/workout → sport; AI/tech/robot/startup/code → tech; dramatic/historical/shocking/ancient → epic; personal/emotional → story; otherwise → documentary
- render_style: rich visual subjects (history, nature, science, mystery) → ai-cinematic; fact-heavy/data content → ai-image; abstract/conceptual or free production → 2d
- reasoning language: match the script language (Dutch script → Dutch reasoning; English script → English reasoning)`;

  const response = await client.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 512,
    messages:   [{ role: 'user', content: prompt }],
  });

  const raw = response.content[0].text.trim();
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Geen geldige JSON in Claude-respons');
  return JSON.parse(jsonMatch[0]);
}

// ── Simple analyse — enkel segmenten + visual_focus, geen templates ──────────

async function analyzeScriptSimple(script, durationSeconds = 30) {
  const client = getClient();

  const prompt = `Split the following script into scenes for a short video.
Each scene should cover one sentence or thought. Return a JSON array only.

Script: "${script}"

Rules:
- 1 object per sentence/thought
- Each object: { "script_segment": "...", "visual_focus": "cinematic description of what to show, no text, photorealistic" }
- visual_focus must be a vivid, concrete visual scene (not abstract)
- Return ONLY the JSON array, no explanation

Example:
[
  { "script_segment": "Rome fell in 476 AD.", "visual_focus": "ancient Roman colosseum crumbling at dusk, dramatic smoke and embers" },
  { "script_segment": "But why?", "visual_focus": "lone Roman soldier silhouetted against burning horizon" }
]`;

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4000, // 60s+ scripts geven 15+ scènes — 1024 kapte de array af
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = response.content[0].text.trim();
  let jsonMatch = raw.match(/\[[\s\S]*\]/);
  // Recovery: als de respons tóch afgekapt is (geen sluitende ]), knip tot het
  // laatste volledige object en sluit de array zelf
  if (!jsonMatch && raw.includes('[')) {
    const start = raw.indexOf('[');
    const lastBrace = raw.lastIndexOf('}');
    if (lastBrace > start) jsonMatch = [raw.slice(start, lastBrace + 1) + ']'];
  }
  if (!jsonMatch) throw new Error('analyzeScriptSimple: geen JSON array in respons');
  const segments = JSON.parse(jsonMatch[0]);

  const totalFrames = durationSeconds * 30;
  const framesPerScene = Math.round(totalFrames / segments.length);

  return segments.map((seg, i) => ({
    template: 'ken_burns',
    script_segment: seg.script_segment || '',
    visual_focus:   seg.visual_focus   || '',
    duration_frames: framesPerScene,
    background_video_url: null,
    kling_status: 'pending',
  }));
}

module.exports = { analyzeScript, analyzeScriptSimple, generateScript, generateEpicScript, calculateWordTimings, selectModeFromTopic, detectFormat, analyzeScriptSettings };
