import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const root = process.cwd();
const manifestPath = join(root, 'docs', 'brand', 'mascot-asset-provenance.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const publicRoot = join(root, manifest.policy.publicRoot);
const maxMeanGreenExcess = manifest.policy.maxMeanGreenExcess;
const matteAlphaMin = manifest.policy.matteAlphaMin;
const matteAlphaMax = manifest.policy.matteAlphaMax;
const supportedExtensions = new Set(['.png', '.webp', '.webm']);

function fail(message) {
  throw new Error(`[mascot-asset-contract] ${message}`);
}

function publicUrl(diskPath) {
  return `/${relative(join(root, 'public'), diskPath).replaceAll('\\', '/')}`;
}

function walkAssets(directory) {
  const paths = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) paths.push(...walkAssets(path));
    if (entry.isFile() && supportedExtensions.has(extname(entry.name).toLowerCase())) {
      paths.push(publicUrl(path));
    }
  }
  return paths.sort();
}

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
}

function registryAssetUrls(path) {
  const source = stripComments(readFileSync(join(root, path), 'utf8'));
  return [...source.matchAll(/['"`]((?:\/mascots\/)[^'"`]+)['"`]/g)]
    .map((match) => match[1])
    .filter((assetPath) => !assetPath.includes('${'))
    .sort();
}

function assertSameSet(actual, expected, label) {
  const left = [...new Set(actual)].sort();
  const right = [...new Set(expected)].sort();
  if (JSON.stringify(left) !== JSON.stringify(right)) {
    fail(`${label}\nactual: ${JSON.stringify(left)}\nexpected: ${JSON.stringify(right)}`);
  }
}

const ffmpegProbe = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' });
if (ffmpegProbe.error || ffmpegProbe.status !== 0) {
  fail('ffmpeg is required for G10/G11 pixel verification and was not available');
}
if (!Number.isInteger(matteAlphaMin) || !Number.isInteger(matteAlphaMax)
  || matteAlphaMin < 1 || matteAlphaMax > 254 || matteAlphaMin > matteAlphaMax) {
  fail(`invalid matte alpha edge band ${matteAlphaMin}-${matteAlphaMax}`);
}

const approved = manifest.assets;
const approvedByPath = new Map(approved.map((asset) => [asset.path, asset]));
if (approvedByPath.size !== approved.length) fail('provenance manifest contains duplicate asset paths');

for (const asset of approved) {
  if (asset.approval !== 'human-reviewed-production') {
    fail(`${asset.path} is not marked human-reviewed-production`);
  }
  if (asset.watermarkFree !== true) {
    fail(`${asset.path} is not explicitly asserted watermark-free`);
  }
  if (!asset.reviewRecord || typeof asset.reviewRecord !== 'string') {
    fail(`${asset.path} has no review/provenance record`);
  }
  const diskPath = join(root, 'public', asset.path.replace(/^\//, ''));
  if (!existsSync(diskPath)) fail(`${asset.path} is declared but missing from public/`);
}

for (const rejected of manifest.rejected) {
  const diskPath = join(root, 'public', rejected.path.replace(/^\//, ''));
  if (existsSync(diskPath)) fail(`rejected asset is still shipped from public/: ${rejected.path}`);
}

const shippedAssets = walkAssets(publicRoot);
const manifestAssets = approved.map((asset) => asset.path).sort();
assertSameSet(shippedAssets, manifestAssets, 'every shipped mascot asset must have approved provenance');

const registryAssets = [
  ...registryAssetUrls('src/ui/mascotStageArt.ts'),
  ...registryAssetUrls('src/ui/mascotActivityArt.ts'),
];
assertSameSet(registryAssets, manifestAssets, 'public mascot assets and central registry ownership must agree');

for (const asset of approved) {
  if (asset.pairedMotion) {
    const motion = approvedByPath.get(asset.pairedMotion);
    if (!motion) fail(`${asset.path} pairs to undeclared motion ${asset.pairedMotion}`);
    if (motion.pairedStill !== asset.path) {
      fail(`${asset.path} / ${asset.pairedMotion} pairing is not reciprocal`);
    }
  }
  if (asset.pairedStill) {
    const still = approvedByPath.get(asset.pairedStill);
    if (!still) fail(`${asset.path} pairs to undeclared still ${asset.pairedStill}`);
    if (still.pairedMotion !== asset.path) {
      fail(`${asset.path} / ${asset.pairedStill} pairing is not reciprocal`);
    }
  }
}

function inputArgs(assetPath) {
  const diskPath = join(root, 'public', assetPath.replace(/^\//, ''));
  return assetPath.endsWith('.webm')
    ? ['-c:v', 'libvpx-vp9', '-i', diskPath]
    : ['-i', diskPath];
}

function alphaBoundingBox(assetPath) {
  const result = spawnSync(
    'ffmpeg',
    [
      '-hide_banner',
      '-loglevel', 'info',
      ...inputArgs(assetPath),
      '-vf', 'select=eq(n\\,0),format=rgba,alphaextract,bbox',
      '-frames:v', '1',
      '-an',
      '-f', 'null',
      '-',
    ],
    { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 },
  );
  if (result.error || result.status !== 0) {
    fail(`ffmpeg could not decode frame 0 of ${assetPath}: ${result.stderr || result.error?.message}`);
  }
  const matches = [...result.stderr.matchAll(/crop=(\d+):(\d+):(\d+):(\d+)/g)];
  const match = matches.at(-1);
  if (!match) fail(`no alpha bounding box was produced for ${assetPath}`);
  const [, width, height, x, y] = match;
  return `${width}x${height}+${x}+${y}`;
}

for (const motion of approved.filter((asset) => asset.pairedStill)) {
  const motionBox = alphaBoundingBox(motion.path);
  const stillBox = alphaBoundingBox(motion.pairedStill);
  if (motionBox !== stillBox) {
    fail(`G10 frame-0 pairing failed: ${motion.path}=${motionBox}, ${motion.pairedStill}=${stillBox}`);
  }
  console.log(`G10 pair OK: ${motion.path} ↔ ${motion.pairedStill} (${motionBox})`);
}

async function matteStats(assetPath) {
  return await new Promise((resolve, reject) => {
    const child = spawn(
      'ffmpeg',
      [
        '-hide_banner',
        '-loglevel', 'error',
        ...inputArgs(assetPath),
        '-an',
        '-sn',
        '-dn',
        '-pix_fmt', 'rgba',
        '-f', 'rawvideo',
        'pipe:1',
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );

    let carry = Buffer.alloc(0);
    let edgePixels = 0;
    let greenExcessTotal = 0;
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      const data = carry.length === 0 ? chunk : Buffer.concat([carry, chunk]);
      const completeLength = data.length - (data.length % 4);
      for (let offset = 0; offset < completeLength; offset += 4) {
        const red = data[offset];
        const green = data[offset + 1];
        const blue = data[offset + 2];
        const alpha = data[offset + 3];
        // The summit's "semi-transparent alpha edge" excludes codec noise very near
        // fully transparent/opaque. Reproduction against the rejected wave gives
        // 53.74 in this 16-239 band (the recorded 53.8) while the clean idle gives 0.
        if (alpha >= matteAlphaMin && alpha <= matteAlphaMax) {
          edgePixels += 1;
          greenExcessTotal += Math.max(0, green - Math.max(red, blue));
        }
      }
      carry = data.subarray(completeLength);
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ffmpeg matte decode failed for ${assetPath}: ${stderr}`));
        return;
      }
      if (carry.length !== 0) {
        reject(new Error(`raw RGBA decode for ${assetPath} ended mid-pixel`));
        return;
      }
      const meanGreenExcess = edgePixels === 0 ? 0 : greenExcessTotal / edgePixels;
      resolve({ edgePixels, meanGreenExcess });
    });
  });
}

for (const asset of approved) {
  const stats = await matteStats(asset.path);
  if (stats.meanGreenExcess > maxMeanGreenExcess) {
    fail(
      `G11 matte spill failed: ${asset.path} mean green excess ${stats.meanGreenExcess.toFixed(2)} > ${maxMeanGreenExcess} across ${stats.edgePixels} alpha-${matteAlphaMin}-${matteAlphaMax} edge pixels`,
    );
  }
  console.log(
    `G11 matte OK: ${asset.path} mean green excess ${stats.meanGreenExcess.toFixed(2)} across ${stats.edgePixels} alpha-${matteAlphaMin}-${matteAlphaMax} edge pixels`,
  );
}

console.log(`G9 provenance OK: ${approved.length} shipped mascot assets are approved and watermark-free; ${manifest.rejected.length} rejected assets are absent from public/`);
