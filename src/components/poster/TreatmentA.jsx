// A · STACK — ported 1:1 from docs/vendorja-ui-reference.html's `.stack`.
// Renders an actual <ul><li> stack (not a generic repeated div) so the DOM
// structure matches the measured reference exactly: same element count,
// same classes, same font tokens (Inter Tight 500, uppercase via CSS).
//
// `lines`: array of strings, or {text, ink:true} for the one line that
// switches to black (used by the SLOGAN screen's final line).
//
// 2026-09-11: dropped the `drift` side-to-side animation and the CSS that
// used to crop this at both screen edges — per owner feedback, text must
// always be fully visible and the layout symmetrical, not sliding/cropped.
export default function TreatmentA({ lines, style, className = '' }) {
  return (
    <ul className={`stack ${className}`} style={style} aria-hidden="true">
      {lines.map((line, i) => {
        const text = typeof line === 'string' ? line : line.text;
        const ink = typeof line === 'object' && line.ink;
        return (
          <li className={ink ? 'ink' : ''} key={i}>
            {text}
          </li>
        );
      })}
    </ul>
  );
}
