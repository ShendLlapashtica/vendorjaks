import { useLanguage } from '../../i18n/LanguageContext.jsx';
import PosterScreen from '../poster/PosterScreen.jsx';
import TreatmentC from '../poster/TreatmentC.jsx';

// 05 · REMINDER (kujto) — ported from the reference: "kujto" / "bleje tanen
// jo te beogradit" as a two-line pair, repeated in 6 groups that shift
// progressively further left (1.3 -> -39.5cqw) until they're mostly gone.
export default function ReminderScreen() {
  const { t } = useLanguage();
  const word = t('reminderWord');
  const motto = t('reminderMotto');
  return (
    <PosterScreen bg="red" ariaLabel={`${word}: ${motto}`} className="vj-story-reminder">
      <TreatmentC line1={word} line2={motto} />
    </PosterScreen>
  );
}
