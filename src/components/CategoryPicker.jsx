import { useLanguage } from '../i18n/LanguageContext.jsx';
import { CATEGORY_OPTIONS } from '../lib/categories.js';

export default function CategoryPicker({ selectedKey, onSelect }) {
  const { t, lang } = useLanguage();

  return (
    <div>
      <p className="vj-section-subtitle">{t('categoryPickerPrompt')}</p>
      <div className="vj-category-picker">
        {CATEGORY_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            type="button"
            className={selectedKey === opt.key ? 'active' : ''}
            onClick={() => onSelect(opt)}
          >
            {lang === 'sq' ? opt.sq : opt.en}
          </button>
        ))}
      </div>
    </div>
  );
}
