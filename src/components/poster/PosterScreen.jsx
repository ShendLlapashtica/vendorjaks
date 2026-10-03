import { forwardRef } from 'react';

// Full-bleed poster screen container — maps directly onto the measured
// reference's `.screen` / `.screen.black` / `.screen.white` (see
// docs/vendorja-ui-reference.html). `container-type: inline-size` on
// `.screen` is what makes every cqw value elsewhere = % of THIS element's
// width, so the crop is identical on every phone.
const PosterScreen = forwardRef(function PosterScreen(
  { as: Tag = 'section', bg = 'red', className = '', ariaLabel, children, snap = true },
  ref
) {
  const variant = bg === 'black' ? 'black' : bg === 'white' ? 'white' : '';
  return (
    <Tag
      ref={ref}
      className={`screen ${variant} ${snap ? 'poster-snap' : ''} ${className}`.trim()}
      aria-label={ariaLabel}
      role={ariaLabel ? 'group' : undefined}
    >
      {children}
    </Tag>
  );
});

export default PosterScreen;
