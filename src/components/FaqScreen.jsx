import { useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext.jsx';

// Q&A — "pyetje që i bën gjithkush".
//
// This is where the long GS1 explanation went after the owner demoted it
// from the verdict screen (see GsFootnote.jsx). Q1 is the owner's own
// question, in their words: "how does apple have barcode". The answer uses
// their real example — a Kosovo supermarket shelf label reading
// "MOLLË DELISHES KG/PLU.601 / PEMËT/PERIME / 0.99 EUR" — because a PLU
// code on loose fruit is exactly the case where the app has nothing to say
// and should say so plainly instead of rendering a verdict.
const QUESTION_COUNT = 6;

function FaqItem({ q, a, defaultOpen }) {
  const [open, setOpen] = useState(Boolean(defaultOpen));
  return (
    <li className={`vj-faq-item${open ? ' is-open' : ''}`}>
      <button type="button" className="vj-faq-q" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span>{q}</span>
        <i aria-hidden="true">{open ? '−' : '+'}</i>
      </button>
      {open && <p className="vj-faq-a">{a}</p>}
    </li>
  );
}

export default function FaqScreen() {
  const { t } = useLanguage();
  const items = Array.from({ length: QUESTION_COUNT }, (_, i) => ({
    q: t(`faqQ${i + 1}`),
    a: t(`faqA${i + 1}`),
  }));

  return (
    <section className="vj-faq" aria-label={t('faqTitle')}>
      <h2 className="vj-faq-title">{t('faqTitle')}</h2>
      <ul className="vj-faq-list">
        {items.map((item, i) => (
          // The apple question opens by default — it is the one the owner
          // hit first, so it is the one a new user most likely has too.
          <FaqItem key={item.q} q={item.q} a={item.a} defaultOpen={i === 0} />
        ))}
      </ul>
    </section>
  );
}
