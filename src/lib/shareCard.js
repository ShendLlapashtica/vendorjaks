// Canvas-based share card generator. Draws a Treatment-A/B-flavoured poster
// (red background, oversized cropped type, the Kosovar alternative's name
// readable at the bottom, a small centered wordmark) at either a 1080x1920
// story size or a 1080x1080 square, per the brief.

const RED = '#FF0000';
const WHITE = '#FFFFFF';
const BLACK = '#000000';

const DISPLAY_FONT = "'Inter Tight', system-ui, sans-serif";
const LOGO_FONT = "'Poppins', system-ui, sans-serif";

export const SHARE_SIZES = {
  story: { width: 1080, height: 1920 },
  square: { width: 1080, height: 1080 },
};

function fitText(ctx, text, maxWidth, startSize, minSize, fontWeight, font) {
  let size = startSize;
  ctx.font = `${fontWeight} ${size}px ${font}`;
  while (ctx.measureText(text).width > maxWidth && size > minSize) {
    size -= 4;
    ctx.font = `${fontWeight} ${size}px ${font}`;
  }
  return size;
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {object} opts
 * @param {'story'|'square'} opts.size
 * @param {string} opts.serbianName - the flagged product's name, cropped/cut off at the edge.
 * @param {string} opts.alternativeName - the Kosovar alternative's name, readable at the bottom.
 * @param {string} opts.mottoMain - "bleje tanen jo te beogradit!"
 */
export function drawShareCard(canvas, { size = 'story', serbianName, alternativeName, mottoMain }) {
  const { width, height } = SHARE_SIZES[size] || SHARE_SIZES.story;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Flat red background — no gradients, per the palette rule.
  ctx.fillStyle = RED;
  ctx.fillRect(0, 0, width, height);

  // THE STACK-flavoured cropped headline: the Serbian product's name,
  // repeated and cut off at the right edge, huge and uppercase.
  const headline = (serbianName || '?').toUpperCase();
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = WHITE;
  const headlineSize = Math.round(width * 0.16);
  ctx.font = `800 ${headlineSize}px ${DISPLAY_FONT}`;
  const startX = width * 0.06;
  let y = height * 0.16;
  const lineGap = headlineSize * 0.92;
  for (let i = 0; i < 3; i += 1) {
    ctx.fillText(headline, startX, y + i * lineGap);
  }

  // The motto, mid-card, black-on-red per Treatment B's argument colour.
  const mottoSize = fitText(ctx, mottoMain || '', width * 0.92, Math.round(width * 0.09), Math.round(width * 0.04), 600, DISPLAY_FONT);
  ctx.font = `600 ${mottoSize}px ${DISPLAY_FONT}`;
  ctx.fillStyle = BLACK;
  ctx.fillText((mottoMain || '').toLowerCase(), startX, height * 0.55);

  // The Kosovar alternative — the one fully readable thing on the card.
  if (alternativeName) {
    ctx.fillStyle = WHITE;
    const altSize = fitText(ctx, alternativeName, width * 0.88, Math.round(width * 0.07), Math.round(width * 0.035), 700, DISPLAY_FONT);
    ctx.font = `700 ${altSize}px ${DISPLAY_FONT}`;
    ctx.fillText(alternativeName, startX, height * 0.82);
  }

  // Small centered wordmark at the very bottom — the one centered, uncropped
  // element on the card, echoing the logo rule.
  ctx.fillStyle = WHITE;
  ctx.font = `600 ${Math.round(width * 0.045)}px ${LOGO_FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('vendorja', width / 2, height * 0.94);
  ctx.textAlign = 'left';
}

export function canvasToBlob(canvas, type = 'image/png') {
  return new Promise((resolve) => canvas.toBlob(resolve, type));
}

/**
 * Offers a native share sheet when available (navigator.share + files
 * support), otherwise falls back to a plain download link. Every step is
 * best-effort — a share/download failure never throws past the caller.
 */
export async function shareOrDownloadCard(canvas, filename) {
  const blob = await canvasToBlob(canvas);
  if (!blob) return { ok: false, method: null };

  try {
    const file = new File([blob], filename, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
      await navigator.share({ files: [file], title: 'vendorja' });
      return { ok: true, method: 'share' };
    }
  } catch {
    // Fall through to download — a cancelled/failed share sheet isn't an error.
  }

  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return { ok: true, method: 'download' };
  } catch {
    return { ok: false, method: null };
  }
}
