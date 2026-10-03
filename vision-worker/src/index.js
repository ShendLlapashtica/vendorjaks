// Vendorja vision probe: read the BRAND off a product photo.
//
// The barcode path answers "which GS1 org issued this number". A photo answers
// the question shoppers actually ask -- "whose product is this?" -- because the
// brand is printed on the pack. So we read the pack rather than trying to
// match the image against a catalogue: brand text is far more reliable to
// recognise than package geometry, and it joins straight onto the curated
// Serbian/local brand map we already have.
const MODEL = '@cf/meta/llama-3.2-11b-vision-instruct';
const FALLBACK = '@cf/llava-hf/llava-1.5-7b-hf';

const PROMPT =
  'Look at this product package. Reply with ONLY a compact JSON object, no prose: ' +
  '{"brand":"<the brand name printed on the pack, or null>",' +
  '"product":"<the product name, or null>",' +
  '"text":"<the most prominent text you can read>",' +
  '"confidence":"high|medium|low"}. ' +
  'If you cannot read a brand, use null. Do not guess a brand that is not visible.';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors() });
    }
    if (url.pathname === '/health') {
      return Response.json({ ok: true, model: MODEL }, { headers: cors() });
    }
    if (request.method !== 'POST') {
      return new Response('POST an image', { status: 405, headers: cors() });
    }

    // Accept a raw image body or { imageUrl }.
    let bytes;
    const ct = request.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      const { imageUrl } = await request.json();
      if (!imageUrl) return Response.json({ error: 'imageUrl required' }, { status: 400, headers: cors() });
      const r = await fetch(imageUrl);
      if (!r.ok) return Response.json({ error: `image fetch ${r.status}` }, { status: 502, headers: cors() });
      bytes = new Uint8Array(await r.arrayBuffer());
    } else {
      bytes = new Uint8Array(await request.arrayBuffer());
    }
    if (!bytes?.length) return Response.json({ error: 'empty image' }, { status: 400, headers: cors() });

    for (const model of [MODEL, FALLBACK]) {
      try {
        const out = await env.AI.run(model, { image: [...bytes], prompt: PROMPT, max_tokens: 256 });
        const raw = out?.description ?? out?.response ?? '';
        return Response.json({ model, raw, parsed: tryJson(raw) }, { headers: cors() });
      } catch (err) {
        if (model === FALLBACK) {
          return Response.json({ error: String(err).slice(0, 300) }, { status: 500, headers: cors() });
        }
      }
    }
  },
};

function tryJson(s) {
  const m = String(s).match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

function cors() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type',
    'access-control-allow-methods': 'POST, GET, OPTIONS',
  };
}
