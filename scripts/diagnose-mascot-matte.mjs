import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ranges = [
  [1, 254],
  [8, 247],
  [16, 239],
  [32, 223],
  [64, 191],
];

async function stats(label, diskPath) {
  const buckets = ranges.map(([min, max]) => ({ min, max, pixels: 0, excess: 0, maxExcess: 0 }));
  await new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', [
      '-hide_banner', '-loglevel', 'error',
      '-c:v', 'libvpx-vp9', '-i', diskPath,
      '-an', '-sn', '-dn', '-pix_fmt', 'rgba', '-f', 'rawvideo', 'pipe:1',
    ], { stdio: ['ignore', 'pipe', 'pipe'] });
    let carry = Buffer.alloc(0);
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      const data = carry.length ? Buffer.concat([carry, chunk]) : chunk;
      const complete = data.length - (data.length % 4);
      for (let i = 0; i < complete; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];
        const excess = Math.max(0, g - Math.max(r, b));
        for (const bucket of buckets) {
          if (a >= bucket.min && a <= bucket.max) {
            bucket.pixels += 1;
            bucket.excess += excess;
            bucket.maxExcess = Math.max(bucket.maxExcess, excess);
          }
        }
      }
      carry = data.subarray(complete);
    });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('close', (code) => code === 0 ? resolve() : reject(new Error(stderr)));
  });
  console.log(`MATTE DIAGNOSTIC ${label}`);
  for (const bucket of buckets) {
    const mean = bucket.pixels ? bucket.excess / bucket.pixels : 0;
    console.log(`  alpha ${bucket.min}-${bucket.max}: pixels=${bucket.pixels} meanGreenExcess=${mean.toFixed(2)} max=${bucket.maxExcess}`);
  }
}

const idle = 'public/mascots/tortoise/tortoise-starter-idle-v1.webm';
await stats('approved idle', idle);

const baseSha = process.env.BASE_SHA || '306bf205b4a7f9c746248abfffb77ec0ac3c6d1a';
const rejectedPath = 'public/mascots/tortoise/tortoise-starter-wave-v1.webm';
const show = spawnSync('git', ['show', `${baseSha}:${rejectedPath}`], { encoding: 'buffer', maxBuffer: 16 * 1024 * 1024 });
if (show.status === 0 && show.stdout?.length) {
  const dir = mkdtempSync(join(tmpdir(), 'ninfit-matte-'));
  const rejected = join(dir, 'rejected-wave.webm');
  writeFileSync(rejected, show.stdout);
  await stats('rejected wave from base', rejected);
} else {
  console.log('MATTE DIAGNOSTIC rejected wave unavailable from base commit');
}
