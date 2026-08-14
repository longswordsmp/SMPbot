'use strict';

const log = require('../../../core/logger');
const { intToHex } = require('../../../core/utils');

// @napi-rs/canvas is a required dependency of the bot; require it lazily so a
// missing native binary degrades to "no card" instead of crashing module load.
let canvasLib = null;
try {
  // eslint-disable-next-line global-require
  canvasLib = require('@napi-rs/canvas');
} catch (err) {
  log.warn('leveling: @napi-rs/canvas unavailable — rank cards will be disabled:', err?.message ?? err);
}

const WIDTH = 900;
const HEIGHT = 260;

function isAvailable() {
  return Boolean(canvasLib);
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

function formatNumber(n) {
  return Number(n || 0).toLocaleString('en-US');
}

/** Truncate a string to fit a pixel width, appending an ellipsis if needed. */
function fitText(ctx, text, maxWidth) {
  let s = String(text ?? '');
  if (ctx.measureText(s).width <= maxWidth) return s;
  while (s.length > 1 && ctx.measureText(`${s}…`).width > maxWidth) s = s.slice(0, -1);
  return `${s}…`;
}

/**
 * Render a 900x260 dark rank card. Returns a PNG Buffer, or null when canvas is
 * unavailable. Never throws — any failure logs and returns null so callers can
 * fall back to a text response.
 *
 * @param {object} opts
 * @param {string} opts.username    display name
 * @param {string} opts.avatarUrl   PNG avatar URL (network failure tolerated)
 * @param {number} opts.level
 * @param {number} opts.rank        leaderboard position (0 = unranked)
 * @param {number} opts.xpIntoLevel XP earned within the current level
 * @param {number} opts.xpForNext   XP needed to reach the next level
 * @param {number} opts.totalXp     all-time XP
 * @param {number} opts.primaryColor theme primary color (integer)
 * @param {number} opts.accentColor  theme accent color (integer)
 * @param {string} opts.serverName   footer text
 */
async function renderRankCard(opts) {
  if (!canvasLib) return null;
  try {
    const {
      username = 'Unknown',
      avatarUrl = null,
      level = 0,
      rank = 0,
      xpIntoLevel = 0,
      xpForNext = 100,
      totalXp = 0,
      primaryColor = 0x2ecc71,
      accentColor = 0xa9dfbf,
      serverName = '',
    } = opts || {};

    const { createCanvas, loadImage } = canvasLib;
    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext('2d');

    const primaryHex = intToHex(primaryColor);
    const accentHex = intToHex(accentColor);

    // Background.
    ctx.fillStyle = '#0f1116';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    // Inner panel.
    roundedRect(ctx, 16, 16, WIDTH - 32, HEIGHT - 32, 24);
    ctx.fillStyle = '#191c23';
    ctx.fill();
    // Accent edge stripe.
    roundedRect(ctx, 16, 16, 10, HEIGHT - 32, 6);
    ctx.fillStyle = primaryHex;
    ctx.fill();

    // Avatar (circle-cropped) with an accent ring.
    const avatarSize = 168;
    const avatarX = 52;
    const avatarY = (HEIGHT - avatarSize) / 2;
    const cx = avatarX + avatarSize / 2;
    const cy = avatarY + avatarSize / 2;
    const radius = avatarSize / 2;

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 6, 0, Math.PI * 2);
    ctx.fillStyle = primaryHex;
    ctx.fill();
    ctx.restore();

    let avatarDrawn = false;
    if (avatarUrl) {
      try {
        const img = await loadImage(avatarUrl);
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(img, avatarX, avatarY, avatarSize, avatarSize);
        ctx.restore();
        avatarDrawn = true;
      } catch (err) {
        // Network / decode failure: keep going without the avatar image.
        log.debug('leveling: avatar load failed, rendering placeholder:', err?.message ?? err);
      }
    }
    if (!avatarDrawn) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.closePath();
      ctx.fillStyle = '#2a2f3a';
      ctx.fill();
      ctx.fillStyle = accentHex;
      ctx.font = 'bold 80px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText((username[0] || '?').toUpperCase(), cx, cy + 4);
      ctx.restore();
    }

    const contentX = avatarX + avatarSize + 40; // ~260
    const rightX = WIDTH - 48;

    // Level + rank (top-right).
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'right';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillStyle = primaryHex;
    const levelLabel = `LEVEL ${formatNumber(level)}`;
    ctx.fillText(levelLabel, rightX, 78);
    const levelWidth = ctx.measureText(levelLabel).width;
    ctx.font = '22px sans-serif';
    ctx.fillStyle = '#9aa4b2';
    ctx.fillText(rank > 0 ? `RANK #${formatNumber(rank)}` : 'UNRANKED', rightX - levelWidth - 16, 78);

    // Username.
    ctx.textAlign = 'left';
    ctx.font = 'bold 44px sans-serif';
    ctx.fillStyle = '#ffffff';
    const nameMax = rightX - contentX;
    ctx.fillText(fitText(ctx, username, nameMax), contentX, 108);

    // XP text above the bar.
    ctx.font = '22px sans-serif';
    ctx.fillStyle = '#c7d0dc';
    ctx.textAlign = 'right';
    ctx.fillText(`${formatNumber(xpIntoLevel)} / ${formatNumber(xpForNext)} XP`, rightX, 168);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#7c8899';
    ctx.font = '18px sans-serif';
    ctx.fillText(`${formatNumber(totalXp)} total XP`, contentX, 168);

    // Progress bar.
    const barX = contentX;
    const barY = 182;
    const barW = rightX - contentX;
    const barH = 30;
    roundedRect(ctx, barX, barY, barW, barH, barH / 2);
    ctx.fillStyle = '#2a2f3a';
    ctx.fill();

    const ratio = xpForNext > 0 ? Math.max(0, Math.min(1, xpIntoLevel / xpForNext)) : 0;
    const fillW = Math.max(barH, barW * ratio); // keep the rounded cap visible even near 0
    if (ratio > 0) {
      ctx.save();
      roundedRect(ctx, barX, barY, fillW, barH, barH / 2);
      ctx.clip();
      const grad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
      grad.addColorStop(0, primaryHex);
      grad.addColorStop(1, accentHex);
      ctx.fillStyle = grad;
      ctx.fillRect(barX, barY, fillW, barH);
      ctx.restore();
    }

    // Footer: server name.
    if (serverName) {
      ctx.textAlign = 'left';
      ctx.font = '18px sans-serif';
      ctx.fillStyle = '#5c6675';
      ctx.fillText(fitText(ctx, serverName, barW), contentX, HEIGHT - 34);
    }

    return canvas.toBuffer('image/png');
  } catch (err) {
    log.warn('leveling: rank card render failed:', err?.message ?? err);
    return null;
  }
}

module.exports = { renderRankCard, isAvailable, WIDTH, HEIGHT };
