#!/usr/bin/env node
/**
 * MiniMax Music Batch Generator for WinCTL
 * Generates all UI sound effects + ambient music using the free music-2.6-free model.
 *
 * Usage:
 *   MINIMAX_API_KEY=your_key node scripts/generate-sounds.js
 *
 * Or edit the API_KEY constant below.
 */

const API_KEY = process.env.MINIMAX_API_KEY || '';
const ENDPOINT = 'https://api.minimaxi.com/v1/music_generation';

const SOUNDS = [
  // ── UI Interactions ────────────────────────────────────────────────────────────
  {
    name: 'hover',
    prompt: 'Softest tick cursor sound — precision micro-click, 0.1s, like a feather-light mechanical switch hover. Ultra-short, high-frequency, minimal. No music, no melody, just a whisper of a sound.',
    duration: 3,
    file: 'hover.mp3',
  },
  {
    name: 'click',
    prompt: 'Mechanical keystroke click — crisp Cherry MX Blue style, medium attack 0.15s, subtle reverb tail. Satisfying but not loud. Precise and premium.',
    duration: 3,
    file: 'click.mp3',
  },
  {
    name: 'toggle-on',
    prompt: 'Rising pitch sweep — 200Hz to 600Hz over 0.2s. Smooth digital whoosh with a satisfying click at end. Premium toggle switch on. Uplifting.',
    duration: 4,
    file: 'toggle-on.mp3',
  },
  {
    name: 'toggle-off',
    prompt: 'Descending pitch sweep — 600Hz to 200Hz. Reverse of switch-on. Smooth and clean. 0.2s. Premium toggle switch off.',
    duration: 4,
    file: 'toggle-off.mp3',
  },
  {
    name: 'modal-open',
    prompt: 'Glass crystalline chime — open, airy resonance. 0.3s fade-in. Like ice tiles clicking into place in a clean grid. Opens a sense of space.',
    duration: 4,
    file: 'modal-open.mp3',
  },
  {
    name: 'modal-close',
    prompt: 'Reverse crystalline chime — gentle decay. Soft dissolution. 0.25s. Like tiles being gently removed from a grid. Closing a window.',
    duration: 4,
    file: 'modal-close.mp3',
  },
  {
    name: 'checkbox',
    prompt: 'Sharp snappy tick — binary precision relay click. 0.08s. Definitive and sharp. Like a high-end toggle.',
    duration: 3,
    file: 'checkbox.mp3',
  },
  {
    name: 'error',
    prompt: 'Low warning buzz — 180Hz slightly distorted square wave. 0.3s. Firm but not aggressive. Something went wrong but it is handled.',
    duration: 4,
    file: 'error.mp3',
  },

  // ── Service State Changes ─────────────────────────────────────────────────────
  {
    name: 'service-started',
    prompt: 'Rising hopeful tone — warm synth chord C-E-G ascending resolution. Ends with soft shimmer. 0.6s. It worked, you are good to go. Reassuring success.',
    duration: 5,
    file: 'service-started.mp3',
  },
  {
    name: 'service-stopped',
    prompt: 'Descending gentle tone — same warm chord descending. Wind-down confirmation. 0.5s. Not sad, just noted and complete. Service stopped.',
    duration: 5,
    file: 'service-stopped.mp3',
  },
  {
    name: 'service-error',
    prompt: 'Single low warning buzz — 180Hz distorted square wave. 0.3s. Firm alert. Something crashed, needs attention.',
    duration: 4,
    file: 'service-error.mp3',
  },
  {
    name: 'service-restart',
    prompt: 'Quick ascending three-note arpeggio C-G-E. Slightly urgent but reassuring. I am handling it. 0.4s. Auto-restart triggered.',
    duration: 4,
    file: 'service-restart.mp3',
  },

  // ── Notifications ─────────────────────────────────────────────────────────────
  {
    name: 'service-added',
    prompt: 'Bright tile placement sound — soft plop with subtle digital shimmer. 0.35s. Something new has been added to the grid.',
    duration: 4,
    file: 'service-added.mp3',
  },
  {
    name: 'service-deleted',
    prompt: 'Gentle dissolve — descending granular texture fading out. 0.4s. It is gone. Not sad, clean removal.',
    duration: 4,
    file: 'service-deleted.mp3',
  },
  {
    name: 'notification',
    prompt: 'Minimalist ping — pure 880Hz sine tone. 0.1s. Clean professional notification bell.',
    duration: 3,
    file: 'notification.mp3',
  },
  {
    name: 'permission-denied',
    prompt: 'Low thump followed by ascending nope tone 200Hz to 300Hz. Brief. Firm but not angry. 0.25s. Access denied.',
    duration: 4,
    file: 'permission-denied.mp3',
  },

  // ── Startup / Ambient ─────────────────────────────────────────────────────────
  {
    name: 'app-startup',
    prompt: 'Generative ambient startup sequence — minimal warm drone, server-room-inspired. Slow harmonic movement. Professional and calm. Like a machine powering on gracefully. 8 seconds.',
    duration: 10,
    file: 'app-startup.mp3',
  },
  {
    name: 'ambient-drone',
    prompt: 'Ultra-quiet generative ambient drone — soft filtered noise very low volume. Slow-evolving almost imperceptible. Server room hum made musical. Professional background presence. Seamless loop.',
    duration: 30,
    file: 'ambient-drone.mp3',
  },
  {
    name: 'app-shutdown',
    prompt: 'Gentle shutdown sequence — warm tone descending into silence. Like a machine going to sleep gracefully. 3 seconds.',
    duration: 5,
    file: 'app-shutdown.mp3',
  },
];

async function generateSound(sound, apiKey) {
  console.log(`[${sound.name}] Generating...`);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'music-2.6-free',
        prompt: sound.prompt,
        is_instrumental: true,
        lyrics: '',
        stream: false,
        output_format: 'url',
        aigc_watermark: false,
        audio_setting: {
          sample_rate: 44100,
          bitrate: 256000,
          format: 'mp3',
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`HTTP ${res.status}: ${err}`);
    }

    const data = await res.json();
    if (data.base_resp?.status_code !== 0) {
      throw new Error(`API error ${data.base_resp?.status_code}: ${data.base_resp?.status_msg}`);
    }

    if (data.data?.status !== 2) {
      throw new Error(`Generation not complete, status: ${data.data?.status}`);
    }

    const url = data.data?.audio_url;
    if (!url) {
      throw new Error('No audio_url in response');
    }

    console.log(`[${sound.name}] Done -> ${url}`);
    return { name: sound.name, url, file: sound.file };
  } catch (err) {
    clearTimeout(timeout);
    console.error(`[${sound.name}] FAILED: ${err.message}`);
    return { name: sound.name, url: null, file: sound.file, error: err.message };
  }
}

async function main() {
  if (!API_KEY) {
    console.error('ERROR: Set MINIMAX_API_KEY env var or edit API_KEY constant in this script.');
    process.exit(1);
  }

  console.log(`\n🎵 WinCTL Sound Generator — ${SOUNDS.length} sounds\n`);
  console.log(`Endpoint: ${ENDPOINT}`);
  console.log(`Model: music-2.6-free\n`);

  const outDir = new URL('../public/sounds/', import.meta.url);
  const fs = await import('fs');
  try { fs.mkdirSync(outDir, { recursive: true }); } catch {}

  const results = [];
  for (const sound of SOUNDS) {
    const result = await generateSound(sound, API_KEY);
    results.push(result);
    await new Promise((r) => setTimeout(r, 500));
  }

  const success = results.filter((r) => r.url);
  const failed = results.filter((r) => !r.url);

  console.log('\n\n─── Results ───────────────────────────────────');
  console.log(`✅ Generated: ${success.length}/${SOUNDS.length}`);
  if (failed.length > 0) {
    console.log(`❌ Failed (${failed.length}):`);
    failed.forEach((f) => console.log(`   ${f.name}: ${f.error}`));
  }

  const manifest = SOUNDS.map((s) => {
    const r = results.find((x) => x.name === s.name);
    return { name: s.name, file: s.file, url: r?.url ?? null };
  });

  const manifestPath = new URL('../public/sounds/manifest.json', import.meta.url);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`\n📝 Manifest written to public/sounds/manifest.json`);

  const urlsTxt = results.filter((r) => r.url).map((r) => `${r.name}: ${r.url}`).join('\n');
  fs.writeFileSync(new URL('../public/sounds/urls.txt', import.meta.url), urlsTxt);
  console.log(`📝 URL list written to public/sounds/urls.txt`);
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
