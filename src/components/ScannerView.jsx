import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { isPlausibleBarcode } from '../lib/gs1.js';
import {
  startCamera,
  stopCamera,
  startScanLoop,
  isTorchSupported,
  setTorch,
  captureAndDecode,
  SCAN_ERROR,
} from '../lib/scanner.js';
import FailureScreen from './FailureScreen.jsx';
import ManualEntry from './ManualEntry.jsx';

// 02 · SCANNER
//
// Rebuilt 2026-09-12 after the owner's verdict: "scan is not working yet",
// "flashlight notif is buggy and blocks screen must be shown a bit uptop
// not block the screen", "add a photograph button when quality is looking
// good and inside frame ill photograph it", "this is very user unfriendly
// the scan part".
//
// What changed and why:
//
// 1. A PHOTOGRAPH BUTTON, as the primary action. The live loop decodes
//    whatever frame is ready — often mid motion-blur or mid auto-focus. A
//    deliberate capture is taken when the user can SEE the barcode is sharp
//    and inside the frame, decodes at full resolution, and tries both the
//    native detector and ZXing on that one still. It is the most reliable
//    route on a phone, so it is the big button, not a hidden fallback.
//
// 2. NOTHING COVERS THE VIEWFINDER. The old timeout hint dropped a banner
//    with the torch button over the middle of the camera view — exactly
//    where the barcode has to be. All status and controls now sit in a
//    slim bar ABOVE the frame, or in the control row below it.
//
// 3. The live loop still runs underneath. If it decodes first, it wins;
//    the user never has to press anything.
const NO_DECODE_HINT_MS = 6000;

export default function ScannerView({ onDetected, onSearchByName, onClose }) {
  const { t } = useLanguage();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState(null);
  const [decoder, setDecoder] = useState('starting');
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [hint, setHint] = useState(false);
  const [busy, setBusy] = useState(false);
  const [missed, setMissed] = useState(0);
  const [showManual, setShowManual] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let stream = null;
    let stopScan = null;
    let cancelled = false;
    let hintId = null;

    async function run() {
      try {
        stream = await startCamera(videoRef.current);
        if (cancelled) {
          stopCamera(stream);
          return;
        }
        streamRef.current = stream;
        // iOS refuses to render a stream without muted+playsinline.
        if (videoRef.current) videoRef.current.muted = true;
        setTorchSupported(isTorchSupported(stream));
        hintId = setTimeout(() => !cancelled && setHint(true), NO_DECODE_HINT_MS);

        stopScan = await startScanLoop(videoRef.current, {
          onDetect: (code) => {
            if (cancelled) return;
            cancelled = true;
            clearTimeout(hintId);
            stopScan?.();
            stopCamera(stream);
            onDetected(code);
          },
          onStatus: (s) => !cancelled && setDecoder(s),
        });
      } catch (err) {
        if (!cancelled) setError(err.kind || SCAN_ERROR.GENERIC);
      }
    }

    run();
    return () => {
      cancelled = true;
      clearTimeout(hintId);
      stopScan?.();
      stopCamera(stream);
      streamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleToggleTorch() {
    const next = !torchOn;
    const ok = await setTorch(streamRef.current, next);
    if (ok) setTorchOn(next);
  }

  /** The photograph button: decode one deliberate, sharp, full-res frame. */
  async function handleCapture() {
    if (busy) return;
    setBusy(true);
    try {
      const code = await captureAndDecode(videoRef.current);
      if (code) {
        stopCamera(streamRef.current);
        onDetected(code);
        return;
      }
      // A miss is normal and recoverable — say so, don't treat it as an error.
      setMissed((n) => n + 1);
      setHint(true);
    } finally {
      setBusy(false);
    }
  }

  function handleStripSubmit(e) {
    e.preventDefault();
    const value = query.trim();
    if (!value) return;
    if (isPlausibleBarcode(value)) onDetected(value.replace(/\D/g, ''));
    else onSearchByName(value);
  }

  if (error) {
    const FAIL_COPY = {
      [SCAN_ERROR.PERMISSION_DENIED]: ['failPermissionWord', 'failPermissionBody'],
      [SCAN_ERROR.NOT_FOUND]: ['failNotFoundWord', 'failNotFoundBody'],
      [SCAN_ERROR.INSECURE_CONTEXT]: ['failInsecureWord', 'failInsecureBody'],
      [SCAN_ERROR.DECODER_LOAD_FAILED]: ['failDecoderWord', 'failDecoderBody'],
      [SCAN_ERROR.GENERIC]: ['failGenericWord', 'failGenericBody'],
    };
    const [wordKey, bodyKey] = FAIL_COPY[error] || FAIL_COPY[SCAN_ERROR.GENERIC];
    return (
      <FailureScreen word={t(wordKey)} body={t(bodyKey)}>
        <div className="actions-col">
          <p className="label">{t('failManualLabel')}</p>
          <ManualEntry onSubmit={onDetected} />
          <button type="button" className="outline" onClick={onClose}>
            {t('close')}
          </button>
        </div>
      </FailureScreen>
    );
  }

  return (
    <div className="vj-scanner" role="dialog" aria-modal="true" aria-label={t('scannerTitle')}>
      {/* TOP BAR — every control and message lives here, above the camera,
          so nothing ever covers the barcode the user is aiming at. */}
      <header className="vj-scanner-top">
        <button type="button" className="vj-scanner-x" onClick={onClose} aria-label={t('close')}>
          ✕
        </button>
        <p className="vj-scanner-hint" role="status">
          {missed > 0 ? t('scannerMissed') : hint ? t('scannerTimeoutHint') : t('scannerAim')}
        </p>
        {torchSupported && (
          <button
            type="button"
            className={`vj-scanner-torch${torchOn ? ' is-on' : ''}`}
            onClick={handleToggleTorch}
            aria-pressed={torchOn}
          >
            {torchOn ? '🔦' : '🔦'}
          </button>
        )}
      </header>

      <div className="vj-scanner-stage">
        <video ref={videoRef} className="vj-scanner-video" playsInline muted autoPlay />
        <div className="vj-scanner-frame" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
          <span className="vj-scanner-sweep" />
        </div>
      </div>

      {/* CONTROLS — below the camera, never over it. */}
      <div className="vj-scanner-controls">
        <button type="button" className="vj-scanner-shoot" onClick={handleCapture} disabled={busy}>
          {busy ? t('scannerReading') : t('scannerShoot')}
        </button>

        <button type="button" className="vj-scanner-manual-toggle" onClick={() => setShowManual((v) => !v)}>
          {t('scannerTypeInstead')}
        </button>

        {showManual && (
          <form className="vj-scanner-manual" onSubmit={handleStripSubmit}>
            <input
              className="vj-scanner-input"
              type="text"
              inputMode="numeric"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('scannerStripSearchPlaceholder')}
              aria-label={t('scannerStripSearchPlaceholder')}
            />
            <button type="submit" className="vj-scanner-go">
              {t('manualSubmit')}
            </button>
          </form>
        )}

        <p className="vj-scanner-decoder">
          {decoder === 'native'
            ? t('scannerDecoderNative')
            : decoder === 'zxing'
            ? t('scannerDecoderZxing')
            : decoder === 'zxing-loading'
            ? t('zxingLoading')
            : t('scannerDecoderStarting')}
        </p>
      </div>
    </div>
  );
}
