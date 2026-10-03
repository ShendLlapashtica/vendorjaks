// A designed, on-brand failure screen — red (or white, via `variant`), big
// lowercase headline, a plain explanation, and real actions. Per the
// 2026-09-11 requirement: every failure state gets one of these, never a
// grey toast or a dead end, and manual entry (when relevant) stays reachable
// from it. Not part of the 8-screen measured reference (which only shows
// the happy path), so it borrows the reference's own type system (`.fail`
// in App.css: Outfit round, red/white/black only) rather than inventing a
// fourth visual language.
export default function FailureScreen({ word, body, variant = 'red', children, ariaLabel }) {
  return (
    <div className={`screen ${variant === 'white' ? 'white' : ''}`} role="group" aria-label={ariaLabel || `${word}. ${body}`}>
      <div className={`fail ${variant === 'white' ? 'white' : ''}`}>
        <p className="word">{word}</p>
        <p className="body">{body}</p>
        {children}
      </div>
    </div>
  );
}
