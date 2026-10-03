#!/usr/bin/env node
// Builds data/gs1-prefixes.json — the COMPLETE GS1 prefix allocation table.
//
// Why this exists (2026-09-12): the previous table covered only 704 of the
// 1000 possible 3-digit prefixes, was missing 389 (GS1 Montenegro) entirely,
// carried six duplicate/overlapping entries (Germany, Italy, Albania, North
// Macedonia, Serbia, Turkey each appeared twice), had no ISO country codes
// (so no flag could be drawn) and no Albanian country names (so `countrySq`
// silently fell back to English for every country).
//
// THE RULE THIS TABLE EXISTS UNDER, restated because it is the whole product:
// a GS1 prefix identifies the GS1 Member Organisation that ISSUED the number
// — i.e. where the brand owner registered — NOT where the item was made.
// Vendorja must say "registered with GS1 X", never "made in X".
//
// KOSOVO / MONTENEGRO, verified 2026-09-12 against the GS1 country-code list
// (en.wikipedia.org/wiki/List_of_GS1_country_codes, upc.dev/prefixes):
//   381 = GS1 Kosovo   — Kosovo's own official prefix.
//   389 = GS1 Montenegro.
//   390 = used in practice by Kosovo producers BEFORE Kosovo had 381; not an
//         official Kosovo allocation, but real and still in circulation, so
//         Vendorja treats it as local and labels it as the legacy case.
// An earlier draft of this file had 389/390 swapped. They are not swapped.
//
// Run: node scripts/build-gs1-table.mjs

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '..', 'data', 'gs1-prefixes.json');

// kind: 'country'    -> a real GS1 Member Organisation, has an ISO code + flag
//       'restricted' -> in-store / retailer-internal numbers, no country at all
//       'coupon' | 'isbn' | 'issn' | 'refund' | 'office' -> special GS1 ranges
//       'unassigned' -> GS1 has not allocated this range to anyone
//
// [range, country(EN), countrySq, iso, kind, note?]
const TABLE = [
  ['000-019', 'United States & Canada', 'SHBA e Kanada', 'US', 'country', 'GS1 US (shared UPC space with Canada).'],
  ['020-029', 'Restricted distribution', 'Përdorim i brendshëm', null, 'restricted', 'Retailer-internal / in-store numbers. Not a country.'],
  ['030-039', 'United States', 'SHBA', 'US', 'country', 'GS1 US (drugs / National Drug Code).'],
  ['040-049', 'Restricted distribution', 'Përdorim i brendshëm', null, 'restricted', 'Retailer-internal / in-store numbers. Not a country.'],
  ['050-059', 'Coupons', 'Kuponë', null, 'coupon', 'GS1 US coupon identification.'],
  ['060-139', 'United States', 'SHBA', 'US', 'country', 'GS1 US.'],
  ['140-199', 'Unassigned', 'E paalokuar', null, 'unassigned', 'Not allocated by GS1.'],
  ['200-299', 'Restricted distribution', 'Përdorim i brendshëm', null, 'restricted', 'Retailer-internal / in-store numbers (weighed goods, loyalty). Not a country.'],
  ['300-379', 'France', 'Francë', 'FR', 'country', 'GS1 France (incl. Monaco).'],
  ['380', 'Bulgaria', 'Bullgari', 'BG', 'country', 'GS1 Bulgaria.'],
  ['381', 'Kosovo', 'Kosovë', 'XK', 'country', "GS1 Kosovo — Kosovo's own official prefix."],
  ['382', 'Unassigned', 'E paalokuar', null, 'unassigned', 'Not allocated by GS1.'],
  ['383', 'Slovenia', 'Slloveni', 'SI', 'country', 'GS1 Slovenia.'],
  ['384', 'Unassigned', 'E paalokuar', null, 'unassigned', 'Not allocated by GS1.'],
  ['385', 'Croatia', 'Kroaci', 'HR', 'country', 'GS1 Croatia.'],
  ['386', 'Unassigned', 'E paalokuar', null, 'unassigned', 'Not allocated by GS1.'],
  ['387', 'Bosnia and Herzegovina', 'Bosnjë e Hercegovinë', 'BA', 'country', 'GS1 Bosnia and Herzegovina.'],
  ['388', 'Unassigned', 'E paalokuar', null, 'unassigned', 'Not allocated by GS1.'],
  ['389', 'Montenegro', 'Mal i Zi', 'ME', 'country', 'GS1 Montenegro.'],
  ['390', 'Kosovo (legacy range)', 'Kosovë (rreze e vjetër)', 'XK', 'country', 'Used in practice by Kosovo producers before Kosovo had its own 381 allocation. Not an official Kosovo assignment, but real and still in circulation.'],
  ['391-399', 'Unassigned', 'E paalokuar', null, 'unassigned', 'Not allocated by GS1.'],
  ['400-440', 'Germany', 'Gjermani', 'DE', 'country', 'GS1 Germany.'],
  ['441-449', 'Unassigned', 'E paalokuar', null, 'unassigned', 'Not allocated by GS1.'],
  ['450-459', 'Japan', 'Japoni', 'JP', 'country', 'GS1 Japan.'],
  ['460-469', 'Russia', 'Rusi', 'RU', 'country', 'GS1 Russia.'],
  ['470', 'Kyrgyzstan', 'Kirgizstan', 'KG', 'country', 'GS1 Kyrgyzstan.'],
  ['471', 'Taiwan', 'Tajvan', 'TW', 'country', 'GS1 Taiwan.'],
  ['472-473', 'Unassigned', 'E paalokuar', null, 'unassigned', 'Not allocated by GS1.'],
  ['474', 'Estonia', 'Estoni', 'EE', 'country', 'GS1 Estonia.'],
  ['475', 'Latvia', 'Letoni', 'LV', 'country', 'GS1 Latvia.'],
  ['476', 'Azerbaijan', 'Azerbajxhan', 'AZ', 'country', 'GS1 Azerbaijan.'],
  ['477', 'Lithuania', 'Lituani', 'LT', 'country', 'GS1 Lithuania.'],
  ['478', 'Uzbekistan', 'Uzbekistan', 'UZ', 'country', 'GS1 Uzbekistan.'],
  ['479', 'Sri Lanka', 'Sri Lankë', 'LK', 'country', 'GS1 Sri Lanka.'],
  ['480', 'Philippines', 'Filipine', 'PH', 'country', 'GS1 Philippines.'],
  ['481', 'Belarus', 'Bjellorusi', 'BY', 'country', 'GS1 Belarus.'],
  ['482', 'Ukraine', 'Ukrainë', 'UA', 'country', 'GS1 Ukraine.'],
  ['483', 'Turkmenistan', 'Turkmenistan', 'TM', 'country', 'GS1 Turkmenistan.'],
  ['484', 'Moldova', 'Moldavi', 'MD', 'country', 'GS1 Moldova.'],
  ['485', 'Armenia', 'Armeni', 'AM', 'country', 'GS1 Armenia.'],
  ['486', 'Georgia', 'Gjeorgji', 'GE', 'country', 'GS1 Georgia.'],
  ['487', 'Kazakhstan', 'Kazakistan', 'KZ', 'country', 'GS1 Kazakhstan.'],
  ['488', 'Tajikistan', 'Taxhikistan', 'TJ', 'country', 'GS1 Tajikistan.'],
  ['489', 'Hong Kong', 'Hong Kong', 'HK', 'country', 'GS1 Hong Kong.'],
  ['490-499', 'Japan', 'Japoni', 'JP', 'country', 'GS1 Japan.'],
  ['500-509', 'United Kingdom', 'Mbretëri e Bashkuar', 'GB', 'country', 'GS1 UK.'],
  ['510-519', 'Unassigned', 'E paalokuar', null, 'unassigned', 'Not allocated by GS1.'],
  ['520-521', 'Greece', 'Greqi', 'GR', 'country', 'GS1 Association Greece.'],
  ['522-527', 'Unassigned', 'E paalokuar', null, 'unassigned', 'Not allocated by GS1.'],
  ['528', 'Lebanon', 'Liban', 'LB', 'country', 'GS1 Lebanon.'],
  ['529', 'Cyprus', 'Qipro', 'CY', 'country', 'GS1 Cyprus.'],
  ['530', 'Albania', 'Shqipëri', 'AL', 'country', 'GS1 Albania.'],
  ['531', 'North Macedonia', 'Maqedoni e Veriut', 'MK', 'country', 'GS1 North Macedonia.'],
  ['532-534', 'Unassigned', 'E paalokuar', null, 'unassigned', 'Not allocated by GS1.'],
  ['535', 'Malta', 'Maltë', 'MT', 'country', 'GS1 Malta.'],
  ['536-538', 'Unassigned', 'E paalokuar', null, 'unassigned', 'Not allocated by GS1.'],
  ['539', 'Ireland', 'Irlandë', 'IE', 'country', 'GS1 Ireland.'],
  ['540-549', 'Belgium & Luxembourg', 'Belgjikë e Luksemburg', 'BE', 'country', 'GS1 Belgium & Luxembourg.'],
  ['550-559', 'Unassigned', 'E paalokuar', null, 'unassigned', 'Not allocated by GS1.'],
  ['560', 'Portugal', 'Portugali', 'PT', 'country', 'GS1 Portugal.'],
  ['561-568', 'Unassigned', 'E paalokuar', null, 'unassigned', 'Not allocated by GS1.'],
  ['569', 'Iceland', 'Islandë', 'IS', 'country', 'GS1 Iceland.'],
  ['570-579', 'Denmark', 'Danimarkë', 'DK', 'country', 'GS1 Denmark.'],
  ['580-589', 'Unassigned', 'E paalokuar', null, 'unassigned', 'Not allocated by GS1.'],
  ['590', 'Poland', 'Poloni', 'PL', 'country', 'GS1 Poland.'],
  ['591-593', 'Unassigned', 'E paalokuar', null, 'unassigned', 'Not allocated by GS1.'],
  ['594', 'Romania', 'Rumani', 'RO', 'country', 'GS1 Romania.'],
  ['595-598', 'Unassigned', 'E paalokuar', null, 'unassigned', 'Not allocated by GS1.'],
  ['599', 'Hungary', 'Hungari', 'HU', 'country', 'GS1 Hungary.'],
  ['600-601', 'South Africa', 'Afrikë e Jugut', 'ZA', 'country', 'GS1 South Africa.'],
  ['602', 'Unassigned', 'E paalokuar', null, 'unassigned', 'Not allocated by GS1.'],
  ['603', 'Ghana', 'Ganë', 'GH', 'country', 'GS1 Ghana.'],
  ['604', 'Senegal', 'Senegal', 'SN', 'country', 'GS1 Senegal.'],
  ['605', 'Uganda', 'Ugandë', 'UG', 'country', 'GS1 Uganda.'],
  ['606', 'Angola', 'Angolë', 'AO', 'country', 'GS1 Angola.'],
  ['607', 'Oman', 'Oman', 'OM', 'country', 'GS1 Oman.'],
  ['608', 'Bahrain', 'Bahrein', 'BH', 'country', 'GS1 Bahrain.'],
  ['609', 'Mauritius', 'Mauritius', 'MU', 'country', 'GS1 Mauritius.'],
  ['610', 'Unassigned', 'E paalokuar', null, 'unassigned', 'Not allocated by GS1.'],
  ['611', 'Morocco', 'Marok', 'MA', 'country', 'GS1 Morocco.'],
  ['612', 'Unassigned', 'E paalokuar', null, 'unassigned', 'Not allocated by GS1.'],
  ['613', 'Algeria', 'Algjeri', 'DZ', 'country', 'GS1 Algeria.'],
  ['614', 'Unassigned', 'E paalokuar', null, 'unassigned', 'Not allocated by GS1.'],
  ['615', 'Nigeria', 'Nigeri', 'NG', 'country', 'GS1 Nigeria.'],
  ['616', 'Kenya', 'Kenia', 'KE', 'country', 'GS1 Kenya.'],
  ['617', 'Cameroon', 'Kamerun', 'CM', 'country', 'GS1 Cameroon.'],
  ['618', 'Ivory Coast', 'Bregu i Fildishtë', 'CI', 'country', 'GS1 Ivory Coast.'],
  ['619', 'Tunisia', 'Tunizi', 'TN', 'country', 'GS1 Tunisia.'],
  ['620', 'Tanzania', 'Tanzani', 'TZ', 'country', 'GS1 Tanzania.'],
  ['621', 'Syria', 'Siri', 'SY', 'country', 'GS1 Syria.'],
  ['622', 'Egypt', 'Egjipt', 'EG', 'country', 'GS1 Egypt.'],
  ['623', 'Brunei', 'Brunei', 'BN', 'country', 'GS1 Brunei.'],
  ['624', 'Libya', 'Libi', 'LY', 'country', 'GS1 Libya.'],
  ['625', 'Jordan', 'Jordani', 'JO', 'country', 'GS1 Jordan.'],
  ['626', 'Iran', 'Iran', 'IR', 'country', 'GS1 Iran.'],
  ['627', 'Kuwait', 'Kuvajt', 'KW', 'country', 'GS1 Kuwait.'],
  ['628', 'Saudi Arabia', 'Arabi Saudite', 'SA', 'country', 'GS1 Saudi Arabia.'],
  ['629', 'United Arab Emirates', 'Emiratet e Bashkuara Arabe', 'AE', 'country', 'GS1 Emirates.'],
  ['630', 'Qatar', 'Katar', 'QA', 'country', 'GS1 Qatar.'],
  ['631', 'Namibia', 'Namibi', 'NA', 'country', 'GS1 Namibia.'],
  ['632', 'Rwanda', 'Ruandë', 'RW', 'country', 'GS1 Rwanda.'],
  ['633-639', 'Unassigned', 'E paalokuar', null, 'unassigned', 'Not allocated by GS1.'],
  ['640-649', 'Finland', 'Finlandë', 'FI', 'country', 'GS1 Finland.'],
  ['650-689', 'Unassigned', 'E paalokuar', null, 'unassigned', 'Not allocated by GS1.'],
  ['690-699', 'China', 'Kinë', 'CN', 'country', 'GS1 China.'],
  ['700-709', 'Norway', 'Norvegji', 'NO', 'country', 'GS1 Norway.'],
  ['710-728', 'Unassigned', 'E paalokuar', null, 'unassigned', 'Not allocated by GS1.'],
  ['729', 'Israel', 'Izrael', 'IL', 'country', 'GS1 Israel.'],
  ['730-739', 'Sweden', 'Suedi', 'SE', 'country', 'GS1 Sweden.'],
  ['740', 'Guatemala', 'Guatemalë', 'GT', 'country', 'GS1 Guatemala.'],
  ['741', 'El Salvador', 'Salvador', 'SV', 'country', 'GS1 El Salvador.'],
  ['742', 'Honduras', 'Honduras', 'HN', 'country', 'GS1 Honduras.'],
  ['743', 'Nicaragua', 'Nikaragua', 'NI', 'country', 'GS1 Nicaragua.'],
  ['744', 'Costa Rica', 'Kosta Rika', 'CR', 'country', 'GS1 Costa Rica.'],
  ['745', 'Panama', 'Panama', 'PA', 'country', 'GS1 Panama.'],
  ['746', 'Dominican Republic', 'Republika Dominikane', 'DO', 'country', 'GS1 Republica Dominicana.'],
  ['747-749', 'Unassigned', 'E paalokuar', null, 'unassigned', 'Not allocated by GS1.'],
  ['750', 'Mexico', 'Meksikë', 'MX', 'country', 'GS1 Mexico.'],
  ['751-753', 'Unassigned', 'E paalokuar', null, 'unassigned', 'Not allocated by GS1.'],
  ['754-755', 'Canada', 'Kanada', 'CA', 'country', 'GS1 Canada.'],
  ['756-758', 'Unassigned', 'E paalokuar', null, 'unassigned', 'Not allocated by GS1.'],
  ['759', 'Venezuela', 'Venezuelë', 'VE', 'country', 'GS1 Venezuela.'],
  ['760-769', 'Switzerland', 'Zvicër', 'CH', 'country', 'GS1 Schweiz/Suisse/Svizzera.'],
  ['770-771', 'Colombia', 'Kolumbi', 'CO', 'country', 'GS1 Colombia.'],
  ['772', 'Unassigned', 'E paalokuar', null, 'unassigned', 'Not allocated by GS1.'],
  ['773', 'Uruguay', 'Uruguai', 'UY', 'country', 'GS1 Uruguay.'],
  ['774', 'Unassigned', 'E paalokuar', null, 'unassigned', 'Not allocated by GS1.'],
  ['775', 'Peru', 'Peru', 'PE', 'country', 'GS1 Peru.'],
  ['776', 'Unassigned', 'E paalokuar', null, 'unassigned', 'Not allocated by GS1.'],
  ['777', 'Bolivia', 'Bolivi', 'BO', 'country', 'GS1 Bolivia.'],
  ['778-779', 'Argentina', 'Argjentinë', 'AR', 'country', 'GS1 Argentina.'],
  ['780', 'Chile', 'Kili', 'CL', 'country', 'GS1 Chile.'],
  ['781-783', 'Unassigned', 'E paalokuar', null, 'unassigned', 'Not allocated by GS1.'],
  ['784', 'Paraguay', 'Paraguai', 'PY', 'country', 'GS1 Paraguay.'],
  ['785', 'Unassigned', 'E paalokuar', null, 'unassigned', 'Not allocated by GS1.'],
  ['786', 'Ecuador', 'Ekuador', 'EC', 'country', 'GS1 Ecuador.'],
  ['787-788', 'Unassigned', 'E paalokuar', null, 'unassigned', 'Not allocated by GS1.'],
  ['789-790', 'Brazil', 'Brazil', 'BR', 'country', 'GS1 Brasil.'],
  ['791-799', 'Unassigned', 'E paalokuar', null, 'unassigned', 'Not allocated by GS1.'],
  ['800-839', 'Italy', 'Itali', 'IT', 'country', 'GS1 Italy (incl. San Marino, Vatican City).'],
  ['840-849', 'Spain', 'Spanjë', 'ES', 'country', 'GS1 Spain (incl. Andorra).'],
  ['850', 'Cuba', 'Kubë', 'CU', 'country', 'GS1 Cuba.'],
  ['851-857', 'Unassigned', 'E paalokuar', null, 'unassigned', 'Not allocated by GS1.'],
  ['858', 'Slovakia', 'Sllovaki', 'SK', 'country', 'GS1 Slovakia.'],
  ['859', 'Czechia', 'Çeki', 'CZ', 'country', 'GS1 Czech Republic.'],
  ['860', 'Serbia', 'Serbi', 'RS', 'country', 'GS1 Serbia.'],
  ['861-864', 'Unassigned', 'E paalokuar', null, 'unassigned', 'Not allocated by GS1.'],
  ['865', 'Mongolia', 'Mongoli', 'MN', 'country', 'GS1 Mongolia.'],
  ['866', 'Unassigned', 'E paalokuar', null, 'unassigned', 'Not allocated by GS1.'],
  ['867', 'North Korea', 'Kore e Veriut', 'KP', 'country', 'GS1 DPR Korea.'],
  ['868-869', 'Türkiye', 'Turqi', 'TR', 'country', 'GS1 Türkiye.'],
  ['870-879', 'Netherlands', 'Holandë', 'NL', 'country', 'GS1 Netherlands.'],
  ['880', 'South Korea', 'Kore e Jugut', 'KR', 'country', 'GS1 South Korea.'],
  ['881-882', 'Unassigned', 'E paalokuar', null, 'unassigned', 'Not allocated by GS1.'],
  ['883', 'Myanmar', 'Mianmar', 'MM', 'country', 'GS1 Myanmar.'],
  ['884', 'Cambodia', 'Kamboxhia', 'KH', 'country', 'GS1 Cambodia.'],
  ['885', 'Thailand', 'Tajlandë', 'TH', 'country', 'GS1 Thailand.'],
  ['886-887', 'Unassigned', 'E paalokuar', null, 'unassigned', 'Not allocated by GS1.'],
  ['888', 'Singapore', 'Singapor', 'SG', 'country', 'GS1 Singapore.'],
  ['889', 'Unassigned', 'E paalokuar', null, 'unassigned', 'Not allocated by GS1.'],
  ['890', 'India', 'Indi', 'IN', 'country', 'GS1 India.'],
  ['891-892', 'Unassigned', 'E paalokuar', null, 'unassigned', 'Not allocated by GS1.'],
  ['893', 'Vietnam', 'Vietnam', 'VN', 'country', 'GS1 Vietnam.'],
  ['894', 'Bangladesh', 'Bangladesh', 'BD', 'country', 'GS1 Bangladesh.'],
  ['895', 'Unassigned', 'E paalokuar', null, 'unassigned', 'Not allocated by GS1.'],
  ['896', 'Pakistan', 'Pakistan', 'PK', 'country', 'GS1 Pakistan.'],
  ['897-898', 'Unassigned', 'E paalokuar', null, 'unassigned', 'Not allocated by GS1.'],
  ['899', 'Indonesia', 'Indonezi', 'ID', 'country', 'GS1 Indonesia.'],
  ['900-919', 'Austria', 'Austri', 'AT', 'country', 'GS1 Austria.'],
  ['920-929', 'Unassigned', 'E paalokuar', null, 'unassigned', 'Not allocated by GS1.'],
  ['930-939', 'Australia', 'Australi', 'AU', 'country', 'GS1 Australia.'],
  ['940-949', 'New Zealand', 'Zelandë e Re', 'NZ', 'country', 'GS1 New Zealand.'],
  ['950-952', 'GS1 Global Office', 'Zyra Globale GS1', null, 'office', 'GS1 Global Office (EPC manager numbers, demonstrations/examples).'],
  ['953', 'Unassigned', 'E paalokuar', null, 'unassigned', 'Not allocated by GS1.'],
  ['954', 'Unassigned', 'E paalokuar', null, 'unassigned', 'Not allocated by GS1.'],
  ['955', 'Malaysia', 'Malajzi', 'MY', 'country', 'GS1 Malaysia.'],
  ['956-957', 'Unassigned', 'E paalokuar', null, 'unassigned', 'Not allocated by GS1.'],
  ['958', 'Macau', 'Makao', 'MO', 'country', 'GS1 Macau.'],
  ['959', 'Unassigned', 'E paalokuar', null, 'unassigned', 'Not allocated by GS1.'],
  ['960-969', 'GS1 Global Office', 'Zyra Globale GS1', null, 'office', 'GS1 Global Office — GTIN-8 allocations.'],
  ['970-976', 'Unassigned', 'E paalokuar', null, 'unassigned', 'Not allocated by GS1.'],
  ['977', 'Serial publication (ISSN)', 'Botim serial (ISSN)', null, 'issn', 'Magazines and journals, not a retail product.'],
  ['978-979', 'Book (ISBN / ISMN)', 'Libër (ISBN / ISMN)', null, 'isbn', 'Bookland — books and sheet music, not a retail food product.'],
  ['980', 'Refund receipt', 'Faturë rimbursimi', null, 'refund', 'Refund receipts, not a product.'],
  ['981-984', 'Coupons', 'Kuponë', null, 'coupon', 'GS1 coupon identification for common currency areas.'],
  ['985-989', 'Unassigned', 'E paalokuar', null, 'unassigned', 'Not allocated by GS1.'],
  ['990-999', 'Coupons', 'Kuponë', null, 'coupon', 'GS1 coupon identification.'],
];

// The only two facts Vendorja's verdict actually turns on.
const SERBIA_PREFIXES = new Set([860]);
const LOCAL_PREFIXES = new Set([381, 390, 530]); // Kosovo official, Kosovo legacy, Albania

function parseRange(range) {
  if (range.includes('-')) {
    const [a, b] = range.split('-');
    return [Number(a), Number(b)];
  }
  return [Number(range), Number(range)];
}

const prefixes = TABLE.map(([range, country, countrySq, iso, kind, note]) => {
  const [min] = parseRange(range);
  return {
    range,
    country,
    countrySq,
    iso,
    kind,
    isSerbia: SERBIA_PREFIXES.has(min),
    isLocal: LOCAL_PREFIXES.has(min),
    note: note || null,
  };
});

// --- Self-check: the table must be total, ordered and non-overlapping ------
// A gap here is not cosmetic — an uncovered prefix is a barcode the app
// cannot classify, which is the exact "it doesn't work for my country" bug
// this rebuild exists to kill. Fail loudly rather than emit a broken table.
const seen = new Map();
for (const entry of prefixes) {
  const [min, max] = parseRange(entry.range);
  if (min > max) throw new Error(`Inverted range: ${entry.range}`);
  for (let i = min; i <= max; i++) {
    if (seen.has(i)) {
      throw new Error(`Prefix ${i} covered twice: "${seen.get(i)}" and "${entry.country}"`);
    }
    seen.set(i, entry.country);
  }
}
const missing = [];
for (let i = 0; i <= 999; i++) if (!seen.has(i)) missing.push(String(i).padStart(3, '0'));
if (missing.length > 0) throw new Error(`Prefixes not covered (${missing.length}): ${missing.join(', ')}`);

for (const p of prefixes) {
  if (p.kind === 'country' && !p.iso) throw new Error(`Country entry without an ISO code: ${p.country}`);
  if (p.kind !== 'country' && p.iso) throw new Error(`Non-country entry with an ISO code: ${p.country}`);
  if (!p.countrySq) throw new Error(`Missing Albanian name: ${p.country}`);
}
if (prefixes.filter((p) => p.isSerbia).length !== 1) throw new Error('Expected exactly one Serbian range');
if (prefixes.filter((p) => p.isLocal).length !== 3) throw new Error('Expected exactly three local ranges');

const out = {
  builtAt: new Date().toISOString(),
  builtBy: 'scripts/build-gs1-table.mjs',
  disclaimer: 'GS1 prefixes do not identify the country of origin for a given product.',
  notes: [
    "A GS1 'company prefix' identifies which national/regional GS1 Member Organisation issued the number to the brand owner -- i.e. where the brand owner registered -- not where the item was manufactured, assembled, or grown.",
    'A brand can register with one GS1 Member Organisation and manufacture (or contract-manufacture) anywhere in the world; multinationals often number all their products under one home-country prefix regardless of factory location.',
    'This table is therefore a REGISTRATION/ISSUER map, never a manufacturing-origin map. Vendorja must only ever say "issued by GS1 <X>", never "made in <X>".',
    'Coverage is total: every 3-digit prefix 000-999 resolves to exactly one entry. Ranges GS1 has not allocated are present explicitly with kind "unassigned" rather than being absent, so the app can say "this prefix is not allocated" instead of failing to classify.',
    'Non-country ranges (restricted distribution, coupons, ISBN/ISSN, refund receipts, GS1 Global Office) carry kind != "country" and iso = null. They must never be rendered with a flag or described as a country.',
    '381 is Kosovo\'s own official GS1 prefix. 389 is GS1 Montenegro. 390 is not an official Kosovo allocation but was used in practice by Kosovo producers before 381 became available, and is still in circulation -- both 381 and 390 are treated as local here, with 390 labelled as the legacy case. Verified 2026-09-12.',
  ],
  sources: [
    'https://en.wikipedia.org/wiki/List_of_GS1_country_codes',
    'https://upc.dev/prefixes',
  ],
  coverage: { totalPrefixes: 1000, covered: seen.size, entries: prefixes.length },
  prefixes,
};

writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`, 'utf8');

const byKind = prefixes.reduce((acc, p) => ({ ...acc, [p.kind]: (acc[p.kind] || 0) + 1 }), {});
console.log(`Wrote ${OUT}`);
console.log(`  entries: ${prefixes.length}, prefixes covered: ${seen.size}/1000`);
console.log(`  by kind: ${JSON.stringify(byKind)}`);
console.log(`  countries with a flag (iso): ${prefixes.filter((p) => p.iso).length}`);
