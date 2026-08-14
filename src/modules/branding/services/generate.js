'use strict';

/**
 * Pure-canvas branding art generator for SMPbot.
 *
 * Zero copyrighted assets: every asset is composited from primitive shapes —
 * isometric voxel cubes, chunky pixel monograms, neon emblems, gradient
 * shields — using only the colors passed in (the guild's active theme, or the
 * owner's custom colors). Rendering is deterministic for a given seed so a
 * previewed asset can be reproduced exactly on Apply, while "Regenerate" simply
 * bumps the seed to produce a fresh variant.
 *
 * Text uses a plain bold sans stack ('bold Npx sans-serif') and never depends
 * on a bundled font file.
 */

const { createCanvas } = require('@napi-rs/canvas');

const STYLES = [
  { id: 'blocks', label: 'Blocks', emoji: '🧊', description: 'Isometric voxel cube cluster' },
  { id: 'pixel', label: 'Pixel', emoji: '🟪', description: 'Chunky pixel-art server monogram' },
  { id: 'glow', label: 'Glow', emoji: '💡', description: 'Neon emblem on a dark backdrop' },
  { id: 'gradient', label: 'Gradient', emoji: '🌈', description: 'Smooth gradient shield emblem' },
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
  if (alpha >= 1) return `rgb(${r}, ${g}, ${b})`;
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
}

function mix(a, b, t) {
  const A = toRgb(a);
  const B = toRgb(b);
  const r = clamp8(A.r + (B.r - A.r) * t);
  const g = clamp8(A.g + (B.g - A.g) * t);
  const bl = clamp8(A.b + (B.b - A.b) * t);
  return (r << 16) | (g << 8) | bl;
}

function lighten(int, t) {
  return mix(int, 0xffffff, t);
}

function darken(int, t) {
  return mix(int, 0x000000, t);
}

function normColors(colors) {
  const c = colors || {};
  const primary = Number.isInteger(c.primary) ? c.primary & 0xffffff : 0x2ecc71;
  const secondary = Number.isInteger(c.secondary) ? c.secondary & 0xffffff : darken(primary, 0.35);
  const accent = Number.isInteger(c.accent) ? c.accent & 0xffffff : lighten(primary, 0.3);
  return { primary, secondary, accent };
}

// ---------------------------------------------------------------------------
// Deterministic RNG
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

function initial(name) {
  const s = String(name || '').trim();
  if (!s) return 'S';
  const ch = s[0];
  return ch.toUpperCase();
}

// ---------------------------------------------------------------------------
// Shared painters
// ---------------------------------------------------------------------------

function drawNoise(ctx, W, H, rng, alpha) {
  const cell = Math.max(6, Math.round(Math.max(W, H) / 26));
  for (let y = 0; y < H; y += cell) {
    for (let x = 0; x < W; x += cell) {
      const r = rng();
      if (r < 0.55) continue;
      const a = (r * alpha).toFixed(3);
      ctx.fillStyle = r > 0.9 ? `rgba(255, 255, 255, ${a})` : `rgba(0, 0, 0, ${a})`;
      ctx.fillRect(x, y, cell, cell);
    }
  }
}

function paintBackdrop(ctx, W, H, colors, style, rng, circle) {
  if (style === 'glow') {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, css(mix(colors.secondary, 0x0b0d12, 0.72)));
    g.addColorStop(1, css(0x05060a));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  } else if (circle) {
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.05, W / 2, H / 2, Math.max(W, H) * 0.62);
    g.addColorStop(0, css(lighten(colors.primary, 0.14)));
    g.addColorStop(0.7, css(colors.primary));
    g.addColorStop(1, css(darken(colors.secondary, 0.38)));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  } else {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, css(lighten(colors.primary, 0.2)));
    g.addColorStop(0.55, css(colors.primary));
    g.addColorStop(1, css(darken(colors.secondary, 0.3)));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  drawNoise(ctx, W, H, rng, style === 'glow' ? 0.07 : 0.05);

  const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.2, W / 2, H / 2, Math.max(W, H) * 0.78);
  vg.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vg.addColorStop(1, style === 'glow' ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.32)');
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
  const cx = W / 2;
  const cy = H / 2;
  const r = Math.min(W, H) * 0.46;
  ctx.save();
  ctx.lineWidth = Math.min(W, H) * 0.022;
  ctx.strokeStyle = css(lighten(colors.accent, 0.35), 0.6);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function hexPath(ctx, cx, cy, r, rot) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = rot + (i * Math.PI) / 3;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

// ---------------------------------------------------------------------------
// Style: blocks (isometric voxel cubes)
// ---------------------------------------------------------------------------

function facePoint(T, u, v, a, b) {
  return { x: T.x + u.x * a + v.x * b, y: T.y + u.y * a + v.y * b };
}

function isoCube(ctx, x, y, tw, depth, topColor, edgeColor, rng, studs) {
  const th = tw * 0.5;
  const top = lighten(topColor, 0.16);
  const left = darken(topColor, 0.12);
  const right = darken(topColor, 0.32);

  // left face
  ctx.beginPath();
  ctx.moveTo(x - tw / 2, y + th / 2);
  ctx.lineTo(x, y + th);
  ctx.lineTo(x, y + th + depth);
  ctx.lineTo(x - tw / 2, y + th / 2 + depth);
  ctx.closePath();
  ctx.fillStyle = css(left);
  ctx.fill();

  // right face
  ctx.beginPath();
  ctx.moveTo(x, y + th);
  ctx.lineTo(x + tw / 2, y + th / 2);
  ctx.lineTo(x + tw / 2, y + th / 2 + depth);
  ctx.lineTo(x, y + th + depth);
  ctx.closePath();
  ctx.fillStyle = css(right);
  ctx.fill();

  // top face
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + tw / 2, y + th / 2);
  ctx.lineTo(x, y + th);
  ctx.lineTo(x - tw / 2, y + th / 2);
  ctx.closePath();
  ctx.fillStyle = css(top);
  ctx.fill();

  if (studs) {
    const T = { x, y };
    const u = { x: tw / 2, y: th / 2 };
    const v = { x: -tw / 2, y: th / 2 };
    const n = 3;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const m = 0.06;
        const A = facePoint(T, u, v, i / n + m, j / n + m);
        const B = facePoint(T, u, v, (i + 1) / n - m, j / n + m);
        const C = facePoint(T, u, v, (i + 1) / n - m, (j + 1) / n - m);
        const D = facePoint(T, u, v, i / n + m, (j + 1) / n - m);
        ctx.beginPath();
        ctx.moveTo(A.x, A.y);
        ctx.lineTo(B.x, B.y);
        ctx.lineTo(C.x, C.y);
        ctx.lineTo(D.x, D.y);
        ctx.closePath();
        const shade = rng() * 0.18 - 0.05;
        ctx.fillStyle = css(shade >= 0 ? lighten(top, shade) : darken(top, -shade), 0.92);
        ctx.fill();
      }
    }
  }

  // top edge highlight
  ctx.strokeStyle = css(lighten(edgeColor, 0.4), 0.5);
  ctx.lineWidth = Math.max(1, tw * 0.012);
  ctx.beginPath();
  ctx.moveTo(x - tw / 2, y + th / 2);
  ctx.lineTo(x, y);
  ctx.lineTo(x + tw / 2, y + th / 2);
  ctx.stroke();
}

function emblemBlocks(ctx, cx, cy, size, colors, name, rng) {
  ctx.save();

  // ground shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + size * 0.36, size * 0.36, size * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();

  const tw = size * 0.62;
  const depth = tw * 0.62;

  // decorative floating cubes behind
  const smalls = [
    { dx: size * 0.34, dy: -size * 0.32, s: 0.22, c: colors.accent },
    { dx: -size * 0.4, dy: size * 0.02, s: 0.17, c: colors.secondary },
  ];
  for (const sc of smalls) {
    const stw = tw * sc.s;
    ctx.save();
    ctx.globalAlpha = 0.9;
    isoCube(ctx, cx + sc.dx, cy + sc.dy, stw, stw * 0.62, sc.c, colors.accent, rng, false);
    ctx.restore();
  }

  // hero cube
  ctx.save();
  ctx.shadowColor = css(colors.accent, 0.55);
  ctx.shadowBlur = size * 0.06;
  isoCube(ctx, cx, cy - depth * 0.2 - tw * 0.25, tw, depth, colors.primary, colors.accent, rng, true);
  ctx.restore();

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Style: pixel (chunky pixel-art monogram)
// ---------------------------------------------------------------------------

function drawPixelBlock(ctx, x, y, cell, base) {
  ctx.fillStyle = css(base);
  ctx.fillRect(x, y, cell, cell);
  const b = cell * 0.16;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.fillRect(x, y, cell, b);
  ctx.fillRect(x, y, b, cell);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
  ctx.fillRect(x, y + cell - b, cell, b);
  ctx.fillRect(x + cell - b, y, b, cell);
}

function emblemPixel(ctx, cx, cy, size, colors, name, rng) {
  const grid = 11;
  const ss = 8;
  const R = grid * ss;
  const letter = initial(name);

  const off = createCanvas(R, R);
  const o = off.getContext('2d');
  o.fillStyle = '#000';
  o.fillRect(0, 0, R, R);
  o.fillStyle = '#fff';
  o.textAlign = 'center';
  o.textBaseline = 'middle';
  let fs = R;
  o.font = `bold ${fs}px sans-serif`;
  while (fs > 6 && o.measureText(letter).width > R * 0.78) {
    fs -= 2;
    o.font = `bold ${fs}px sans-serif`;
  }
  o.fillText(letter, R / 2, R / 2 + R * 0.02);
  const data = o.getImageData(0, 0, R, R).data;

  const litCell = (gx, gy) => {
    let sum = 0;
    let cnt = 0;
    for (let sy = 1; sy < ss - 1; sy++) {
      for (let sx = 1; sx < ss - 1; sx++) {
        const px = gx * ss + sx;
        const py = gy * ss + sy;
        sum += data[(py * R + px) * 4];
        cnt++;
      }
    }
    return sum / cnt > 90;
  };

  const cell = size / grid;
  const ox = cx - size / 2;
  const oy = cy - size / 2;

  // darkened backing panel so the bright monogram blocks pop against any theme
  ctx.save();
  const pad = cell * 0.6;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  roundRectPath(ctx, ox - pad, oy - pad, size + pad * 2, size + pad * 2, cell * 0.9);
  ctx.fill();
  ctx.restore();

  const blockColor = lighten(colors.accent, 0.2);

  ctx.save();
  ctx.shadowColor = css(colors.accent, 0.55);
  ctx.shadowBlur = size * 0.045;
  let any = false;
  for (let gy = 0; gy < grid; gy++) {
    for (let gx = 0; gx < grid; gx++) {
      const x = ox + gx * cell;
      const y = oy + gy * cell;
      if (litCell(gx, gy)) {
        any = true;
        drawPixelBlock(ctx, x + cell * 0.04, y + cell * 0.04, cell * 0.92, blockColor);
      } else if (rng() < 0.14) {
        ctx.save();
        ctx.shadowBlur = 0;
        ctx.fillStyle = css(lighten(colors.primary, 0.1), 0.14);
        ctx.fillRect(x + cell * 0.16, y + cell * 0.16, cell * 0.68, cell * 0.68);
        ctx.restore();
      }
    }
  }
  ctx.restore();

  // fallback if the font produced nothing (should not happen with system fonts)
  if (!any) {
    ctx.save();
    ctx.shadowColor = css(colors.accent, 0.5);
    ctx.shadowBlur = size * 0.05;
    for (let k = 0; k < grid; k++) {
      const x = ox + k * cell;
      const y = oy + k * cell;
      drawPixelBlock(ctx, x + cell * 0.04, y + cell * 0.04, cell * 0.92, blockColor);
      drawPixelBlock(ctx, ox + (grid - 1 - k) * cell + cell * 0.04, y + cell * 0.04, cell * 0.92, lighten(colors.primary, 0.3));
    }
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// Style: glow (neon emblem on dark)
// ---------------------------------------------------------------------------

function emblemGlow(ctx, cx, cy, size, colors, name, rng) {
  void rng;
  const r = size * 0.44;
  ctx.save();
  ctx.lineJoin = 'round';

  const passes = [
    [size * 0.05, size * 0.16, 0.9],
    [size * 0.022, size * 0.06, 1],
    [size * 0.01, 0, 1],
  ];
  for (const [lw, blur, al] of passes) {
    hexPath(ctx, cx, cy, r, -Math.PI / 2);
    ctx.lineWidth = lw;
    ctx.globalAlpha = al;
    ctx.strokeStyle = css(lighten(colors.accent, 0.35));
    ctx.shadowColor = css(colors.accent, 0.95);
    ctx.shadowBlur = blur;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // inner hex
  ctx.shadowColor = css(colors.primary, 0.8);
  ctx.shadowBlur = size * 0.05;
  hexPath(ctx, cx, cy, r * 0.62, -Math.PI / 2);
  ctx.lineWidth = size * 0.012;
  ctx.strokeStyle = css(lighten(colors.primary, 0.5), 0.85);
  ctx.stroke();

  // monogram
  ctx.shadowColor = css(colors.accent, 0.95);
  ctx.shadowBlur = size * 0.09;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.font = `bold ${Math.floor(size * 0.34)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(initial(name), cx, cy + size * 0.01);

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Style: gradient (smooth gradient shield emblem)
// ---------------------------------------------------------------------------

function emblemGradient(ctx, cx, cy, size, colors, name, rng) {
  void rng;
  const r = size * 0.46;
  ctx.save();

  hexPath(ctx, cx, cy, r, -Math.PI / 2);
  ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
  ctx.shadowBlur = size * 0.06;
  ctx.shadowOffsetY = size * 0.02;
  const g = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  g.addColorStop(0, css(lighten(colors.accent, 0.25)));
  g.addColorStop(0.5, css(colors.primary));
  g.addColorStop(1, css(darken(colors.secondary, 0.2)));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.shadowOffsetY = 0;

  // glossy top highlight
  ctx.save();
  hexPath(ctx, cx, cy, r, -Math.PI / 2);
  ctx.clip();
  const gg = ctx.createLinearGradient(cx, cy - r, cx, cy + r * 0.2);
  gg.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
  gg.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = gg;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 1.2);
  ctx.restore();

  // border
  hexPath(ctx, cx, cy, r, -Math.PI / 2);
  ctx.lineWidth = size * 0.022;
  ctx.strokeStyle = css(lighten(colors.accent, 0.45), 0.85);
  ctx.stroke();

  // monogram
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.font = `bold ${Math.floor(size * 0.4)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
  ctx.shadowBlur = size * 0.03;
  ctx.shadowOffsetY = size * 0.01;
  ctx.fillText(initial(name), cx, cy + size * 0.02);

  ctx.restore();
}

function drawEmblem(style, ctx, cx, cy, size, colors, name, rng) {
  if (style === 'pixel') return emblemPixel(ctx, cx, cy, size, colors, name, rng);
  if (style === 'glow') return emblemGlow(ctx, cx, cy, size, colors, name, rng);
  if (style === 'gradient') return emblemGradient(ctx, cx, cy, size, colors, name, rng);
  return emblemBlocks(ctx, cx, cy, size, colors, name, rng);
}

// ---------------------------------------------------------------------------
// Banner text
// ---------------------------------------------------------------------------

function drawBannerText(ctx, W, H, name, tagline, colors) {
  const x = Math.round(H + H * 0.06);
  const maxW = W - x - Math.round(H * 0.12);
  const nm = String(name || 'SMP Server');
  const tag = tagline ? String(tagline) : '';

  let fs = Math.floor(H * 0.27);
  ctx.font = `bold ${fs}px sans-serif`;
  while (fs > 18 && ctx.measureText(nm).width > maxW) {
    fs -= 2;
    ctx.font = `bold ${fs}px sans-serif`;
  }
  ctx.textAlign = 'left';

  const baseY = tag ? H * 0.44 : H * 0.5;

  // accent bar above title
  ctx.fillStyle = css(lighten(colors.accent, 0.15), 0.95);
  ctx.fillRect(x, Math.round(baseY - fs * 0.98), Math.round(Math.min(maxW, fs * 5)), Math.max(3, Math.round(H * 0.012)));

  // title
  ctx.textBaseline = 'alphabetic';
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = Math.round(H * 0.03);
  ctx.shadowOffsetY = Math.round(H * 0.008);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.97)';
  ctx.fillText(nm, x, Math.round(baseY));
  ctx.restore();

  if (tag) {
    let ts = Math.floor(H * 0.1);
    ctx.font = `bold ${ts}px sans-serif`;
    while (ts > 10 && ctx.measureText(tag).width > maxW) {
      ts -= 1;
      ctx.font = `bold ${ts}px sans-serif`;
    }
    ctx.fillStyle = css(lighten(colors.accent, 0.35), 0.95);
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(tag, x, Math.round(baseY + ts * 1.5));
  }
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

  let cx;
  let cy;
  let size;
  if (banner) {
    cx = H * 0.5;
    cy = H * 0.5;
    size = H * 0.66;
  } else {
    cx = W / 2;
    cy = H / 2;
    size = circle ? W * 0.56 : W * 0.66;
  }

  drawEmblem(st, ctx, cx, cy, size, colors, name, rng);

  if (banner) {
    drawBannerText(ctx, W, H, name, tagline, colors);
    drawFrame(ctx, W, H, colors);
  } else if (circle) {
    drawAvatarRing(ctx, W, H, colors);
  } else {
    drawFrame(ctx, W, H, colors);
  }

  return canvas.toBuffer('image/png');
}

/**
 * Render a single branding asset.
 * @param {object} p
 * @param {string} p.style   one of STYLE_IDS (invalid falls back to 'blocks')
 * @param {'logo'|'banner'|'avatar'|'webhook'} p.kind
 * @param {{primary?:number,secondary?:number,accent?:number}} p.colors
 * @param {string} p.name
 * @param {string} p.tagline
 * @param {number} p.seed
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
  generateAsset,
  generateSet,
};
