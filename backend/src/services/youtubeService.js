const { google } = require('googleapis');
const fs   = require('fs');
const path = require('path');

function getOAuthClient() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
    throw new Error(
      'YouTube credentials ontbreken. Stel in backend/.env in: ' +
      'GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN'
    );
  }
  const auth = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
  auth.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN });
  return auth;
}

async function uploadVideoToYouTube(job) {
  const auth = getOAuthClient();
  const youtube = google.youtube({ version: 'v3', auth });

  if (!job.file_path || !fs.existsSync(job.file_path)) {
    throw new Error('Video bestand niet gevonden: ' + job.file_path);
  }

  const fileSize = fs.statSync(job.file_path).size;
  console.log(`[YouTube] Upload gestart: ${job.title} (${Math.round(fileSize / 1024 / 1024)}MB)`);

  const response = await youtube.videos.insert(
    {
      part: ['snippet', 'status'],
      requestBody: {
        snippet: {
          title: (job.title || 'VaultMotion Short').slice(0, 100),
          description: [
            job.script || '',
            '',
            '#Shorts #AI #VaultMotion'
          ].join('\n').slice(0, 5000),
          tags: ['shorts', 'youtube shorts', 'ai video', 'vaultmotion'],
          categoryId: '22',
          defaultLanguage: 'nl'
        },
        status: {
          privacyStatus: 'unlisted',
          selfDeclaredMadeForKids: false
        }
      },
      media: {
        mimeType: 'video/mp4',
        body: fs.createReadStream(job.file_path)
      }
    },
    {
      onUploadProgress: evt => {
        const pct = Math.round((evt.bytesRead / fileSize) * 100);
        console.log(`[YouTube] Upload: ${pct}%`);
      }
    }
  );

  const videoId = response.data.id;
  console.log(`[YouTube] ✅ Upload klaar: ${videoId}`);

  // Thumbnail instellen als die beschikbaar is
  if (job.thumbnail_url) {
    try {
      const thumbPath = path.resolve(__dirname, '../../../', job.thumbnail_url.replace(/^\//, ''));
      if (fs.existsSync(thumbPath)) {
        await youtube.thumbnails.set({
          videoId,
          media: { mimeType: 'image/jpeg', body: fs.createReadStream(thumbPath) },
        });
        console.log(`[YouTube] ✅ Thumbnail ingesteld`);
      }
    } catch (thumbErr) {
      console.warn('[YouTube] Thumbnail instellen mislukt:', thumbErr.message);
    }
  }

  return {
    youtube_id: videoId,
    youtube_url: `https://www.youtube.com/watch?v=${videoId}`,
    youtube_shorts_url: `https://www.youtube.com/shorts/${videoId}`
  };
}

module.exports = { uploadVideoToYouTube };
