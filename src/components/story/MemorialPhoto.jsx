import { useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';

// A memorial photograph, rendered BLACK AND WHITE (owner, 2026-09-12:
// "use photos for visual effect ... place photos only black and white").
//
// The grayscale is applied in CSS rather than requiring pre-converted
// files, so a colour original dropped into public/memorial/ still renders
// mono.
//
// TWO HARD RULES, enforced here rather than left to discipline:
//
//  1. NO CAPTION, NO RENDER. An uncaptioned photograph of an atrocity is
//     how misattribution happens — an image from one war captioned as
//     another is the single fastest way to discredit a page that is
//     otherwise sourced from court records. If a caption is missing, this
//     component renders nothing at all.
//
//  2. NOTHING IS SHIPPED BY DEFAULT. Every `photo.src` in the content file
//     is null until the owner supplies a file they hold rights to. See
//     public/memorial/README.md.
export default function MemorialPhoto({ photo }) {
  const { t, lang } = useLanguage();
  const [broken, setBroken] = useState(false);

  if (!photo?.src) return null;

  const caption = (lang === 'sq' ? photo.captionSq : photo.caption) || photo.caption;
  if (!caption) return null;
  if (broken) return null;

  return (
    <figure className="vj-memorial-photo">
      <img src={photo.src} alt={caption} loading="lazy" onError={() => setBroken(true)} />
      <figcaption>
        {caption}
        {photo.credit && <span className="vj-memorial-credit">{photo.credit}</span>}
      </figcaption>
    </figure>
  );
}
