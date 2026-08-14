'use strict';

const log = require('../../../core/logger');
const { intToHex } = require('../../../core/utils');

// @napi-rs/canvas is a bundled dependency; require it lazily so a missing native
// binary degrades to a text fallback (see components/verify.js) instead of
// crashing module load.
let canvasLib = null;
try {
  // eslint-disable-next-line global-require
  canvasLib = require('@napi-rs/canvas');
} catch (err) {
  log.warn('verification: @napi-rs/canvas unavailable — captcha images will use a text fallback:', err?.message ?? err);
}

// Unambiguous charset: no 0/O, 1/I/L, or other easily-confused glyphs.
const CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 5;

const WIDTH = 360;
const HEIGHT = 140;

function isAvailable() {
  return Boolean(canvasLib);
}

/** Generate a random unambiguous verification code (uppercase). */
function generateCode(length = CODE_LENGTH) {
  let out = '';
  for (let i = 0; i < length; i++) out += CHARSET[Math.floor(Math.random() * CHARSET.length)];
  return out;
}

/** Normalize user-typed input for comparison (uppercase, trimmed, spaces removed). */
function normalize(input) {
  return String(input ?? '')
    .toUpperCase()
    .replace(/\s+/g, '')
    .trim();
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}

/**
 * Render a distorted captcha image for `code`. Returns a PNG Buffer, or null when
 * canvas is unavailable. Never throws — any failure logs and returns null so the
 * caller can fall back to a text challenge.
 *
 * @param {string} code
 * @param {object} [colors] theme colors ({ primary, secondary, accent } integers)
 */
function renderCaptcha(code, colors = {}) {
  if (!canvasLib) return null;
  try {
    const { createCanvas } = canvasLib;
    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext('2d');

    const primaryHex = intToHex(colors.primary ?? 0x2ecc71);
    const secondaryHex = intToHex(colors.secondary ?? 0x1e8e4e);
    const accentHex = intToHex(colors.accent ?? 0xa9dfbf);

    // Dark background.
    ctx.fillStyle = '#0f1116';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Faint dotted noise across the whole image.
    for (let i = 0; i < 220; i++) {
      ctx.fillStyle = i % 2 === 0 ? secondaryHex : accentHex;
      ctx.globalAlpha = rand(0.05, 0.2);
      ctx.beginPath();
      ctx.arc(rand(0, WIDTH), rand(0, HEIGHT), rand(0.6, 1.8), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Noise lines behind the text.
    for (let i = 0; i < 7; i++) {
      ctx.strokeStyle = i % 2 === 0 ? primaryHex : accentHex;
      ctx.globalAlpha = rand(0.25, 0.5);
      ctx.lineWidth = rand(1, 2.5);
      ctx.beginPath();
      ctx.moveTo(rand(0, WIDTH * 0.3), rand(0, HEIGHT));
      ctx.bezierCurveTo(
        rand(WIDTH * 0.2, WIDTH * 0.5), rand(0, HEIGHT),
        rand(WIDTH * 0.5, WIDTH * 0.8), rand(0, HEIGHT),
        rand(WIDTH * 0.7, WIDTH), rand(0, HEIGHT),
      );
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Characters — each rotated, offset, and wobbled independently.
    const chars = code.split('');
    const slot = (WIDTH - 60) / chars.length;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    chars.forEach((ch, i) => {
      ctx.save();
      const x = 40 + slot * i + slot / 2 + rand(-6, 6);
      const y = HEIGHT / 2 + rand(-10, 10);
      ctx.translate(x, y);
      ctx.rotate(rand(-0.42, 0.42));
      const size = Math.floor(rand(46, 58));
      ctx.font = `bold ${size}px sans-serif`;
      // Subtle shadow for legibility against the noise.
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 4;
      ctx.fillStyle = i % 3 === 0 ? accentHex : i % 3 === 1 ? primaryHex : '#f4f6f8';
      ctx.fillText(ch, 0, 0);
      ctx.restore();
    });

    // A couple of foreground streaks over the text.
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = primaryHex;
      ctx.globalAlpha = rand(0.2, 0.4);
      ctx.lineWidth = rand(1, 2);
      ctx.beginPath();
      ctx.moveTo(rand(0, WIDTH), rand(0, HEIGHT));
      ctx.lineTo(rand(0, WIDTH), rand(0, HEIGHT));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    return canvas.toBuffer('image/png');
  } catch (err) {
    log.warn('verification: captcha render failed:', err?.message ?? err);
    return null;
  }
}

module.exports = { isAvailable, generateCode, normalize, renderCaptcha, CHARSET, CODE_LENGTH, WIDTH, HEIGHT };
