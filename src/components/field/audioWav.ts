/**
 * Normalizes a MediaRecorder blob to 16 kHz mono 16-bit PCM WAV before upload.
 *
 * Why: Chrome/Firefox record audio/webm (Opus) and Safari records audio/mp4 (AAC). WAV is the one
 * format every audio-capable model on OpenRouter accepts (Gemini docs list WAV/MP3/AIFF/AAC/OGG/FLAC;
 * WebM is not listed). The browser's own decoder handles whatever it recorded, so we re-encode
 * here instead of guessing on the server. 16 kHz mono is what speech models use internally:
 * ~32 KB/s, so a 3-minute note is ~5.8 MB.
 *
 * If decoding fails (very old browser), the original blob is returned unchanged and the server
 * labels it from its MIME type.
 */
export async function toSpeechWav(blob: Blob, sampleRate = 16_000): Promise<Blob> {
  if (typeof window === "undefined") return blob;
  const Ctx: typeof AudioContext | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx || typeof OfflineAudioContext === "undefined") return blob;
  try {
    const ctx = new Ctx();
    let decoded: AudioBuffer;
    try {
      decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
    } finally {
      void ctx.close();
    }
    const frames = Math.max(1, Math.ceil(decoded.duration * sampleRate));
    const offline = new OfflineAudioContext(1, frames, sampleRate);
    const src = offline.createBufferSource();
    src.buffer = decoded; // multi-channel input is down-mixed to the 1-channel destination
    src.connect(offline.destination);
    src.start();
    const pcm = (await offline.startRendering()).getChannelData(0);
    return encodeWav(pcm, sampleRate);
  } catch (e) {
    console.warn("wav conversion failed; uploading original recording", e);
    return blob;
  }
}

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const w = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF");
  v.setUint32(4, 36 + samples.length * 2, true);
  w(8, "WAVE");
  w(12, "fmt ");
  v.setUint32(16, 16, true); // PCM chunk size
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true); // byte rate
  v.setUint16(32, 2, true); // block align
  v.setUint16(34, 16, true); // bits per sample
  w(36, "data");
  v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buf], { type: "audio/wav" });
}
