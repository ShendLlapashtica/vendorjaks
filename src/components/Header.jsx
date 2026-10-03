import StoryNav from './StoryNav.jsx';

// The chrome screens (Explore / Manifesto / History / FAQ) use the same
// navbar as every other screen. Kept as a thin alias so existing call sites
// don't have to change — see StoryNav.jsx for why there is only one.
export default function Header({ title, onBack }) {
  return <StoryNav title={title} onBack={onBack} />;
}
