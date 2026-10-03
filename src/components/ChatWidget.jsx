import { useEffect, useRef, useState } from 'react';
import './ChatWidget.css';

// The store/shopper chat. Talks to /api/chat. The alternative CARDS are
// rendered from `matches` (picked in code from the curated list), never from
// the model's text — see api/chat.js for the guardrails.

const GREETING = {
  role: 'assistant',
  content: 'Përshëndetje! Shkruani një markë serbe (p.sh. Plazma, Knjaz Miloš, Imlek) ose një barkod, dhe ju tregoj alternativat vendore nga lista jonë.',
};

// A store's own xAI key, pasted into the chat. Kept only in this browser;
// sent per request in X-XAI-Key, never as a chat message. See api/chat.js.
const KEY_RE = /xai-[A-Za-z0-9]{20,200}/;
const LS_KEY = 'vj-xai-key';
const LS_MODEL = 'vj-xai-model';
const REMOVE_RE = /^(hiq|fshij?|remove|delete)\s+(çelësin|celesin|key|kodin)/i;

function readLS(k) {
  try { return localStorage.getItem(k); } catch { return null; }
}
function writeLS(k, v) {
  try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* storage blocked */ }
}

const KEY_REASON = {
  invalid: 'Çelësi nuk u pranua nga xAI. Kontrolloni që e keni kopjuar të plotë.',
  'no-credits': 'Çelësi është i vlefshëm, por llogaria xAI nuk ka kredite ende. Shtoni kredite te console.x.ai dhe dërgojeni përsëri.',
  'no-grok-model': 'Çelësi funksionon, por nuk ka qasje në asnjë model Grok.',
  unreachable: 'Nuk arrita të lidhem me xAI. Provoni përsëri pas pak.',
};

function authHeaders() {
  const key = readLS(LS_KEY);
  const model = readLS(LS_MODEL);
  return { ...(key ? { 'X-XAI-Key': key } : {}), ...(model ? { 'X-XAI-Model': model } : {}) };
}

const EVIDENCE = {
  reported: 'Raportuar si zëvendësim',
  'category-match': 'E njëjta kategori',
};

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([GREETING]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [msgs, open]);

  async function send(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput('');

    // "hiq çelësin" -> forget the store key.
    if (REMOVE_RE.test(text)) {
      writeLS(LS_KEY, null);
      writeLS(LS_MODEL, null);
      setMsgs([...msgs, { role: 'user', content: text }, { role: 'assistant', content: 'Çelësi u hoq nga ky shfletues.', local: true }]);
      return;
    }

    // A pasted xAI key configures the chat. It is never shown back or sent
    // as a message — only masked here, and checked against xAI.
    const found = text.match(KEY_RE);
    if (found) {
      const key = found[0];
      const masked = `xai-…${key.slice(-4)}`;
      const withUser = [...msgs, { role: 'user', content: `[çelës xAI ${masked}]`, local: true }];
      setMsgs(withUser);
      setBusy(true);
      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-XAI-Key': key },
          body: JSON.stringify({ action: 'check-key' }),
        });
        const r = await res.json();
        if (r.ok) {
          writeLS(LS_KEY, key);
          writeLS(LS_MODEL, r.model);
          setMsgs([...withUser, { role: 'assistant', local: true, content: `U konfigurua. Tani përgjigjet i shkruan ${r.model} me çelësin tuaj (ruhet vetëm në këtë shfletues). Për ta hequr: "hiq çelësin".` }]);
        } else {
          setMsgs([...withUser, { role: 'assistant', local: true, content: KEY_REASON[r.reason] || `xAI refuzoi çelësin (${r.reason}).` }]);
        }
      } catch {
        setMsgs([...withUser, { role: 'assistant', local: true, content: KEY_REASON.unreachable }]);
      } finally {
        setBusy(false);
      }
      return;
    }

    const next = [...msgs, { role: 'user', content: text }];
    setMsgs(next);
    setBusy(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          messages: next.filter((m) => m !== GREETING && !m.local).map(({ role, content }) => ({ role, content })),
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || res.status);
      setMsgs([...next, { role: 'assistant', content: body.reply, matches: body.matches, facts: body.facts, mode: body.mode }]);
    } catch {
      setMsgs([...next, { role: 'assistant', content: 'Diçka nuk shkoi. Provoni përsëri pas pak.' }]);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className="vj-chat-fab" onClick={() => setOpen(true)} aria-label="Pyet për alternativa" title="Pyet për alternativa">
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          <path fill="currentColor" d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-5 4v-4H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm3 6.5a1.5 1.5 0 1 0 0 .01Zm5 0a1.5 1.5 0 1 0 0 .01Zm5 0a1.5 1.5 0 1 0 0 .01Z" />
        </svg>
      </button>
    );
  }

  return (
    <section className="vj-chat" aria-label="Asistenti i alternativave">
      <header className="vj-chat-head">
        <strong>Asistenti Vendorja</strong>
        <button type="button" onClick={() => setOpen(false)} aria-label="Mbyll">×</button>
      </header>
      <div className="vj-chat-log">
        {msgs.map((m, i) => (
          <div key={i} className={`vj-chat-msg vj-chat-${m.role}`}>
            <p>{m.content}</p>
            {m.matches?.flatMap((mt) =>
              mt.alternatives.map((a) => (
                <a key={mt.serbianBrand + a.brand} className="vj-chat-card" href={a.sourceUrl} target="_blank" rel="noreferrer">
                  <span className="vj-chat-card-brand">{a.brand}</span>
                  <span className="vj-chat-card-meta">
                    {a.company} · në vend të {mt.serbianBrand.split('(')[0].trim()} · {EVIDENCE[a.pairingEvidence] || a.pairingEvidence}
                  </span>
                </a>
              )),
            )}
            {m.facts?.length > 0 && (
              <ol className="vj-chat-facts">
                {m.facts.map((f) => (
                  <li key={f.id}>
                    <a href={f.sourceUrl} target="_blank" rel="noreferrer">
                      {f.fact}{f.year ? ` (${f.year})` : ''}: {f.value}
                    </a>
                  </li>
                ))}
              </ol>
            )}
            {m.mode && <small className="vj-chat-mode">{m.mode === 'fallback' ? 'nga lista e kuruar' : 'AI · vetëm nga lista e kuruar'}</small>}
          </div>
        ))}
        {busy && <div className="vj-chat-msg vj-chat-assistant"><p>…</p></div>}
        <div ref={endRef} />
      </div>
      <form className="vj-chat-form" onSubmit={send}>
        <input value={input} onChange={(e) => setInput(e.target.value)} maxLength={600} placeholder="p.sh. Plazma ose 8600043000016" />
        <button type="submit" disabled={busy || !input.trim()}>Dërgo</button>
      </form>
      <p className="vj-chat-foot">Prefiksi GS1 tregon ku u regjistrua barkodi, jo ku u prodhua produkti.</p>
    </section>
  );
}
