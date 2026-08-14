'use strict';

const log = require('../../../core/logger');
const { intToHex } = require('../../../core/utils');

// @napi-rs/canvas is a bot dependency; require it lazily so a missing native
// binary degrades to "no banner" instead of crashing module load.
let canvasLib = null;
try {
  // eslint-disable-next-line global-require
  canvasLib = require('@napi-rs/canvas');
} catch (err) {
  log.warn('welcome: @napi-rs/canvas unavailable — welcome banners will be disabled:', err?.message ?? err);
}

const WIDTH = 1024;
const HEIGHT = 360;

function isAvailable() {
  return Boolean(canvasLib);
}

function rgb(int) {
  const n = Number(int) >>> 0;
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

function roundedRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/** Truncate a string to fit a pixel width, appending an ellipsis if needed. */
function fitText(ctx, text, maxWidth) {
  let s = String(text ?? '');
  if (ctx.measureText(s).width <= maxWidth) return s;
  while (s.length > 1 && ctx.measureText(`${s}…`).width > maxWidth) s = s.slice(0, -1);
  return `${s}…`;
}

/**
 * Render a 1024x360 dark welcome banner: themed accent glow, a centered circular
 * avatar with an accent ring, "Welcome {username}", and "Member #{membercount}".
 * Returns a PNG Buffer, or null when canvas is unavailable / rendering fails.
 * Never throws — callers fall back to the plain embed image.
 *
 * @param {object} opts
 * @param {string} opts.username
 * @param {string|null} opts.avatarUrl  PNG avatar URL (network failure tolerated)
 * @param {number} opts.memberCount
 * @param {number} opts.primaryColor    theme primary color (integer)
 * @param {number} opts.accentColor     theme accent color (integer)
 * @param {string} opts.serverName
 */
async function renderBanner(opts) {
  if (!canvasLib) return null;
  try {
    const {
      username = 'member',
      avatarUrl = null,
      memberCount = 0,
      primaryColor = 0x2ecc71,
      accentColor = 0xa9dfbf,
      serverName = '',
    } = opts || {};

    const { createCanvas, loadImage } = canvasLib;
    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext('2d');

    // Background + inner panel.
    ctx.fillStyle = '#0f1116';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    roundedRect(ctx, 12, 12, WIDTH - 24, HEIGHT - 24, 28);
    ctx.fillStyle = '#14171f';
    ctx.fill();

    const cx = WIDTH / 2;
    const cy = 132;

    // Accent glow behind the avatar.
    const a = rgb(accentColor);
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 280);
    glow.addColorStop(0, `rgba(${a.r},${a.g},${a.b},0.35)`);
    glow.addColorStop(1, `rgba(${a.r},${a.g},${a.b},0)`);
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Avatar with accent ring.
    const R = 80;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R + 7, 0, Math.PI * 2);
    ctx.fillStyle = intToHex(primaryColor);
    ctx.fill();
    ctx.restore();

    let drawn = false;
    if (avatarUrl) {
      try {
        const img = await loadImage(avatarUrl);
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, R, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(img, cx - R, cy - R, R * 2, R * 2);
        ctx.restore();
        drawn = true;
      } catch (err) {
        log.debug('welcome banner: avatar load failed, using placeholder:', err?.message ?? err);
      }
    }
    if (!drawn) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.closePath();
      ctx.fillStyle = '#2a2f3a';
      ctx.fill();
      ctx.fillStyle = intToHex(accentColor);
      ctx.font = 'bold 76px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText((String(username)[0] || '?').toUpperCase(), cx, cy + 4);
      ctx.restore();
    }

    // Welcome line.
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 46px sans-serif';
    ctx.fillText(fitText(ctx, `Welcome ${username}`, WIDTH - 120), cx, 270);

    // Member number.
    ctx.fillStyle = intToHex(accentColor);
    ctx.font = '30px sans-serif';
    ctx.fillText(`Member #${Number(memberCount || 0).toLocaleString('en-US')}`, cx, 314);

    // Server name footer.
    if (serverName) {
      ctx.fillStyle = '#7c8899';
      ctx.font = '20px sans-serif';
      ctx.fillText(fitText(ctx, serverName, WIDTH - 160), cx, 344);
    }

    return canvas.toBuffer('image/png');
  } catch (err) {
    log.warn('welcome: banner render failed:', err?.message ?? err);
    return null;
  }
}

module.exports = { renderBanner, isAvailable, WIDTH, HEIGHT };
