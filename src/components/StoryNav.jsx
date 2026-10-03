import { useLanguage } from '../i18n/LanguageContext.jsx';

// THE navbar. One component, one look, every screen.
//
// Owner, 2026-09-12: "navbar must be same everywhere like in eksploro. make
// it also in postscan like that".
//
// It deliberately reuses the SAME class names as the Explore/Manifesto
// header (`vj-chrome-header` and friends) rather than carrying a parallel
// `vj-story-nav` skin. Two components with two stylesheets is precisely how
// the app ended up with a black bar on one screen and a red one on the
// next; sharing the classes makes divergence impossible.
export default function StoryNav({ title, onBack }) {
  const { t, lang, toggleLanguage } = useLanguage();

  return (
    <header className="vj-chrome-header vj-nav">
      <button type="button" className="vj-chrome-back" onClick={onBack}>
        ← {t('navBack')}
      </button>
      <h1 className="vj-chrome-title">{title}</h1>
      <button
        type="button"
        className="vj-chrome-lang"
        onClick={toggleLanguage}
        lang={lang === 'sq' ? 'en' : 'sq'}
      >
        {t('languageToggle')}
      </button>
    </header>
  );
}
