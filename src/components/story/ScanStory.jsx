import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { ARGUMENT_SCREENS } from '../../content/argument.js';
import StoryNav from '../StoryNav.jsx';
import VerdictScreen from './VerdictScreen.jsx';
import BestAlternativeScreen from './BestAlternativeScreen.jsx';
import AllAlternativesScreen from './AllAlternativesScreen.jsx';
import ArgumentScreen from './ArgumentScreen.jsx';
import ReminderScreen from './ReminderScreen.jsx';
import SloganScreen from './SloganScreen.jsx';
import ChoiceScreen from './ChoiceScreen.jsx';

// The full vertical, scroll-snapped SCAN STORY for a Serbian-registered
// product: Verdict -> Argument(s) -> Reminder -> Slogan -> hard cut to the
// calm Choice screen. (No separate "Money" screen — the owner's measured
// reference, docs/vendorja-ui-reference.html, specifies exactly these 8
// screens app-wide and supersedes the earlier 6-screen story outline.)
export default function ScanStory({ resultState, data, onCategoryPick, onScanAnother, onShare, onClose, onOpenFaq, onSelectProduct }) {
  const { t } = useLanguage();
  const { code, classify, product, productStatus, errorKind } = resultState;

  return (
    <div className="vj-scan-story">
      <div className="vj-scan-story-scroller">
        {/* Sticky nav — first child of the SCROLLER so it sticks against
            it while the story scrolls (owner, 2026-09-12). */}
        <StoryNav title={t('navPageResult')} onBack={onClose} />
        <VerdictScreen product={product} productStatus={productStatus} code={code} errorKind={errorKind} data={data} classify={classify} onOpenFaq={onOpenFaq} alternatives={resultState.alternatives} onSelectProduct={onSelectProduct} />
        {/* Directly under the black-and-white flag: the COMPLETE roster of
            Kosovo/Albania alternatives (owner, 2026-09-12). Not the
            category-matched shortlist — that still runs and still appears
            on the Choice screen at the end of the story. */}
        {/* Directly under "vazhdo ↓": the ONE product that best replaces
            what was scanned. Category-gated upstream by
            lib/categoryFamily.js — an oil can only ever match an oil. */}
        <BestAlternativeScreen
          alternatives={resultState.alternatives}
          scannedName={product?.name || classify?.boycott?.name || null}
        />
        <AllAlternativesScreen alternatives={resultState.alternatives} onSelectProduct={onSelectProduct} />
        {/* THE ARGUMENT: real, sourced entries from src/content/argument.js
            (owned by the content module) — rendered as-is, one per screen. */}
        {ARGUMENT_SCREENS.map((item) => (
          <ArgumentScreen key={item.id} item={item} />
        ))}
        <ReminderScreen />
        <SloganScreen />
        <ChoiceScreen resultState={resultState} data={data} onCategoryPick={onCategoryPick} onScanAnother={onScanAnother} onShare={onShare} />
      </div>
      {/* Full sentence for anything assistive tech might miss from the
          cropped visuals, tied to the actual classify verdict. */}
      <span className="visually-hidden">{classify?.verdict}</span>
    </div>
  );
}
