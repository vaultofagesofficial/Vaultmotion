/**
 * higgsfieldService.js
 * Higgsfield integratie voor VaultMotion.
 *
 * ARCHITECTUUR:
 * - De Higgsfield MCP is beschikbaar in Claude Code (FleetView connector)
 * - De backend heeft GEEN directe API key nodig
 * - Claude genereert video's via MCP en pusht URL's naar de backend
 *   via PATCH /api/render/:jobId/scene/:idx
 * - Dit bestand bevat hulpfuncties voor prompt generatie
 */

/**
 * Genereer een Higgsfield video prompt op basis van template type en scène content.
 */
function buildPromptForScene(template, content) {
  const prompts = {
    cinematic_title: `Dramatic dark cinematic background, slow motion floating particles of light, deep shadows,
      atmospheric fog, ${content.title ? `themed around "${content.title}"` : ''},
      epic movie opening, IMAX quality, 9:16 vertical format, no text`,

    ken_burns: `Cinematic historical scene, ${content.text || content.title || 'dramatic landscape'},
      photorealistic, documentary style, warm tones, shallow depth of field,
      slow subtle movement, 9:16 vertical format, no text overlays`,

    animated_map: `Aerial drone view from high altitude,
      ${content.location || content.text || 'world map view'},
      cinematic geography shot, dramatic clouds, god rays through atmosphere,
      slowly descending, 9:16 vertical format`,

    timeline: `Abstract timeline visualization, flowing light streams,
      dark background with glowing chronological elements,
      ${content.events ? `representing "${content.events[0]?.event || ''}"` : ''},
      cinematic motion graphics, 9:16 vertical format`,

    stats_counter: `Dramatic close-up shot, ${content.stat_label || content.text || 'impactful statistic'},
      dark dramatic background, sharp focus, powerful atmosphere,
      documentary cinematography, 9:16 vertical format, no text`,

    outro_cta: `Professional branded outro background, dark gradient,
      subtle animated geometric shapes, premium brand feel,
      YouTube channel subscribe animation style, 9:16 vertical format, clean`
  };

  return prompts[template] || `Cinematic vertical video background for "${content.title || template}", dark theme, 9:16 format`;
}

/**
 * Start een Higgsfield video generatie job.
 * @param {string} prompt - Beschrijving van de video
 * @param {number} durationSeconds - Duur in seconden (1-10)
 * @returns {Promise<{jobId: string}>}
 */
async function startGeneration(prompt, durationSeconds = 5) {
  const apiKey = process.env.HIGGSFIELD_API_KEY;

  if (!apiKey || apiKey === 'hf-...') {
    // Simulatiemodus als geen echte API key beschikbaar
    console.log('[Higgsfield] Simulatiemodus — geen echte API key');
    const fakeJobId = `sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return { jobId: fakeJobId, simulated: true };
  }

  const duration = Math.min(Math.max(Math.round(durationSeconds), 1), 10);

  const response = await axios.post(
    `${HIGGSFIELD_API_BASE}/generation`,
    {
      model: MODEL,
      prompt,
      aspect_ratio: '9:16',
      duration,
    },
    {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    }
  );

  const jobId = response.data?.id || response.data?.job_id;
  if (!jobId) throw new Error('Higgsfield gaf geen job ID terug');

  return { jobId, simulated: false };
}

/**
 * Prik de status van een Higgsfield job.
 * @returns {Promise<{status: string, videoUrl: string|null, progress: number}>}
 */
async function getGenerationStatus(jobId) {
  // Simulatiemodus
  if (jobId.startsWith('sim_')) {
    const createdAt = parseInt(jobId.split('_')[1]);
    const elapsed = Date.now() - createdAt;

    if (elapsed < 8000) {
      return { status: 'processing', videoUrl: null, progress: Math.min(80, Math.round((elapsed / 8000) * 80)) };
    }
    // Simuleer een echte video URL (openbare test video)
    return {
      status: 'completed',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      progress: 100
    };
  }

  const apiKey = process.env.HIGGSFIELD_API_KEY;
  const response = await axios.get(
    `${HIGGSFIELD_API_BASE}/generation/${jobId}`,
    {
      headers: { 'Authorization': `Bearer ${apiKey}` },
      timeout: 10000,
    }
  );

  const data = response.data;
  const status = data.status; // 'pending' | 'processing' | 'completed' | 'failed'
  const videoUrl = data.video_url || data.output_url || null;
  const progress = data.progress || (status === 'completed' ? 100 : status === 'processing' ? 50 : 10);

  return { status, videoUrl, progress };
}

/**
 * Wacht tot een Higgsfield job klaar is (polling loop).
 * @param {string} jobId
 * @param {function} onProgress - callback(progress: number)
 * @returns {Promise<string>} videoUrl
 */
async function waitForCompletion(jobId, onProgress = null) {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    const { status, videoUrl, progress } = await getGenerationStatus(jobId);

    if (onProgress) onProgress(progress);

    if (status === 'completed' && videoUrl) {
      return videoUrl;
    }
    if (status === 'failed') {
      throw new Error(`Higgsfield job ${jobId} mislukt`);
    }

    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  throw new Error(`Higgsfield job ${jobId} timed out na ${MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS / 1000}s`);
}

/**
 * Genereer achtergrondvideo's voor alle scènes.
 * @param {Array} scenes - Scènes met template, content, duration_frames
 * @param {function} onSceneProgress - callback(sceneIndex, status, progress)
 * @returns {Promise<Array>} scenes met higgsfield_video_url toegevoegd
 */
async function generateBackgroundVideos(scenes, onSceneProgress = null) {
  const results = [...scenes];

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const durationSeconds = Math.max(1, Math.round((scene.duration_frames || 90) / 30));

    try {
      if (onSceneProgress) onSceneProgress(i, 'generating', 0);

      const prompt = buildPromptForScene(scene.template, scene.content || {});
      console.log(`[Higgsfield] Scène ${i + 1}/${scenes.length}: ${scene.template} (${durationSeconds}s)`);

      const { jobId, simulated } = await startGeneration(prompt, durationSeconds);

      results[i] = {
        ...results[i],
        higgsfield_job_id: jobId,
        higgsfield_simulated: simulated,
        higgsfield_status: 'processing'
      };

      if (onSceneProgress) onSceneProgress(i, 'polling', 10);

      const videoUrl = await waitForCompletion(jobId, (progress) => {
        if (onSceneProgress) onSceneProgress(i, 'polling', progress);
      });

      results[i] = {
        ...results[i],
        higgsfield_status: 'completed',
        higgsfield_video_url: videoUrl,
        background_video_url: videoUrl
      };

      if (onSceneProgress) onSceneProgress(i, 'completed', 100);
      console.log(`[Higgsfield] Scène ${i + 1} klaar: ${videoUrl}`);

    } catch (err) {
      console.error(`[Higgsfield] Scène ${i + 1} fout:`, err.message);
      results[i] = {
        ...results[i],
        higgsfield_status: 'failed',
        higgsfield_error: err.message,
        background_video_url: null
      };
      if (onSceneProgress) onSceneProgress(i, 'failed', 0);
    }
  }

  return results;
}

module.exports = {
  buildPromptForScene,
  startGeneration,
  getGenerationStatus,
  waitForCompletion,
  generateBackgroundVideos
};
