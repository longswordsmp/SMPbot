'use strict';

/**
 * Pure-canvas branding art generator for SMPbot — BlockBench-style renders.
 *
 * Zero copyrighted assets: every asset is composited from primitives into
 * textured isometric Minecraft-style blocks (grass, ore, gem, beacon) with
 * shaded faces and pixel texel detail, plus a 3D-extruded server name. Only the
 * colors passed in are used (the guild's active theme, or the owner's custom
 * colors), so the art always matches the server. Rendering is deterministic for
 * a given seed, so a previewed asset reproduces exactly on Apply while
 * "Regenerate" bumps the seed for a fresh variant.
 *
 * Text uses a bold sans stack ('bold Npx sans-serif') rendered with a hard
 * extrude/shadow to evoke a blocky Minecraft look without a bundled font file.
 */

const { createCanvas } = require('@napi-rs/canvas');

const STYLES = [
  { id: 'blocks', label: 'Grass Block', emoji: '🟩', description: 'Iconic isometric grass block' },
  { id: 'pixel', label: 'Ore Block', emoji: '💎', description: 'Stone block studded with themed ore' },
  { id: 'glow', label: 'Beacon', emoji: '🔆', description: 'Glowing beacon block with a light beam' },
  { id: 'gradient', label: 'Gem Block', emoji: '💠', description: 'Faceted cut-gem crystal block' },
];
const STYLE_IDS = STYLES.map((s) => s.id);
const DEFAULT_STYLE = 'blocks';

function normalizeStyle(id) {
  return STYLE_IDS.includes(id) ? id : DEFAULT_STYLE;
}
function styleLabel(id) {
  const s = STYLES.find((x) => x.id === id);
  return s ? s.label : STYLES[0].label;
}

// ---------------------------------------------------------------------------
// Color helpers (operate on 0xRRGGBB integers)
// ---------------------------------------------------------------------------

function clamp8(v) {
  return Math.max(0, Math.min(255, Math.round(v)));
}
function toRgb(int) {
  const n = Number(int) & 0xffffff;
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}
function css(int, alpha = 1) {
  const { r, g, b } = toRgb(int);
  return alpha >= 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
}
function mix(a, b, t) {
  const A = toRgb(a);
  const B = toRgb(b);
  return (clamp8(A.r + (B.r - A.r) * t) << 16) | (clamp8(A.g + (B.g - A.g) * t) << 8) | clamp8(A.b + (B.b - A.b) * t);
}
function lighten(int, t) {
  return mix(int, 0xffffff, t);
}
function darken(int, t) {
  return mix(int, 0x000000, t);
}
/** Shade a color: f > 0 lightens, f < 0 darkens. */
function shade(int, f) {
  return f >= 0 ? lighten(int, f) : darken(int, -f);
}
function normColors(colors) {
  const c = colors || {};
  const primary = Number.isInteger(c.primary) ? c.primary & 0xffffff : 0x2ecc71;
  const secondary = Number.isInteger(c.secondary) ? c.secondary & 0xffffff : darken(primary, 0.35);
  const accent = Number.isInteger(c.accent) ? c.accent & 0xffffff : lighten(primary, 0.3);
  return { primary, secondary, accent };
}

// ---------------------------------------------------------------------------
// Deterministic RNG + hashing
// ---------------------------------------------------------------------------

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(a) {
  let state = a >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), 1 | t);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Stable per-texel noise in [-1, 1] for a face. */
function texel(i, j, salt) {
  const h = hashStr(`${salt}:${i},${j}`);
  return ((h & 0xffff) / 0xffff) * 2 - 1;
}
function initial(name) {
  const s = String(name || '').trim();
  return s ? s[0].toUpperCase() : 'S';
}

// ---------------------------------------------------------------------------
// Backdrop
// ---------------------------------------------------------------------------

function drawNoise(ctx, W, H, rng, alpha) {
  const cell = Math.max(6, Math.round(Math.max(W, H) / 30));
  for (let y = 0; y < H; y += cell) {
    for (let x = 0; x < W; x += cell) {
      const r = rng();
      if (r < 0.6) continue;
      ctx.fillStyle = r > 0.9 ? `rgba(255,255,255,${(r * alpha).toFixed(3)})` : `rgba(0,0,0,${(r * alpha).toFixed(3)})`;
      ctx.fillRect(x, y, cell, cell);
    }
  }
}

function paintBackdrop(ctx, W, H, colors, style, rng, circle) {
  const dark = style === 'glow';
  if (dark) {
    const g = ctx.createRadialGradient(W / 2, H * 0.42, H * 0.05, W / 2, H / 2, Math.max(W, H) * 0.7);
    g.addColorStop(0, css(mix(colors.secondary, 0x0b0d16, 0.55)));
    g.addColorStop(1, css(0x05060a));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  } else if (circle) {
    const g = ctx.createRadialGradient(W / 2, H * 0.4, H * 0.05, W / 2, H / 2, Math.max(W, H) * 0.62);
    g.addColorStop(0, css(lighten(colors.primary, 0.18)));
    g.addColorStop(0.7, css(colors.primary));
    g.addColorStop(1, css(darken(colors.secondary, 0.42)));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  } else {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, css(lighten(colors.primary, 0.22)));
    g.addColorStop(0.55, css(colors.primary));
    g.addColorStop(1, css(darken(colors.secondary, 0.34)));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  drawNoise(ctx, W, H, rng, dark ? 0.07 : 0.05);

  const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.2, W / 2, H / 2, Math.max(W, H) * 0.78);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, dark ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.34)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}
function drawFrame(ctx, W, H, colors) {
  const inset = Math.round(Math.min(W, H) * 0.035);
  const r = Math.round(Math.min(W, H) * 0.06);
  ctx.save();
  ctx.lineWidth = Math.max(2, Math.min(W, H) * 0.008);
  ctx.strokeStyle = css(lighten(colors.accent, 0.3), 0.32);
  roundRectPath(ctx, inset, inset, W - inset * 2, H - inset * 2, r);
  ctx.stroke();
  ctx.restore();
}
function drawAvatarRing(ctx, W, H, colors) {
  const r = Math.min(W, H) * 0.46;
  ctx.save();
  ctx.lineWidth = Math.min(W, H) * 0.03;
  ctx.strokeStyle = css(lighten(colors.accent, 0.35), 0.7);
  ctx.shadowColor = css(colors.accent, 0.6);
  ctx.shadowBlur = Math.min(W, H) * 0.03;
  ctx.beginPath();
  ctx.arc(W / 2, H / 2, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Isometric textured block — the heart of the BlockBench look
// ---------------------------------------------------------------------------

/**
 * Draw one isometric cube centered at (cx, cy) with top-face width `W`.
 * `faceColor(face, i, j, N)` returns the 0xRRGGBB color of texel (i,j) on the
 * given face ('top'|'left'|'right'); it is called with pre-shaded bases so
 * textures only add local variation. N is the texels-per-edge resolution.
 */
function isoBlock(ctx, cx, cy, W, faceColor, { N = 8, outline = true } = {}) {
  const halfW = W / 2;
  const quarterH = W / 4; // 2:1 isometric
  const depth = W * 0.52;

  // Top diamond corners.
  const T = { x: cx, y: cy - quarterH - depth / 2 }; // top vertex
  const R = { x: cx + halfW, y: T.y + quarterH };
  const B = { x: cx, y: T.y + quarterH * 2 };
  const L = { x: cx - halfW, y: T.y + quarterH };

  const paintFace = (O, U, V, face) => {
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const a0 = i / N;
        const b0 = j / N;
        const s = 1 / N;
        const p = (a, b) => ({ x: O.x + U.x * a + V.x * b, y: O.y + U.y * a + V.y * b });
        const A = p(a0, b0);
        const C = p(a0 + s, b0);
        const D = p(a0 + s, b0 + s);
        const E = p(a0, b0 + s);
        ctx.beginPath();
        ctx.moveTo(A.x, A.y);
        ctx.lineTo(C.x, C.y);
        ctx.lineTo(D.x, D.y);
        ctx.lineTo(E.x, E.y);
        ctx.closePath();
        const color = css(faceColor(face, i, j, N));
        ctx.fillStyle = color;
        ctx.fill();
        // Same-color hairline stroke hides antialiased seams between texels.
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  };

  // Left face: origin L, U toward B, V downward.
  paintFace(L, { x: B.x - L.x, y: B.y - L.y }, { x: 0, y: depth }, 'left');
  // Right face: origin B, U toward R, V downward.
  paintFace(B, { x: R.x - B.x, y: R.y - B.y }, { x: 0, y: depth }, 'right');
  // Top face: origin T, U toward R, V toward L.
  paintFace(T, { x: R.x - T.x, y: R.y - T.y }, { x: L.x - T.x, y: L.y - T.y }, 'top');

  if (outline) {
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(1.5, W * 0.012);
    ctx.strokeStyle = 'rgba(0,0,0,0.28)';
    // outer silhouette
    ctx.beginPath();
    ctx.moveTo(T.x, T.y);
    ctx.lineTo(R.x, R.y);
    ctx.lineTo(R.x, R.y + depth);
    ctx.lineTo(B.x, B.y + depth);
    ctx.lineTo(L.x, L.y + depth);
    ctx.lineTo(L.x, L.y);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
  return { T, R, B, L, depth };
}

function groundShadow(ctx, cx, cy, W) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + W * 0.5, W * 0.44, W * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ---- per-style face texturers ---------------------------------------------

// Face base shading so the cube reads as 3D under a top-left light.
const FACE_SHADE = { top: 0.08, left: -0.16, right: -0.36 };

/** Grass block: green top, earthy sides with a grassy overhang row. */
function grassFace(colors) {
  const grass = colors.primary;
  const dirt = darken(mix(colors.primary, 0x6d4a2a, 0.5), 0.02);
  return (face, i, j, N) => {
    const isSide = face !== 'top';
    let base = isSide ? dirt : grass;
    // grassy overhang on the top rows of the side faces
    if (isSide && j <= (N >= 8 ? 1 : 0)) base = mix(grass, dirt, j === 0 ? 0.1 : 0.45);
    const n = texel(i, j, face) * 0.09;
    return shade(shade(base, FACE_SHADE[face]), n);
  };
}

/** Ore block: stony grey with clustered themed gems. */
function oreFace(colors) {
  const stone = mix(colors.secondary, 0x8b8f96, 0.62);
  const gem = colors.accent;
  return (face, i, j) => {
    const n = texel(i, j, `s${face}`) * 0.12;
    let base = shade(stone, FACE_SHADE[face]);
    // deterministic ore pockets
    const ore = hashStr(`ore:${face}:${i >> 1},${j >> 1}`) % 7 === 0;
    if (ore) {
      const center = (i & 1) === 0 && (j & 1) === 0;
      base = shade(center ? lighten(gem, 0.28) : gem, FACE_SHADE[face] * 0.5);
    }
    return shade(base, n);
  };
}

/** Gem block: faceted crystal — smooth diagonal gradient per face. */
function gemFace(colors) {
  const hi = lighten(colors.accent, 0.35);
  const lo = darken(colors.primary, 0.1);
  return (face, i, j, N) => {
    const t = (i + j) / (2 * (N - 1 || 1));
    const base = mix(hi, lo, t);
    const facet = ((i + j) & 1) === 0 ? 0.06 : -0.05; // subtle cut-facet flip
    return shade(shade(base, FACE_SHADE[face]), facet);
  };
}

/** Beacon block: dark obsidian shell with a glowing accent core. */
function beaconFace(colors) {
  const shell = darken(mix(colors.secondary, 0x1a1030, 0.5), 0.15);
  const core = colors.accent;
  return (face, i, j, N) => {
    const edge = i === 0 || j === 0 || i === N - 1 || j === N - 1;
    const mid = i >= N * 0.28 && i <= N * 0.72 && j >= N * 0.28 && j <= N * 0.72;
    let base = shade(shell, FACE_SHADE[face]);
    if (mid) base = shade(mix(core, shell, 0.15), FACE_SHADE[face] * 0.4);
    if (edge) base = darken(base, 0.15);
    return shade(base, texel(i, j, face) * 0.06);
  };
}

// ---- style compositions ----------------------------------------------------

function drawBlockEmblem(style, ctx, cx, cy, size, colors, rng) {
  groundShadow(ctx, cx, cy, size);

  if (style === 'glow') {
    // Beacon beam behind the block.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const beam = ctx.createLinearGradient(cx, cy - size * 2.2, cx, cy);
    beam.addColorStop(0, css(colors.accent, 0));
    beam.addColorStop(1, css(lighten(colors.accent, 0.2), 0.5));
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(cx - size * 0.16, cy);
    ctx.lineTo(cx + size * 0.16, cy);
    ctx.lineTo(cx + size * 0.28, cy - size * 2.2);
    ctx.lineTo(cx - size * 0.28, cy - size * 2.2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // A couple of small floating accent blocks behind the hero for depth.
  const faceOf = { blocks: grassFace, pixel: oreFace, glow: beaconFace, gradient: gemFace }[style] || grassFace;
  const smalls = [
    { dx: size * 0.62, dy: -size * 0.28, s: 0.28 },
    { dx: -size * 0.66, dy: size * 0.06, s: 0.22 },
  ];
  for (const sm of smalls) {
    ctx.save();
    ctx.globalAlpha = 0.85;
    isoBlock(ctx, cx + sm.dx, cy + sm.dy, size * sm.s, faceOf(colors), { N: 4, outline: true });
    ctx.restore();
  }

  // Hero block with a soft glow.
  ctx.save();
  ctx.shadowColor = css(colors.accent, style === 'glow' ? 0.85 : 0.5);
  ctx.shadowBlur = size * (style === 'glow' ? 0.12 : 0.07);
  isoBlock(ctx, cx, cy - size * 0.12, size, faceOf(colors), { N: 8, outline: true });
  ctx.restore();

  void rng;
}

// ---------------------------------------------------------------------------
// Blocky 3D title
// ---------------------------------------------------------------------------

function fitFont(ctx, text, weight, maxW, startPx, minPx) {
  let fs = startPx;
  ctx.font = `${weight} ${fs}px sans-serif`;
  while (fs > minPx && ctx.measureText(text).width > maxW) {
    fs -= 2;
    ctx.font = `${weight} ${fs}px sans-serif`;
  }
  return fs;
}

/** Draw extruded, hard-shadowed title text — a blocky Minecraft-ish feel. */
function drawTitle(ctx, x, y, text, fs, colors, align = 'left') {
  ctx.save();
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.font = `bold ${fs}px sans-serif`;
  // extrude down-right
  const depth = Math.max(2, Math.round(fs * 0.09));
  ctx.fillStyle = css(darken(colors.secondary, 0.55));
  for (let d = depth; d >= 1; d--) ctx.fillText(text, x + d, y + d);
  // face
  ctx.fillStyle = 'rgba(255,255,255,0.98)';
  ctx.fillText(text, x, y);
  // outline
  ctx.lineWidth = Math.max(1, fs * 0.03);
  ctx.strokeStyle = css(darken(colors.secondary, 0.5), 0.9);
  ctx.strokeText(text, x, y);
  ctx.restore();
}

function drawSubtitle(ctx, x, y, text, fs, colors, align = 'left') {
  ctx.save();
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.font = `bold ${fs}px sans-serif`;
  ctx.fillStyle = css(lighten(colors.accent, 0.35), 0.96);
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = fs * 0.25;
  ctx.fillText(text, x, y);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Top-level render
// ---------------------------------------------------------------------------

function renderCanvas({ style, kind, colors, name, tagline, seed }) {
  const st = normalizeStyle(style);
  const banner = kind === 'banner';
  const circle = kind === 'avatar' || kind === 'webhook';
  const W = banner ? 1200 : 512;
  const H = banner ? 400 : 512;

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const rng = mulberry32(((seed >>> 0) ^ hashStr(`${st}:${kind}`)) >>> 0);

  paintBackdrop(ctx, W, H, colors, st, rng, circle);

  if (banner) {
    // Block on the left, name + tagline on the right.
    const blockCx = H * 0.52;
    const blockCy = H * 0.5;
    drawBlockEmblem(st, ctx, blockCx, blockCy, H * 0.34, colors, rng);

    const tx = Math.round(H + H * 0.04);
    const maxW = W - tx - Math.round(H * 0.1);
    const nm = String(name || 'SMP Server');
    const nmFs = fitFont(ctx, nm, 'bold', maxW, Math.floor(H * 0.26), 20);
    const baseY = tagline ? H * 0.46 : H * 0.56;
    // accent bar
    ctx.fillStyle = css(lighten(colors.accent, 0.15), 0.95);
    ctx.fillRect(tx, Math.round(baseY - nmFs * 1.02), Math.round(Math.min(maxW, nmFs * 5)), Math.max(3, Math.round(H * 0.012)));
    drawTitle(ctx, tx, Math.round(baseY), nm, nmFs, colors, 'left');
    if (tagline) {
      const tg = String(tagline);
      const tgFs = fitFont(ctx, tg, 'bold', maxW, Math.floor(H * 0.1), 10);
      drawSubtitle(ctx, tx, Math.round(baseY + tgFs * 1.7), tg, tgFs, colors, 'left');
    }
    drawFrame(ctx, W, H, colors);
  } else if (circle) {
    // Centered block, no text (unreadable at avatar size); ring frame.
    drawBlockEmblem(st, ctx, W / 2, H * 0.46, W * 0.34, colors, rng);
    drawAvatarRing(ctx, W, H, colors);
  } else {
    // Logo: hero block up top, server name across the bottom.
    drawBlockEmblem(st, ctx, W / 2, H * 0.38, W * 0.34, colors, rng);
    const nm = String(name || 'SMP');
    const maxW = W * 0.86;
    const nmFs = fitFont(ctx, nm, 'bold', maxW, Math.floor(H * 0.16), 22);
    ctx.textAlign = 'center';
    // accent underline
    const uw = Math.min(maxW, ctx.measureText(nm).width * 1.06);
    ctx.fillStyle = css(lighten(colors.accent, 0.15), 0.95);
    ctx.fillRect((W - uw) / 2, Math.round(H * 0.9), uw, Math.max(3, Math.round(H * 0.012)));
    drawTitle(ctx, W / 2, Math.round(H * 0.87), nm, nmFs, colors, 'center');
    drawFrame(ctx, W, H, colors);
  }

  return canvas.toBuffer('image/png');
}

/**
 * Render a single branding asset.
 * @returns {Buffer} PNG buffer
 */
function generateAsset({ style, kind = 'logo', colors, name = 'SMP', tagline = '', seed = 0 } = {}) {
  return renderCanvas({
    style: normalizeStyle(style),
    kind,
    colors: normColors(colors),
    name,
    tagline,
    seed: seed >>> 0,
  });
}

/** Render the full set (logo/banner/avatar/webhook) from one parameter object. */
function generateSet(params = {}) {
  return {
    logo: generateAsset({ ...params, kind: 'logo' }),
    banner: generateAsset({ ...params, kind: 'banner' }),
    avatar: generateAsset({ ...params, kind: 'avatar' }),
    webhook: generateAsset({ ...params, kind: 'webhook' }),
  };
}

module.exports = {
  STYLES,
  STYLE_IDS,
  DEFAULT_STYLE,
  normalizeStyle,
  styleLabel,
  normColors,
  lighten,
  darken,
  mix,
  initial,
  generateAsset,
  generateSet,
};
