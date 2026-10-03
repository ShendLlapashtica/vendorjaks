# Shopper-proposed alternatives, and the vetting queue

> Owner, 2026-09-17: *"IF NO MATCH FOUND> make it and people can look products
> up and propose alternatives for serb products they will undergo a vetting
> process and then you decide wether 1:1 match aswell"*

When Vendorja has no exact Kosovar/Albanian equivalent for a Serbian product,
a person standing in a shop can name one. **A proposal is a claim by a
stranger, not evidence.** Nothing anyone submits reaches another shopper
before a human has looked at it, and an accepted proposal never pretends to
be a source-cited curated pairing.

| file | what it is |
|---|---|
| `src/components/ProposeAlternative.jsx` | the submit form, rendered by `/alternativa` when there is no exact match |
| `src/styles/propose.css` | its styling (glass tokens from `index.css`; red is the submit button and nothing else) |
| `src/lib/proposals.js` | the client. Degrades silently when there is no backend |
| `api/proposals.js` | the route. Mirrors `api/feed.js`: same store, same env vars, same privacy posture, no npm dependency |
| `scripts/vet-proposals.mjs` | the review tool — the human decision, made with evidence on screen |
| `data/proposed-alternatives.json` | accepted pairings, awaiting merge. **Created on the first accept; absent until then** |
| `src/test/proposals.test.js` | 48 tests, including the four proofs in §3 |

---

## 1. The endpoint

`/api/proposals` — one route, three methods, no npm dependency, spoken to an
Upstash-compatible Redis REST endpoint over plain `fetch`.

```
GET  /api/proposals?for=<gtin>&limit=<n>
  200 { ok, enabled, items[], total, pendingCount }
      `items` are VETTED, ACCEPTED pairings only, each projected by
      toPublicAccepted(): { id, forCode, altCode, altBrand, altName, match,
      origin:"community-vetted", sourceUrl, at, acceptedAt, by }
      `pendingCount` is a NUMBER — how many are waiting. Never their content.

POST /api/proposals
  body { forCode, forName?, forBrand?, altCode?, altBrand?, altName?,
         seenAt?, anonId? }
  202 { ok, stored:true, status:"pending", id, at }   queued for review
  200 { ok, stored:false, reason:"duplicate" }        same person, same pair
  400 { ok:false, error:"invalid", field, reason }    see §4
  429 { ok:false, error:"rate_limited" }              3/min, 20/day per hashed IP
  503 { ok:false, error:"queue_full" }                queue at QUEUE_MAX (2000)

DELETE /api/proposals
  body { anonId }
  200 { ok, removed, unlinked }
      `removed`  pending proposals of that owner, deleted outright
      `unlinked` accepted ones, KEPT but with `owner` nulled — the pairing is
                 now curated content about two products, not a record about a
                 person. Counts only; this method never returns content.

ANY, when the store is not provisioned
  503 { ok:false, enabled:true, error:"not_provisioned" }
ANY, when PROPOSALS=off (or PUBLIC_FEED=off)
  410 { ok:false, enabled:false, error:"disabled" }
```

**202, not 201, on a successful POST.** Received and queued, not published.
The client words it that way and so does the UI.

### Provisioning

Exactly the env vars `api/feed.js` already uses — one store serves both:

```
KV_REST_API_URL        + KV_REST_API_TOKEN          # Vercel KV / Upstash integration
UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN   # Upstash direct
```

With neither set the route answers 503 and the client hides the form. **That
is the repo's default state**, `npm test` and `npm run build` both pass in it,
and the deploy survives it.

---

## 2. What a proposal stores, and what it never stores

**Stored:** `forCode`, `forName`, `forBrand`, `altCode`, `altBrand`,
`altName`, `seenAt`, `owner`, `at`, `id`, `status`.

**Published** (the `toPublicAccepted()` allow-list — a field added to the
stored record stays invisible until someone adds it here on purpose):
`id`, `forCode`, `altCode`, `altBrand`, `altName`, `match`, `origin`,
`sourceUrl`, `at`, `acceptedAt`, `by`.

**Stored but never published:**

- `owner` — the client's private anon id, needed so a person can delete their
  own proposals. The public `by` is a 6-hex truncation of
  `sha256(owner + monthly salt)`: it rotates every month and cannot be
  reversed into the delete key.
- `seenAt` — "I saw it in Viva Fresh". A lead for the reviewer, not a fact
  about the product, and publishing where a person stood is needed for
  nothing.
- the reviewer's note, flags and identity.

**Never stored at all:** IP address, precise location, user agent, device or
browser identifier, the page they arrived from, any name or contact detail.
There is no lat/lng field, and a `seenAt` that looks like coordinates is
dropped (`looksLikeCoordinates`). The IP is hashed with the salt into
*rate-limit key names only* — `vj:prl:m:<hash>` (EXPIRE 120s) and
`vj:prl:d:<hash>` (EXPIRE 172800s) — never a value, never a field, never
reversible.

`anonId` is **optional** here, unlike in the feed. The feed publishes a scan
the person did not compose, so it is gated on the cookie consent that mints
the id; a proposal is a thing someone typed and pressed a button to send.
Requiring an unrelated cookie first would be the worse trade. Without an id,
dedupe falls back to the hashed IP counter and the person has no delete
handle — which is what anonymous costs, and the form says so.

---

## 3. How a pending proposal is structurally kept away from shoppers

Not a convention — four independent mechanisms, each with its own test in
`src/test/proposals.test.js`.

1. **Three keys, and the public read path names only one.**
   `vj:prop:q` (pending, written by POST), `vj:prop:ok` (accepted, written
   *only* by `vet-proposals.mjs`), `vj:prop:rej` (rejected, read by nothing).
   `handleGet()` LRANGEs `vj:prop:ok`. Its single mention of the pending key
   is `['LLEN', PENDING_KEY]` — a count, not content. A test slices
   `handleGet`'s source out of the file and fails if that changes.
2. **One projection, and it refuses anything unvetted.** `toPublicAccepted()`
   returns `null` unless `record.status === 'accepted'`, whatever list the
   record came out of.
3. **The route cannot mint an accepted record.** `sanitizeProposal()`
   hard-codes `status: STATUS.PENDING` and ignores every status, `match`,
   `acceptedAt` and `origin` the body claims. Only the vetting script writes
   `'accepted'`, and it runs on a human's keystroke.
4. **The client does not trust the server either.** `isVettedItem()` requires
   `origin === 'community-vetted'` and no `status` field, so a mis-deployed or
   compromised backend handing over a pending record still renders nothing.

A fifth, weaker guard: the route module deliberately **exports no function
that can read an arbitrary key** — the Redis transport is not exported, and
`vet-proposals.mjs` carries its own ten-line copy. A test asserts the export
list is exactly the frozen set, so adding one is a reviewed change.

---

## 4. Refused at intake — not moderation, just nonsense

These three are not judgement calls, so they never reach the queue:

| reason | what it is |
|---|---|
| `same_product` | `altCode === forCode` — a product proposed as its own alternative |
| `same_brand` | the same brand on both sides, diacritics/case/punctuation folded |
| `alternative_serbian` | the proposed alternative is itself GS1-Serbia (860) registered — self-defeating by the app's own published definition |

Plus: free text that smells like a URL, an address, markup or a scheme loses
the **field** (`looksLikeSpam`); if that field was the only thing named, the
proposal is refused as `nothing_named`. Control characters, zero-width
characters and over-long input are stripped and capped. Nothing is ever
rendered as HTML — React escapes text children and a test fails the build on
any raw-HTML escape hatch appearing in these files.

The queue cap **refuses** at `QUEUE_MAX` rather than LTRIM-ing the oldest away:
trimming would let a flood delete the honest proposals ahead of it, which is
the cheapest possible attack on a queue whose whole value is that a human
reads it.

---

## 5. The vetting tool

```bash
node scripts/vet-proposals.mjs                 # review the live queue
node scripts/vet-proposals.mjs --list          # print the dossiers, decide nothing
node scripts/vet-proposals.mjs --input f.json  # review a file, no store needed
node scripts/vet-proposals.mjs --dry-run       # decide, write nothing anywhere
node scripts/vet-proposals.mjs --no-catalogue  # skip the 66 MB retail load
node scripts/vet-proposals.mjs --reviewer shend
```

For each pending proposal it prints both products with **everything the app
already knows**: the GS1 prefix → country via `src/lib/gs1.js`, any
boycott-table hit (by barcode and by brand), whether the barcode is in
`data/kosovo-retail.json` with its name / price / category / shelf, the
`isLocalBrand` value verbatim, and the category family — resolved in the same
order the app resolves it (`categoryFamilyOf(category)` then
`leadFamilyOf(name)`), because a reviewer must be shown the family the app
computes and not a different one.

Then the pre-flight. **None of these auto-reject** — they are reasons to look
harder, shown so a human does not have to find them:

| flag | meaning |
|---|---|
| `SELF` | same product, or same brand, on both sides |
| `SERBIAN` | the proposed alternative is itself 860-registered |
| `BOYCOTT` | it matches `data/boycott-brands.json` by barcode or brand |
| `FAMILY` | the two families disagree — *milk is not an alternative to yogurt* |
| `UNKNOWN` | the barcode is in no catalogue we hold; nothing can confirm it exists |
| `NOT-LOCAL` | a catalogue row exists but `isLocalBrand` is `false` **or `null`** — both are "not proven local" |
| `HEARSAY` | the proposer named a shop. **Sold in Kosovo is not made by a Kosovar brand**, and this is not evidence of origin |

Then: `[a]ccept  [r]eject  [n]eeds more info  [s]kip  [q]uit`, a mandatory
note recording the reasoning, and on an accept the owner's own question —
**"is this a 1:1 replacement?"** — asked explicitly rather than assumed, plus
a source URL for the pairing.

Prompts read from a TTY *or* a pipe, so a review can be scripted:

```bash
printf 'a\nsame aisle, Kosovo prefix, isLocalBrand true\ny\nhttps://example.com/\nq\n' \
  | node scripts/vet-proposals.mjs --input proposals.json
```

Measured 2026-09-17 on a five-proposal fixture built from real catalogue rows
(`--list`, full catalogue loaded):

```
p1  Imlek milk 8601500110057  ->  Vita milk 3900372010034
    family milk (from the title) vs milk (from the title)
    PRE-FLIGHT — nothing flagged.
p2  Imlek 8601500110057  ->  Imlek 8601500110057
    [SELF] the proposed alternative IS the product it claims to replace
    [SELF] same brand on both sides ("Imlek")
    [SERBIAN] the proposed alternative is itself registered with GS1 Serbia (860)
    [BOYCOTT] proposed alternative matches the boycott table by brand: Imlek
    [NOT-LOCAL] isLocalBrand is false — NOT proven to be a local brand
p3  Vita milk  ->  Bimilk YOGURT 8601500111207
    [SERBIAN] ... [FAMILY] families disagree: "milk" vs "yogurt" — would fail the aisle test
    [NOT-LOCAL] ...
p4  Imlek milk  ->  Qikjo pumpkin seeds 3901009470849
    [FAMILY] families disagree: "milk" vs "biscuits" — would fail the aisle test
p5  Imlek milk  ->  brand "Rugove", no barcode, seen at "Viva Fresh, Prishtine"
    [HEARSAY] sold in Kosovo is NOT made by a Kosovar brand
```

---

## 6. The merge — accepted proposals into the curated table

An accepted proposal is written to **`data/proposed-alternatives.json`**, in
the same entry shape as `data/brand-alternatives.json`, with the provenance
that keeps the two distinguishable forever:

```json
{
  "serbianBrand": "Imlek",
  "category": "milk",
  "verifiedSerbian": true,
  "forCode": "8601500110057",
  "alternatives": [{
    "brand": "Vita",
    "country": "kosovo",
    "barcode": "3900372010034",
    "sourceUrl": "https://vitakos.com/",
    "evidence": "GS1 barcode prefix 390 (Kosovo) on barcode 3900372010034",
    "pairingEvidence": "community-proposal-vetted",
    "pairingUrl": "https://vitakos.com/"
  }],
  "proposal": {
    "id": "p1", "proposedAt": 1758000000000, "decidedAt": 1789594947911,
    "decidedBy": "owner", "match": "1:1",
    "reviewNote": "same aisle, Kosovo 390 prefix, isLocalBrand true on its own row",
    "preflightFlags": []
  }
}
```

Two things it deliberately does **not** do:

- `country` is `null` unless the catalogue row proves `isLocalBrand === true`.
  A reviewer agreeing with a pairing is not a finding about origin, and
  `evidence` then reads *"origin NOT established from data Vendorja holds;
  accepted on reviewer judgement"*.
- `pairingEvidence` is `"community-proposal-vetted"`, never `"reported"` and
  never `"category-match"`. Nothing downstream can quietly upgrade a
  stranger's suggestion into a sourced claim.

### The merge command

`data/brand-alternatives.json` is curated by hand, so **this
tool never writes it** (a test asserts `vet-proposals.mjs` has exactly one
output path, and that it is `proposed-alternatives.json`). The merge is a
separate, reviewed step:

```bash
# 1. read it first — this is curated data, not a queue
cat data/proposed-alternatives.json

# 2. dry run: what would land, and what already exists
node --input-type=module -e "
import fs from 'node:fs';
const cur = JSON.parse(fs.readFileSync('data/brand-alternatives.json','utf8'));
const add = JSON.parse(fs.readFileSync('data/proposed-alternatives.json','utf8'));
const have = new Set(cur.entries.map(e => String(e.serbianBrand).toLowerCase()));
for (const e of add.entries) {
  const key = String(e.serbianBrand).toLowerCase();
  console.log(have.has(key) ? 'MERGE INTO EXISTING' : 'NEW ENTRY', '->', e.serbianBrand,
              '::', e.alternatives.map(a => a.brand).join(', '));
}"

# 3. merge (APPEND-ONLY; the incumbent wins a collision, exactly as
#    scripts/merge-retail.mjs does — see docs/XAPI-SOURCING.md §6)
node --input-type=module -e "
import fs from 'node:fs';
const p = 'data/brand-alternatives.json';
const cur = JSON.parse(fs.readFileSync(p,'utf8'));
const add = JSON.parse(fs.readFileSync('data/proposed-alternatives.json','utf8'));
const byBrand = new Map(cur.entries.map(e => [String(e.serbianBrand).toLowerCase(), e]));
let merged = 0, appended = 0;
for (const e of add.entries) {
  const hit = byBrand.get(String(e.serbianBrand).toLowerCase());
  if (hit) {
    const known = new Set(hit.alternatives.map(a => String(a.brand).toLowerCase()));
    for (const alt of e.alternatives) {
      if (known.has(String(alt.brand).toLowerCase())) continue;  // incumbent wins
      hit.alternatives.push(alt); merged++;
    }
  } else { cur.entries.push(e); appended++; }
}
fs.writeFileSync(p, JSON.stringify(cur, null, 2) + '\n');
console.log('appended', appended, 'entries,', merged, 'alternatives into existing entries');"

# 4. THE GATES. The number that must not move is WRONG FAMILY = 0.
node scripts/eval-alternatives.mjs
node scripts/verify-local-brand-gate.mjs
npm test && npm run build

# 5. only then, empty the accepted file so it is a queue again
rm data/proposed-alternatives.json
```

**Do not merge without re-running `eval-alternatives.mjs`.** If it moves
`WRONG FAMILY` above 0, the pairing is wrong — take it back out, whatever the
reviewer thought.

A `scripts/merge-proposals.mjs` that wraps step 3 with a `--dry-run` and the
gates, the way `scripts/merge-retail.mjs` does, is the obvious follow-up. It
is not here because `data/brand-alternatives.json` is curated by hand;
the command above is what such a script would run.

---

## 7. How the UI must show an accepted proposal

An accepted proposal is **not** a source-cited curated pairing. It arrives
with `origin: "community-vetted"` and the screen has to say where it came
from. The strings exist in both languages:

| key | sq | en |
|---|---|---|
| `proposeOriginLabel` | propozuar nga një blerës, e shqyrtuar | Proposed by a shopper, reviewed |
| `proposeOriginNote` | nuk është çiftëzim i kuruar me burim … | Not a source-cited curated pairing … |
| `proposeMatch1to1` | zëvendësim 1:1 | 1:1 replacement |
| `proposeMatchSimilar` | i ngjashëm, jo 1:1 | Similar, not 1:1 |

`match` is `'1:1'` only when the reviewer answered yes to that question.
Anything else reads as merely similar — `toPublicAccepted()` defaults an
unknown value to `'similar'`, never upward.

---

## 8. Verify

```bash
npm test                  # 438 tests pass, 48 of them this feature's
npm run build             # must pass with NO backend configured
node scripts/vet-proposals.mjs --list     # "No proposal store is provisioned" — exit 0
```

### Measured in a real browser, 2026-09-17

`npm run dev` on port 5213, the component mounted on a throwaway preview page
(deleted again afterwards — `/alternativa` is the real mount point). Every
state below was seen rendered, with the browser console filtered to errors
reporting **no console errors or exceptions** at each step:

| state | what was on screen |
|---|---|
| collapsed | "s'kemi zëvendësim vendor për këtë produkt. a njeh ti një?" + one quiet outline button. No red. |
| open | four fields, barcode first, 48px inputs at 16px text, the `seenAt` hint carrying the "sold in Kosovo is not made by a Kosovar brand" warning, one red submit |
| self-referential | typed the product's own barcode → "ky është vetë produkti — nuk mund të jetë alternativë e vetvetes." as alarm TEXT with a hairline rule, no red fill |
| XSS payload | `<img src=x onerror="document.title='XSS-EXECUTED'">` typed into the brand field → rendered as literal characters, `document.title` still `propose preview`, nothing executed |
| no backend | POST `/api/proposals` answered **503**, the client went `unavailable`, and the form stayed put saying "s'po arrijmë ta dërgojmë tani. provo më vonë." |
| queued | with a stubbed 202 → "e morëm — tani pret shqyrtimin / propozimi yt nuk është publikuar…". Plain ink, never a green tick: green is the `vendore` badge's and a queued proposal is not a verified local product. |

The exact body that went on the wire, read out of the stub:

```json
{"forCode":"8600043000016","forName":"Plazma 300g","forBrand":"Bambi",
 "altCode":"3810000000015","altBrand":"Rugove","altName":"Qumesht i fresket 1L",
 "seenAt":"<b>Viva Fresh</b> 42.66278, 21.16556","anonId":"8fd9853b1918"}
```

No IP, no location field, no user agent, no contact detail. The `seenAt` value
there is what the client sends; the SERVER is the authority that drops it —
`looksLikeSpam` (it contains `<`/`>`) and `looksLikeCoordinates` both reject
it, so the stored record's `seenAt` is `null`. Trimming on the client is a
courtesy, never the boundary.

**One real bug was found this way and fixed.** The component used to call
`currentProposalState()` on every render, so the first submit against an
unprovisioned deployment flipped the module's session state and unmounted the
panel on the next render — the form vanished under the finger of the person
who had just typed into it, with nothing said. It now reads that state once,
in a `useState` initialiser: an instance that mounts while the backend is
already known to be gone renders nothing, an instance that discovers it
mid-submit stays and says so. `src/test/proposals.test.js` has the regression.
