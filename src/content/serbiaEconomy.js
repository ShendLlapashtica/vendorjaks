// Serbia's trade surplus with Kosovo, its tax machinery, its military
// spending and its arms procurement — the statistics dossier on the "pse"
// page.
//
// SOURCING RULE (owner's standing instruction, verbatim): "Every claim MUST
// have a real, checkable source. Do not invent facts or numbers. Where the
// data isn't verified, leave a clearly marked placeholder for the team to
// fill in."
//
// Research date: 2026-09-12. Every URL below was fetched and confirmed to
// resolve on that date. Every figure carries the year it applies to; a 2021
// figure is never presented as current.
//
// `verified: true` means: I fetched the named source and it states the
// figure as written here. `verified: false` means the figure could not be
// confirmed to that standard — the `note` says exactly what document would
// settle it, and the UI renders it as unconfirmed, never as settled fact.
//
// Where credible sources DISAGREE — common for arms-deal values and for
// military-spending series, which get revised — the disagreement is stated
// in `note` with both figures and who says what. It is not averaged away.
//
// Framing discipline: this module is the evidence base, not the argument.
// Labels state what the figure is. The rhetoric belongs elsewhere on the
// page. Nothing here is rounded up, and nothing is carried over from
// memory or from an aggregator that does not name its own source.
//
// ---------------------------------------------------------------------------
// ALBANIAN (added 2026-09-12 on the owner's instruction)
// ---------------------------------------------------------------------------
// Albanian is this app's primary language and this dossier used to ship in
// English only. Every entry below now carries an Albanian twin of each
// human-readable field:
//
//     label      -> labelSq      (for arms entries, labelSq translates `system`)
//     unit       -> unitSq
//     note       -> noteSq
//     value      -> valueSq      (only where the value is a word, e.g. "36th")
//     category   -> categorySq
//     supplier   -> supplierSq
//     dealValue  -> dealValueSq
//
// The view falls back to the English field whenever the Albanian one is
// absent, so a gap degrades to the sourced English string, never to blank.
//
// NOT translated, on purpose:
//   * proper nouns and designations — Rafale, T-72B1MS, BRDM-2MS, Pantsir-S1,
//     HQ-17AE, Lazar 3, Nora, Miloš, Hermes 900;
//   * institutions and their acronyms — SIPRI, PURS, ASK, Yugoimport SDPR,
//     Janes, RFE/RL, Elbit Systems, CASIC;
//   * the `source` and `sourceUrl` citation fields, which are how a reader
//     finds the document and must match what the document is called;
//   * DIRECT QUOTATIONS. A translated quote is no longer a quote. Serbian
//     statute text stays in Serbian and English press quotes stay in English
//     inside the Albanian notes, exactly as they appear in the source.

// ---------------------------------------------------------------------------
// A. TRADE — what Serbia earns from selling into Kosovo
// ---------------------------------------------------------------------------
// IMPORTANT CONTEXT for anyone reading the year-on-year series: Kosovo's
// imports from Serbia are not a clean trend line. Two political measures
// cut across them and both are sourced below —
//   * a 100% tariff on Serbian and Bosnian goods, Nov 2018 – April 2020;
//   * a ban on Serbian-origin goods imposed June 2023 and lifted 7 Oct 2024.
// Any figure for 2019, 2023 or 2024 is depressed by those measures. Reading
// the series without them would be misleading, so the measures ship as data.
//
// Source of the series: Kosovo Agency of Statistics (ASK), ASKDATA table
// tab02.px "Export and Import by partner country, 2010–2025" (partner code
// 242, "XS:SERBIA 06/2005") and tab08.px "Turnover of goods in Kosovo
// international trade". ASK publishes these in THOUSANDS of euro; the
// conversion to millions below is a decimal shift, nothing more. Values for
// 2017–2023 were additionally checked line by line against ASK's printed
// Statistical Yearbook 2024 (TAB 18.5, 18.7, 18.8) and match to the euro.
const TRADE_STATS_RAW = [
  {
    id: 'trade-imports-2025',
    label: 'Kosovo’s goods imports from Serbia',
    labelSq: 'Importet e mallrave të Kosovës nga Serbia',
    value: '€234.8 m',
    unit: '',
    year: 2025,
    source: 'Kosovo Agency of Statistics (ASK), ASKDATA tab02.px',
    sourceUrl:
      'https://askdata.rks-gov.net/pxweb/en/ASKdata/ASKdata__External%20trade__Yearly%20indicators/tab02.px/',
    verified: true,
    note:
      'ASK value as published: 234,833 thousand EUR. Latest full year. Up 81% on 2024 — the first full year after Kosovo’s import ban was lifted — but still about 37% below the 2022 level.',
    noteSq:
      'Vlera e publikuar nga ASK: 234,833 mijë EUR. Viti i fundit i plotë. Rritje prej 81% ndaj vitit 2024 — viti i parë i plotë pas heqjes së ndalesës kosovare të importit — por ende rreth 37% nën nivelin e vitit 2022.',
  },
  {
    id: 'trade-imports-2024',
    label: 'Kosovo’s goods imports from Serbia',
    labelSq: 'Importet e mallrave të Kosovës nga Serbia',
    value: '€129.7 m',
    unit: '',
    year: 2024,
    source: 'Kosovo Agency of Statistics (ASK), ASKDATA tab02.px',
    sourceUrl:
      'https://askdata.rks-gov.net/pxweb/en/ASKdata/ASKdata__External%20trade__Yearly%20indicators/tab02.px/',
    verified: true,
    note:
      'ASK value as published: 129,723 thousand EUR. Depressed by Kosovo’s ban on Serbian goods, in force for the first nine months of the year.',
    noteSq:
      'Vlera e publikuar nga ASK: 129,723 mijë EUR. E ulur nga ndalesa kosovare ndaj mallrave serbe, në fuqi gjatë nëntë muajve të parë të vitit.',
  },
  {
    id: 'trade-imports-2023',
    label: 'Kosovo’s goods imports from Serbia',
    labelSq: 'Importet e mallrave të Kosovës nga Serbia',
    value: '€198.7 m',
    unit: '',
    year: 2023,
    source: 'Kosovo Agency of Statistics (ASK), ASKDATA tab02.px',
    sourceUrl:
      'https://askdata.rks-gov.net/pxweb/en/ASKdata/ASKdata__External%20trade__Yearly%20indicators/tab02.px/',
    verified: true,
    note:
      'ASK value as published: 198,736 thousand EUR; matches ASK Statistical Yearbook 2024, TAB 18.7. Ban imposed mid-June 2023, so roughly half the year is affected.',
    noteSq:
      'Vlera e publikuar nga ASK: 198,736 mijë EUR; përputhet me Vjetarin Statistikor 2024 të ASK-së, TAB 18.7. Ndalesa u vendos në mesin e qershorit 2023, pra rreth gjysma e vitit është e prekur.',
  },
  {
    id: 'trade-imports-2022',
    label: 'Kosovo’s goods imports from Serbia — last full year before the import ban',
    labelSq:
      'Importet e mallrave të Kosovës nga Serbia — viti i fundit i plotë para ndalesës së importit',
    value: '€372.1 m',
    unit: '',
    year: 2022,
    source: 'Kosovo Agency of Statistics (ASK), ASKDATA tab02.px',
    sourceUrl:
      'https://askdata.rks-gov.net/pxweb/en/ASKdata/ASKdata__External%20trade__Yearly%20indicators/tab02.px/',
    verified: true,
    note: 'ASK value as published: 372,065 thousand EUR; matches ASK Statistical Yearbook 2024, TAB 18.7.',
    noteSq:
      'Vlera e publikuar nga ASK: 372,065 mijë EUR; përputhet me Vjetarin Statistikor 2024 të ASK-së, TAB 18.7.',
  },
  {
    id: 'trade-imports-2019',
    label: 'Kosovo’s goods imports from Serbia — under the 100% tariff',
    labelSq: 'Importet e mallrave të Kosovës nga Serbia — nën tarifën 100%',
    value: '€5.8 m',
    unit: '',
    year: 2019,
    source: 'Kosovo Agency of Statistics (ASK), Statistical Yearbook 2024, TAB 18.7',
    sourceUrl: 'https://askapi.rks-gov.net/Custom/323bbe7d-f5d2-47ce-a814-8dc7299fa4e3.pdf',
    verified: true,
    note:
      'ASK value as published: 5,784 thousand EUR, against 388,928 thousand in 2018. The only year in the series in which Kosovo ran a goods trade SURPLUS with Serbia (exports 27,361 thousand EUR).',
    noteSq:
      'Vlera e publikuar nga ASK: 5,784 mijë EUR, kundrejt 388,928 mijë në vitin 2018. I vetmi vit në seri në të cilin Kosova pati SUFICIT tregtar të mallrave me Serbinë (eksportet 27,361 mijë EUR).',
  },
  {
    id: 'trade-imports-2017',
    label: 'Kosovo’s goods imports from Serbia — last full year before the 100% tariff',
    labelSq:
      'Importet e mallrave të Kosovës nga Serbia — viti i fundit i plotë para tarifës 100%',
    value: '€449.9 m',
    unit: '',
    year: 2017,
    source: 'Kosovo Agency of Statistics (ASK), Statistical Yearbook 2024, TAB 18.7',
    sourceUrl: 'https://askapi.rks-gov.net/Custom/323bbe7d-f5d2-47ce-a814-8dc7299fa4e3.pdf',
    verified: true,
    note:
      'ASK value as published: 449,918 thousand EUR. The highest figure in the modern series, and the baseline against which every later measure should be read.',
    noteSq:
      'Vlera e publikuar nga ASK: 449,918 mijë EUR. Shifra më e lartë në serinë moderne, dhe baza ndaj së cilës duhet lexuar çdo masë e mëvonshme.',
  },
  {
    id: 'trade-share-2025',
    label: 'Serbia’s share of Kosovo’s total goods imports',
    labelSq: 'Pjesa e Serbisë në importet e përgjithshme të mallrave të Kosovës',
    value: '3.3',
    unit: '%',
    year: 2025,
    source: 'Computed from Kosovo Agency of Statistics (ASK) tables tab02.px and tab08.px',
    sourceUrl:
      'https://askdata.rks-gov.net/pxweb/en/ASKdata/ASKdata__External%20trade__Yearly%20indicators/tab08.px/',
    verified: false,
    note:
      'NOT AN ASK-PUBLISHED SHARE. Computed as 234,833 ÷ 7,055,838 = 3.33%, from two ASK tables. ASK has published shares by partner country only through 2023. Settled by: TAB 18.8 "Struktura e importit sipas vendeve" in the ASK Statistical Yearbook covering 2025. (The 2024 equivalent on the same arithmetic is 2.04%.)',
    noteSq:
      'NUK ËSHTË PJESË E PUBLIKUAR NGA ASK. E llogaritur si 234,833 ÷ 7,055,838 = 3.33%, nga dy tabela të ASK-së. ASK i ka publikuar pjesët sipas vendit partner vetëm deri në vitin 2023. Zgjidhet nga: TAB 18.8 "Struktura e importit sipas vendeve" në Vjetarin Statistikor të ASK-së që mbulon vitin 2025. (Ekuivalenti për vitin 2024 me të njëjtën aritmetikë është 2.04%.)',
  },
  {
    id: 'trade-share-2022',
    label: 'Serbia’s share of Kosovo’s total goods imports',
    labelSq: 'Pjesa e Serbisë në importet e përgjithshme të mallrave të Kosovës',
    value: '6.6',
    unit: '%',
    year: 2022,
    source: 'Kosovo Agency of Statistics (ASK), Statistical Yearbook 2024, TAB 18.8',
    sourceUrl: 'https://askapi.rks-gov.net/Custom/323bbe7d-f5d2-47ce-a814-8dc7299fa4e3.pdf',
    verified: true,
    note: 'Share as published by ASK. Same table gives 6.5% for 2021 and 3.4% for 2023.',
    noteSq:
      'Pjesa siç e publikon ASK. E njëjta tabelë jep 6.5% për vitin 2021 dhe 3.4% për vitin 2023.',
  },
  {
    id: 'trade-share-2017',
    label: 'Serbia’s share of Kosovo’s total goods imports',
    labelSq: 'Pjesa e Serbisë në importet e përgjithshme të mallrave të Kosovës',
    value: '14.8',
    unit: '%',
    year: 2017,
    source: 'Kosovo Agency of Statistics (ASK), Statistical Yearbook 2024, TAB 18.8',
    sourceUrl: 'https://askapi.rks-gov.net/Custom/323bbe7d-f5d2-47ce-a814-8dc7299fa4e3.pdf',
    verified: true,
    note: 'Share as published by ASK, not computed here. Same table gives 0.2% for 2019 and 5.3% for 2020.',
    noteSq:
      'Pjesa siç e publikon ASK, jo e llogaritur këtu. E njëjta tabelë jep 0.2% për vitin 2019 dhe 5.3% për vitin 2020.',
  },
  {
    id: 'trade-exports-2025',
    label: 'Kosovo’s goods exports to Serbia',
    labelSq: 'Eksportet e mallrave të Kosovës në Serbi',
    value: '€61.5 m',
    unit: '',
    year: 2025,
    source: 'Kosovo Agency of Statistics (ASK), ASKDATA tab02.px',
    sourceUrl:
      'https://askdata.rks-gov.net/pxweb/en/ASKdata/ASKdata__External%20trade__Yearly%20indicators/tab02.px/',
    verified: true,
    note: 'ASK value as published: 61,514 thousand EUR.',
    noteSq: 'Vlera e publikuar nga ASK: 61,514 mijë EUR.',
  },
  {
    id: 'trade-balance-2025',
    label: 'Kosovo’s goods trade deficit with Serbia',
    labelSq: 'Deficiti tregtar i mallrave i Kosovës me Serbinë',
    value: '−€173.3 m',
    unit: '',
    year: 2025,
    source: 'Kosovo Agency of Statistics (ASK), ASKDATA tab02.px',
    sourceUrl:
      'https://askdata.rks-gov.net/pxweb/en/ASKdata/ASKdata__External%20trade__Yearly%20indicators/tab02.px/',
    verified: true,
    note:
      'Imports minus exports on the same ASK partner table: 234,833 − 61,514 = 173,319 thousand EUR. ASK does not publish the bilateral balance as its own line, so this is subtraction of two published figures, not a separate estimate. Equivalent 2022 figure: −€309.2 m.',
    noteSq:
      'Importet minus eksportet në të njëjtën tabelë partnere të ASK-së: 234,833 − 61,514 = 173,319 mijë EUR. ASK nuk e publikon bilancin dypalësh si rresht të veçantë, prandaj kjo është zbritje e dy shifrave të publikuara, jo një vlerësim më vete. Shifra ekuivalente për vitin 2022: −€309.2 mln.',
  },
  {
    id: 'trade-measure-tariff',
    label: 'Kosovo tariff on goods from Serbia and Bosnia-Herzegovina, 21 Nov 2018 – 1 Apr 2020',
    labelSq:
      'Tarifa e Kosovës ndaj mallrave nga Serbia dhe Bosnja e Hercegovina, 21 nëntor 2018 – 1 prill 2020',
    value: '100',
    unit: '% tariff',
    unitSq: '% tarifë',
    year: '2018–2020',
    source: 'European Western Balkans; removal per RFE/RL',
    sourceUrl:
      'https://europeanwesternbalkans.com/2018/11/21/kosovo-decides-raise-tariffs-serbian-bosnian-goods-10-100/',
    verified: true,
    note:
      'Raised from 10% (set 6 Nov 2018) to 100% on 21 Nov 2018. Partially lifted for raw materials 21 Mar 2020 and fully removed effective 1 Apr 2020, replaced by "reciprocity" documentation requirements applied to Serbia only. Removal source: https://www.rferl.org/a/kosovo-lifts-serbia-tariffs-belgrade/30521305.html',
    noteSq:
      'E ngritur nga 10% (vendosur më 6 nëntor 2018) në 100% më 21 nëntor 2018. E hequr pjesërisht për lëndët e para më 21 mars 2020 dhe plotësisht nga 1 prilli 2020, e zëvendësuar me kërkesa dokumentacioni "reciprociteti" të zbatuara vetëm ndaj Serbisë. Burimi i heqjes: https://www.rferl.org/a/kosovo-lifts-serbia-tariffs-belgrade/30521305.html',
  },
  {
    id: 'trade-measure-ban',
    label: 'Kosovo ban on imports of goods from Serbia, June 2023 – October 2024',
    labelSq:
      'Ndalesa e Kosovës ndaj importit të mallrave nga Serbia, qershor 2023 – tetor 2024',
    value: '16',
    unit: 'months',
    unitSq: 'muaj',
    year: '2023–2024',
    source: 'European Western Balkans',
    sourceUrl:
      'https://europeanwesternbalkans.com/2023/06/15/kosovo-bans-entry-of-vehicles-with-serbian-licence-plates-and-imports-of-goods-from-serbia/',
    verified: true,
    note:
      'Announced 14–15 June 2023 as a security measure after Serbian police detained three Kosovo police officers; it also barred vehicles with Serbian licence plates. Lifted at the Merdare crossing on 7 Oct 2024. The exact legal scope — all goods, or finished goods only — is NOT established here from a primary text; that would be settled by the Government of Kosovo decision or the Kosovo Customs circular of June 2023. Lifting source: https://europeanwesternbalkans.com/2024/10/08/kosovo-lifts-import-ban-on-serbian-goods-at-merdare-border-crossing/',
    noteSq:
      'E shpallur më 14–15 qershor 2023 si masë sigurie pasi policia serbe ndaloi tre policë kosovarë; ajo ndaloi edhe automjetet me targa serbe. E hequr në pikëkalimin e Merdarit më 7 tetor 2024. Shtrirja e saktë ligjore — të gjitha mallrat, apo vetëm mallrat e gatshme — NUK është vërtetuar këtu nga një tekst primar; kjo do të zgjidhej nga vendimi i Qeverisë së Kosovës ose qarkorja e Doganës së Kosovës e qershorit 2023. Burimi i heqjes: https://europeanwesternbalkans.com/2024/10/08/kosovo-lifts-import-ban-on-serbian-goods-at-merdare-border-crossing/',
  },
];

// ---------------------------------------------------------------------------
// B. TAX — how that trade becomes Serbian state revenue
// ---------------------------------------------------------------------------
// Rates come from the consolidated Serbian tax statutes themselves, hosted
// by the Serbian Tax Administration (Poreska uprava / PURS) — not from a
// summary site. Revenue figures come from the Serbian Ministry of Finance's
// own "Macroeconomic and fiscal data" spreadsheets (Table 2, republic
// budget; Table 3, consolidated general government), cross-checked against
// the Ministry's Public Finance Bulletin.
//
// One caveat that is stated on every revenue entry: the Ministry publishes
// in DINARS. Any euro figure here is a conversion at the rate implied by the
// Ministry's own paired RSD/EUR GDP figures (~117.2 RSD/EUR), and is marked
// as such. The dinar figure is the sourced one.
//
// This block renders at the FOOT of the "pse" page (owner, 2026-09-12),
// followed by TAX_IMPACT_DERIVED below — the per-euro consequence.
const TAX_STATS_RAW = [
  {
    id: 'tax-vat-standard',
    label: 'Serbian VAT (TVSH / PDV) — standard rate',
    labelSq: 'TVSH-ja serbe (PDV) — norma standarde',
    value: '20',
    unit: '%',
    year: 2026,
    source: 'Law on Value Added Tax, Article 23 (Serbian Tax Administration / PURS)',
    sourceUrl: 'https://www.purs.gov.rs/lat/fizicka-lica/pdv/opste-o-pdvu.html',
    verified: true,
    note:
      'Statute text, Article 23: "Општа стопа ПДВ за опорезиви промет добара и услуга или увоз добара износи 20%." Consolidated through Sl. glasnik RS 109/25. PwC Worldwide Tax Summaries (reviewed 7 Aug 2026) agrees.',
    noteSq:
      'Teksti i ligjit, neni 23: "Општа стопа ПДВ за опорезиви промет добара и услуга или увоз добара износи 20%." I konsoliduar deri te Sl. glasnik RS 109/25. PwC Worldwide Tax Summaries (rishikuar më 7 gusht 2026) pajtohet.',
  },
  {
    id: 'tax-vat-reduced',
    label: 'Serbian VAT — reduced rate (bread, milk, flour, oil, meat, medicines, textbooks, heating, water, passenger transport, hotel accommodation)',
    labelSq:
      'TVSH-ja serbe — norma e reduktuar (bukë, qumësht, miell, vaj, mish, barna, tekste shkollore, ngrohje, ujë, transport udhëtarësh, akomodim hotelier)',
    value: '10',
    unit: '%',
    year: 2026,
    source: 'Law on Value Added Tax, Article 23 (Serbian Tax Administration / PURS)',
    sourceUrl: 'https://www.purs.gov.rs/lat/fizicka-lica/pdv/opste-o-pdvu.html',
    verified: true,
    note:
      'Statute text, Article 23: "По посебној стопи ПДВ од 10% опорезује се промет добара и услуга или увоз добара". The label lists part of a 21-item statutory list. There is no third rate and no zero rate in Article 23.',
    noteSq:
      'Teksti i ligjit, neni 23: "По посебној стопи ПДВ од 10% опорезује се промет добара и услуга или увоз добара". Etiketa liston një pjesë të një liste ligjore me 21 zëra. Nuk ka normë të tretë dhe as normë zero në nenin 23.',
  },
  {
    id: 'tax-cit',
    label: 'Serbian corporate income (profit) tax',
    labelSq: 'Tatimi serb mbi të ardhurat (fitimin) e korporatave',
    value: '15',
    unit: '%',
    year: 2026,
    source: 'Law on Corporate Income Tax, Article 39 (Serbian Tax Administration / PURS)',
    sourceUrl: 'https://purs.gov.rs/upload/media/2025/2/4/417349/Zakonoporezunadobitpravnihlica.pdf',
    verified: true,
    note:
      'Statute text, Article 39: "Стопа пореза на добит правних лица je пропорционална и једнообразна. Стопа пореза на добит правних лица износи 15%." Consolidated through Sl. glasnik RS 94/24. Flat rate, no bands.',
    noteSq:
      'Teksti i ligjit, neni 39: "Стопа пореза на добит правних лица je пропорционална и једнообразна. Стопа пореза на добит правних лица износи 15%." I konsoliduar deri te Sl. glasnik RS 94/24. Normë e sheshtë, pa shkallë.',
  },
  {
    id: 'tax-wht-dividends',
    label: 'Serbian withholding tax on dividends paid to non-resident companies',
    labelSq: 'Tatimi serb në burim mbi dividendët e paguar kompanive jorezidente',
    value: '20',
    unit: '%',
    year: 2026,
    source: 'Law on Corporate Income Tax, Article 40 (Serbian Tax Administration / PURS)',
    sourceUrl: 'https://purs.gov.rs/upload/media/2025/2/4/417349/Zakonoporezunadobitpravnihlica.pdf',
    verified: true,
    note:
      'Applies absent a double-taxation treaty, and equally to royalties, interest, rent and service fees. Rises to 25% where the recipient sits in a preferential-tax jurisdiction.',
    noteSq:
      'Zbatohet në mungesë të një marrëveshjeje për shmangien e tatimit të dyfishtë, dhe njësoj për të drejtat e autorit, interesin, qiranë dhe tarifat e shërbimeve. Ngrihet në 25% kur përfituesi ndodhet në një juridiksion me tatim preferencial.',
  },
  {
    id: 'tax-pit-wages',
    label: 'Serbian personal income tax on wages',
    labelSq: 'Tatimi serb mbi të ardhurat personale nga pagat',
    value: '10',
    unit: '%',
    year: 2026,
    source: 'Law on Personal Income Tax, Article 16 (Serbian Tax Administration / PURS)',
    sourceUrl: 'https://www.purs.gov.rs/lat/fizicka-lica/pdv/opste-o-pdvu.html',
    verified: true,
    note:
      'Consolidated text in force from 1 Jan 2026. Same law: capital income and capital gains 15%, income from immovable property 20%. Linked here from the PURS tax-law portal; the PIT statute PDF is served from the same purs.gov.rs document store.',
    noteSq:
      'Tekst i konsoliduar në fuqi nga 1 janari 2026. I njëjti ligj: të ardhurat nga kapitali dhe fitimet kapitale 15%, të ardhurat nga pasuria e paluajtshme 20%. I lidhur këtu nga portali i ligjeve tatimore i PURS; PDF-ja e ligjit të tatimit mbi të ardhurat personale shërbehet nga i njëjti depo dokumentesh purs.gov.rs.',
  },
  {
    id: 'tax-budget-revenue-2025',
    label: 'Serbian republic budget revenue',
    labelSq: 'Të hyrat e buxhetit republikan serb',
    value: 'RSD 2,278.4 bn',
    valueSq: '2,278.4 mld RSD',
    unit: '',
    year: 2025,
    source: 'Ministry of Finance of Serbia, Macroeconomic and fiscal data, Table 2',
    sourceUrl: 'https://www.mfin.gov.rs/en/documents2-2/macroeconomic-and-fiscal-data2',
    verified: true,
    note:
      'Executed outturn, not plan: 2,278,376.2 million RSD. Approximately €19.4 bn — that euro figure is a CONVERSION at the ~117.2 RSD/EUR rate implied by the Ministry\'s own paired RSD/EUR GDP figures, not a published euro number. 2024: 2,141,590.0 m RSD; 2023: 1,889,098.8 m RSD.',
    noteSq:
      'Realizim i ekzekutuar, jo plan: 2,278,376.2 milionë RSD. Përafërsisht €19.4 mld — ajo shifër në euro është KONVERTIM me kursin ~117.2 RSD/EUR që del nga vetë shifrat e çiftëzuara RSD/EUR të BPV-së të Ministrisë, jo një shifër e publikuar në euro. 2024: 2,141,590.0 mln RSD; 2023: 1,889,098.8 mln RSD.',
  },
  {
    id: 'tax-gg-revenue-2025',
    label: 'Serbian consolidated general government revenue',
    labelSq: 'Të hyrat e konsoliduara të qeverisë së përgjithshme serbe',
    value: 'RSD 4,253.4 bn',
    valueSq: '4,253.4 mld RSD',
    unit: '',
    year: 2025,
    source: 'Ministry of Finance of Serbia, Macroeconomic and fiscal data, Table 3',
    sourceUrl: 'https://www.mfin.gov.rs/en/documents2-2/macroeconomic-and-fiscal-data2',
    verified: true,
    note:
      'The broader measure, including social contributions: 4,253,415.3 million RSD, or 40.93% of GDP on the Ministry\'s own percentage sheet. Approximately €36.3 bn by conversion. Cross-checked against the Ministry\'s Public Finance Bulletin 12/2025 (No. 256), which carries the identical series. 2024: 3,940,963.3 m RSD.',
    noteSq:
      'Matja më e gjerë, përfshirë kontributet sociale: 4,253,415.3 milionë RSD, ose 40.93% e BPV-së sipas fletës së përqindjeve të vetë Ministrisë. Përafërsisht €36.3 mld me konvertim. E kryqëzuar me Buletinin e Financave Publike 12/2025 (Nr. 256) të Ministrisë, i cili mban serinë identike. 2024: 3,940,963.3 mln RSD.',
  },
  {
    id: 'tax-vat-revenue-2025',
    label: 'VAT collected by the Serbian state',
    labelSq: 'TVSH-ja e mbledhur nga shteti serb',
    value: 'RSD 998.2 bn',
    valueSq: '998.2 mld RSD',
    unit: '',
    year: 2025,
    source: 'Ministry of Finance of Serbia, Macroeconomic and fiscal data, Tables 2 and 3',
    sourceUrl: 'https://www.mfin.gov.rs/en/documents2-2/macroeconomic-and-fiscal-data2',
    verified: true,
    note:
      'Executed outturn: 998,202.3 million RSD, approximately €8.5 bn by conversion. 2024: 951,782.4 m RSD; 2023: 842,907.4 m RSD. In 2024, 721,962.1 m RSD of the VAT take — about 76% — was VAT charged on IMPORTS.',
    noteSq:
      'Realizim i ekzekutuar: 998,202.3 milionë RSD, përafërsisht €8.5 mld me konvertim. 2024: 951,782.4 mln RSD; 2023: 842,907.4 mln RSD. Në vitin 2024, 721,962.1 mln RSD e të hyrave nga TVSH-ja — rreth 76% — ishte TVSH e ngarkuar mbi IMPORTET e Serbisë.',
  },
  {
    id: 'tax-vat-gdp-2025',
    label: 'VAT revenue as a share of Serbian GDP',
    labelSq: 'Të hyrat nga TVSH-ja si pjesë e BPV-së serbe',
    value: '9.6',
    unit: '% of GDP',
    unitSq: '% e BPV-së',
    year: 2025,
    source: 'Ministry of Finance of Serbia, Macroeconomic and fiscal data, Table 3b',
    sourceUrl: 'https://www.mfin.gov.rs/en/documents2-2/macroeconomic-and-fiscal-data2',
    verified: true,
    note:
      'Published directly by the Ministry on its "in % of GDP" sheet — this is the one VAT ratio the Serbian government states itself. 2024: 9.76%; 2023: 9.56%.',
    noteSq:
      'E publikuar drejtpërdrejt nga Ministria në fletën e saj "in % of GDP" — ky është i vetmi raport i TVSH-së që qeveria serbe e deklaron vetë. 2024: 9.76%; 2023: 9.56%.',
  },
  {
    id: 'tax-cit-revenue-2025',
    label: 'Corporate income tax collected by the Serbian state',
    labelSq: 'Tatimi mbi fitimin e korporatave i mbledhur nga shteti serb',
    value: 'RSD 272.5 bn',
    valueSq: '272.5 mld RSD',
    unit: '',
    year: 2025,
    source: 'Ministry of Finance of Serbia, Macroeconomic and fiscal data, Table 2',
    sourceUrl: 'https://www.mfin.gov.rs/en/documents2-2/macroeconomic-and-fiscal-data2',
    verified: true,
    note: 'Executed outturn: 272,467.1 million RSD. 2024: 272,277.0 m RSD; 2023: 236,041.6 m RSD.',
    noteSq:
      'Realizim i ekzekutuar: 272,467.1 milionë RSD. 2024: 272,277.0 mln RSD; 2023: 236,041.6 mln RSD.',
  },
  {
    id: 'tax-vat-share-of-tax-revenue-2025',
    label: 'VAT as a share of Serbian republic budget tax revenue',
    labelSq: 'TVSH-ja si pjesë e të hyrave tatimore të buxhetit republikan serb',
    value: '50.9',
    unit: '%',
    year: 2025,
    source: 'Computed from Ministry of Finance of Serbia, Table 2 line items',
    sourceUrl: 'https://www.mfin.gov.rs/en/documents2-2/macroeconomic-and-fiscal-data2',
    verified: false,
    note:
      'NOT A PUBLISHED GOVERNMENT STATISTIC. Computed as 998,202.3 ÷ 1,961,312.5 from two Ministry line items. The Ministry publishes VAT only as a share of GDP. The ratio moves sharply with the denominator chosen — on consolidated general government tax revenue excluding social contributions it is 41.7%, including them 26.4%. Settled by: an IMF Article IV staff report on Serbia or a Fiscal Council of Serbia analysis stating the share directly.',
    noteSq:
      'NUK ËSHTË STATISTIKË QEVERITARE E PUBLIKUAR. E llogaritur si 998,202.3 ÷ 1,961,312.5 nga dy zëra të Ministrisë. Ministria e publikon TVSH-në vetëm si pjesë të BPV-së. Raporti lëviz ndjeshëm sipas emëruesit të zgjedhur — mbi të hyrat tatimore të qeverisë së përgjithshme të konsoliduar pa kontributet sociale është 41.7%, me to 26.4%. Zgjidhet nga: një raport i stafit të FMN-së sipas nenit IV për Serbinë ose një analizë e Këshillit Fiskal të Serbisë që e deklaron pjesën drejtpërdrejt.',
  },
];

// ---------------------------------------------------------------------------
// C. MILITARY SPEND — what Serbia spends on its armed forces
// ---------------------------------------------------------------------------
// Serbia's own currency figures are not published in a single comparable
// series, so the spending series below is SIPRI's, which is the standard
// comparable source. It was retrieved through the World Bank's indicator
// API, whose metadata names its source organisation as "SIPRI Military
// Expenditure Database, Stockholm International Peace Research Institute
// (SIPRI)" — so the institution credited is SIPRI, and the fetched URL is
// the retrieval route.
const MILITARY_SPEND_RAW = [
  {
    id: 'milex-2025-usd',
    label: 'Serbian military expenditure',
    labelSq: 'Shpenzimet ushtarake serbe',
    value: 'US$2.78 bn',
    valueSq: '2.78 mld USD',
    unit: '',
    year: 2025,
    source: 'Trading Economics, citing SIPRI',
    sourceUrl: 'https://tradingeconomics.com/serbia/military-expenditure',
    verified: false,
    note:
      'UNCONFIRMED at source. The World Bank/SIPRI series returns no 2025 value for Serbia, and Serbia is not named in SIPRI\'s April 2026 fact sheet "Trends in World Military Expenditure, 2025" (its top-40 spender table stops above Serbia). Settled by: the Serbia country entry in the SIPRI Military Expenditure Database, April 2026 release.',
    noteSq:
      'E PAKONFIRMUAR në burim. Seria Bankë Botërore/SIPRI nuk kthen asnjë vlerë për vitin 2025 për Serbinë, dhe Serbia nuk përmendet në fletën informative të SIPRI-t të prillit 2026 "Trends in World Military Expenditure, 2025" (tabela e saj e 40 shpenzuesve më të mëdhenj ndalet mbi Serbinë). Zgjidhet nga: zëri i Serbisë në SIPRI Military Expenditure Database, botimi i prillit 2026.',
  },
  {
    id: 'milex-2024-usd',
    label: 'Serbian military expenditure',
    labelSq: 'Shpenzimet ushtarake serbe',
    value: 'US$2.32 bn',
    valueSq: '2.32 mld USD',
    unit: '',
    year: 2024,
    source: 'SIPRI Military Expenditure Database (via World Bank API)',
    sourceUrl:
      'https://api.worldbank.org/v2/country/SRB/indicator/MS.MIL.XPND.CD?format=json&date=2015:2025',
    verified: true,
    note:
      'Exact value returned: US$2,322,830,102 (current prices). SIPRI revises this series: Trading Economics, also citing SIPRI, gives US$2,403.6 m for 2024 — an ~US$81 m gap traceable to the April 2026 SIPRI update, which the World Bank series had not yet taken up.',
    noteSq:
      'Vlera e saktë e kthyer: 2,322,830,102 USD (çmime korrente). SIPRI e rishikon këtë seri: Trading Economics, po ashtu duke cituar SIPRI-n, jep 2,403.6 mln USD për vitin 2024 — një hendek prej ~81 mln USD që rrjedh nga përditësimi i SIPRI-t i prillit 2026, të cilin seria e Bankës Botërore ende nuk e kishte marrë.',
  },
  {
    id: 'milex-2024-gdp',
    label: 'Serbian military expenditure, share of GDP',
    labelSq: 'Shpenzimet ushtarake serbe, si pjesë e BPV-së',
    value: '2.60',
    unit: '% of GDP',
    unitSq: '% e BPV-së',
    year: 2024,
    source: 'SIPRI Military Expenditure Database (via World Bank API)',
    sourceUrl:
      'https://api.worldbank.org/v2/country/SRB/indicator/MS.MIL.XPND.GD.ZS?format=json&date=2015:2025',
    verified: true,
  },
  {
    id: 'milex-2023-usd',
    label: 'Serbian military expenditure',
    labelSq: 'Shpenzimet ushtarake serbe',
    value: 'US$1.80 bn',
    valueSq: '1.80 mld USD',
    unit: '',
    year: 2023,
    source: 'SIPRI Military Expenditure Database (via World Bank API)',
    sourceUrl:
      'https://api.worldbank.org/v2/country/SRB/indicator/MS.MIL.XPND.CD?format=json&date=2015:2025',
    verified: true,
    note: 'Exact value returned: US$1,796,879,440. Share of GDP the same year: 2.21%.',
    noteSq: 'Vlera e saktë e kthyer: 1,796,879,440 USD. Pjesa e BPV-së po atë vit: 2.21%.',
  },
  {
    id: 'milex-2022-usd',
    label: 'Serbian military expenditure',
    labelSq: 'Shpenzimet ushtarake serbe',
    value: 'US$1.45 bn',
    valueSq: '1.45 mld USD',
    unit: '',
    year: 2022,
    source: 'SIPRI Military Expenditure Database (via World Bank API)',
    sourceUrl:
      'https://api.worldbank.org/v2/country/SRB/indicator/MS.MIL.XPND.CD?format=json&date=2015:2025',
    verified: true,
    note: 'Exact value returned: US$1,451,348,837. Share of GDP the same year: 2.17%.',
    noteSq: 'Vlera e saktë e kthyer: 1,451,348,837 USD. Pjesa e BPV-së po atë vit: 2.17%.',
  },
  {
    id: 'milex-2021-usd',
    label: 'Serbian military expenditure',
    labelSq: 'Shpenzimet ushtarake serbe',
    value: 'US$1.81 bn',
    valueSq: '1.81 mld USD',
    unit: '',
    year: 2021,
    source: 'SIPRI Military Expenditure Database (via World Bank API)',
    sourceUrl:
      'https://api.worldbank.org/v2/country/SRB/indicator/MS.MIL.XPND.CD?format=json&date=2015:2025',
    verified: true,
    note: 'Exact value returned: US$1,813,007,742. Share of GDP the same year: 2.73%.',
    noteSq: 'Vlera e saktë e kthyer: 1,813,007,742 USD. Pjesa e BPV-së po atë vit: 2.73%.',
  },
  {
    id: 'procurement-2024',
    label: 'Announced Serbian spend on new weapons in one year',
    labelSq: 'Shpenzimi i shpallur serb për armë të reja brenda një viti',
    value: '€740 m',
    valueSq: '€740 mln',
    unit: '(US$810 m)',
    unitSq: '(810 mln USD)',
    year: 2024,
    source: 'Janes',
    sourceUrl:
      'https://www.janes.com/osint-insights/defence-news/land/serbia-to-spend-nearly-eur740-million-on-new-weapons',
    verified: true,
    note:
      'Janes, 16 Jan 2024. Breakdown reported: €186 m immediately available from Yugoimport SDPR, €150 m and €400 m later in 2024, €360 m already allocated in the Serbian budget.',
    noteSq:
      'Janes, 16 janar 2024. Ndarja e raportuar: €186 mln të disponueshme menjëherë nga Yugoimport SDPR, €150 mln dhe €400 mln më vonë gjatë vitit 2024, €360 mln tashmë të alokuara në buxhetin serb.',
  },
  {
    id: 'arms-import-rank',
    label: 'Serbia’s rank among the world’s largest importers of major arms',
    labelSq: 'Renditja e Serbisë mes importuesve më të mëdhenj të armëve kryesore në botë',
    value: '36th',
    valueSq: 'i 36-ti',
    unit: '',
    year: '2020–24',
    source: 'SIPRI, Trends in International Arms Transfers, 2024 (Table 2)',
    sourceUrl: 'https://www.sipri.org/sites/default/files/2025-03/fs_2503_at_2024_0.pdf',
    verified: true,
    note:
      'Rank taken from the rank column of Table 2, which is unambiguous. Serbia’s percentage share of global arms imports is NOT reproduced here: the extracted table’s data rows are offset from their rank labels, so the share could not be read off with confidence.',
    noteSq:
      'Renditja është marrë nga kolona e renditjes në Tabelën 2, e cila nuk lë vend për dykuptimësi. Përqindja e Serbisë në importet globale të armëve NUK riprodhohet këtu: rreshtat e të dhënave të tabelës së nxjerrë janë të zhvendosur nga etiketat e renditjes, prandaj pjesa nuk mund të lexohej me siguri.',
  },
  {
    id: 'china-share-of-serbia-imports',
    label: 'Share of Serbia’s arms imports supplied by China',
    labelSq: 'Pjesa e importeve serbe të armëve e furnizuar nga Kina',
    value: '57',
    unit: '%',
    year: '2020–24',
    source: 'RFE/RL, citing SIPRI',
    sourceUrl:
      'https://www.rferl.org/a/serbia-china-military-cooperation-drones-air-defense-security/33626646.html',
    verified: true,
    note:
      'RFE/RL, 7 Jan 2026, citing SIPRI data. Same source: Russia 20%, France 7.4%. RFE/RL also reports roughly US$280 m of Serbian defence imports from China over two years, per customs data it reviewed.',
    noteSq:
      'RFE/RL, 7 janar 2026, duke cituar të dhënat e SIPRI-t. I njëjti burim: Rusia 20%, Franca 7.4%. RFE/RL raporton gjithashtu rreth 280 mln USD importe mbrojtjeje të Serbisë nga Kina brenda dy vitesh, sipas të dhënave doganore që i ka shqyrtuar.',
  },
  {
    id: 'serbia-share-of-china-exports',
    label: 'Share of China’s total arms exports that went to Serbia — its second-largest customer, after Pakistan (63%)',
    labelSq:
      'Pjesa e eksporteve të përgjithshme kineze të armëve që shkoi në Serbi — klienti i saj i dytë më i madh, pas Pakistanit (63%)',
    value: '6.8',
    unit: '%',
    year: '2020–24',
    source: 'SIPRI, Trends in International Arms Transfers, 2024 (Table 1)',
    sourceUrl: 'https://www.sipri.org/sites/default/files/2025-03/fs_2503_at_2024_0.pdf',
    verified: true,
    note:
      'From Table 1, China’s row: main recipients Pakistan 63%, Serbia 6.8%, Thailand 4.6%. Cross-checked against the same row’s 5.9% global-export share, which matches SIPRI’s published figure for China.',
    noteSq:
      'Nga Tabela 1, rreshti i Kinës: përfituesit kryesorë Pakistani 63%, Serbia 6.8%, Tajlanda 4.6%. E kryqëzuar me pjesën 5.9% të eksporteve globale në të njëjtin rresht, e cila përputhet me shifrën e publikuar të SIPRI-t për Kinën.',
  },
  {
    id: 'russia-exports-to-europe',
    label: 'Share of Russian arms exports going to Europe — to Armenia, Belarus and Serbia only',
    labelSq:
      'Pjesa e eksporteve ruse të armëve që shkon në Evropë — vetëm te Armenia, Bjellorusia dhe Serbia',
    value: '7.4',
    unit: '%',
    year: '2020–24',
    source: 'SIPRI, Trends in International Arms Transfers, 2024',
    sourceUrl: 'https://www.sipri.org/sites/default/files/2025-03/fs_2503_at_2024_0.pdf',
    verified: true,
    note:
      'Quoted from the fact sheet text: "7.4 per cent to Europe (Armenia, Belarus and Serbia)". Serbia is one of only three European recipients of Russian major arms in the period.',
    noteSq:
      'Cituar nga teksti i fletës informative: "7.4 per cent to Europe (Armenia, Belarus and Serbia)". Serbia është një nga vetëm tre marrësit evropianë të armëve kryesore ruse në atë periudhë.',
  },
];

// ---------------------------------------------------------------------------
// D. ARMS — what Serbia actually buys, and from whom
// ---------------------------------------------------------------------------
// The owner asked specifically "what tanks they buy", so armour is listed
// first and in full, then aircraft and helicopters, then air defence, then
// drones, then the disputed Israeli package.
//
// `quantity` is the headline number; `unit` qualifies it where a bare
// number would mislead (systems vs. vehicles vs. missiles).
//
// For these entries `labelSq` is the Albanian rendering of `system` — the
// system name IS the label in this block. Designations stay untranslated.
const ARMS_ACQUISITIONS_RAW = [
  // --- Armour and land systems ---
  {
    id: 'arms-t72b1ms',
    system: 'T-72B1MS “Beli Orlovi” main battle tank',
    labelSq: 'Tank kryesor luftarak T-72B1MS “Beli Orlovi”',
    category: 'Armour',
    categorySq: 'Të blinduara',
    quantity: '30',
    unit: 'tanks',
    unitSq: 'tanke',
    supplier: 'Russia',
    supplierSq: 'Rusia',
    year: 2021,
    dealValue: 'Donation, stated value ~€75 m (with the BRDM-2MS below)',
    dealValueSq: 'Donacion, vlerë e deklaruar ~€75 mln (bashkë me BRDM-2MS më poshtë)',
    source: 'Ministry of Defence of the Republic of Serbia',
    sourceUrl:
      'https://www.mod.gov.rs/eng/17414/vojska-srbije-jaca-za-30-tenkova-t-72ms-i-30-oklopno-izvidjackih-automobila-brdm-2ms-17414',
    verified: true,
    note:
      'Serbian MoD, 23 May 2021: "It is a donation from the Russian Federation to the Serbian Armed Forces worth about 75 million euros, and it includes 30 BRDM-2MS armoured personnel carriers and 30 modernized T-72 MS tanks." Agreed by Vučić and Putin at Sochi; first 11 tanks handed over in Niš in Nov 2020.',
    noteSq:
      'Ministria e Mbrojtjes e Serbisë, 23 maj 2021: "It is a donation from the Russian Federation to the Serbian Armed Forces worth about 75 million euros, and it includes 30 BRDM-2MS armoured personnel carriers and 30 modernized T-72 MS tanks." Rënë dakord nga Vuçiqi dhe Putini në Soçi; 11 tanket e parë u dorëzuan në Nish në nëntor 2020.',
  },
  {
    id: 'arms-brdm2ms',
    system: 'BRDM-2MS armoured reconnaissance vehicle',
    labelSq: 'Automjet i blinduar zbulimi BRDM-2MS',
    category: 'Armour',
    categorySq: 'Të blinduara',
    quantity: '30',
    unit: 'vehicles',
    unitSq: 'automjete',
    supplier: 'Russia',
    supplierSq: 'Rusia',
    year: 2021,
    dealValue: 'Donation, stated value ~€75 m (with the T-72B1MS above)',
    dealValueSq: 'Donacion, vlerë e deklaruar ~€75 mln (bashkë me T-72B1MS më lart)',
    source: 'Ministry of Defence of the Republic of Serbia',
    sourceUrl:
      'https://www.mod.gov.rs/eng/17414/vojska-srbije-jaca-za-30-tenkova-t-72ms-i-30-oklopno-izvidjackih-automobila-brdm-2ms-17414',
    verified: true,
    note: 'Same 23 May 2021 handover at the "Mija Stanimirović" barracks in Niš.',
    noteSq: 'I njëjti dorëzim i 23 majit 2021 në kazermën "Mija Stanimirović" në Nish.',
  },
  {
    id: 'arms-m84as2',
    system: 'M-84AS2 main battle tank (domestic upgrade of the M-84)',
    labelSq: 'Tank kryesor luftarak M-84AS2 (modernizim vendor i M-84)',
    category: 'Armour',
    categorySq: 'Të blinduara',
    quantity: '~20',
    unit: 'tanks',
    unitSq: 'tanke',
    supplier: 'Serbia (Yugoimport SDPR)',
    supplierSq: 'Serbia (Yugoimport SDPR)',
    year: 2024,
    source: 'European Security & Defence',
    sourceUrl:
      'https://euro-sd.com/2025/09/articles/armament/46589/assessing-serbias-ground-forces-procurement-efforts/',
    verified: false,
    note:
      'UNCONFIRMED quantity — the source itself hedges: "around 20 units were believed to have entered service", with "at least nine displayed during the Zastava 2024 event". Settled by: a Serbian MoD or Yugoimport SDPR delivery statement giving the accepted number.',
    noteSq:
      'SASI E PAKONFIRMUAR — vetë burimi e ruan rezervën: "around 20 units were believed to have entered service", me "at least nine displayed during the Zastava 2024 event". Zgjidhet nga: një deklaratë dorëzimi e Ministrisë së Mbrojtjes serbe ose e Yugoimport SDPR që jep numrin e pranuar.',
  },
  {
    id: 'arms-lazar3',
    system: 'Lazar 3 8×8 armoured personnel carrier',
    labelSq: 'Transportues i blinduar këmbësorie Lazar 3 8×8',
    category: 'Armour',
    categorySq: 'Të blinduara',
    quantity: '~80',
    unit: 'in service, of 125 ordered',
    unitSq: 'në shërbim, nga 125 të porositura',
    supplier: 'Serbia (Yugoimport SDPR)',
    supplierSq: 'Serbia (Yugoimport SDPR)',
    year: 2025,
    source: 'European Security & Defence',
    sourceUrl:
      'https://euro-sd.com/2025/09/articles/armament/46589/assessing-serbias-ground-forces-procurement-efforts/',
    verified: true,
    note:
      '"Approximately 80 vehicles in service out of a total order of 125" as of 2025. Janes separately reports 30 special Lazar III turrets in the 2024 procurement package.',
    noteSq:
      '"Approximately 80 vehicles in service out of a total order of 125" sipas gjendjes më 2025. Janes raporton veçmas 30 kulla speciale Lazar III në paketën e prokurimit të vitit 2024.',
  },
  {
    id: 'arms-milos',
    system: 'BOV M16 Miloš protected mobility vehicle',
    labelSq: 'Automjet i mbrojtur lëvizshmërie BOV M16 Miloš',
    category: 'Armour',
    categorySq: 'Të blinduara',
    quantity: '112',
    unit: 'ordered',
    unitSq: 'të porositura',
    supplier: 'Serbia (Yugoimport SDPR)',
    supplierSq: 'Serbia (Yugoimport SDPR)',
    year: 2024,
    source: 'European Security & Defence',
    sourceUrl:
      'https://euro-sd.com/2025/09/articles/armament/46589/assessing-serbias-ground-forces-procurement-efforts/',
    verified: true,
    note:
      'Order of 112 Miloš vehicles announced January 2024; "at least 30 baseline Miloš vehicles are known to be in service". SOURCES DISAGREE on the 2024 batch: Janes (16 Jan 2024) reports 81 Miloš II 4×4 vehicles in the same procurement package. The two figures may cover different variants or different tranches; neither source reconciles them.',
    noteSq:
      'Porosi prej 112 automjetesh Miloš e shpallur në janar 2024; "at least 30 baseline Miloš vehicles are known to be in service". BURIMET NUK PAJTOHEN për grupin e vitit 2024: Janes (16 janar 2024) raporton 81 automjete Miloš II 4×4 në të njëjtën paketë prokurimi. Të dy shifrat mund të mbulojnë variante ose transhe të ndryshme; asnjëri burim nuk i pajton.',
  },
  {
    id: 'arms-m80ab1',
    system: 'BVP M-80AB1 tracked amphibious infantry fighting vehicle (upgrade)',
    labelSq: 'Automjet luftarak këmbësorie amfib me zinxhirë BVP M-80AB1 (modernizim)',
    category: 'Armour',
    categorySq: 'Të blinduara',
    quantity: '26',
    unit: 'upgraded',
    unitSq: 'të modernizuara',
    supplier: 'Serbia',
    supplierSq: 'Serbia',
    year: 2024,
    source: 'Janes',
    sourceUrl:
      'https://www.janes.com/osint-insights/defence-news/land/serbia-to-spend-nearly-eur740-million-on-new-weapons',
    verified: true,
    note:
      'Part of the €740 m 2024 package. European Security & Defence separately reports "up to 13 examples" of the M-80AB1 displayed at Zastava 2024 — a display count, not an order count.',
    noteSq:
      'Pjesë e paketës prej €740 mln të vitit 2024. European Security & Defence raporton veçmas "up to 13 examples" të M-80AB1 të ekspozuara në Zastava 2024 — numër ekspozimi, jo numër porosie.',
  },
  {
    id: 'arms-nora',
    system: 'Nora 8×8 155 mm self-propelled gun-howitzer',
    labelSq: 'Obus-top vetëlëvizës 155 mm Nora 8×8',
    category: 'Artillery',
    categorySq: 'Artileri',
    quantity: '8',
    unit: 'additional, ordered',
    unitSq: 'shtesë, të porositura',
    supplier: 'Serbia (Yugoimport SDPR)',
    supplierSq: 'Serbia (Yugoimport SDPR)',
    year: 2024,
    source: 'Janes',
    sourceUrl:
      'https://www.janes.com/osint-insights/defence-news/land/serbia-to-spend-nearly-eur740-million-on-new-weapons',
    verified: true,
    note:
      'Part of the €740 m 2024 package; Vučić said the equipment "should arrive by 2026". European Security & Defence reports 12 Nora B52 NG in service as of 2021 with six more ordered.',
    noteSq:
      'Pjesë e paketës prej €740 mln të vitit 2024; Vuçiqi tha se pajisjet "should arrive by 2026". European Security & Defence raporton 12 Nora B52 NG në shërbim sipas gjendjes më 2021, me gjashtë të tjera të porositura.',
  },

  // --- Aircraft and helicopters ---
  {
    id: 'arms-rafale',
    system: 'Dassault Rafale multirole fighter',
    labelSq: 'Avion luftarak shumërolësh Dassault Rafale',
    category: 'Combat aircraft',
    categorySq: 'Avionë luftarakë',
    quantity: '12',
    unit: 'aircraft (9 single-seat, 3 two-seat)',
    unitSq: 'avionë (9 njëvendësh, 3 dyvendësh)',
    supplier: 'France',
    supplierSq: 'Franca',
    year: 2024,
    dealValue: '€2.7 bn — contract signed 29 Aug 2024, delivery by 2029',
    dealValueSq: '€2.7 mld — kontratë e nënshkruar më 29 gusht 2024, dorëzimi deri në 2029',
    source: 'Dassault Aviation; value per RFE/RL',
    sourceUrl:
      'https://www.dassault-aviation.com/en/group/press/press-kits/serbia-acquires-12-rafale-fighters/',
    verified: true,
    note:
      'VALUE DISPUTED BY PRESENTATION, not by substance. Dassault’s own press kit confirms the 12 aircraft and the 29 Aug 2024 Belgrade signature but discloses NO value. The €2.7 bn figure is RFE/RL’s, matched by AFP/France 24, Bloomberg and Euronews; AP (via PBS) rendered the same deal as "$3 billion", which is the same number converted, not a competing figure. RFE/RL adds that Serbia pays tranches of €420 m in 2024 and 2025. Corroborating URL: https://www.rferl.org/a/macron-vucic-rafale-novi-sad-artificial-intelligence/33098413.html',
    noteSq:
      'VLERA KONTESTOHET NGA PARAQITJA, jo nga përmbajtja. Vetë materiali për shtyp i Dassault-it konfirmon 12 avionët dhe nënshkrimin e 29 gushtit 2024 në Beograd, por NUK zbulon asnjë vlerë. Shifra €2.7 mld është e RFE/RL-së, e përputhur nga AFP/France 24, Bloomberg dhe Euronews; AP (përmes PBS) e dha të njëjtën marrëveshje si "$3 billion", që është i njëjti numër i konvertuar, jo shifër konkurruese. RFE/RL shton se Serbia paguan transhe prej €420 mln në vitet 2024 dhe 2025. URL konfirmuese: https://www.rferl.org/a/macron-vucic-rafale-novi-sad-artificial-intelligence/33098413.html',
  },
  {
    id: 'arms-mig29-russia',
    system: 'MiG-29 fighter',
    labelSq: 'Avion luftarak MiG-29',
    category: 'Combat aircraft',
    categorySq: 'Avionë luftarakë',
    quantity: '6',
    unit: 'aircraft',
    unitSq: 'avionë',
    supplier: 'Russia',
    supplierSq: 'Rusia',
    year: 2017,
    dealValue: 'Military-technical assistance (not a standard purchase)',
    dealValueSq: 'Ndihmë ushtarako-teknike (jo blerje standarde)',
    source: 'Ministry of Defence of the Republic of Serbia',
    sourceUrl: 'https://www.mod.gov.rs/eng/16455/mig-29-garancija-suvereniteta-naseg-neba-16455',
    verified: true,
    note:
      'Serbian MoD, 9 Sep 2020: Serbia operates 14 MiG-29s in total — six received from Russia in 2017, four donated by Belarus, and four legacy aircraft of its own.',
    noteSq:
      'Ministria e Mbrojtjes e Serbisë, 9 shtator 2020: Serbia operon gjithsej 14 MiG-29 — gjashtë të marrë nga Rusia më 2017, katër të dhuruar nga Bjellorusia dhe katër avionë të trashëguar të vetët.',
  },
  {
    id: 'arms-mig29-belarus',
    system: 'MiG-29 fighter',
    labelSq: 'Avion luftarak MiG-29',
    category: 'Combat aircraft',
    categorySq: 'Avionë luftarakë',
    quantity: '4',
    unit: 'aircraft',
    unitSq: 'avionë',
    supplier: 'Belarus',
    supplierSq: 'Bjellorusia',
    year: 2019,
    dealValue: 'Donation from the Republic of Belarus',
    dealValueSq: 'Donacion nga Republika e Bjellorusisë',
    source: 'Ministry of Defence of the Republic of Serbia',
    sourceUrl: 'https://www.mod.gov.rs/eng/16455/mig-29-garancija-suvereniteta-naseg-neba-16455',
    verified: true,
    note:
      'YEAR DISPUTED. The Serbian MoD page dates the Belarusian donation to 2019; The Defense Post and TASS both reported the four aircraft arriving in Serbia in April 2018. The 2019 date may refer to formal acceptance after modernisation, which the MoD page says was still pending. The quantity — four — is not in dispute.',
    noteSq:
      'VITI KONTESTOHET. Faqja e Ministrisë së Mbrojtjes serbe e daton donacionin bjellorus në vitin 2019; The Defense Post dhe TASS raportuan të dy mbërritjen e katër avionëve në Serbi në prill 2018. Data 2019 mund t’i referohet pranimit formal pas modernizimit, të cilin faqja e Ministrisë e thotë se ishte ende në pritje. Sasia — katër — nuk kontestohet.',
  },
  {
    id: 'arms-h145m',
    system: 'Airbus H145M multirole helicopter',
    labelSq: 'Helikopter shumërolësh Airbus H145M',
    category: 'Helicopters',
    categorySq: 'Helikopterë',
    quantity: '9',
    unit: 'helicopters',
    unitSq: 'helikopterë',
    supplier: 'France/Germany (Airbus Helicopters)',
    supplierSq: 'Francë/Gjermani (Airbus Helicopters)',
    year: 2016,
    dealValue: 'Value not disclosed by Airbus',
    dealValueSq: 'Vlera nuk zbulohet nga Airbus',
    source: 'Airbus',
    sourceUrl:
      'https://www.airbus.com/en/newsroom/press-releases/2016-12-republic-of-serbia-orders-nine-h145m',
    verified: true,
    note:
      'Contract signed in Belgrade with the Serbian Ministry of Defence and Ministry of Interior on 28 December 2016; four of the air force aircraft fitted with the HForce weapon management system. First delivery to the Serbian Air Force June 2019. Airbus discloses no contract value.',
    noteSq:
      'Kontrata u nënshkrua në Beograd me Ministrinë e Mbrojtjes dhe Ministrinë e Punëve të Brendshme të Serbisë më 28 dhjetor 2016; katër nga avionët e forcave ajrore u pajisën me sistemin e menaxhimit të armëve HForce. Dorëzimi i parë te Forcat Ajrore serbe në qershor 2019. Airbus nuk zbulon asnjë vlerë kontrate.',
  },

  // --- Air defence ---
  {
    id: 'arms-fk3',
    system: 'FK-3 medium-range surface-to-air missile system (export HQ-22)',
    labelSq: 'Sistem raketor tokë-ajër me rreze mesatare FK-3 (HQ-22 për eksport)',
    category: 'Air defence',
    categorySq: 'Mbrojtje ajrore',
    quantity: '3',
    unit: 'systems, with 300 missiles',
    unitSq: 'sisteme, me 300 raketa',
    supplier: 'China',
    supplierSq: 'Kina',
    year: 2022,
    dealValue: 'Contracted 2020; value not published',
    dealValueSq: 'Kontraktuar më 2020; vlera e papublikuar',
    source: 'RFE/RL citing SIPRI; delivery per Defense News',
    sourceUrl:
      'https://www.rferl.org/a/serbia-china-military-cooperation-drones-air-defense-security/33626646.html',
    verified: true,
    note:
      'RFE/RL (7 Jan 2026), citing SIPRI: 3 systems and 300 missiles, contracted 2020, delivered 2022–23. Defense News (11 Apr 2022) reports the delivery airlifted into Belgrade on 9–10 April 2022 by 12 Chinese Y-20 transports — the first Chinese medium-range air defence system exported to Europe. A SIPRI researcher told RFE/RL the FK-3 "has a higher value than most other systems acquired in the last five years". Corroborating URL: https://www.defensenews.com/land/2022/04/11/china-delivers-anti-aircraft-missiles-to-serbia/',
    noteSq:
      'RFE/RL (7 janar 2026), duke cituar SIPRI-n: 3 sisteme dhe 300 raketa, të kontraktuara më 2020, të dorëzuara 2022–23. Defense News (11 prill 2022) raporton se dorëzimi u transportua ajror në Beograd më 9–10 prill 2022 nga 12 avionë kinezë Y-20 — sistemi i parë kinez i mbrojtjes ajrore me rreze mesatare i eksportuar në Evropë. Një studiues i SIPRI-t i tha RFE/RL-së se FK-3 "has a higher value than most other systems acquired in the last five years". URL konfirmuese: https://www.defensenews.com/land/2022/04/11/china-delivers-anti-aircraft-missiles-to-serbia/',
  },
  {
    id: 'arms-hq17ae',
    system: 'HQ-17AE short-range surface-to-air missile system',
    labelSq: 'Sistem raketor tokë-ajër me rreze të shkurtër HQ-17AE',
    category: 'Air defence',
    categorySq: 'Mbrojtje ajrore',
    quantity: '4',
    unit: 'systems, with 100 missiles',
    unitSq: 'sisteme, me 100 raketa',
    supplier: 'China',
    supplierSq: 'Kina',
    year: 2024,
    dealValue: 'Contracted 2023; value not published',
    dealValueSq: 'Kontraktuar më 2023; vlera e papublikuar',
    source: 'RFE/RL citing SIPRI',
    sourceUrl:
      'https://www.rferl.org/a/serbia-china-military-cooperation-drones-air-defense-security/33626646.html',
    verified: true,
    note:
      'RFE/RL (7 Jan 2026), citing SIPRI: 4 HQ-17A systems and 100 missiles, contracted 2023, delivered 2024. Publicly shown at the Vidovdan display in Kruševac on 28 June 2024, where Serbia’s then prime minister confirmed the purchase from China. Built by CASIC.',
    noteSq:
      'RFE/RL (7 janar 2026), duke cituar SIPRI-n: 4 sisteme HQ-17A dhe 100 raketa, të kontraktuara më 2023, të dorëzuara më 2024. Të shfaqura publikisht në paraqitjen e Vidovdanit në Krushevc më 28 qershor 2024, ku kryeministri i atëhershëm i Serbisë konfirmoi blerjen nga Kina. Prodhuar nga CASIC.',
  },
  {
    id: 'arms-pantsir',
    system: 'Pantsir-S1 gun/missile air defence system',
    labelSq: 'Sistem mbrojtjeje ajrore me top/raketa Pantsir-S1',
    category: 'Air defence',
    categorySq: 'Mbrojtje ajrore',
    quantity: '6',
    unit: 'systems (one battery)',
    unitSq: 'sisteme (një bateri)',
    supplier: 'Russia',
    supplierSq: 'Rusia',
    year: 2020,
    dealValue: 'Value not disclosed',
    dealValueSq: 'Vlera e pazbuluar',
    source: 'Airforce Technology',
    sourceUrl: 'https://www.airforce-technology.com/news/russia-pantsir-s1-systems-serbia/',
    verified: false,
    note:
      'UNCONFIRMED quantity. The six-system figure rests on an unnamed "defence sector source" quoted by Airforce Technology (21 Jan 2020): "Russia and Serbia signed a deal on one battery made up of six Pantsir-S1 missile systems." Neither the Serbian MoD nor Rosoboronexport has published the number or the value. European Security & Defence dates the acquisition to 2019. Settled by: a Serbian MoD acceptance statement or the Serbian budget’s procurement line for the system.',
    noteSq:
      'SASI E PAKONFIRMUAR. Shifra prej gjashtë sistemesh mbështetet në një "defence sector source" të paemërtuar të cituar nga Airforce Technology (21 janar 2020): "Russia and Serbia signed a deal on one battery made up of six Pantsir-S1 missile systems." As Ministria e Mbrojtjes serbe dhe as Rosoboronexport nuk e kanë publikuar numrin apo vlerën. European Security & Defence e daton blerjen në vitin 2019. Zgjidhet nga: një deklaratë pranimi e Ministrisë së Mbrojtjes serbe ose rreshti i prokurimit për këtë sistem në buxhetin serb.',
  },

  // --- Drones ---
  {
    id: 'arms-ch92a',
    system: 'CH-92A armed reconnaissance drone',
    labelSq: 'Dron i armatosur zbulimi CH-92A',
    category: 'Drones',
    categorySq: 'Dronë',
    quantity: '6',
    unit: 'drones, with 50 FT-8 missiles',
    unitSq: 'dronë, me 50 raketa FT-8',
    supplier: 'China',
    supplierSq: 'Kina',
    year: 2020,
    dealValue: 'Contracted 2019; price never disclosed by Serbia',
    dealValueSq: 'Kontraktuar më 2019; çmimi kurrë i zbuluar nga Serbia',
    source: 'RFE/RL citing SIPRI',
    sourceUrl:
      'https://www.rferl.org/a/serbia-china-military-cooperation-drones-air-defense-security/33626646.html',
    verified: true,
    note:
      'QUANTITY DISPUTED. RFE/RL (7 Jan 2026), citing SIPRI: 6 drones contracted 2019, delivered 2020, with 50 FT-8 missiles. Chinese and Serbian state-media reporting at the July 2020 handover described nine CH-92A airframes and 18 FT-8C missiles. Six is the figure in the SIPRI-derived record and is used here. China’s first export of military aviation equipment to Europe. RUSI notes Vučić "declined to disclose the full price of the Chinese drones to the public".',
    noteSq:
      'SASIA KONTESTOHET. RFE/RL (7 janar 2026), duke cituar SIPRI-n: 6 dronë të kontraktuar më 2019, të dorëzuar më 2020, me 50 raketa FT-8. Raportimi i medieve shtetërore kineze dhe serbe në dorëzimin e korrikut 2020 përshkroi nëntë trupa CH-92A dhe 18 raketa FT-8C. Gjashtë është shifra në regjistrin e bazuar në SIPRI dhe përdoret këtu. Eksporti i parë kinez i pajisjeve ushtarake të aviacionit në Evropë. RUSI vëren se Vuçiqi "declined to disclose the full price of the Chinese drones to the public".',
  },
  {
    id: 'arms-ch95',
    system: 'CH-95 reconnaissance-strike drone',
    labelSq: 'Dron zbulimi-goditjeje CH-95',
    category: 'Drones',
    categorySq: 'Dronë',
    quantity: '10',
    unit: 'drones',
    unitSq: 'dronë',
    supplier: 'China',
    supplierSq: 'Kina',
    year: 2023,
    dealValue: 'Contracted 2022; value not published',
    dealValueSq: 'Kontraktuar më 2022; vlera e papublikuar',
    source: 'RFE/RL citing SIPRI',
    sourceUrl:
      'https://www.rferl.org/a/serbia-china-military-cooperation-drones-air-defense-security/33626646.html',
    verified: true,
  },

  // --- Disputed ---
  {
    id: 'arms-elbit',
    system: 'Elbit Systems package — reported as Hermes 900 drones, long-range precision missiles, electronic warfare and command-and-control',
    labelSq:
      'Paketa e Elbit Systems — e raportuar si dronë Hermes 900, raketa precize me rreze të gjatë, luftë elektronike dhe komandë-kontroll',
    category: 'Multiple',
    categorySq: 'Të përziera',
    quantity: 'US$1.63 bn',
    unit: 'contract value',
    unitSq: 'vlerë kontrate',
    supplier: 'Israel',
    supplierSq: 'Izraeli',
    year: 2025,
    dealValue: 'US$1.63 bn (≈€1.4 bn)',
    dealValueSq: '1.63 mld USD (≈€1.4 mld)',
    source: 'Calcalist (CTech)',
    sourceUrl: 'https://www.calcalistech.com/ctechnews/article/5vr2ehayj',
    verified: false,
    note:
      'BUYER NOT OFFICIALLY CONFIRMED. Elbit Systems announced the US$1.63 bn contract on 17 Aug 2025 but did NOT name the customer, citing "a confidentiality request from the customer". Serbia was identified as the buyer by a security source speaking to Calcalist; Elbit declined further comment. Serbia and Israel signed a general defence security agreement in April 2026 reported as clearing the way for such a contract. Settled by: an Elbit Systems filing naming the customer, or a Serbian MoD / National Assembly ratification document for the contract.',
    noteSq:
      'BLERËSI NUK ËSHTË KONFIRMUAR ZYRTARISHT. Elbit Systems shpalli kontratën prej 1.63 mld USD më 17 gusht 2025 por NUK e emëroi klientin, duke cituar "a confidentiality request from the customer". Serbia u identifikua si blerëse nga një burim sigurie që foli për Calcalist; Elbit nuk pranoi të komentojë më tej. Serbia dhe Izraeli nënshkruan në prill 2026 një marrëveshje të përgjithshme sigurie mbrojtëse, e raportuar si hapje e rrugës për një kontratë të tillë. Zgjidhet nga: një dokument i Elbit Systems që emëron klientin, ose një dokument ratifikimi i Ministrisë së Mbrojtjes / Kuvendit të Serbisë për kontratën.',
  },
];

// Deduped { institution, document, year, url } list for a sources footer.
// Built by hand from the entries above.
const ALL_ECONOMY_SOURCES_LEGACY = [
  {
    institution: 'Kosovo Agency of Statistics (ASK) / Agjencia e Statistikave të Kosovës',
    document:
      'ASKDATA, External trade, Yearly indicators — tab02.px "Export and Import by partner country, 2010–2025"',
    year: 2026,
    url: 'https://askdata.rks-gov.net/pxweb/en/ASKdata/ASKdata__External%20trade__Yearly%20indicators/tab02.px/',
  },
  {
    institution: 'Kosovo Agency of Statistics (ASK) / Agjencia e Statistikave të Kosovës',
    document:
      'ASKDATA, External trade, Yearly indicators — tab08.px "Turnover of goods in Kosovo international trade, 2001–2025"',
    year: 2026,
    url: 'https://askdata.rks-gov.net/pxweb/en/ASKdata/ASKdata__External%20trade__Yearly%20indicators/tab08.px/',
  },
  {
    institution: 'Kosovo Agency of Statistics (ASK) / Agjencia e Statistikave të Kosovës',
    document:
      'Vjetari Statistikor i Republikës së Kosovës 2024 (Statistical Yearbook) — TAB 18.5, 18.7, 18.8',
    year: 2024,
    url: 'https://askapi.rks-gov.net/Custom/323bbe7d-f5d2-47ce-a814-8dc7299fa4e3.pdf',
  },
  {
    institution: 'European Western Balkans',
    document:
      'Kosovo raises tariffs on Serbian and Bosnian goods to 100% (2018); Kosovo bans imports of goods from Serbia (2023); Kosovo lifts the import ban at Merdare (2024)',
    year: 2024,
    url: 'https://europeanwesternbalkans.com/2024/10/08/kosovo-lifts-import-ban-on-serbian-goods-at-merdare-border-crossing/',
  },
  {
    institution: 'Radio Free Europe/Radio Liberty (RFE/RL)',
    document: 'Kosovo Lifts Tariffs On Serbian Goods',
    year: 2020,
    url: 'https://www.rferl.org/a/kosovo-lifts-serbia-tariffs-belgrade/30521305.html',
  },
  {
    institution: 'Tax Administration of the Republic of Serbia (Poreska uprava / PURS)',
    document: 'Law on Value Added Tax (Zakon o porezu na dodatu vrednost), Article 23 — VAT rates',
    year: 2026,
    url: 'https://www.purs.gov.rs/lat/fizicka-lica/pdv/opste-o-pdvu.html',
  },
  {
    institution: 'Tax Administration of the Republic of Serbia (Poreska uprava / PURS)',
    document:
      'Law on Corporate Income Tax (Zakon o porezu na dobit pravnih lica), Articles 39–40 — profit tax and withholding tax',
    year: 2025,
    url: 'https://purs.gov.rs/upload/media/2025/2/4/417349/Zakonoporezunadobitpravnihlica.pdf',
  },
  {
    institution: 'Ministry of Finance of the Republic of Serbia',
    document:
      'Macroeconomic and fiscal data — Table 2 (Budget Revenues and Expenditures) and Table 3 (Consolidated General Government)',
    year: 2026,
    url: 'https://www.mfin.gov.rs/en/documents2-2/macroeconomic-and-fiscal-data2',
  },
  {
    institution: 'Stockholm International Peace Research Institute (SIPRI)',
    document: 'SIPRI Military Expenditure Database (Serbia series, retrieved via the World Bank indicator API)',
    year: 2024,
    url: 'https://www.sipri.org/databases/milex',
  },
  {
    institution: 'Stockholm International Peace Research Institute (SIPRI)',
    document: 'Fact Sheet — Trends in International Arms Transfers, 2024',
    year: 2025,
    url: 'https://www.sipri.org/sites/default/files/2025-03/fs_2503_at_2024_0.pdf',
  },
  {
    institution: 'Ministry of Defence of the Republic of Serbia',
    document: 'Serbian Armed Forces receive 30 T-72MS tanks and 30 BRDM-2MS armoured reconnaissance vehicles',
    year: 2021,
    url: 'https://www.mod.gov.rs/eng/17414/vojska-srbije-jaca-za-30-tenkova-t-72ms-i-30-oklopno-izvidjackih-automobila-brdm-2ms-17414',
  },
  {
    institution: 'Ministry of Defence of the Republic of Serbia',
    document: 'MiG-29 — A guarantee of the sovereignty of our sky',
    year: 2020,
    url: 'https://www.mod.gov.rs/eng/16455/mig-29-garancija-suvereniteta-naseg-neba-16455',
  },
  {
    institution: 'Ministry of Defence of the Republic of Serbia',
    document: 'More than 70 new assets in Serbian Armed Forces armament',
    year: 2024,
    url: 'https://www.mod.gov.rs/eng/21897/vise-od-70-novih-sredstava-u-naoruzanju-vojske-srbije21897',
  },
  {
    institution: 'Dassault Aviation',
    document: 'Press kit — Serbia acquires 12 Rafale fighters',
    year: 2024,
    url: 'https://www.dassault-aviation.com/en/group/press/press-kits/serbia-acquires-12-rafale-fighters/',
  },
  {
    institution: 'Airbus',
    document: 'Press release — Republic of Serbia orders nine H145M',
    year: 2016,
    url: 'https://www.airbus.com/en/newsroom/press-releases/2016-12-republic-of-serbia-orders-nine-h145m',
  },
  {
    institution: 'Radio Free Europe/Radio Liberty (RFE/RL)',
    document: 'Serbia Deepens Military Ties With China Through Drones, Air Defense Systems (citing SIPRI)',
    year: 2026,
    url: 'https://www.rferl.org/a/serbia-china-military-cooperation-drones-air-defense-security/33626646.html',
  },
  {
    institution: 'Radio Free Europe/Radio Liberty (RFE/RL)',
    document: 'Macron Hails Fighter Jet Deal Signed By Serbia As Historically Significant',
    year: 2024,
    url: 'https://www.rferl.org/a/macron-vucic-rafale-novi-sad-artificial-intelligence/33098413.html',
  },
  {
    institution: 'Janes',
    document: 'Serbia to spend nearly EUR740 million on new weapons',
    year: 2024,
    url: 'https://www.janes.com/osint-insights/defence-news/land/serbia-to-spend-nearly-eur740-million-on-new-weapons',
  },
  {
    institution: 'European Security & Defence',
    document: "Assessing Serbia's ground forces procurement efforts",
    year: 2025,
    url: 'https://euro-sd.com/2025/09/articles/armament/46589/assessing-serbias-ground-forces-procurement-efforts/',
  },
  {
    institution: 'Defense News',
    document: 'China delivers anti-aircraft missiles to Serbia',
    year: 2022,
    url: 'https://www.defensenews.com/land/2022/04/11/china-delivers-anti-aircraft-missiles-to-serbia/',
  },
  {
    institution: 'Calcalist (CTech)',
    document: "Serbia revealed as buyer in Elbit's $1.63 billion arms deal",
    year: 2025,
    url: 'https://www.calcalistech.com/ctechnews/article/5vr2ehayj',
  },
];

// ============================================================
// DERIVED IMPACT — "what it means for us"
//
// Owner, 2026-09-12: "what it means for us if 10% how much of product how
// much serbia financed".
//
// THESE ARE CALCULATIONS, NOT MEASUREMENTS, and they are marked as such so
// they can never be mistaken for the sourced figures above them. Every one
// shows its inputs and its arithmetic so a reader can check it, and every
// one carries the assumption that limits it.
//
// The temptation here is to write "€234.8m × 20% = €47m that Kosovo sends
// to Belgrade". That would be wrong and it would discredit the sourced
// material sitting directly above it: VAT is levied on the final sale
// price inside Serbia, not on an import value; a large share of food
// carries the statutory 10% reduced rate rather than 20%; and profit tax
// falls on profit, not turnover. So the scaled figure below is stated as an
// explicit upper-bound illustration, and the honest per-purchase figure —
// which IS exact — carries the argument instead.
// ============================================================

export const TAX_IMPACT_COPY = {
  derivedBadge: { en: 'calculation', sq: 'llogaritje' },
  refusalBadge: { en: 'deliberately not calculated', sq: 'qëllimisht e pallogaritur' },
  inputsLabel: { en: 'inputs', sq: 'të dhënat' },
  arithmeticLabel: { en: 'arithmetic', sq: 'llogaria' },
  assumptionLabel: { en: 'assumption', sq: 'kushti' },
};

const TAX_IMPACT_DERIVED_RAW = [
  {
    id: 'vat-on-one-purchase',
    kind: 'derived',
    label: 'Serbian VAT inside a €1.20 shelf price',
    labelSq: 'TVSH serbe brenda një çmimi prej 1,20 €',
    value: '€0.20',
    inputs: ['Serbian VAT standard rate: 20% (Law on VAT, Art. 23)'],
    inputsSq: ['Norma standarde e TVSH-së serbe: 20% (Ligji për TVSH, neni 23)'],
    arithmetic: '1.20 × (20 ÷ 120) = 0.20',
    assumption:
      'Applies where the good carries the 20% standard rate. Many foods carry the statutory 10% reduced rate, where €1.10 contains €0.10.',
    assumptionSq:
      'Vlen kur produkti ka normën standarde 20%. Shumë ushqime kanë normën e reduktuar ligjore 10%, ku 1,10 € përmban 0,10 €.',
  },
  {
    id: 'vat-reduced-rate',
    kind: 'derived',
    label: 'Serbian VAT inside a €1.10 shelf price at the reduced rate',
    labelSq: 'TVSH serbe brenda një çmimi prej 1,10 € me normën e reduktuar',
    value: '€0.10',
    inputs: ['Serbian VAT reduced rate: 10% (Law on VAT, Art. 23)'],
    inputsSq: ['Norma e reduktuar e TVSH-së serbe: 10% (Ligji për TVSH, neni 23)'],
    arithmetic: '1.10 × (10 ÷ 110) = 0.10',
    assumption: 'The 10% rate applies to a statutory list of goods, including many basic foods.',
    assumptionSq: 'Norma 10% vlen për një listë ligjore mallrash, përfshirë shumë ushqime bazë.',
  },
  {
    id: 'scaled-upper-bound',
    kind: 'derived',
    label: 'Upper bound on VAT across all Kosovo imports from Serbia, 2025',
    labelSq: 'Kufiri i sipërm i TVSH-së mbi të gjitha importet e Kosovës nga Serbia, 2025',
    value: 'up to €47.0 m',
    valueSq: 'deri në 47,0 mln €',
    inputs: [
      'Kosovo goods imports from Serbia 2025: €234.8 m (Kosovo Agency of Statistics)',
      'Serbian VAT standard rate: 20%',
    ],
    inputsSq: [
      'Importet e mallrave të Kosovës nga Serbia 2025: 234,8 mln € (Agjencia e Statistikave të Kosovës)',
      'Norma standarde e TVSH-së serbe: 20%',
    ],
    arithmetic: '234.8 × 0.20 = 46.96',
    assumption:
      'AN UPPER BOUND, NOT A TRANSFER. Serbian VAT is charged on the final sale price inside Serbia, not on an export/import value, and much of this trade is food carrying the 10% rate. Treat this as the ceiling of an order of magnitude, never as money actually received.',
    assumptionSq:
      'KUFI I SIPËRM, JO NJË TRANSFER. TVSH-ja serbe llogaritet mbi çmimin final të shitjes brenda Serbisë, jo mbi vlerën e eksportit/importit, dhe pjesa më e madhe e kësaj tregtie janë ushqime me normën 10%. Merre si tavan të një rendi madhësie, kurrë si para të marra realisht.',
  },
  {
    id: 'profit-tax-refusal',
    kind: 'refusal',
    label: 'Serbian profit tax generated by this trade',
    labelSq: 'Tatimi serb mbi fitimin i gjeneruar nga kjo tregti',
    value: 'not calculated',
    valueSq: 'e pallogaritur',
    assumption:
      'Profit tax is 15% of PROFIT, not of turnover. Nothing published states the margin these exporters earn on Kosovo sales, so any figure would be invented. Left blank on purpose.',
    assumptionSq:
      'Tatimi mbi fitimin është 15% e FITIMIT, jo e qarkullimit. Asgjë e publikuar nuk tregon marzhin e këtyre eksportuesve në shitjet drejt Kosovës, prandaj çdo shifër do të ishte e sajuar. E lënë bosh me qëllim.',
  },
];

// ============================================================
// PANEL COPY — UI strings the /pse statistics panel needs.
//
// Owner, 2026-09-14: "make it a detailed for everythign". Showing every
// figure by default, grouping the arms list by what the weapon IS, and
// offering the sourced note under each row all need labels, and the panel
// is rendered from this module rather than from the shared dictionary —
// `src/i18n/dictionary.js` is kept to targeted edits. Same sq/en shape as TAX_IMPACT_COPY above, read
// through the same `copy(lang, entry)` helper.
//
// These are interface labels, not claims. No figure, source or citation
// lives in here.
// ============================================================
export const PANEL_COPY = {
  notesShow: {
    en: 'show the note and source behind every figure',
    sq: 'shfaq shënimin dhe burimin pas çdo shifre',
  },
  notesHide: { en: 'hide the notes', sq: 'fshih shënimet' },
  figuresWord: { en: 'figures', sq: 'shifra' },
  allShown: { en: 'all shown', sq: 'të gjitha të shfaqura' },
  sourceWord: { en: 'source', sq: 'burimi' },
  dealWord: { en: 'deal', sq: 'marrëveshja' },
  // Section standfirsts — plain descriptions of what the table under them
  // is a table OF. Nothing here states a figure.
  leadTrade: {
    en: 'Every year of the trade series, both political measures that cut across it, and what Kosovo sends back.',
    sq: 'Çdo vit i serisë tregtare, të dyja masat politike që e presin atë, dhe çka i kthen Kosova.',
  },
  leadMilitary: {
    en: 'What that treasury spends on its armed forces, and who supplies them.',
    sq: 'Çka shpenzon ajo arkë për forcat e veta, dhe kush i furnizon ato.',
  },
  leadArms: {
    en: 'Every acquisition in the dossier, grouped by what the system is.',
    sq: 'Çdo blerje në dosje, e grupuar sipas asaj çka është sistemi.',
  },
  leadTax: {
    en: 'The rates a purchase in Serbia pays, and what those rates raise.',
    sq: 'Normat që i paguan një blerje në Serbi, dhe sa mbledhin ato norma.',
  },
};

// ===========================================================================
// CITATION WIRING — added 2026-09-16 for the owner's IEEE instruction.
// ===========================================================================
// "all must have links and IEEE referencing" (owner, 2026-09-16).
//
// Every figure above already carried a `sourceUrl`. What it did NOT carry was
// a stable identity for the DOCUMENT behind that URL, so the page could only
// render an anonymous "↗" and could not number anything. That identity now
// lives once, in src/content/sources.js, and each figure is joined to it here
// BY ITS URL — mechanically, at module load, for all 56 figures at once.
//
// Doing it by URL rather than by hand-editing 56 entries is deliberate: a
// hand-added `sourceId` on entry 41 is exactly the kind of thing that gets
// missed, and a missed one would render a claim with no reference. Here, a
// URL with no registry entry throws at import time — you find out when the
// test suite runs, not when a reader scrolls.
//
// IMPORTANT: this adds a field. It does not change a single figure, label,
// note, year or `verified` flag. The dossier's content is untouched by the
// citation work.

import { SOURCES, createRegistry } from './sources.js';

/** sourceUrl (as written in the entries above) -> registry id. */
const URL_TO_SOURCE_ID = (() => {
  const map = new Map();
  for (const [id, s] of Object.entries(SOURCES)) map.set(s.url, id);
  return map;
})();

/**
 * Extra URLs that appear on entries above but are a second address for a
 * document already in the registry (the World Bank indicator API serves the
 * same SIPRI series under two indicator codes; ASK publishes the same trade
 * series through a data portal and a yearbook PDF; European Western Balkans
 * carries the tariff/ban story across three dated articles).
 */
const URL_ALIASES = {
  'https://api.worldbank.org/v2/country/SRB/indicator/MS.MIL.XPND.GD.ZS?format=json&date=2015:2025':
    'worldbank-milex',
  'https://europeanwesternbalkans.com/2018/11/21/kosovo-decides-raise-tariffs-serbian-bosnian-goods-10-100/':
    'ewb-trade-measures',
  'https://europeanwesternbalkans.com/2023/06/15/kosovo-bans-entry-of-vehicles-with-serbian-licence-plates-and-imports-of-goods-from-serbia/':
    'ewb-trade-measures',
};

/**
 * Corroborating documents cited in an entry's own `note` but not its
 * `sourceUrl`. They are real citations — a reader is told to check them — so
 * they belong in the reference list, numbered, like any other. Before this,
 * three of them sat in the old hand-written source list with no claim
 * pointing at them, and two claims pointed at documents the list omitted.
 */
const EXTRA_SOURCE_IDS = {
  // note: 'Removal source: https://www.rferl.org/a/kosovo-lifts-serbia-tariffs-…'
  'trade-measure-tariff': ['rferl-tariffs-lifted'],
  // note: 'Corroborating URL: https://www.rferl.org/a/macron-vucic-rafale-…'
  'arms-rafale': ['rferl-macron-rafale'],
  // note: 'Corroborating URL: https://www.defensenews.com/land/2022/04/11/…'
  'arms-fk3': ['defensenews-fk3'],
  // The World Bank API is the RETRIEVAL ROUTE; SIPRI is the database. Both
  // are named in the entries' own `source` string ("SIPRI Military
  // Expenditure Database (via World Bank API)"), so both are cited.
  'milex-2025-usd': ['sipri-milex'],
  'milex-2024-usd': ['sipri-milex'],
  'milex-2024-gdp': ['sipri-milex'],
  'milex-2023-usd': ['sipri-milex'],
  'milex-2022-usd': ['sipri-milex'],
  'milex-2021-usd': ['sipri-milex'],
};

/** Derived rows have no URL of their own — they cite the inputs they used. */
const DERIVED_SOURCE_IDS = {
  'vat-on-one-purchase': ['purs-vat-law'],
  'vat-reduced-rate': ['purs-vat-law'],
  'scaled-upper-bound': ['ask-tab02', 'purs-vat-law'],
  'profit-tax-refusal': ['purs-cit-law'],
};

function sourceIdFor(entry) {
  const extra = EXTRA_SOURCE_IDS[entry.id] || [];
  if (DERIVED_SOURCE_IDS[entry.id]) return [...DERIVED_SOURCE_IDS[entry.id], ...extra];
  const url = entry.sourceUrl;
  const id = URL_TO_SOURCE_ID.get(url) || URL_ALIASES[url];
  if (!id) {
    throw new Error(
      `serbiaEconomy: entry "${entry.id}" cites ${url || '(no url)'} which is not in the ` +
        `source registry. Add it to SOURCES in src/content/sources.js, or remove the claim.`
    );
  }
  return [...new Set([id, ...extra])];
}

function withSourceIds(entry) {
  return { ...entry, sourceIds: sourceIdFor(entry) };
}

export const TRADE_STATS = TRADE_STATS_RAW.map(withSourceIds);
export const TAX_STATS = TAX_STATS_RAW.map(withSourceIds);
export const MILITARY_SPEND = MILITARY_SPEND_RAW.map(withSourceIds);
export const ARMS_ACQUISITIONS = ARMS_ACQUISITIONS_RAW.map(withSourceIds);
export const TAX_IMPACT_DERIVED = TAX_IMPACT_DERIVED_RAW.map(withSourceIds);

/**
 * The economic dossier's source ids in the order the /pse panel renders them
 * — trade, military spending, arms, tax, then the derived tax rows. This is
 * what gives the IEEE numbering its document order for the second half of
 * the page. Nobody writes a number down.
 */
export function economySourceIdsInOrder() {
  const ids = [];
  for (const group of [
    TRADE_STATS,
    MILITARY_SPEND,
    ARMS_ACQUISITIONS,
    TAX_STATS,
    TAX_IMPACT_DERIVED,
  ]) {
    for (const e of group) for (const id of e.sourceIds) if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}

/**
 * Kept as an export because it was one, but no longer a second hand-written
 * list: it is now DERIVED from the registry, in citation order. The old
 * hand-built array (21 entries, maintained in parallel with the figures and
 * already one document out of step) is gone.
 */
export const ALL_ECONOMY_SOURCES = createRegistry(economySourceIdsInOrder()).entries.map((e) => ({
  institution: e.source.institution || e.source.court || e.source.publication,
  document: e.source.title || e.source.caseName,
  year: e.source.year,
  url: e.source.url,
}));

// The legacy hand-written list is retained ONLY so a reviewer can diff it
// against the derived one; nothing imports it and nothing should.
export const __LEGACY_ECONOMY_SOURCES = ALL_ECONOMY_SOURCES_LEGACY;
