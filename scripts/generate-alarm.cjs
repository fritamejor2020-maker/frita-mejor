/**
 * generate-alarm.js
 * Genera public/sounds/alarm.wav — alarma aguda de 3 pitidos a máxima amplitud.
 * Ejecutar con: node scripts/generate-alarm.js
 */

const fs   = require('fs');
const path = require('path');

const SAMPLE_RATE  = 44100;
const NUM_CHANNELS = 1;       // Mono
const BIT_DEPTH    = 16;
const MAX_INT16    = 32767;

// ── Definir los pitidos ──────────────────────────────────────────────────────
// Cada pitido: { start(s), end(s), freq(Hz), type: 'sine'|'square' }
const BEEPS = [
  { start: 0.00, end: 0.15, freq: 1100 },   // pitido 1
  { start: 0.22, end: 0.37, freq: 1100 },   // pitido 2
  { start: 0.44, end: 0.65, freq: 1400 },   // pitido 3 (más agudo y largo)
];

const TOTAL_DURATION = 0.75; // segundos
const NUM_SAMPLES    = Math.ceil(SAMPLE_RATE * TOTAL_DURATION);

// ── Generar muestras PCM 16-bit ──────────────────────────────────────────────
const samples = new Int16Array(NUM_SAMPLES);

for (let i = 0; i < NUM_SAMPLES; i++) {
  const t = i / SAMPLE_RATE;

  let value = 0;
  for (const beep of BEEPS) {
    if (t >= beep.start && t < beep.end) {
      const localT = t - beep.start;
      const dur    = beep.end - beep.start;

      // Envolvente: fade in 10ms, fade out 20ms, meseta en el medio
      let envelope = 1.0;
      if (localT < 0.01)       envelope = localT / 0.01;
      if (localT > dur - 0.02) envelope = (dur - localT) / 0.02;

      // Onda cuadrada (más penetrante que seno) layered con armónico
      const fundamental = Math.sign(Math.sin(2 * Math.PI * beep.freq * t));
      const harmonic    = 0.3 * Math.sign(Math.sin(2 * Math.PI * beep.freq * 2 * t));

      value = envelope * (fundamental + harmonic) / 1.3; // normalizado
      break;
    }
  }

  samples[i] = Math.round(Math.max(-1, Math.min(1, value)) * MAX_INT16);
}

// ── Construir el header WAV ──────────────────────────────────────────────────
const dataBytes   = NUM_SAMPLES * NUM_CHANNELS * (BIT_DEPTH / 8);
const headerSize  = 44;
const buffer      = Buffer.alloc(headerSize + dataBytes);

// RIFF chunk
buffer.write('RIFF', 0, 'ascii');
buffer.writeUInt32LE(36 + dataBytes, 4);
buffer.write('WAVE', 8, 'ascii');

// fmt  chunk
buffer.write('fmt ', 12, 'ascii');
buffer.writeUInt32LE(16, 16);                          // subchunk size
buffer.writeUInt16LE(1, 20);                           // PCM format
buffer.writeUInt16LE(NUM_CHANNELS, 22);
buffer.writeUInt32LE(SAMPLE_RATE, 24);
buffer.writeUInt32LE(SAMPLE_RATE * NUM_CHANNELS * (BIT_DEPTH / 8), 28); // byte rate
buffer.writeUInt16LE(NUM_CHANNELS * (BIT_DEPTH / 8), 32); // block align
buffer.writeUInt16LE(BIT_DEPTH, 34);

// data chunk
buffer.write('data', 36, 'ascii');
buffer.writeUInt32LE(dataBytes, 40);

for (let i = 0; i < NUM_SAMPLES; i++) {
  buffer.writeInt16LE(samples[i], headerSize + i * 2);
}

// ── Guardar el archivo ───────────────────────────────────────────────────────
const outDir  = path.resolve(__dirname, '..', 'public', 'sounds');
const outFile = path.join(outDir, 'alarm.wav');

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outFile, buffer);

console.log(`✅ Alarma generada: ${outFile}`);
console.log(`   Duración: ${TOTAL_DURATION}s | ${NUM_SAMPLES} muestras | ${dataBytes} bytes`);
