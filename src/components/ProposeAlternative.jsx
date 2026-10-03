import { useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import {
  submitProposal,
  currentProposalState,
  precheckProposal,
  PROPOSAL_OK,
  PROPOSAL_INVALID,
  PROPOSAL_DISABLED,
  PROPOSAL_UNAVAILABLE,
} from '../lib/proposals.js';
import '../styles/propose.css';

// The submit surface for "IF NO MATCH FOUND" (owner, 2026-09-17). Rendered
// by /alternativa on a Serbian product Vendorja has no exact equivalent for.
//
// The person using this is standing in a shop holding a box, so the form is
// four fields, only one of which is required, and the barcode is asked for
// first because it is the only answer the app can check by itself.
//
// WHAT THIS COMPONENT PROMISES, AND WHAT IT MUST NEVER PROMISE
// A submission is QUEUED. It is not published, it is not "added", it does
// not appear anywhere until a human has vetted it. Every success string
// below says so, because the one dishonest thing this surface could do is
// let a shopper walk away believing they just put an alternative in the app.
//
// FREE TEXT IS NEVER HTML. Every value below is rendered as a React text
// child or as an input `value` — no raw-HTML escape hatch, no template built
// from user input, anywhere in this file. src/test/proposals.test.js asserts
// that by reading this source and failing on any of the four ways it could
// be reintroduced. React escapes text children, so a proposal named
// `<img onerror=...>` renders as those literal characters and nothing else.
// api/proposals.js also drops any field containing `<` or `>` before storing
// it — two layers, because this is a user-submitted-content surface on a
// politically charged app.

const FIELDS = { altCode: '', altBrand: '', altName: '', seenAt: '' };

export default function ProposeAlternative({ forCode, forName = null, forBrand = null, hasMatch = false }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState(FIELDS);
  const [phase, setPhase] = useState('idle'); // idle | sending | queued
  const [error, setError] = useState(null);
  // Read ONCE, on mount, and deliberately not again.
  //
  // If this re-read currentProposalState() every render, a submit that
  // discovers there is no backend would flip the state and unmount the form
  // on the very next render — which is what it did, measured 2026-09-17:
  // the panel silently vanished the instant you pressed the button, with no
  // word to the person who had just typed into it. Silent degradation means
  // "never offer a control that cannot work", not "delete the control under
  // someone's finger". So: an instance that mounted while the backend was
  // already known to be gone renders nothing at all, and an instance that
  // discovers it mid-submit stays put and says so once (setError below).
  // Every subsequently mounted instance renders nothing.
  const [stateAtMount] = useState(() => currentProposalState());

  if (stateAtMount === PROPOSAL_DISABLED || stateAtMount === PROPOSAL_UNAVAILABLE) return null;
  if (typeof forCode !== 'string' || !/^[0-9]{8,14}$/.test(forCode)) return null;

  function set(field, value) {
    setValues((prev) => ({ ...prev, [field]: value }));
    if (error) setError(null);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (phase === 'sending') return;

    const draft = { forCode, forName, forBrand, ...values };
    const bad = precheckProposal(draft);
    if (bad) {
      setError(bad);
      return;
    }

    setPhase('sending');
    const result = await submitProposal(draft);

    if (result.status === PROPOSAL_OK) {
      setPhase('queued');
      return;
    }
    if (result.status === PROPOSAL_INVALID) {
      setPhase('idle');
      setError(result.reason || 'invalid');
      return;
    }
    // Disabled or unreachable. Say it once, plainly, then stop offering the
    // control for the rest of the visit — currentProposalState() now
    // remembers, so every other product's form is gone too.
    setPhase('idle');
    setError('unavailable');
  }

  if (phase === 'queued') {
    return (
      <section className="propose propose--done" aria-live="polite">
        <p className="propose__done-title">{t('proposeQueuedTitle')}</p>
        <p className="propose__note">{t('proposeQueuedBody')}</p>
      </section>
    );
  }

  if (!open) {
    return (
      <section className="propose propose--collapsed">
        {/* The invitation has to match what the row already says.
            Owner, 2026-09-17: "make it able to propose changes for all".
            On a row that already found an exact match, "propose an
            alternative" reads as though we found nothing — so it asks for a
            BETTER one instead. Our answer is a floor, not a ceiling: someone
            in the shop may know a closer replacement than the catalogue. */}
        <p className="propose__lead">{hasMatch ? t('proposeLeadBetter') : t('proposeLead')}</p>
        <button type="button" className="propose__open" onClick={() => setOpen(true)}>
          {hasMatch ? t('proposeOpenBetter') : t('proposeOpen')}
        </button>
      </section>
    );
  }

  return (
    <section className="propose">
      <h3 className="propose__title">{t('proposeTitle')}</h3>
      <p className="propose__note">{t('proposeIntro')}</p>

      <form className="propose__form" onSubmit={handleSubmit}>
        <label className="propose__field">
          <span className="propose__label">{t('proposeCodeLabel')}</span>
          <input
            className="propose__input"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            maxLength={20}
            placeholder={t('proposeCodePlaceholder')}
            value={values.altCode}
            onChange={(e) => set('altCode', e.target.value)}
          />
          <span className="propose__hint">{t('proposeCodeHint')}</span>
        </label>

        <label className="propose__field">
          <span className="propose__label">{t('proposeBrandLabel')}</span>
          <input
            className="propose__input"
            type="text"
            autoComplete="off"
            maxLength={60}
            placeholder={t('proposeBrandPlaceholder')}
            value={values.altBrand}
            onChange={(e) => set('altBrand', e.target.value)}
          />
        </label>

        <label className="propose__field">
          <span className="propose__label">{t('proposeNameLabel')}</span>
          <input
            className="propose__input"
            type="text"
            autoComplete="off"
            maxLength={80}
            placeholder={t('proposeNamePlaceholder')}
            value={values.altName}
            onChange={(e) => set('altName', e.target.value)}
          />
        </label>

        <label className="propose__field">
          <span className="propose__label">{t('proposeSeenLabel')}</span>
          <input
            className="propose__input"
            type="text"
            autoComplete="off"
            maxLength={60}
            placeholder={t('proposeSeenPlaceholder')}
            value={values.seenAt}
            onChange={(e) => set('seenAt', e.target.value)}
          />
          {/* The honesty rule, said to the person typing it rather than only
              in the reviewer's tool: seeing it on a Kosovo shelf is not
              evidence that a Kosovar brand made it. */}
          <span className="propose__hint">{t('proposeSeenHint')}</span>
        </label>

        {error && (
          <p className="propose__error" role="alert">
            {t(`proposeError_${error}`)}
          </p>
        )}

        <div className="propose__actions">
          <button type="submit" className="propose__submit" disabled={phase === 'sending'}>
            {phase === 'sending' ? t('proposeSending') : t('proposeSubmit')}
          </button>
          <button
            type="button"
            className="propose__cancel"
            onClick={() => {
              setOpen(false);
              setValues(FIELDS);
              setError(null);
            }}
          >
            {t('proposeCancel')}
          </button>
        </div>

        <p className="propose__note propose__note--fine">{t('proposeVettingNote')}</p>
      </form>
    </section>
  );
}
