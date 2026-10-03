// THE SOURCE REGISTRY — one list, IEEE style, numbers derived not written.
//
// OWNER, 2026-09-16, verbatim: "remove these put on a source to all. if no
// source remove. all must have links and IEEE referencing".
//
// This file is the single place a source is defined. Nothing anywhere else
// in the app may hand-write a citation number, a document title or a URL.
// Content modules (argument.js, serbiaEconomy.js) refer to a source by its
// string id; the number in front of the reader ([1], [2], …) is computed at
// render time from the order the claims appear in the document. That is the
// whole point: hand-numbering drifts the first time a claim is added or
// removed, and this page has had claims added and removed four times in
// five days.
//
// WHY A REGISTRY AND NOT AN ARRAY OF STRINGS
// A claim that names a source id that does not exist here is a build-time
// error, not a dangling "[undefined]" on a public page arguing a political
// case. scripts/verify-citations.mjs turns that into a failing check, and
// src/test/citations.test.js runs it inside `npm test`.
//
// EVERY ENTRY CARRIES A URL. That is enforced, not hoped for: assertRegistry()
// below throws on a source with no url, and the verifier fails the build.
// Every URL in this file was fetched on 2026-09-16 and returned HTTP 200.
// The one exception is noted on its own entry (`airforce-technology`, which
// answers 403 to a scripted request — a bot block, not link rot).

/** The date the whole registry was last link-checked. IEEE "[Accessed: …]". */
export const ACCESSED = '16-Sep-2026';

/**
 * Source records, keyed by a stable id.
 *
 * `type` selects the IEEE entry format:
 *   'legal'   — Prosecutor v. Name, Case No., Judgement, Court, Date.
 *   'report'  — Institution, "Title," Publisher, City, Country, Rep. no., Year.
 *   'dataset' — Agency, "Dataset title," Year.
 *   'news'    — A. Author, "Headline," Publication, Date.
 *   'law'     — Jurisdiction, "Instrument," Article, Year.
 */
export const SOURCES = {
  // ---------------------------------------------------------------------
  // THE LEGAL RECORD
  // ---------------------------------------------------------------------
  'icj-kosovo-2010': {
    type: 'legal',
    court: 'International Court of Justice',
    courtSq: 'Gjykata Ndërkombëtare e Drejtësisë',
    caseName:
      'Accordance with International Law of the Unilateral Declaration of Independence in Respect of Kosovo',
    caseNo: 'General List No. 141',
    instrument: 'Advisory Opinion',
    date: '22 July 2010',
    year: 2010,
    url: 'https://www.icj-cij.org/case/141',
  },

  'icty-sainovic-trial': {
    type: 'legal',
    court: 'ICTY',
    courtSq: 'GJNPIJ (ICTY)',
    caseName: 'Prosecutor v. Milutinović et al.',
    caseNo: 'IT-05-87-T',
    instrument: 'Trial Judgement',
    date: '26 February 2009',
    year: 2009,
    url: 'https://www.icty.org/en/press/five-senior-serb-officials-convicted-kosovo-crimes-one-acquitted',
    // What this document does and does NOT say — checked 2026-09-16 by
    // reading the page, not by trusting the previous citation:
    //   DOES: the five convictions and the Milutinović acquittal; the 13
    //   municipalities; Judge Bonomy's "the departure of at least 700,000
    //   Kosovo Albanians from Kosovo" between end-March and early June 1999.
    //   DOES NOT: give any figure for people killed, and does NOT name
    //   Meja, Izbica, Velika Kruša, Mala Kruša, Podujevo, Ćuška, Bela
    //   Crkva, Rezalla or Poklek. Račak appears ONLY as one of three sites
    //   whose evidence the Chamber excluded under Rule 73 bis(D) for
    //   expedition. Until 2026-09-16 this URL was cited as the source for
    //   all eleven of those sites. It supported none of them.
    supports: [
      'five convictions and one acquittal, 26 Feb 2009',
      '13 municipalities',
      'at least 700,000 departures, end-March to early June 1999',
    ],
    doesNotSupport: ['any figure for people killed', 'any individual village'],
  },

  'icty-sainovic-appeal': {
    type: 'legal',
    court: 'ICTY',
    courtSq: 'GJNPIJ (ICTY)',
    caseName: 'Prosecutor v. Šainović et al.',
    caseNo: 'IT-05-87-A',
    instrument: 'Appeal Judgement',
    date: '23 January 2014',
    year: 2014,
    url: 'https://www.icty.org/en/press/convictions-kosovo-crimes-upheld-four-senior-serbian-officials',
    // Names, as localities at issue in the murder convictions: Bela
    // Crkva/Bellacërka, Mala Kruša/Krusha e Vogël, Suva Reka/Suhareka town,
    // Izbica/Izbicë, Đakovica/Gjakova town, Korenica/Korenicë, Meja/Mejë,
    // Gornja Sudimlja. Gives 287 Kosovo Albanians "found to be murdered" in
    // the Reka/Caragoj valley operation. Final sentences: Šainović 18,
    // Pavković 22, Lukić 20, Lazarević 14.
  },

  'icty-milosevic-indictment-1999': {
    type: 'legal',
    court: 'ICTY',
    courtSq: 'GJNPIJ (ICTY)',
    caseName: 'Prosecutor v. Milošević, Milutinović, Šainović, Ojdanić and Stojiljković',
    caseNo: 'IT-99-37',
    instrument: 'Indictment (confirmed 24 May 1999)',
    date: '24 May 1999',
    year: 1999,
    url: 'https://www.icty.org/x/cases/slobodan_milosevic/ind/en/mil-ii990524e.htm',
    // AN ALLEGATION, NEVER A FINDING. Milošević died on 11 March 2006,
    // before judgement. Anything cited to this document must be worded as
    // charged/alleged. Every claim in this app that rests on it says so in
    // its own text, in both languages.
    isAllegation: true,
  },

  'icty-djordjevic-trial': {
    type: 'legal',
    court: 'ICTY',
    courtSq: 'GJNPIJ (ICTY)',
    caseName: 'Prosecutor v. Vlastimir Đorđević',
    caseNo: 'IT-05-87/1-T',
    instrument: 'Trial Judgement',
    date: '23 February 2011',
    year: 2011,
    url: 'https://www.icty.org/en/press/vlastimir-%C4%91or%C4%91evi%C4%87-convicted-crimes-kosovo',
  },

  'icty-djordjevic-cis': {
    type: 'report',
    institution: 'International Criminal Tribunal for the former Yugoslavia',
    institutionSq: 'Gjykata Ndërkombëtare Penale për ish-Jugosllavinë',
    title: 'Case Information Sheet "Kosovo" (IT-05-87/1) Đorđević',
    publisher: 'ICTY Communications Service',
    city: 'The Hague',
    country: 'Netherlands',
    year: 2014,
    url: 'https://www.icty.org/x/cases/djordjevic/cis/en/cis_djordjevic_en.pdf',
    // This is the document that corrects the app's old claim. It states
    // "Appeals Chamber Judgement 27 January 2014, sentence reduced to 18
    // years". The app said the appeal UPHELD the 27-year sentence. It did
    // not. See argument.js, entry `dordevic`.
  },

  'unsc-827-1993': {
    type: 'law',
    institution: 'United Nations Security Council',
    institutionSq: 'Këshilli i Sigurimit i Kombeve të Bashkuara',
    title: 'Resolution 827 (1993) — Establishment of the International Tribunal',
    year: 1993,
    date: '25 May 1993',
    url: 'https://www.icty.org/en/about/tribunal/establishment',
  },

  'serbia-constitution-2006': {
    type: 'law',
    institution: 'National Assembly of the Republic of Serbia',
    institutionSq: 'Kuvendi Kombëtar i Republikës së Serbisë',
    title: 'Constitution of the Republic of Serbia',
    section: 'Preamble',
    year: 2006,
    url: 'https://www.constituteproject.org/constitution/Serbia_2006.pdf?lang=en',
  },

  // ---------------------------------------------------------------------
  // THE CONTEMPORANEOUS HUMAN-RIGHTS RECORD
  // ---------------------------------------------------------------------
  'osce-asat-1999': {
    type: 'report',
    institution: 'OSCE Office for Democratic Institutions and Human Rights',
    institutionSq: 'Zyra e OSBE-së për Institucione Demokratike dhe të Drejtat e Njeriut',
    title: 'Human Rights in Kosovo: As Seen, As Told. Volume I, October 1998 – June 1999',
    publisher: 'Organization for Security and Co-operation in Europe',
    city: 'Warsaw',
    country: 'Poland',
    year: 1999,
    date: '5 November 1999',
    url: 'https://odihr.osce.org/odihr/17772',
    // The Kosovo Verification Mission's own findings. Used here for Račak
    // (which the ICTY Šainović trial excluded for expedition) and for
    // Poklek. Read locally from the published PDF on 2026-09-16; the
    // passages quoted in argument.js are verbatim from it.
  },

  'hrw-under-orders-2001': {
    type: 'report',
    institution: 'Human Rights Watch',
    institutionSq: 'Human Rights Watch',
    title: 'Under Orders: War Crimes in Kosovo',
    publisher: 'Human Rights Watch',
    city: 'New York, NY',
    country: 'USA',
    year: 2001,
    url: 'https://www.hrw.org/reports/2001/kosovo/',
    // Field investigation — witness testimony and site visits, not a
    // judicial finding. Every claim citing it says so.
    isFieldInvestigation: true,
  },

  'hlc-kosovo-memory-book-2015': {
    type: 'report',
    institution: 'Humanitarian Law Center',
    institutionSq: 'Fondi për të Drejtën Humanitare',
    title:
      '31,600 documents undoubtedly confirm death or disappearance of 13,535 individuals during war in Kosovo',
    publisher: 'Humanitarian Law Center (Kosovo Memory Book)',
    city: 'Belgrade',
    country: 'Serbia',
    year: 2015,
    date: '6 February 2015',
    url: 'https://www.hlc-rdc.org/en/dokumentovanje-i-pamcenje-2/31600-documents-undoubtedly-confirm-death-or-disappearance-of-13535-individuals-during-war-in-kosovo/',
    // The Kosovo Memory Book's own domain (kosovomemorybook.org) serves
    // plain HTTP only and redirect-loops under HTTPS, so it is not linked
    // from a site served over HTTPS. This HLC page carries the same figure
    // and does resolve.
  },

  'hlc-podujevo-2018': {
    type: 'report',
    institution: 'Humanitarian Law Center',
    institutionSq: 'Fondi për të Drejtën Humanitare',
    title:
      'Saša Cvjetan, convicted for murder of women and children in Podujevo, set free before sentence expires',
    publisher: 'Humanitarian Law Center',
    city: 'Belgrade',
    country: 'Serbia',
    year: 2018,
    date: '25 April 2018',
    url: 'https://www.hlc-rdc.org/en/public-information/press-releases-informisanje/sasa-cvjetan-convicted-for-murder-of-women-and-children-in-podujevo-set-free-before-sentence-expires/',
  },

  'hlc-cuska-2024': {
    type: 'report',
    institution: 'Humanitarian Law Center',
    institutionSq: 'Fondi për të Drejtën Humanitare',
    title:
      'Too little, too late: After 14 years, the first-instance verdict was pronounced for crimes in the Kosovo villages of Ćuška, Ljubenić, Pavljan and Zahać',
    publisher: 'Humanitarian Law Center',
    city: 'Belgrade',
    country: 'Serbia',
    year: 2024,
    date: '26 April 2024',
    url: 'https://www.hlc-rdc.org/en/public-information/press-releases-informisanje/too-little-too-late-after-14-years-the-first-instance-verdict-was-pronounced-for-crimes-in-the-kosovo-villages-of-cuska-ljubenic-pavljan-and-zahac/',
    // FIRST INSTANCE, NOT FINAL. HLC's own words: "this verdict has not
    // completed the proceedings, and it will be final only after the Court
    // of Appeal has rendered a second-instance verdict." The claim citing
    // this says so, in both languages.
  },

  // ---------------------------------------------------------------------
  // THE ECONOMIC DOSSIER
  // ---------------------------------------------------------------------
  'ask-tab02': {
    type: 'dataset',
    institution: 'Kosovo Agency of Statistics (ASK)',
    institutionSq: 'Agjencia e Statistikave të Kosovës (ASK)',
    title:
      'ASKDATA, External trade, Yearly indicators — tab02.px "Export and Import by partner country, 2010–2025"',
    year: 2026,
    url: 'https://askdata.rks-gov.net/pxweb/en/ASKdata/ASKdata__External%20trade__Yearly%20indicators/tab02.px/',
  },
  'ask-tab08': {
    type: 'dataset',
    institution: 'Kosovo Agency of Statistics (ASK)',
    institutionSq: 'Agjencia e Statistikave të Kosovës (ASK)',
    title:
      'ASKDATA, External trade, Yearly indicators — tab08.px "Turnover of goods in Kosovo international trade, 2001–2025"',
    year: 2026,
    url: 'https://askdata.rks-gov.net/pxweb/en/ASKdata/ASKdata__External%20trade__Yearly%20indicators/tab08.px/',
  },
  'ask-yearbook-2024': {
    type: 'report',
    institution: 'Kosovo Agency of Statistics (ASK)',
    institutionSq: 'Agjencia e Statistikave të Kosovës (ASK)',
    title:
      'Vjetari Statistikor i Republikës së Kosovës 2024 (Statistical Yearbook), TAB 18.5, 18.7, 18.8',
    publisher: 'Agjencia e Statistikave të Kosovës',
    city: 'Prishtina',
    country: 'Kosovo',
    year: 2024,
    url: 'https://askapi.rks-gov.net/Custom/323bbe7d-f5d2-47ce-a814-8dc7299fa4e3.pdf',
  },
  'ewb-trade-measures': {
    type: 'news',
    publication: 'European Western Balkans',
    title:
      'Kosovo raises tariffs on Serbian and Bosnian goods to 100% (2018); Kosovo bans imports of goods from Serbia (2023); Kosovo lifts the import ban at Merdare (2024)',
    year: 2024,
    date: '8 October 2024',
    url: 'https://europeanwesternbalkans.com/2024/10/08/kosovo-lifts-import-ban-on-serbian-goods-at-merdare-border-crossing/',
  },
  'rferl-tariffs-lifted': {
    type: 'news',
    publication: 'Radio Free Europe/Radio Liberty',
    title: 'Kosovo Lifts Tariffs On Serbian Goods',
    year: 2020,
    date: '1 April 2020',
    url: 'https://www.rferl.org/a/kosovo-lifts-serbia-tariffs-belgrade/30521305.html',
  },
  'purs-vat-law': {
    type: 'law',
    institution: 'Tax Administration of the Republic of Serbia (Poreska uprava / PURS)',
    institutionSq: 'Administrata Tatimore e Republikës së Serbisë (PURS)',
    title: 'Zakon o porezu na dodatu vrednost (Law on Value Added Tax)',
    section: 'Article 23 — VAT rates',
    year: 2026,
    url: 'https://www.purs.gov.rs/lat/fizicka-lica/pdv/opste-o-pdvu.html',
  },
  'purs-cit-law': {
    type: 'law',
    institution: 'Tax Administration of the Republic of Serbia (Poreska uprava / PURS)',
    institutionSq: 'Administrata Tatimore e Republikës së Serbisë (PURS)',
    title: 'Zakon o porezu na dobit pravnih lica (Law on Corporate Income Tax)',
    section: 'Articles 39–40 — profit tax and withholding tax',
    year: 2025,
    url: 'https://purs.gov.rs/upload/media/2025/2/4/417349/Zakonoporezunadobitpravnihlica.pdf',
  },
  'mfin-serbia': {
    type: 'dataset',
    institution: 'Ministry of Finance of the Republic of Serbia',
    institutionSq: 'Ministria e Financave e Republikës së Serbisë',
    title:
      'Macroeconomic and fiscal data — Table 2 (Budget Revenues and Expenditures), Table 3 (Consolidated General Government)',
    year: 2026,
    url: 'https://www.mfin.gov.rs/en/documents2-2/macroeconomic-and-fiscal-data2',
  },
  'sipri-milex': {
    type: 'dataset',
    institution: 'Stockholm International Peace Research Institute (SIPRI)',
    institutionSq: 'Instituti Ndërkombëtar i Stokholmit për Kërkime mbi Paqen (SIPRI)',
    title: 'SIPRI Military Expenditure Database — Serbia series',
    year: 2024,
    url: 'https://www.sipri.org/databases/milex',
  },
  'sipri-at-2024': {
    type: 'report',
    institution: 'Stockholm International Peace Research Institute (SIPRI)',
    institutionSq: 'Instituti Ndërkombëtar i Stokholmit për Kërkime mbi Paqen (SIPRI)',
    title: 'Trends in International Arms Transfers, 2024',
    publisher: 'SIPRI',
    city: 'Solna',
    country: 'Sweden',
    number: 'SIPRI Fact Sheet, March 2025',
    year: 2025,
    url: 'https://www.sipri.org/sites/default/files/2025-03/fs_2503_at_2024_0.pdf',
  },
  'worldbank-milex': {
    type: 'dataset',
    institution: 'World Bank (SIPRI indicator MS.MIL.XPND.CD / MS.MIL.XPND.GD.ZS)',
    institutionSq: 'Banka Botërore (treguesi SIPRI MS.MIL.XPND.CD / MS.MIL.XPND.GD.ZS)',
    title: 'Military expenditure (current USD and % of GDP), Serbia, 2015–2025',
    year: 2025,
    url: 'https://api.worldbank.org/v2/country/SRB/indicator/MS.MIL.XPND.CD?format=json&date=2015:2025',
  },
  'tradingeconomics-milex': {
    type: 'dataset',
    institution: 'Trading Economics',
    institutionSq: 'Trading Economics',
    title: 'Serbia — Military Expenditure',
    year: 2025,
    url: 'https://tradingeconomics.com/serbia/military-expenditure',
  },
  'mod-serbia-t72': {
    type: 'report',
    institution: 'Ministry of Defence of the Republic of Serbia',
    institutionSq: 'Ministria e Mbrojtjes e Republikës së Serbisë',
    title:
      'Serbian Armed Forces receive 30 T-72MS tanks and 30 BRDM-2MS armoured reconnaissance vehicles',
    publisher: 'Ministry of Defence of the Republic of Serbia',
    city: 'Belgrade',
    country: 'Serbia',
    year: 2021,
    url: 'https://www.mod.gov.rs/eng/17414/vojska-srbije-jaca-za-30-tenkova-t-72ms-i-30-oklopno-izvidjackih-automobila-brdm-2ms-17414',
  },
  'mod-serbia-mig29': {
    type: 'report',
    institution: 'Ministry of Defence of the Republic of Serbia',
    institutionSq: 'Ministria e Mbrojtjes e Republikës së Serbisë',
    title: 'MiG-29 — A guarantee of the sovereignty of our sky',
    publisher: 'Ministry of Defence of the Republic of Serbia',
    city: 'Belgrade',
    country: 'Serbia',
    year: 2020,
    url: 'https://www.mod.gov.rs/eng/16455/mig-29-garancija-suvereniteta-naseg-neba-16455',
  },
  // REMOVED 2026-09-16 — 'mod-serbia-70-assets' (Serbian MoD, "More than 70
  // new assets in Serbian Armed Forces armament", 2024). It sat in the old
  // hand-written economy source list, but no figure in the dossier cited it:
  // a reference-list entry nothing referenced. IEEE lists carry cited works
  // only, and scripts/verify-citations.mjs now fails on an orphan. If a
  // future claim needs it, add it back with the claim, not before.
  'dassault-rafale': {
    type: 'report',
    institution: 'Dassault Aviation',
    institutionSq: 'Dassault Aviation',
    title: 'Press kit — Serbia acquires 12 Rafale fighters',
    publisher: 'Dassault Aviation',
    city: 'Paris',
    country: 'France',
    year: 2024,
    url: 'https://www.dassault-aviation.com/en/group/press/press-kits/serbia-acquires-12-rafale-fighters/',
  },
  'airbus-h145m': {
    type: 'report',
    institution: 'Airbus',
    institutionSq: 'Airbus',
    title: 'Republic of Serbia orders nine H145M',
    publisher: 'Airbus Helicopters',
    city: 'Marignane',
    country: 'France',
    year: 2016,
    url: 'https://www.airbus.com/en/newsroom/press-releases/2016-12-republic-of-serbia-orders-nine-h145m',
  },
  'rferl-serbia-china': {
    type: 'news',
    publication: 'Radio Free Europe/Radio Liberty',
    title: 'Serbia Deepens Military Ties With China Through Drones, Air Defense Systems',
    year: 2026,
    date: '2026',
    url: 'https://www.rferl.org/a/serbia-china-military-cooperation-drones-air-defense-security/33626646.html',
  },
  'rferl-macron-rafale': {
    type: 'news',
    publication: 'Radio Free Europe/Radio Liberty',
    title: 'Macron Hails Fighter Jet Deal Signed By Serbia As Historically Significant',
    year: 2024,
    date: '29 August 2024',
    url: 'https://www.rferl.org/a/macron-vucic-rafale-novi-sad-artificial-intelligence/33098413.html',
  },
  'janes-740m': {
    type: 'news',
    publication: 'Janes',
    title: 'Serbia to spend nearly EUR740 million on new weapons',
    year: 2024,
    url: 'https://www.janes.com/osint-insights/defence-news/land/serbia-to-spend-nearly-eur740-million-on-new-weapons',
  },
  'esd-ground-forces': {
    type: 'news',
    publication: 'European Security & Defence',
    title: "Assessing Serbia's ground forces procurement efforts",
    year: 2025,
    date: 'September 2025',
    url: 'https://euro-sd.com/2025/09/articles/armament/46589/assessing-serbias-ground-forces-procurement-efforts/',
  },
  'defensenews-fk3': {
    type: 'news',
    publication: 'Defense News',
    title: 'China delivers anti-aircraft missiles to Serbia',
    year: 2022,
    date: '11 April 2022',
    url: 'https://www.defensenews.com/land/2022/04/11/china-delivers-anti-aircraft-missiles-to-serbia/',
  },
  'calcalist-elbit': {
    type: 'news',
    publication: 'Calcalist (CTech)',
    title: "Serbia revealed as buyer in Elbit's $1.63 billion arms deal",
    year: 2025,
    url: 'https://www.calcalistech.com/ctechnews/article/5vr2ehayj',
  },
  'airforce-technology-pantsir': {
    type: 'news',
    publication: 'Airforce Technology',
    title: 'Russia delivers Pantsir-S1 systems to Serbia',
    year: 2020,
    url: 'https://www.airforce-technology.com/news/russia-pantsir-s1-systems-serbia/',
    // LINK NOTE, 2026-09-16: this host is inconsistent to automated
    // clients — it answered HTTP 403 to `curl` with a browser user-agent
    // and HTTP 200 to Node's fetch in the same session. A bot rule, not
    // link rot. `botBlocked` only suppresses a --check-links failure, so a
    // genuine 403 here will never fail the build; the flag is kept for that
    // reason and the claim resting on it (arms-pantsir) is already marked
    // unverified in serbiaEconomy.js and stays marked.
    botBlocked: true,
  },
};

// ---------------------------------------------------------------------------
// IEEE FORMATTING
// ---------------------------------------------------------------------------
// IEEE style, per the formats this project actually needs. The reference
// list is numbered in citation order, never alphabetically, and every entry
// ends in a live link plus an access date.

/**
 * Join IEEE fields with ", " — EXCEPT after a quoted title, which already
 * carries its own comma inside the closing quote ("Title," Publisher, …).
 * Joining naively produced `"Title,", Publisher` in every report and news
 * entry on the page; caught by reading the rendered reference list rather
 * than by reading this function.
 */
function join(parts) {
  const kept = parts.filter(Boolean).map(String);
  return kept.reduce((acc, part, i) => {
    if (i === 0) return part;
    return acc + (/,"$/.test(acc) ? ' ' : ', ') + part;
  }, '');
}

/**
 * The reference-list text for one source, WITHOUT its number and WITHOUT the
 * trailing "[Online]. Available: …" — the view renders the URL as the anchor
 * so the link is real rather than a printed string.
 *
 * @param {object} s a record from SOURCES
 * @returns {string}
 */
export function formatIeee(s) {
  switch (s.type) {
    case 'legal': {
      // [n] Prosecutor v. Name, Case No. IT-XX-XX-T, Judgement, ICTY, Date.
      // An ICJ matter carries its own docket wording ("General List No. 141"),
      // so "Case No." is not prefixed onto a number that already says No.
      const docket = s.caseNo.includes('No.') ? s.caseNo : `Case No. ${s.caseNo}`;
      return `${s.caseName}, ${docket}, ${s.instrument}, ${s.court}, ${s.date}.`;
    }
    case 'law':
      // [n] Body, "Instrument," Article, Year.
      return `${join([s.institution, `"${s.title},"`, s.section, s.year])}.`;
    case 'dataset':
      // [n] Agency, "Dataset title," Year.
      return `${s.institution}, "${s.title}," ${s.year}.`;
    case 'news':
      // [n] A. Author, "Headline," Publication, Date.
      return `${join([s.author, `"${s.title},"`, s.publication, s.date || s.year])}.`;
    case 'report':
    default:
      // [n] Institution, "Title," Publisher, City, Country, Rep. no., Year.
      return `${join([
        s.institution,
        `"${s.title},"`,
        s.publisher,
        s.city,
        s.country,
        s.number,
        s.date || s.year,
      ])}.`;
  }
}

/** Institution/court name in Albanian where the registry carries one. */
export function sourceInstitution(s, lang) {
  const en = s.institution || s.court || s.publication || s.publisher || '';
  if (lang !== 'sq') return en;
  return s.institutionSq || s.courtSq || en;
}

/**
 * Throws if the registry itself is malformed. Called by the verifier and by
 * the test run — a source with no URL must never reach a reader.
 */
export function assertRegistry(registry = SOURCES) {
  const problems = [];
  for (const [id, s] of Object.entries(registry)) {
    if (!s || typeof s !== 'object') problems.push(`${id}: not an object`);
    else {
      if (!s.url || !/^https?:\/\//.test(s.url)) problems.push(`${id}: missing or non-http url`);
      if (!s.type) problems.push(`${id}: missing type`);
      if (!s.year) problems.push(`${id}: missing year`);
      const label = formatIeee(s);
      if (!label || label.length < 12) problems.push(`${id}: unusable IEEE label "${label}"`);
    }
  }
  if (problems.length) {
    throw new Error(`Source registry is invalid:\n  - ${problems.join('\n  - ')}`);
  }
  return true;
}

/**
 * Assign IEEE numbers from DOCUMENT ORDER.
 *
 * Give it the source ids in the order their claims first appear on the page;
 * it returns `numberOf(id)` and the ordered reference list. Numbers are never
 * written down anywhere — add a claim, remove a claim, reorder the page, and
 * the numbering follows without anybody editing it.
 *
 * An id that is not in the registry throws here rather than rendering
 * "[undefined]" on a page that argues a political and economic case.
 */
export function createRegistry(idsInFirstAppearanceOrder, registry = SOURCES) {
  const numbers = new Map();
  const entries = [];
  const unknown = [];

  for (const id of idsInFirstAppearanceOrder) {
    if (numbers.has(id)) continue;
    const source = registry[id];
    if (!source) {
      unknown.push(id);
      continue;
    }
    const n = entries.length + 1;
    numbers.set(id, n);
    entries.push({ n, id, source, text: formatIeee(source), url: source.url });
  }

  if (unknown.length) {
    throw new Error(
      `Unknown source id(s) cited: ${unknown.join(', ')}. ` +
        `Add them to SOURCES in src/content/sources.js or remove the claim.`
    );
  }

  return {
    entries,
    /** @returns {number|null} */
    numberOf: (id) => (numbers.has(id) ? numbers.get(id) : null),
    /** "[1]", "[1], [4]", "[1]–[3]" for a run of three or more. */
    label: (ids) => formatCitationLabel((Array.isArray(ids) ? ids : [ids]).map((i) => numbers.get(i))),
    has: (id) => numbers.has(id),
    size: entries.length,
  };
}

/**
 * IEEE in-text form for a set of numbers: "[1]", "[1], [4]", "[1]–[3]".
 * A run of three or more consecutive numerals collapses to a range, which is
 * the rule IEEE actually states; two consecutive numerals do not.
 */
export function formatCitationLabel(numbers) {
  const ns = [...new Set(numbers.filter((n) => Number.isInteger(n) && n > 0))].sort((a, b) => a - b);
  if (ns.length === 0) return '';
  const runs = [];
  let start = ns[0];
  let prev = ns[0];
  for (let i = 1; i <= ns.length; i += 1) {
    const cur = ns[i];
    if (cur !== prev + 1) {
      runs.push([start, prev]);
      start = cur;
    }
    prev = cur;
  }
  return runs
    .map(([a, b]) => {
      if (a === b) return `[${a}]`;
      if (b === a + 1) return `[${a}], [${b}]`;
      return `[${a}]–[${b}]`;
    })
    .join(', ');
}
