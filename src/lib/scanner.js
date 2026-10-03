// Camera + barcode decoding. Primary path: the native BarcodeDetector API
// (Chrome/Android — the target audience). Fallback: ZXing loaded from cdnjs
// for browsers without BarcodeDetector (iOS Safari, desktop Firefox).

// cdnjs does not mirror zxing-js-library; @zxing/library's UMD build on
// jsdelivr (also on the approved CDN allowlist) is the reliable pinned source.
const ZXING_VERSION = '0.21.3';
const ZXING_URL = `https://cdn.jsdelivr.net/npm/@zxing/library@${ZXING_VERSION}/umd/index.min.js`;
const SUPPORTED_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];

export const SCAN_ERROR = {
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  NOT_FOUND: 'NOT_FOUND',
  INSECURE_CONTEXT: 'INSECURE_CONTEXT',
  // Distinct from GENERIC: the camera opened fine, it's the ZXing fallback
  // script (from the CDN) that failed to load — a real, reported symptom
  // ("camera opens but never decodes", esp. on iOS Safari, which has no
  // native BarcodeDetector). Reported as its own kind so the UI can say the
  // true cause instead of the misleading "camera could not be opened".
  DECODER_LOAD_FAILED: 'DECODER_LOAD_FAILED',
  GENERIC: 'GENERIC',
};

export class ScannerError extends Error {
  constructor(message, kind) {
    super(message);
    this.kind = kind;
  }
}

export function hasNativeBarcodeDetector() {
  return typeof window !== 'undefined' && 'BarcodeDetector' in window;
}

export function isSecureContextForCamera() {
  if (typeof window === 'undefined') return true;
  // localhost is exempt from the secure-context requirement.
  const host = window.location.hostname;
  const isLocalhost = host === 'localhost' || host === '127.0.0.1' || host === '::1';
  return window.isSecureContext || isLocalhost;
}

/** Requests the rear camera and attaches it to the given <video> element. */
export async function startCamera(videoEl) {
  if (!isSecureContextForCamera()) {
    throw new ScannerError('Camera requires a secure context (HTTPS).', SCAN_ERROR.INSECURE_CONTEXT);
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new ScannerError('getUserMedia is not supported in this browser.', SCAN_ERROR.GENERIC);
  }

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false,
    });
  } catch (err) {
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      throw new ScannerError('Camera permission denied.', SCAN_ERROR.PERMISSION_DENIED);
    }
    if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
      throw new ScannerError('No camera device found.', SCAN_ERROR.NOT_FOUND);
    }
    throw new ScannerError(err.message || 'Could not start the camera.', SCAN_ERROR.GENERIC);
  }

  videoEl.srcObject = stream;
  await videoEl.play();
  return stream;
}

/**
 * Torch (camera flash) support — shops are dim and this is the single
 * biggest lever a phone has for a bad-light decode failure. Every call is
 * feature-detected and wrapped so an unsupported device/browser (most
 * front-facing setups, iOS Safari, desktop) just silently has no torch
 * button rather than throwing.
 */
export function isTorchSupported(stream) {
  try {
    const track = stream?.getVideoTracks?.()[0];
    const caps = track?.getCapabilities?.();
    return Boolean(caps && 'torch' in caps);
  } catch {
    return false;
  }
}

export async function setTorch(stream, on) {
  const track = stream?.getVideoTracks?.()[0];
  if (!track || !isTorchSupported(stream)) return false;
  // Real bug fixed here (2026-09-11): the "advanced" constraint form is the
  // spec-correct one, but some Android Chrome builds only honor a plain
  // (non-advanced) `torch` constraint and silently no-op on the advanced
  // form — reported symptom: torch toggle sometimes does nothing. Try the
  // spec form first, then retry with the plain form before giving up.
  try {
    await track.applyConstraints({ advanced: [{ torch: on }] });
    return true;
  } catch {
    // fall through to the alternate form below
  }
  try {
    await track.applyConstraints({ torch: on });
    return true;
  } catch {
    return false;
  }
}

/** Always stop every track — a live camera left running is a privacy/battery problem. */
export function stopCamera(stream) {
  if (!stream) return;
  for (const track of stream.getTracks()) {
    try {
      track.stop();
    } catch {
      // ignore
    }
  }
}

/**
 * THE PHOTOGRAPH BUTTON WAS DEAD. Root cause, found 2026-09-12 by reading
 * the actual bytes the app loads (`@zxing/library@0.21.3/umd/index.min.js`,
 * the pinned CDN build above):
 *
 *   captureAndDecode() called `reader.decodeFromCanvas(canvas)`.
 *   **There is no `decodeFromCanvas` in that build.** The string does not
 *   occur in the bundle. The call threw `TypeError: reader.decodeFromCanvas
 *   is not a function` on EVERY press, the surrounding `catch {}` swallowed
 *   it, and the function returned null — which the UI correctly reports as
 *   "no barcode in this frame". So the button looked like it worked, ran,
 *   and could never succeed, on any device, with any barcode.
 *
 * What 0.21.3 actually exports (verified against the bundle): the low-level
 * `MultiFormatReader`, `BinaryBitmap`, `HybridBinarizer` and
 * `HTMLCanvasElementLuminanceSource`, plus `decodeFromImageUrl`. The
 * decode below is built from those, which is also strictly better than the
 * convenience method would have been:
 *
 *   · TRY_HARDER is set. For a 1D symbology ZXing only attempts the
 *     ROTATED 90° pass when TRY_HARDER is on — i.e. without it, a barcode
 *     photographed on a vertically-held bottle never decodes.
 *   · POSSIBLE_FORMATS is limited to the four retail symbologies, so the
 *     decoder spends its budget on EAN/UPC instead of QR and Aztec.
 *   · A miss on the raw frame is retried on an upscaled centre crop, which
 *     is what rescues a small barcode shot from arm's length.
 *
 * `decode()` takes its hints as an ARGUMENT, not from setHints(): ZXing's
 * `decode(image, hints)` begins by calling `setHints(hints)`, so calling
 * `decode(bitmap)` after a separate `setHints(...)` silently clears them.
 */
function zxingHints(ZXing) {
  const hints = new Map();
  hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
  hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [
    ZXing.BarcodeFormat.EAN_13,
    ZXing.BarcodeFormat.EAN_8,
    ZXing.BarcodeFormat.UPC_A,
    ZXing.BarcodeFormat.UPC_E,
  ]);
  return hints;
}

/** One decode attempt against one canvas. Returns the text, or null. */
function decodeCanvasWithZXing(ZXing, canvas) {
  try {
    const source = new ZXing.HTMLCanvasElementLuminanceSource(canvas);
    const bitmap = new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(source));
    const result = new ZXing.MultiFormatReader().decode(bitmap, zxingHints(ZXing));
    return result?.getText?.() || null;
  } catch {
    // NotFoundException is the normal "nothing in this frame" outcome.
    return null;
  }
}

/**
 * An upscaled centre crop of a frame. A barcode that occupies too few
 * pixels to resolve its narrow bars is the single most common photograph
 * miss; doubling the sample rate over the region the on-screen frame guide
 * tells the user to aim at gives the binarizer something to work with.
 */
/**
 * A 90°-rotated copy of a frame.
 *
 * ZXing is supposed to do this itself: OneDReader retries on a rotated
 * bitmap when TRY_HARDER is set and the source reports isRotateSupported().
 * Measured against this build it does not come back with a result, so a
 * barcode running vertically in the viewfinder — a bottle, a tall carton,
 * anyone holding the phone in the other orientation — never decodes. Doing
 * the rotation ourselves is a few lines and is not dependent on library
 * internals we cannot see.
 */
function rotateCanvas(srcCanvas) {
  const out = document.createElement('canvas');
  out.width = srcCanvas.height;
  out.height = srcCanvas.width;
  const ctx = out.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.translate(out.width / 2, out.height / 2);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(srcCanvas, -srcCanvas.width / 2, -srcCanvas.height / 2);
  return out;
}

function cropScaled(srcCanvas, cropFraction, scale) {
  const cw = Math.round(srcCanvas.width * cropFraction);
  const ch = Math.round(srcCanvas.height * cropFraction);
  const sx = Math.round((srcCanvas.width - cw) / 2);
  const sy = Math.round((srcCanvas.height - ch) / 2);
  const out = document.createElement('canvas');
  out.width = Math.max(1, Math.round(cw * scale));
  out.height = Math.max(1, Math.round(ch * scale));
  const ctx = out.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(srcCanvas, sx, sy, cw, ch, 0, 0, out.width, out.height);
  return out;
}

let zxingLoadPromise = null;

function loadZXingScript() {
  if (typeof window !== 'undefined' && window.ZXing) return Promise.resolve(window.ZXing);
  if (zxingLoadPromise) return zxingLoadPromise;

  zxingLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = ZXING_URL;
    script.async = true;
    script.onload = () => {
      if (window.ZXing) resolve(window.ZXing);
      else reject(new Error('ZXing script loaded but window.ZXing is missing.'));
    };
    script.onerror = () => reject(new Error('Failed to load ZXing from CDN.'));
    document.head.appendChild(script);
  });

  return zxingLoadPromise;
}

/**
 * Starts a scan loop against the given <video> element and calls
 * onDetect(code) the first time a barcode is decoded. Returns a stop()
 * function. Uses BarcodeDetector when available, otherwise ZXing.
 */
export async function startScanLoop(videoEl, { onDetect, onStatus }) {
  // Real bug fixed here (2026-09-11): `'BarcodeDetector' in window` only
  // proves the constructor exists, NOT that this device/OS actually
  // supports the formats we ask for. Some Android/Chrome builds throw
  // synchronously from `new BarcodeDetector({formats:[...]})` for a format
  // it doesn't support (NotSupportedError) — this used to crash the whole
  // scanner with a generic error instead of falling back to ZXing, which is
  // exactly the "scanning doesn't work" symptom with no obvious cause. Now:
  // (1) ask the browser which formats it actually supports first when that
  // API exists, and (2) wrap construction in try/catch either way, falling
  // through to ZXing on any failure instead of erroring out.
  let nativeUsable = hasNativeBarcodeDetector();
  let detector = null;
  if (nativeUsable) {
    try {
      let formats = SUPPORTED_FORMATS;
      if (typeof window.BarcodeDetector.getSupportedFormats === 'function') {
        const supported = await window.BarcodeDetector.getSupportedFormats();
        const usable = SUPPORTED_FORMATS.filter((f) => supported.includes(f));
        if (usable.length > 0) formats = usable;
      }
      detector = new window.BarcodeDetector({ formats });
    } catch {
      nativeUsable = false;
      detector = null;
    }
  }

  // Shared teardown handle. The caller gets ONE stop() immediately, and it
  // keeps working across a mid-flight native->ZXing handover — otherwise a
  // fallback that happens after the component unmounted would leave a
  // decoder running against a dead <video>.
  let stopped = false;
  let teardown = () => {};
  const stop = () => {
    stopped = true;
    try {
      teardown();
    } catch {
      // ignore
    }
  };

  // --- ZXing lane, callable either as the first choice or as a late fallback.
  async function startZXing() {
    onStatus?.('zxing-loading');
    let ZXing;
    try {
      ZXing = await loadZXingScript();
    } catch (err) {
      throw new ScannerError(err.message, SCAN_ERROR.DECODER_LOAD_FAILED);
    }
    if (stopped) return;
    onStatus?.('zxing');

    // WHY THIS DRIVES ITS OWN LOOP instead of calling ZXing's
    // `decodeFromVideoElementContinuously` (changed 2026-09-12).
    //
    // That helper owns the <video> element: it calls reader.reset() on
    // entry, re-applies its own attributes, installs 'canplay'/'play'/
    // 'ended' listeners, and on teardown sets `videoElement.srcObject =
    // undefined`. But in this app the element is NOT ZXing's to own — the
    // camera stream is attached and played by startCamera() before the
    // decoder ever sees it, and the torch control keeps operating on that
    // same track. Handing the element to a library that resets it is how
    // you get the symptom the owner reported: a live picture, a moving scan
    // line, and a decoder that never returns anything.
    //
    // The frame-grab loop below uses the SAME decode that the photograph
    // button uses — the one verified to read real EAN-13s end to end — so
    // there is now exactly one decoder in this file, and if it works for
    // the button it works for the live loop. It also means TRY_HARDER's
    // rotated pass applies here, and that a missed frame costs one canvas
    // draw rather than an unknown amount of library state.
    const SCAN_INTERVAL_MS = 220;
    let timerId = null;
    let scanCanvas = null;

    teardown = () => {
      if (timerId) clearTimeout(timerId);
      timerId = null;
      scanCanvas = null;
    };

    let tickCount = 0;
    const tick = () => {
      if (stopped) return;
      try {
        const w = videoEl.videoWidth;
        const h = videoEl.videoHeight;
        if (w && h) {
          if (!scanCanvas || scanCanvas.width !== w || scanCanvas.height !== h) {
            scanCanvas = document.createElement('canvas');
            scanCanvas.width = w;
            scanCanvas.height = h;
          }
          const ctx = scanCanvas.getContext('2d', { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(videoEl, 0, 0, w, h);
            let text = decodeCanvasWithZXing(ZXing, scanCanvas);
            // Alternate the extra work across ticks so no single frame costs
            // much: a magnified centre crop for a barcode that is too far
            // away, and a 90° rotation for one held the other way up.
            if (!text && tickCount % 3 === 1) {
              const crop = cropScaled(scanCanvas, 0.6, 2);
              if (crop) text = decodeCanvasWithZXing(ZXing, crop);
            }
            if (!text && tickCount % 3 === 2) {
              const turned = rotateCanvas(scanCanvas);
              if (turned) text = decodeCanvasWithZXing(ZXing, turned);
            }
            if (text) {
              onDetect(text, 'zxing');
              return; // caller decides whether to keep scanning
            }
          }
        }
      } catch {
        // A bad frame is not a failure — just try the next one.
      }
      tickCount += 1;
      if (!stopped) timerId = setTimeout(tick, SCAN_INTERVAL_MS);
    };

    tick();
  }

  if (nativeUsable && detector) {
    // Real bug fixed here (2026-09-12): the native loop used to swallow
    // EVERY detect() error and keep looping. On a device where detect()
    // throws on every frame — the documented Android/Chrome failure mode
    // this code path exists to survive — that produced a live camera, a
    // moving scan line, and a decoder that could never succeed, forever,
    // with no fallback and no error. That is precisely the reported
    // "scanning doesn't work" symptom, and it was unreachable from the
    // construction-time guard above because construction succeeded.
    //
    // Now: a run of consecutive failures is treated as "this decoder is
    // broken on this device", not as transient frame noise, and the scanner
    // hands over to ZXing. Occasional throws still cost nothing, because
    // the counter resets on any successful detect() call.
    const MAX_CONSECUTIVE_FAILURES = 10;
    let consecutiveFailures = 0;
    let rafId = null;
    let handedOver = false;

    teardown = () => {
      if (rafId) cancelAnimationFrame(rafId);
    };

    const tick = async () => {
      if (stopped || handedOver) return;
      try {
        const results = await detector.detect(videoEl);
        consecutiveFailures = 0;
        if (results.length > 0) {
          onDetect(results[0].rawValue, 'native');
          return; // caller decides whether to keep scanning
        }
      } catch {
        consecutiveFailures += 1;
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          handedOver = true;
          if (rafId) cancelAnimationFrame(rafId);
          // Hand over. A failure here is reported through onStatus rather
          // than thrown, because by this point the caller already has its
          // stop() handle and is no longer awaiting us.
          startZXing().catch(() => onStatus?.('decoder-failed'));
          return;
        }
      }
      if (!stopped && !handedOver) rafId = requestAnimationFrame(tick);
    };

    onStatus?.('native');
    rafId = requestAnimationFrame(tick);
    return stop;
  }

  await startZXing();
  return stop;
}

/**
 * Decode a SINGLE still frame grabbed from the video.
 *
 * Owner, 2026-09-12: "scan is not working yet ... add a photograph button
 * when quality is looking good and inside frame ill photograph it".
 *
 * This is a genuinely different decode route, not just a UI affordance, and
 * it is the one most likely to succeed when the live loop fails:
 *   · the live loop decodes whatever frame happens to be ready, often mid
 *     motion-blur or mid auto-focus; a deliberate capture is taken when the
 *     user can see the barcode is sharp and framed.
 *   · it decodes from a full-resolution canvas rather than a downscaled
 *     preview, so a small or low-contrast barcode has more pixels to work
 *     with.
 *   · it tries the native detector AND ZXing on the same frame, so a device
 *     whose BarcodeDetector silently fails still gets a second attempt
 *     without waiting for the ten-failure handover.
 *
 * @returns {Promise<string|null>} the decoded barcode, or null if this frame
 *          could not be read — a null here means "try again", never an error.
 */
export async function captureAndDecode(videoEl) {
  if (!videoEl || !videoEl.videoWidth) return null;

  const canvas = document.createElement('canvas');
  canvas.width = videoEl.videoWidth;
  canvas.height = videoEl.videoHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);

  // 1. Native detector on the still.
  if (hasNativeBarcodeDetector()) {
    try {
      let formats = SUPPORTED_FORMATS;
      if (typeof window.BarcodeDetector.getSupportedFormats === 'function') {
        const supported = await window.BarcodeDetector.getSupportedFormats();
        const usable = SUPPORTED_FORMATS.filter((f) => supported.includes(f));
        if (usable.length > 0) formats = usable;
      }
      const detector = new window.BarcodeDetector({ formats });
      const results = await detector.detect(canvas);
      if (results?.length > 0 && results[0].rawValue) return results[0].rawValue;
    } catch {
      // fall through to ZXing
    }
  }

  // 2. ZXing on the same still, then on progressively more generous
  //    magnifications of the middle of the frame. Each pass is cheap and
  //    only runs because the previous one found nothing.
  try {
    const ZXing = await loadZXingScript();

    const attempts = [canvas];
    for (const [fraction, scale] of [
      [0.8, 2],
      [0.5, 3],
    ]) {
      const c = cropScaled(canvas, fraction, scale);
      if (c) attempts.push(c);
    }
    // …and the same ladder again with the frame turned 90°.
    const rotated = rotateCanvas(canvas);
    if (rotated) {
      attempts.push(rotated);
      const rotatedCrop = cropScaled(rotated, 0.8, 2);
      if (rotatedCrop) attempts.push(rotatedCrop);
    }

    for (const c of attempts) {
      const text = decodeCanvasWithZXing(ZXing, c);
      if (text) return text;
    }

    // Version guard. If a future @zxing build renames the low-level classes
    // the way it evidently renamed decodeFromCanvas, fall back to the
    // documented image-URL route rather than failing silently again.
    if (typeof ZXing.HTMLCanvasElementLuminanceSource !== 'function') {
      const reader = new ZXing.BrowserMultiFormatReader();
      try {
        const result = await reader.decodeFromImageUrl(canvas.toDataURL('image/png'));
        if (result) return result.getText();
      } finally {
        try {
          reader.reset();
        } catch {
          // ignore
        }
      }
    }
  } catch {
    // Nothing decodable in this frame.
  }

  return null;
}

/** A still JPEG of the current frame, for showing the user what they shot. */
export function captureStill(videoEl, quality = 0.85) {
  if (!videoEl || !videoEl.videoWidth) return null;
  const canvas = document.createElement('canvas');
  canvas.width = videoEl.videoWidth;
  canvas.height = videoEl.videoHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
  try {
    return canvas.toDataURL('image/jpeg', quality);
  } catch {
    return null;
  }
}
