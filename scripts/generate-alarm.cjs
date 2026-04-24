/**
 * generate-alarm.cjs
 * Genera public/sounds/alarm.wav — chime melódico moderno (3 notas ascendentes).
 * Suena como una notificación agradable pero audible, no como una alarma fea.
 * Ejecutar con: node scripts/generate-alarm.cjs
 */

const fs   = require('fs');
const path = require('path');

const SAMPLE_RATE  = 44100;
const NUM_CHANNELS = 1;
const BIT_DEPTH    = 16;
const MAX_INT16    = 32767;

// ── Las 3 notas del chime (acorde mayor A – C# – E, una octava alta) ────────
// Estas frecuencias suenan "agradables" pero penetran bien en bocinas pequeñas
const NOTES = [
  { freq: 1318.5, start: 0.00, dur: 0.30 },  // E6
  { freq: 1046.5, start: 0.18, dur: 0.30 },  // C6  (baja al medio para dar profundidad)
  { freq: 1567.9, start: 0.36, dur: 0.45 },  // G6  (sube al final — resuelve el acorde)
];

const TOTAL_DURATION = 0.85;
const NUM_SAMPLES    = Math.ceil(SAMPLE_RATE * TOTAL_DURATION);
const samples        = new Float32Array(NUM_SAMPLES);

for (const note of NOTES) {
  const startSample = Math.floor(note.start * SAMPLE_RATE);
  const durSamples  = Math.floor(note.dur  * SAMPLE_RATE);

  for (let i = 0; i < durSamples; i++) {
    const sampleIdx = startSample + i;
    if (sampleIdx >= NUM_SAMPLES) break;

    const t = i / SAMPLE_RATE;

    // ── Envolvente tipo campana: ataque rápido (5ms), decay exponencial largo ──
    const attack = Math.min(t / 0.005, 1.0);                   // 5ms attack
    const decay  = Math.exp(-t * 6.0);                          // decay natural
    const envelope = attack * decay;

    // ── Sine wave pura + harmónico suave para dar "cuerpo" ──────────────────
    const fundamental = Math.sin(2 * Math.PI * note.freq * t);
    const harmonic2   = 0.15 * Math.sin(2 * Math.PI * note.freq * 2 * t);
    const harmonic3   = 0.05 * Math.sin(2 * Math.PI * note.freq * 3 * t);

    samples[sampleIdx] += envelope * (fundamental + harmonic2 + harmonic3);
  }
}

// ── Normalizar para usar máxima amplitud sin distorsión ─────────────────────
let peak = 0;
for (let i = 0; i < NUM_SAMPLES; i++) peak = Math.max(peak, Math.abs(samples[i]));
const gain = peak > 0 ? 0.95 / peak : 1;

// ── Convertir a PCM 16-bit ───────────────────────────────────────────────────
const pcm = new Int16Array(NUM_SAMPLES);
for (let i = 0; i < NUM_SAMPLES; i++) {
  pcm[i] = Math.round(Math.max(-1, Math.min(1, samples[i] * gain)) * MAX_INT16);
}

// ── Construir header WAV ─────────────────────────────────────────────────────
const dataBytes  = NUM_SAMPLES * 2;
const buffer     = Buffer.alloc(44 + dataBytes);

buffer.write('RIFF', 0, 'ascii');
buffer.writeUInt32LE(36 + dataBytes, 4);
buffer.write('WAVE', 8, 'ascii');
buffer.write('fmt ', 12, 'ascii');
buffer.writeUInt32LE(16, 16);
buffer.writeUInt16LE(1, 20);          // PCM
buffer.writeUInt16LE(1, 22);          // Mono
buffer.writeUInt32LE(SAMPLE_RATE, 24);
buffer.writeUInt32LE(SAMPLE_RATE * 2, 28);
buffer.writeUInt16LE(2, 32);
buffer.writeUInt16LE(16, 34);
buffer.write('data', 36, 'ascii');
buffer.writeUInt32LE(dataBytes, 40);

for (let i = 0; i < NUM_SAMPLES; i++) {
  buffer.writeInt16LE(pcm[i], 44 + i * 2);
}

// ── Guardar ──────────────────────────────────────────────────────────────────
const outDir  = path.resolve(__dirname, '..', 'public', 'sounds');
const outFile = path.join(outDir, 'alarm.wav');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outFile, buffer);

console.log(`✅ Chime generado: ${outFile}`);
console.log(`   Notas: E6 → C6 → G6 | Duración: ${TOTAL_DURATION}s`);
