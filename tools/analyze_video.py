"""
analyze_video.py — Frame-by-frame video analysis via Gemini 1.5 Flash.

Usage:
    python analyze_video.py <video_file_or_youtube_url>

Extracts 1 frame/sec via ffmpeg, sends batches to Gemini, prints analysis.
"""

import sys
import os
import base64
import subprocess
import tempfile
import shutil
from pathlib import Path
from dotenv import load_dotenv

# Load .env from backend/ (one level up from tools/)
env_path = Path(__file__).parent.parent / "backend" / ".env"
load_dotenv(env_path)

GEMINI_API_KEY = os.getenv("GEMINI_VISION_API_KEY") or os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    print("ERROR: GEMINI_API_KEY not found in .env")
    sys.exit(1)

# Use Remotion's bundled ffmpeg
FFMPEG_PATH = r"C:\Users\kurtc\Documents\Vault of ages\backend\node_modules\@remotion\compositor-win32-x64-msvc\ffmpeg.exe"
if not Path(FFMPEG_PATH).exists():
    # fallback to PATH
    FFMPEG_PATH = "ffmpeg"

from google import genai
from google.genai import types

client = genai.Client(api_key=GEMINI_API_KEY)


def download_youtube(url: str, out_dir: str) -> str:
    """Download YouTube video via yt-dlp, return local path."""
    import yt_dlp
    ydl_opts = {
        "format": "bestvideo[ext=mp4]+bestaudio[ext=m4a]/mp4",
        "outtmpl": os.path.join(out_dir, "video.%(ext)s"),
        "quiet": True,
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=True)
        return ydl.prepare_filename(info)


def extract_frames(video_path: str, out_dir: str, fps: int = 1) -> list[str]:
    """Extract frames at given fps using ffmpeg. Returns sorted list of frame paths."""
    frame_pattern = os.path.join(out_dir, "frame_%04d.jpg")
    cmd = [
        FFMPEG_PATH, "-i", video_path,
        "-r", str(fps),
        frame_pattern,
        "-hide_banner", "-loglevel", "error",
    ]
    subprocess.run(cmd, check=True)
    frames = sorted(Path(out_dir).glob("frame_*.jpg"))
    return [str(f) for f in frames]


def frames_to_parts(paths: list[str]) -> list:
    """Convert frame files to Gemini Part objects."""
    parts = []
    for p in paths:
        with open(p, "rb") as f:
            data = f.read()
        parts.append(types.Part.from_bytes(data=data, mime_type="image/jpeg"))
    return parts


def analyze_frames(frame_paths: list[str], video_path: str) -> str:
    """Send frames in batches to Gemini and return combined analysis."""
    total = len(frame_paths)
    print(f"[analyze] {total} frames geëxtraheerd — versturen naar Gemini 1.5 Flash...")

    context = (
        "Je analyseert een YouTube Shorts video (VaultMotion render). "
        "De video heet 'Vault of Ages' — ancient mysteries / cinematic epic stijl. "
        "De video heeft 9 scènes: cinematic_title, animated_map, fact_animation, "
        "stats_counter, fact_animation, animated_map, ken_burns, ken_burns, outro_cta.\n\n"
        "Beantwoord voor de volledige video:\n"
        "1. Zijn er echte kie.ai-achtergrondvideo's/beelden zichtbaar in elke scène? "
        "Of zijn er zwarte/lege scènes?\n"
        "2. Matcht de visuele stijl met 'ancient mysteries, cinematic epic'?\n"
        "3. Zijn subtitels zichtbaar en correct gesynchroniseerd?\n"
        "4. Hoe lang duurt de outro (scène 8) en ziet die er goed uit?\n"
        "5. Algemene kwaliteitsbeoordeling (publiceerbaar op YouTube Shorts?).\n\n"
        f"Totaal: {total} frames (1 per seconde). "
        "Geef een beknopte scène-voor-scène analyse + eindoordeel."
    )

    BATCH_SIZE = 30
    batch_analyses = []

    for i in range(0, total, BATCH_SIZE):
        batch = frame_paths[i : i + BATCH_SIZE]
        start_sec = i + 1
        end_sec = i + len(batch)
        print(f"[analyze] Batch {i//BATCH_SIZE + 1}: frames {start_sec}s–{end_sec}s...")

        parts = [context if i == 0 else f"Vervolg analyse — frames {start_sec}s tot {end_sec}s:"]
        parts += frames_to_parts(batch)

        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=parts,
        )
        batch_analyses.append(f"=== Frames {start_sec}s–{end_sec}s ===\n{response.text}")

    if len(batch_analyses) == 1:
        return batch_analyses[0]

    print("[analyze] Samenvattende eindanalyse...")
    summary_prompt = (
        "Combineer de volgende batch-analyses tot één beknopt eindrapport "
        "(max 400 woorden). Beantwoord de 5 vragen:\n\n"
        + "\n\n".join(batch_analyses)
    )
    summary = client.models.generate_content(
        model="gemini-2.0-flash",
        contents=summary_prompt,
    )
    return summary.text


def main():
    if len(sys.argv) < 2:
        print("Usage: python analyze_video.py <video_file_or_youtube_url>")
        sys.exit(1)

    target = sys.argv[1]
    tmp_dir = tempfile.mkdtemp(prefix="vaultmotion_analyze_")

    try:
        # Step 1: resolve video path
        if target.startswith("http"):
            print(f"[analyze] YouTube download: {target}")
            video_path = download_youtube(target, tmp_dir)
        else:
            video_path = str(Path(target).resolve())
            if not Path(video_path).exists():
                print(f"ERROR: bestand niet gevonden: {video_path}")
                sys.exit(1)

        print(f"[analyze] Video: {video_path}")

        # Step 2: extract frames
        frames_dir = os.path.join(tmp_dir, "frames")
        os.makedirs(frames_dir)
        frame_paths = extract_frames(video_path, frames_dir, fps=1)
        print(f"[analyze] {len(frame_paths)} frames geëxtraheerd")

        # Step 3: analyze
        result = analyze_frames(frame_paths, video_path)

        print("\n" + "=" * 60)
        print("ANALYSE RESULTAAT")
        print("=" * 60)
        print(result)
        print("=" * 60)

    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


if __name__ == "__main__":
    main()
