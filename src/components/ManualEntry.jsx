import { useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { isPlausibleBarcode } from '../lib/gs1.js';

// Barcode-only manual entry used inside the camera FailureScreen(s) — when
// the camera itself can't be used, guiding the shopper to type the digits
// is the one action that always works. Styled with the same `.fail`
// classes as its wrapping screen (App.css), always a real >=56px control.
export default function ManualEntry({ onSubmit }) {
  const { t } = useLanguage();
  const [value, setValue] = useState('');
  const [showError, setShowError] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    if (!isPlausibleBarcode(value)) {
      setShowError(true);
      return;
    }
    setShowError(false);
    onSubmit(value.replace(/\D/g, ''));
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        className="search"
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoFocus
        placeholder={t('manualPlaceholder')}
        aria-label={t('failManualLabel')}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          if (showError) setShowError(false);
        }}
      />
      {showError && (
        <p className="body" role="alert" style={{ marginTop: '2cqw' }}>
          {t('manualInvalid')}
        </p>
      )}
      <button type="submit" className="solid" style={{ marginTop: '2.4cqw' }}>
        {t('manualSubmit')}
      </button>
    </form>
  );
}
