// B · STAGGER — ported 1:1 from docs/vendorja-ui-reference.html's
// `.stagger`. Exactly four <span> lines with FIXED indents from the
// reference's CSS (:nth-child(1..4) => 12.6 / 13.45 / 19.45 / 1.45cqw) —
// these are measured values, not approximations, so the component always
// renders exactly 4 spans; a longer sentence should be pre-wrapped into 4
// lines by the caller (matching how the reference itself hard-wraps text,
// including the leading comma on line 2).
export default function TreatmentB({ lines, style, className = '' }) {
  return (
    <p className={`stagger ${className}`} style={style} aria-hidden="true">
      {lines.slice(0, 4).map((line, i) => (
        <span key={i}>{line}</span>
      ))}
    </p>
  );
}
