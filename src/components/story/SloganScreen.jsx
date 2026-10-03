import { useLanguage } from '../../i18n/LanguageContext.jsx';
import PosterScreen from '../poster/PosterScreen.jsx';
import TreatmentA from '../poster/TreatmentA.jsx';

// 06 · SLOGAN (parulla) — the slogan, once, in white, then the final line
// in black underneath (2026-09-11: was thirteen repeated white lines
// cropped at the screen edge — replaced per owner feedback; the colour
// change from white to black is still the punchline, it just doesn't
// require a wall of repeated, partly-invisible text to land).
export default function SloganScreen() {
  const { t } = useLanguage();
  const stack = t('sloganStackWord');
  const final = t('sloganFinalLine');
  // Owner cap (2026-09-12): "max repeat 3 times no more" — three
  // repetitions of the slogan, then the final line in black. Three is the
  // ceiling, not a target: never render more than this.
  const MAX_REPEATS = 3;
  const lines = [...Array(MAX_REPEATS).fill(stack), { text: final, ink: true }];
  return (
    <PosterScreen bg="red" ariaLabel={`${stack} ${final}`} className="vj-story-slogan">
      <TreatmentA lines={lines} />
    </PosterScreen>
  );
}
