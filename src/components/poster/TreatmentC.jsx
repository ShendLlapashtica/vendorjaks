// C · COLLISION — single, fully-visible, centered two-line pair
// ("kujto" / the motto). Was six sliding/overlapping copies shifted
// off-screen by measured negative margins; per owner feedback (2026-09-11)
// text must always stay fully visible and symmetrical, so this is now just
// the one real statement, no animation, no clipping.
export default function TreatmentC({ line1, line2, style, className = '' }) {
  return (
    <div className={`collision ${className}`} style={style} aria-hidden="true">
      <div className="g">
        <span>{line1}</span>
        <span>{line2}</span>
      </div>
    </div>
  );
}
