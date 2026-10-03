import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { drawShareCard, shareOrDownloadCard } from '../lib/shareCard.js';

// SHARE CARD — an auto-generated 1080x1920 or 1080x1080 canvas image: red
// background, the flagged product's name cropped at the edge, the motto,
// and the Kosovar alternative's name readable in white at the bottom.
export default function ShareCardScreen({ target, onClose }) {
  const { t } = useLanguage();
  const canvasRef = useRef(null);
  const [size, setSize] = useState('story');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!target || !canvasRef.current) return;
    drawShareCard(canvasRef.current, {
      size,
      serbianName: target.serbianName,
      alternativeName: target.alternativeName,
      mottoMain: t('mottoMain'),
    });
  }, [target, size, t]);

  if (!target) return null;

  async function handleAction() {
    setBusy(true);
    try {
      await shareOrDownloadCard(canvasRef.current, `vendorja-${Date.now()}.png`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="vj-share-overlay" role="dialog" aria-modal="true" aria-label={t('shareTitle')}>
      <button type="button" className="vj-story-close" onClick={onClose} aria-label={t('shareClose')}>
        ✕
      </button>
      <div className="vj-share-preview">
        <canvas ref={canvasRef} className={`vj-share-canvas vj-share-canvas-${size}`} aria-label={t('shareCardAlt')} />
      </div>
      <div className="vj-share-controls">
        <div className="vj-share-size-toggle">
          <button type="button" className={size === 'story' ? 'active' : ''} onClick={() => setSize('story')}>
            9:16
          </button>
          <button type="button" className={size === 'square' ? 'active' : ''} onClick={() => setSize('square')}>
            1:1
          </button>
        </div>
        <button type="button" className="vj-btn-flat vj-btn-white" onClick={handleAction} disabled={busy}>
          {busy ? t('shareGenerating') : t('shareDownload')}
        </button>
      </div>
    </div>
  );
}
