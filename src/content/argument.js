// Sourced factual content for Vendorja's "argument" screens and the "pse"
// manifesto page.
//
// SOURCING RULE (owner, 2026-09-16, verbatim): "remove these put on a source
// to all. if no source remove. all must have links and IEEE referencing".
//
// Every claim below names one or more source ids from src/content/sources.js.
// A claim with no `sourceIds` fails scripts/verify-citations.mjs, which runs
// inside `npm test`. There is no "citation needed" state: a claim is sourced
// or it is not here.
//
// ===========================================================================
// AUDIT OF 2026-09-16 — WHAT CHANGED AND WHY (read before editing)
// ===========================================================================
// The previous version of this file cited ONE ICTY press release —
// "Five Senior Serb Officials Convicted of Kosovo Crimes, One Acquitted"
// (26 Feb 2009) — as the source for ELEVEN individual massacre sites. That
// press release was read in full on 2026-09-16. It names none of them.
//
// What it actually names: thirteen MUNICIPALITIES, the five convictions and
// one acquittal, and Judge Bonomy's "at least 700,000" departure figure. It
// gives no death toll at all. Račak appears in it once — as one of three
// sites whose evidence the Trial Chamber decided, under Rule 73 bis(D), not
// to hear, for expedition. Citing it for a Račak finding was backwards.
//
// A source that does not support its claim is worse than no source, so every
// site was re-sourced from scratch against primary material:
//
//   * ICTY Šainović et al. APPEAL Judgement press release (23 Jan 2014) —
//     this is the document that names localities: Bela Crkva, Mala Kruša,
//     Suva Reka town, Izbica, Đakovica town, Korenica and Meja, Gornja
//     Sudimlja. It also gives the Reka/Caragoj figure (287 found murdered).
//   * ICTY Milošević et al. indictment IT-99-37 (24 May 1999) — read in
//     full. Its Schedules A–G carry named-victim counts for Račak (~45),
//     Bela Crkva (~65), Velika Kruša/Mala Kruša (~105), Đakovica (6 and
//     20), Crkolez/Padalište (~20) and Izbica (~130). AN INDICTMENT IS AN
//     ALLEGATION, NOT A FINDING — Milošević died before judgement — and
//     every claim resting on it says "akuzoi"/"charged", never "found".
//   * OSCE/ODIHR "As Seen, As Told" (5 Nov 1999) — the KVM's own findings.
//     Read locally from the published PDF. Source for Račak and Poklek.
//   * Human Rights Watch, "Under Orders" (2001) — field investigation.
//     Source for Velika Kruša and for the Ćuška narrative.
//   * Humanitarian Law Center — Serbian domestic convictions for Podujevo
//     (2005) and Ćuška (first instance 2024, NOT final), and the Kosovo
//     Memory Book total.
//
// REMOVED, 2026-09-16 — Rezalla/Rezallë. No source meets the bar. It is
// absent from the Milošević indictment, from both ICTY Šainović press
// releases, and from HLC and HRW. The only document that mentions it is the
// OSCE report, which says, verbatim: "Although none had first-hand knowledge,
// interviewees reported killings in Rezala village." Its footnote 87 adds
// that the single witness who gave a figure (85 killed) gave testimony that
// "differs substantially from eyewitness accounts". That is the OSCE
// declining to stand behind it. So this app cannot stand behind it either.
// DO NOT RESTORE without a source that names Rezalla and a number, from
// ICTY/IRMCT, HLC, HRW or OSCE. This is not a judgement about whether people
// died there; it is a statement about what can be cited.
//
// ALSO REMOVED — the "Berisha family" clause on the Suva Reka entry. Suva
// Reka town IS a locality named in the ICTY appeal judgement and stays. The
// Berisha family execution is widely reported but was not confirmed against
// a primary document in this pass, so the specific clause goes and the site
// stays.
//
// CORRECTED — the Đorđević entry said the Appeals Chamber "upheld" his
// 27-year sentence in 2014. It did not: on 27 January 2014 it REDUCED the
// sentence to 18 years. The ICTY's own case information sheet states
// "Appeals Chamber Judgement 27 January 2014, sentence reduced to 18 years".
// The page had been asserting the opposite of what its own tribunal found.

import { SOURCES } from './sources.js';

/**
 * Attach the registry record so consumers that still read `item.source`
 * (ScanStory, ProductDetailScreen, ArgumentScreen) keep working, without a
 * second hand-maintained copy of the citation. One list, two shapes.
 */
function withSources(entry) {
  const ids = entry.sourceIds || [];
  const primary = ids.length ? SOURCES[ids[0]] : null;
  return {
    ...entry,
    source: primary
      ? {
          institution: primary.institution || primary.court || primary.publication,
          document: primary.caseName
            ? `${primary.caseName}, ${primary.caseNo} — ${primary.instrument}`
            : primary.title,
          year: primary.year,
          url: primary.url,
        }
      : null,
  };
}

export const ARGUMENT_SCREENS = [
  {
    id: 'non-recognition',
    sq: 'serbia nuk e njeh pavarësinë e kosovës',
    en: "serbia does not recognize kosovo's independence",
    ariaSq:
      'kosova e shpalli pavarësinë më 17 shkurt 2008. kushtetuta e serbisë e vitit 2006 e përshkruan kosovën si pjesë përbërëse të territorit të saj. gjykata ndërkombëtare e drejtësisë dha mendim këshillimor në 2010 se shpallja e pavarësisë nuk e shkeli të drejtën ndërkombëtare.',
    ariaEn:
      "kosovo declared independence on 17 february 2008. serbia's 2006 constitution describes kosovo as an integral part of its territory. the international court of justice gave an advisory opinion in 2010 that the declaration of independence did not violate international law.",
    // Two claims, two sources: the ICJ opinion, and Serbia's own
    // constitution for the non-recognition half. The constitution was
    // previously cited only on a separate screen further down the page,
    // which left "serbia does not recognize" resting on nothing.
    sourceIds: ['icj-kosovo-2010', 'serbia-constitution-2006'],
    verified: true,
  },
  {
    id: 'war-crimes',
    sq: 'gjykata e hagës dënoi zyrtarë serbë për krime kundër shqiptarëve të kosovës',
    en: 'the hague tribunal convicted serbian officials of crimes against kosovo albanians',
    ariaSq:
      'gjykata ndërkombëtare penale për ish-jugosllavinë (ikty) dënoi më 26 shkurt 2009 pesë zyrtarë të lartë serbë e jugosllavë — nikola sainoviq, nebojsha pavkoviq, sreten lukiq, vladimir lazareviq dhe dragoljub ojdaniq — për krime kundër njerëzimit ndaj popullsisë civile shqiptare të kosovës në 1999. milan millutinoviqi, ish-president i serbisë, u shpall i pafajshëm në të gjitha pikat. në apel, më 23 janar 2014, dënimet përfundimtare ishin: pavkoviq 22 vjet, lukiq 20 vjet, sainoviq 18 vjet, lazareviq 14 vjet.',
    ariaEn:
      'on 26 february 2009 the international criminal tribunal for the former yugoslavia (icty) convicted five senior serbian and yugoslav officials — nikola šainović, nebojša pavković, sreten lukić, vladimir lazarević and dragoljub ojdanić — of crimes against humanity against the kosovo albanian civilian population in 1999. milan milutinović, the former president of serbia, was acquitted on all counts. on appeal, on 23 january 2014, the final sentences were: pavković 22 years, lukić 20, šainović 18, lazarević 14.',
    // The appeal source is not decoration: the trial sentences (22/22/22/
    // 15/15) are NOT the sentences these men are serving, and a page that
    // gave only the trial figures would be out of date by twelve years.
    sourceIds: ['icty-sainovic-trial', 'icty-sainovic-appeal'],
    verified: true,
  },

  {
    id: 'kosova-1998-1999',
    headline: 'KOSOVË (1998–1999)',
    subheadSq: 'Shtëpitë e djegura, kufomat në oborre dhe gjakrat e derdhura në pragun tënd.',
    subheadEn: 'Burned homes, corpses in yards and blood spilled at your doorstep.',
    // The body used to read "dhunës sistematike mbi një milion shqiptarëve"
    // — over a million. No source in this file carried that number. The
    // sourced figure is the ICTY's: the deliberate actions of FRY and
    // Serbian forces "caused the departure of at least 700,000 Kosovo
    // Albanians from Kosovo" between the end of March and early June 1999.
    // The sentence now says that, and cites it. The rhetoric around it is
    // the owner's own and is untouched.
    bodySq:
      'Kur ti blen një produkt me kodin 860, ti po e shkel gjakun e tokës tënde. Prapa çdo shifre fshihet kujtimi i vrasjeve masive dhe i dëbimit me dhunë: Gjykata e Hagës konstatoi se veprimet e forcave serbe e jugosllave shkaktuan largimin e së paku 700 mijë shqiptarëve të Kosovës nga Kosova, vetëm mes fundit të marsit dhe fillimit të qershorit 1999. Fondi për të Drejtën Humanitare ka dokumentuar 13.535 njerëz të vrarë ose të zhdukur në Kosovë mes 1 janarit 1998 dhe 31 dhjetorit 2000, prej tyre 10.812 shqiptarë. Masakrat në Reçak, Mejë, Izbicë dhe anembanë Kosovës janë dëshmi e atij terrori. Çdo cent që ti e çon atje është fyerje direkte për atë gjak të derdhur dhe për jetët e humbura për lirinë që gëzon sot. Mos lejo që rehatia jote ta mbulojë gjakun me harresë!',
    bodyEn:
      'When you buy a product with the code 860, you are trampling the blood of your soil. Behind every digit lies the memory of mass killings and of violent expulsion: the Hague tribunal found that the deliberate actions of Serbian and Yugoslav forces caused the departure of at least 700,000 Kosovo Albanians from Kosovo between the end of March and the beginning of June 1999 alone. The Humanitarian Law Center has documented 13,535 people killed or disappeared in Kosovo between 1 January 1998 and 31 December 2000, of whom 10,812 were Albanians. The massacres at Račak, Meja, Izbica and throughout Kosovo are testimony to that terror. Every cent you send there is a direct insult to that spilled blood and to the lives lost for the freedom you enjoy today. Do not let your comfort bury the blood in oblivion!',
    sourceIds: ['icty-sainovic-trial', 'hlc-kosovo-memory-book-2015'],

    // Eleven sites, still eleven — but not the same eleven. Rezalla is out
    // (see the note above); Dakovica/Gjakova is in, because the ICTY Appeals
    // Chamber names it as a murder locality and the 1999 indictment carries
    // two named-victim schedules for it, and it had simply been missing.
    // Each site now carries the source that actually documents IT, the nature of that source (court finding / charge /
    // field investigation), and the figure exactly as the source gives it —
    // "approximately", "more than", "an estimated" are the source's own
    // words and are not rounded into a clean number.
    massacres: [
      {
        place: 'Račak',
        placeSq: 'Reçak',
        date: '15 January 1999',
        dateSq: '15 janar 1999',
        figure: '45',
        figureSq: '45',
        findingSq:
          'OSBE-ja (Misioni Verifikues në Kosovë): “At Racak on 15 January, 45 Kosovo Albanians were killed.” Ekipi i OSBE-së gjeti 40 trupa më 16 janar; pesë të tjerë ishin marrë më herët nga familjarët. Aktakuza e IKTY-së IT-99-37 ngarkoi po ashtu rreth 45 të vrarë (Shtojca A) — akuzë, jo vendim.',
        findingEn:
          'OSCE Kosovo Verification Mission: "At Racak on 15 January, 45 Kosovo Albanians were killed." The OSCE team found 40 bodies on 16 January; five others had already been removed by relatives. ICTY indictment IT-99-37 charged approximately 45 killed (Schedule A) — a charge, not a verdict.',
        // Stated out loud because the old citation got this exactly wrong:
        caveatSq:
          'Provat për Reçakun nuk u paraqitën në gjyqin Sainoviq et al. — Trupi Gjykues vendosi t’i përjashtonte për shpejtësi procedurale, duke theksuar se kjo “në asnjë mënyrë” nuk i bën këto vende më pak domethënëse.',
        caveatEn:
          'Evidence on Račak was not presented at the Šainović et al. trial — the Trial Chamber excluded it for expedition, stating that this "in no way" makes the sites less significant.',
        sourceIds: ['osce-asat-1999', 'icty-milosevic-indictment-1999', 'icty-sainovic-trial'],
      },
      {
        place: 'Meja and Korenica',
        placeSq: 'Mejë dhe Korenicë',
        date: 'April 1999',
        dateSq: 'prill 1999',
        figure: '287 found murdered in the Reka/Caragoj valley operation',
        figureSq: '287 të vrarë të gjetur në operacionin e luginës Rekë/Caragoj',
        findingSq:
          'Dhoma e Apelit e IKTY-së i emërton Korenicën dhe Mejën ndër vendet ku u konstatuan vrasjet, dhe vë në dukje 287 shqiptarë të Kosovës “të gjetur si të vrarë” në operacionin e luginës Rekë/Caragoj në komunën e Gjakovës.',
        findingEn:
          'The ICTY Appeals Chamber names Korenica and Meja among the localities where murders were found, and records 287 Kosovo Albanians "found to be murdered" in the Reka/Caragoj valley operation in Đakovica/Gjakova municipality.',
        sourceIds: ['icty-sainovic-appeal'],
      },
      {
        place: 'Izbica',
        placeSq: 'Izbicë',
        date: '28 March 1999',
        dateSq: '28 mars 1999',
        figure: 'approximately 130 (charged)',
        figureSq: 'rreth 130 (sipas akuzës)',
        findingSq:
          'Izbica është ndër vendet e emërtuara nga Dhoma e Apelit e IKTY-së në lidhje me dënimet për vrasje. Aktakuza IT-99-37 (Shtojca F) ngarkoi rreth 130 burra shqiptarë të vrarë — akuzë, jo vendim.',
        findingEn:
          'Izbica is among the localities named by the ICTY Appeals Chamber in connection with the murder convictions. Indictment IT-99-37 (Schedule F) charged approximately 130 Kosovo Albanian men killed — a charge, not a verdict.',
        sourceIds: ['icty-sainovic-appeal', 'icty-milosevic-indictment-1999'],
      },
      {
        place: 'Bela Crkva',
        placeSq: 'Bellacërkë',
        date: '25 March 1999',
        dateSq: '25 mars 1999',
        figure: 'approximately 65 (charged)',
        figureSq: 'rreth 65 (sipas akuzës)',
        findingSq:
          'Bellacërka është ndër vendet e emërtuara nga Dhoma e Apelit e IKTY-së në lidhje me dënimet për vrasje. Aktakuza IT-99-37 (Shtojca B) ngarkoi rreth 65 shqiptarë të Kosovës të vrarë — akuzë, jo vendim.',
        findingEn:
          'Bela Crkva is among the localities named by the ICTY Appeals Chamber in connection with the murder convictions. Indictment IT-99-37 (Schedule B) charged approximately 65 Kosovo Albanians killed — a charge, not a verdict.',
        sourceIds: ['icty-sainovic-appeal', 'icty-milosevic-indictment-1999'],
      },
      {
        place: 'Velika Kruša',
        placeSq: 'Krushë e Madhe',
        date: '26–28 March 1999',
        dateSq: '26–28 mars 1999',
        figure: 'more than ninety men',
        figureSq: 'më shumë se nëntëdhjetë burra',
        findingSq:
          'Human Rights Watch: “In Velika Krusa, more than ninety villagers were killed in various parts of the village between March 26 and March 28.” Ekipet forenzike të IKTY-së nxorën 98 trupa nga tri vende të ndryshme në Krushë të Madhe. Hetim në terren, jo vendim gjykate.',
        findingEn:
          'Human Rights Watch: "In Velika Krusa, more than ninety villagers were killed in various parts of the village between March 26 and March 28." ICTY forensic teams exhumed ninety-eight bodies from three different sites in Velika Kruša. A field investigation, not a court finding.',
        caveatSq:
          'Krusha e Madhe nuk përmendet si fshat në aktgjykimet e IKTY-së në çështjen Sainoviq et al.; komunat e Rahovecit dhe Prizrenit janë të dyja ndër 13 komunat e konstatuara.',
        caveatEn:
          'Velika Kruša is not named at village level in the ICTY Šainović et al. judgements; the Orahovac/Rahovec and Prizren municipalities are both among the 13 municipalities found.',
        sourceIds: ['hrw-under-orders-2001', 'icty-milosevic-indictment-1999'],
      },
      {
        place: 'Mala Kruša',
        placeSq: 'Krushë e Vogël',
        date: '26 March 1999',
        dateSq: '26 mars 1999',
        figure: 'at least one hundred men (HRW)',
        figureSq: 'së paku njëqind burra (HRW)',
        findingSq:
          'Krusha e Vogël është ndër vendet e emërtuara nga Dhoma e Apelit e IKTY-së në lidhje me dënimet për vrasje. Human Rights Watch raporton “at least one hundred men”, të mbuluar me bar dhe të djegur; ekipet forenzike të IKTY-së gjetën vetëm 14 trupa, me shenja të qarta të ndërhyrjes në varre.',
        findingEn:
          'Mala Kruša is among the localities named by the ICTY Appeals Chamber in connection with the murder convictions. Human Rights Watch reports "at least one hundred men", covered with hay and set on fire; ICTY forensic teams found only fourteen bodies, with clear evidence of grave tampering.',
        sourceIds: ['icty-sainovic-appeal', 'hrw-under-orders-2001'],
      },
      {
        place: 'Suva Reka',
        placeSq: 'Suharekë',
        date: 'March–April 1999',
        dateSq: 'mars–prill 1999',
        figure: null,
        figureSq: null,
        findingSq:
          'Qyteti i Suharekës është ndër vendet e emërtuara nga Dhoma e Apelit e IKTY-së në lidhje me dënimet për vrasje, dhe komuna e Suharekës është ndër 13 komunat ku Trupi Gjykues konstatoi krime. Asnjë burim parësor i konsultuar këtu nuk jep një numër të vrarësh vetëm për Suharekën, prandaj këtu nuk jepet asnjë.',
        findingEn:
          'Suva Reka town is among the localities named by the ICTY Appeals Chamber in connection with the murder convictions, and Suva Reka is among the 13 municipalities where the Trial Chamber found crimes. No primary source consulted here gives a Suva Reka-only death toll, so none is given.',
        sourceIds: ['icty-sainovic-appeal', 'icty-sainovic-trial'],
      },
      {
        place: 'Đakovica',
        placeSq: 'Gjakovë',
        date: '26 March and 2 April 1999',
        dateSq: '26 mars dhe 2 prill 1999',
        figure: '6 and 20 (charged)',
        figureSq: '6 dhe 20 (sipas akuzës)',
        findingSq:
          'Qyteti i Gjakovës është ndër vendet e emërtuara nga Dhoma e Apelit e IKTY-së në lidhje me dënimet për vrasje. Aktakuza IT-99-37 ngarkoi 6 burra të vrarë në rrugën Ymer Grezda më 26 mars (Shtojca D) dhe 20 të vrarë në lagjen Qerim më 2 prill, prej të cilëve 19 gra e fëmijë (Shtojca G) — akuza, jo vendime.',
        findingEn:
          'Đakovica town is among the localities named by the ICTY Appeals Chamber in connection with the murder convictions. Indictment IT-99-37 charged 6 men killed on Ymer Grezda Street on 26 March (Schedule D) and 20 killed in the Qerim district on 2 April, of whom 19 were women and children (Schedule G) — charges, not verdicts.',
        sourceIds: ['icty-sainovic-appeal', 'icty-milosevic-indictment-1999'],
      },
      {
        place: 'Podujevo',
        placeSq: 'Podujevë',
        date: '28 March 1999',
        dateSq: '28 mars 1999',
        figure: '14 civilians',
        figureSq: '14 civilë',
        findingSq:
          'Fondi për të Drejtën Humanitare: pjesëtarë të njësisë serbe “Akrepat” vranë katërmbëdhjetë civilë shqiptarë në oborrin e familjes Gashi — shtatë fëmijë të moshës dy deri pesëmbëdhjetë vjeç dhe shtatë gra. Pesë fëmijë mbijetuan të plagosur rëndë. Sasha Cvjetan u dënua në vitin 2005 nga Gjykata e Qarkut në Beograd me njëzet vjet burg; të tjerë u dënuan në 2010 dhe 2011.',
        findingEn:
          'Humanitarian Law Center: members of the Serbian "Scorpions" unit shot fourteen Albanian civilians in the Gashi family yard — seven children aged from two to fifteen, and seven women. Five children survived with serious injuries. Saša Cvjetan was convicted in 2005 by the District Court in Belgrade and sentenced to twenty years; others were convicted in 2010 and 2011.',
        caveatSq:
          'Podujeva nuk është ndër 13 komunat e çështjes së IKTY-së Sainoviq et al.; ky është një dënim i gjykatës serbe, jo i Hagës.',
        caveatEn:
          'Podujevo is not among the 13 municipalities in the ICTY Šainović et al. case; this is a Serbian domestic court conviction, not a Hague one.',
        sourceIds: ['hlc-podujevo-2018'],
      },
      {
        place: 'Ćuška',
        placeSq: 'Qyshk',
        date: '14 May 1999',
        dateSq: '14 maj 1999',
        figure: '57 across Ćuška, Ljubenić, Pavljan and Zahać',
        figureSq: '57 në total për Qyshkun, Lubeniqin, Pavlanin dhe Zahaqin',
        findingSq:
          'Gjykata e Lartë në Beograd, 24 prill 2024: shtatë të pandehur u shpallën fajtorë, mes tjerash për vrasjen e gjithsej 57 civilëve shqiptarë në fshatrat Lubeniq, Qyshk, Pavlan dhe Zahaq. Human Rights Watch dokumenton në vetë Qyshkun rreth dymbëdhjetë burra të vrarë gjatë rrethimit dhe tridhjetë e dy burra të ndarë në tri grupe e të qëlluar në tri shtëpi, me një të mbijetuar në secilin grup.',
        findingEn:
          'Higher Court in Belgrade, 24 April 2024: seven defendants were found guilty, including of murdering a total of 57 Albanian civilians in the villages of Ljubenić, Ćuška, Pavljan and Zahać. Human Rights Watch documents in Ćuška itself an estimated twelve men killed during the roundup and thirty-two men divided into three groups and shot in three houses, with one survivor in each group.',
        caveatSq:
          'Aktgjykimi është i shkallës së parë dhe NUK ËSHTË PËRFUNDIMTAR: sipas FDH-së, ai “do të jetë përfundimtar vetëm pasi Gjykata e Apelit të japë aktgjykimin e shkallës së dytë”. Shifra 57 është për të katër fshatrat së bashku, jo vetëm për Qyshkun.',
        caveatEn:
          'The verdict is first-instance and NOT FINAL: per HLC it "will be final only after the Court of Appeal has rendered a second-instance verdict." The figure of 57 is for all four villages together, not for Ćuška alone.',
        sourceIds: ['hlc-cuska-2024', 'hrw-under-orders-2001'],
      },
      {
        place: 'Poklek',
        placeSq: 'Poklek',
        date: '17 April 1999',
        dateSq: '17 prill 1999',
        figure: 'some 46 people',
        figureSq: 'rreth 46 njerëz',
        findingSq:
          'OSBE-ja (Misioni Verifikues në Kosovë): “In Poklek/Poklek i Vjeter village (Glogovac/Gllogoc municipality), a house containing the bodies of some 46 people was also set on fire by the perpetrators.” Kapitulli komunal i të njëjtit raport dokumenton vrasjen e 17 prillit në një shtëpi ku ishin strehuar 64 njerëz, dhe shënon se “among those killed were more than 10 children”; Human Rights Watch raportoi se vdiqën 23 fëmijë.',
        findingEn:
          'OSCE Kosovo Verification Mission: "In Poklek/Poklek i Vjeter village (Glogovac/Gllogoc municipality), a house containing the bodies of some 46 people was also set on fire by the perpetrators." The same report\'s municipal chapter documents the 17 April killing at a house sheltering 64 people and records that "among those killed were more than 10 children"; Human Rights Watch reported that 23 children died.',
        caveatSq:
          'Pokleku nuk përmendet në aktakuzën IT-99-37 as në njoftimet për shtyp të çështjes Sainoviq et al.; burimi këtu është OSBE-ja, jo një gjykatë.',
        caveatEn:
          'Poklek is not named in indictment IT-99-37 or in the Šainović et al. press releases; the source here is the OSCE, not a court.',
        sourceIds: ['osce-asat-1999', 'hrw-under-orders-2001'],
      },
    ],

    overallFigures: {
      displaced: {
        figure: 'at least 700,000',
        figureSq: 'së paku 700.000',
        // The ICTY's own words, not a paraphrase. The previous version said
        // "forcibly expelled", which is a stronger verb than the sentence
        // the figure comes from uses.
        description:
          'Kosovo Albanians whose departure from Kosovo the ICTY found was caused by the deliberate actions of FRY and Serbian forces, end of March – beginning of June 1999',
        descriptionSq:
          'shqiptarë të Kosovës largimin e të cilëve nga Kosova IKTY-ja e konstatoi si pasojë të veprimeve të qëllimshme të forcave të RFJ-së dhe Serbisë, fund marsi – fillim qershori 1999',
        sourceIds: ['icty-sainovic-trial'],
        verified: true,
      },
      killed: {
        // Was `figure: null` with a note saying the number could not be
        // sourced. It can: the Kosovo Memory Book is the documented count,
        // and it counts ALL the dead, which is how the source presents it
        // and therefore how this presents it.
        figure: '13,535',
        figureSq: '13.535',
        description:
          'people killed or disappeared in Kosovo, 1 January 1998 – 31 December 2000, documented by the Humanitarian Law Center: 10,812 Albanians, 2,197 Serbs, 526 Roma, Bosniaks, Montenegrins and other non-Albanians',
        descriptionSq:
          'njerëz të vrarë ose të zhdukur në Kosovë, 1 janar 1998 – 31 dhjetor 2000, të dokumentuar nga Fondi për të Drejtën Humanitare: 10.812 shqiptarë, 2.197 serbë, 526 romë, boshnjakë, malazezë dhe joshqiptarë të tjerë',
        sourceIds: ['hlc-kosovo-memory-book-2015'],
        verified: true,
      },
    },
    verified: true,
  },

  // SREBRENICA AND VUKOVAR: REMOVED, 2026-09-13, ON THE OWNER'S OWN
  // INSTRUCTION. Please read this before restoring them a third time.
  //
  // History: a pass on 2026-09-12 removed both; a later pass that same day
  // put them back with the note that the owner had supplied both texts
  // verbatim ("this is in the scroll section aswell") and that content the
  // owner asked for is not an agent's to delete.
  //
  // It has since been superseded. On 2026-09-13 the owner said, directly:
  // "talk only about the ethnic cleansing and genocide in Kosovo not
  // bosnia". That is newer, explicit, and about exactly this content.
  //
  // This is not a judgement that the findings are weak; they were the
  // best-sourced entries in the file. It is the owner's decision about whose
  // case this app argues. Do not restore without a NEWER instruction from
  // the owner than 2026-09-13, and if one comes, replace this note rather
  // than deleting it.

  {
    id: 'financimi-860',
    kind: 'argument',
    // ------------------------------------------------------------------
    // THIS ENTRY IS THE OWNER'S ARGUMENT, NOT A SOURCED FINDING — and it is
    // now labelled as one on screen (`kind: 'argument'` renders a visible
    // "qëndrim" / "position" badge) so a reader can tell a court finding
    // from a call to action.
    //
    // 2026-09-16: the owner said "if no source remove". Applied literally
    // that deletes his own manifesto, which is plainly not what he meant by
    // a page that argues a case. What is done instead: every FACTUAL premise
    // inside it is now cited to the economic dossier (Serbian VAT 20%,
    // profit tax 15%, budget revenue, military expenditure — all sourced in
    // serbiaEconomy.js), and the one unsourced numeric claim in the old text
    // ("over a million Albanians", which lived in the entry above) is gone.
    //
    // ONE THING HE SHOULD DECIDE HIMSELF, flagged rather than quietly
    // altered: the headline calls Serbia a "shtet gjenocidal". No court has
    // made that finding about Kosovo — the ICTY convicted for crimes against
    // humanity and war crimes, not genocide, and there is no ICJ finding of
    // genocide in Kosovo. It is a political characterisation, not a citable
    // fact, so no citation is attached to it and none should be invented.
    // The owner's call, and it is in the report he was handed.
    // ------------------------------------------------------------------
    headline:
      'Çdo herë që blej një produkt me kodin 860, unë vetë po e financoj drejtpërdrejt shtetin gjenocidal serb.',
    subheadSq: 'Paratë e tua, armatimi i tyre.',
    subheadEn: 'Your money, their weapons.',
    bodySq:
      'Nuk është thjesht një blerje e zakonshme – është një kontribut financiar i drejtpërdrejtë në ekonominë, arkën dhe fuqinë ushtarako-politike të Beogradit. Prapa çdo shisheje produkti me prefiksin 860 fshihet ky zinxhir:\n\nTaksat e tua shkojnë në atë arkë: norma standarde e TVSH-së në Serbi është 20% dhe tatimi mbi fitimin e korporatave 15%. Ajo arkë financon një shtet që në vitin 2024 shpenzoi 2,32 miliardë dollarë për ushtrinë, 2,60% të BPV-së, dhe që renditet i 36-ti ndër importuesit më të mëdhenj të armëve në botë.\n\nTi po e mban në jetë makinerinë e tyre ekonomike: çdo fitim që gjenerohet atje forcon korporatat e tyre dhe rrit bazën tatimore të atij buxheti.\n\nKomoditeti yt po kushton dinjitet: të zgjedhësh produktin më të lirë ose të mbyllësh sytë para barkodit vetëm se "është aty në rafte" do të thotë të zgjedhësh rehatinë tënde mbi gjakun e derdhur dhe mbi të kaluarën e dhimbshme.\n\nBojkoti i 860-ës nuk është thjesht një trend apo zgjedhje estetike – është përgjegjësi kombëtare dhe morale. Çdo herë që e kthen produktin mbrapsht, ti je duke refuzuar t\'i japësh bukë dhe fuqi atij që ka dashur të të shkatërrojë!',
    bodyEn:
      'It is not just an ordinary purchase – it is a direct financial contribution to the economy, treasury and military-political power of Belgrade. Behind every bottle of product with the prefix 860 lies this chain:\n\nYour taxes go into that treasury: Serbia\'s standard VAT rate is 20% and its corporate profit tax 15%. That treasury funds a state that in 2024 spent US$2.32 billion on its military, 2.60% of GDP, and that ranks 36th among the world\'s largest importers of major arms.\n\nYou are keeping their economic machinery alive: every profit generated there strengthens their corporations and widens the tax base of that budget.\n\nYour comfort is costing dignity: to choose the cheapest product or close your eyes to the barcode just because "it\'s there on the shelf" means choosing your comfort over spilled blood and over painful history.\n\nThe boycott of 860 is not just a trend or aesthetic choice – it is national and moral responsibility. Every time you put the product back, you are refusing to give bread and power to the one who wanted to destroy you!',
    sourceIds: ['purs-vat-law', 'purs-cit-law', 'worldbank-milex', 'sipri-at-2024'],
    verified: true,
  },
].map(withSources);

// Longer sequence for the "pse" (why) manifesto page. Includes the screens
// above plus additional, independently-sourced facts.
export const MANIFESTO_SCREENS = [
  ...ARGUMENT_SCREENS,
  ...[
    {
      id: 'icty-established',
      sq: 'kombet e bashkuara krijuan një gjykatë ndërkombëtare për krime lufte në ballkan',
      en: 'the united nations created an international tribunal for balkan war crimes',
      ariaSq:
        'këshilli i sigurimit i kombeve të bashkuara miratoi më 25 maj 1993 rezolutën 827, duke krijuar gjykatën ndërkombëtare penale për ish-jugosllavinë (ikty) për të gjykuar personat përgjegjës për shkelje të rënda të së drejtës humanitare ndërkombëtare në ballkan.',
      ariaEn:
        'the un security council adopted resolution 827 on 25 may 1993, establishing the international criminal tribunal for the former yugoslavia (icty) to prosecute persons responsible for serious violations of international humanitarian law in the balkans.',
      sourceIds: ['unsc-827-1993'],
      verified: true,
    },

    {
      id: 'kosovo-displacement',
      sq: 'gjykata e hagës: së paku 700 mijë shqiptarë u larguan nga kosova nën dhunë',
      en: 'the hague tribunal: at least 700,000 albanians left kosovo under violence',
      ariaSq:
        'gjykata ndërkombëtare penale për ish-jugosllavinë konstatoi se veprimet e qëllimshme të forcave serbe e jugosllave shkaktuan largimin e së paku 700 mijë shqiptarëve të kosovës nga kosova, në periudhën e shkurtër mes fundit të marsit dhe fillimit të qershorit 1999.',
      ariaEn:
        'the international criminal tribunal for the former yugoslavia found that the deliberate actions of serbian and yugoslav forces caused the departure of at least 700,000 kosovo albanians from kosovo, in the short period between the end of march and the beginning of june 1999.',
      sourceIds: ['icty-sainovic-trial'],
      verified: true,
    },

    {
      id: 'serbia-constitution',
      sq: 'kushtetuta e serbisë e quan kosovën pjesë të territorit të saj',
      en: "serbia's constitution calls kosovo part of its own territory",
      ariaSq:
        "kushtetuta e republikës së serbisë, e miratuar në 2006, e përcakton kosovën në parathënien e saj si 'pjesë përbërëse të territorit të serbisë', pavarësisht shpalljes së pavarësisë së kosovës në 2008 dhe njohjes ndërkombëtare që pasoi.",
      ariaEn:
        "the constitution of the republic of serbia, adopted in 2006, describes kosovo in its preamble as 'an integral part of the territory of serbia', despite kosovo's 2008 declaration of independence and the international recognition that followed.",
      sourceIds: ['serbia-constitution-2006'],
      verified: true,
    },

    {
      id: 'dordevic',
      // CORRECTED 2026-09-16. This screen used to read "u dënua me 27 vjet
      // burg" with the sub-claim that the Appeals Chamber "upheld the
      // conviction in 2014". The Appeals Chamber did uphold the conviction,
      // but it REDUCED the sentence from 27 years to 18 on 27 January 2014.
      // Stating the trial sentence as the standing one was wrong by nine
      // years, on the app's own cited tribunal's own record.
      sq: 'kreu i policisë serbe u dënua për krime në kosovë — 27 vjet, ulur në 18 në apel',
      en: 'the chief of serbian police was convicted of crimes in kosovo — 27 years, reduced to 18 on appeal',
      ariaSq:
        'gjykata e hagës dënoi më 23 shkurt 2011 vlastimir gjorgjeviqin, ish-zëvendësministër i punëve të brendshme të serbisë dhe kreu i departamentit të sigurisë publike, me 27 vjet burg për krime kundër njerëzimit dhe krime lufte kundër popullsisë civile shqiptare të kosovës në 1999. dhoma e apelit e la në fuqi dënimin më 27 janar 2014, por e uli dënimin me burg në 18 vjet.',
      ariaEn:
        "the hague tribunal convicted vlastimir đorđević, former assistant minister of the interior of serbia and chief of its public security department, on 23 february 2011 and sentenced him to 27 years' imprisonment for crimes against humanity and war crimes against the kosovo albanian civilian population in 1999. the appeals chamber upheld the conviction on 27 january 2014 but reduced the sentence to 18 years.",
      sourceIds: ['icty-djordjevic-trial', 'icty-djordjevic-cis'],
      verified: true,
    },
  ].map(withSources),
];

/**
 * Every source id cited by the legal record, in the order the claims appear.
 * This is what feeds IEEE numbering — nobody writes a number down.
 */
export function argumentSourceIdsInOrder(screens = MANIFESTO_SCREENS) {
  const ids = [];
  const push = (list) => {
    for (const id of list || []) if (!ids.includes(id)) ids.push(id);
  };
  for (const item of screens) {
    push(item.sourceIds);
    for (const site of item.massacres || []) push(site.sourceIds);
    push(item.overallFigures?.displaced?.sourceIds);
    push(item.overallFigures?.killed?.sourceIds);
  }
  return ids;
}
