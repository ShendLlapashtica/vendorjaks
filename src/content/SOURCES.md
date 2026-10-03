# Sources — Vendorja `/pse`

**The registry, not this file, is the source of truth.** Every source is
defined exactly once, in [`src/content/sources.js`](./sources.js). Claims name
a source by id; the numbers a reader sees are derived from document order at
render time. Nothing anywhere hand-writes a citation number.

This file is the **audit record**: what each source does and does not support,
what was removed and why, and the reference list as it currently stands. The
list at the bottom is generated — regenerate it with:

```
node scripts/verify-citations.mjs --markdown
```

The rules are enforced, not described. `node scripts/verify-citations.mjs`
fails if any claim lacks a source, any source lacks a URL, any in-text numeral
has no matching entry, or any entry is unreferenced. It runs inside `npm test`
via `src/test/citations.test.js`.

---

## The audit of 2026-09-16

Owner, verbatim: *"remove these put on a source to all. if no source remove.
all must have links and IEEE referencing"*.

### The finding that mattered

The previous version of `argument.js` cited **one ICTY press release** — "Five
Senior Serb Officials Convicted of Kosovo Crimes, One Acquitted", 26 February
2009 — as the source for **eleven individual massacre sites**.

That press release was read in full on 2026-09-16. **It names none of them.**

What it actually contains: thirteen *municipalities*, the five convictions and
one acquittal, and Presiding Judge Bonomy's figure — the deliberate actions of
FRY and Serbian forces "caused the departure of at least 700,000 Kosovo
Albanians from Kosovo" between the end of March and early June 1999. It gives
**no death toll of any kind**. Račak appears in it exactly once, as one of
three sites whose evidence the Trial Chamber decided under Rule 73 *bis*(D) not
to hear, for expedition.

So ten of the eleven sites were sourced to a document that does not mention
them, and the eleventh — Račak — was sourced to a document that says its
evidence was *excluded*. A source that does not support its claim is worse than
no source. Every site was re-sourced from primary material.

### What each source is for

| Source | Used for | What it is |
| --- | --- | --- |
| ICTY *Šainović et al.* Appeal Judgement, 23 Jan 2014 | Bela Crkva, Mala Kruša, Suva Reka town, Izbica, Đakovica town, Meja and Korenica | A court **finding**. This is the ICTY document that names localities. |
| ICTY *Milutinović et al.* Trial Judgement, 26 Feb 2009 | the convictions, the 13 municipalities, the 700,000 figure | A court **finding** — but only for those three things. |
| ICTY *Milošević et al.* indictment IT-99-37, 24 May 1999 | named-victim counts: Račak ~45 (Sch. A), Bela Crkva ~65 (Sch. B), Velika/Mala Kruša ~105 (Sch. C), Đakovica 6 (Sch. D) and 20 (Sch. G), Izbica ~130 (Sch. F) | **An allegation, never a finding.** Milošević died before judgement. Every claim resting on it says *akuzë, jo vendim* / "a charge, not a verdict". |
| OSCE/ODIHR *As Seen, As Told*, 5 Nov 1999 | Račak, Poklek | The Kosovo Verification Mission's own findings. Read locally from the published PDF. |
| Human Rights Watch *Under Orders*, 2001 | Velika Kruša, Mala Kruša, Ćuška narrative | **A field investigation, not a court finding.** Said so on every claim. |
| Humanitarian Law Center | Podujevo (2005 conviction), Ćuška (2024 first-instance verdict), the Kosovo Memory Book total | Serbian domestic convictions and the documented death toll. |

### Removed — Rezalla / Rezallë

**No source meets the bar.** Absent from the Milošević indictment, from both
ICTY *Šainović* press releases, and from HLC and HRW. The only document that
mentions it is the OSCE report, which says, verbatim:

> "Although none had first-hand knowledge, interviewees reported killings in
> Rezala village."

Its footnote 87 adds that the one witness who gave a figure (85 killed) gave
testimony that "differs substantially from eyewitness accounts". That is the
OSCE declining to stand behind it.

This is **not** a finding that nothing happened there. It is a statement about
what can be cited. Do not restore it without a source that names Rezalla and a
number, from ICTY/IRMCT, HLC, HRW or OSCE.

### Also removed

- **The "Berisha family" clause** on the Suva Reka entry. Suva Reka town is a
  locality named in the ICTY appeal judgement and stays; the specific clause
  was not confirmed against a primary document in this pass, so it goes.
- **"over a million Albanians"** in the Kosovo 1998–99 body. No source in the
  file carried it. Replaced with the two figures that *are* sourced: the ICTY's
  "at least 700,000" departures, and the Kosovo Memory Book's 13,535 killed or
  disappeared.
- **Serbian MoD, "More than 70 new assets…" (2024)** from the economy source
  list. It sat in the old hand-written list with no figure citing it — a
  reference-list entry nothing referenced.

### Corrected

- **Đorđević.** The screen said he was sentenced to 27 years and that "the
  appeals chamber upheld the conviction in 2014". The Appeals Chamber upheld
  the *conviction* but **reduced the sentence to 18 years** on 27 January 2014
  — the ICTY's own case information sheet states "Appeals Chamber Judgement 27
  January 2014, sentence reduced to 18 years". The page was asserting the
  opposite of its own cited tribunal's record. Now: "27 vjet, ulur në 18 në
  apel".
- **The 700,000 figure** was described as people "forcibly expelled". The ICTY
  sentence it comes from says their *departure* was caused by the forces'
  deliberate actions. The stronger verb is gone; the ICTY's own wording is in.
- **`overallFigures.killed`** was `null` with a note saying no figure could be
  sourced. One can: the Kosovo Memory Book. It is now stated the way the source
  states it — 13,535 killed or disappeared, 1 Jan 1998 – 31 Dec 2000, of whom
  10,812 Albanians, 2,197 Serbs and 526 others. All the dead, because that is
  what the source counts.
- **Đakovica / Gjakovë added.** It is named as a murder locality in the appeal
  judgement and carries two named-victim schedules in the 1999 indictment, and
  had simply been missing from the list.

### Not citable — flagged for the owner, not silently changed

The `financimi-860` screen, which is the owner's own text, calls Serbia a
*"shtet gjenocidal"*. **No court has made that finding about Kosovo.** The ICTY
convicted for crimes against humanity and war crimes, not genocide, and there
is no ICJ finding of genocide in Kosovo. It is a political characterisation,
not a citable fact, so no citation is attached to it and none was invented. The
screen now renders a visible *qëndrim* / "position" badge so a reader can tell
the argument from the court findings, and its factual premises (Serbian VAT
20%, profit tax 15%, 2024 military spending, arms-import rank) are cited to the
economic dossier. **The owner's call whether the phrase stays.**

### Link check, 2026-09-16

All 36 registry URLs were fetched. **All 36 returned HTTP 200. No dead
links.** One host, `airforce-technology.com`, is inconsistent to automated
clients — it answered 403 to `curl` and 200 to Node's `fetch` in the same
session — so it is marked `botBlocked` in the registry, which suppresses a
`--check-links` failure for it. The one claim resting on it (`arms-pantsir`)
was already flagged unverified and stays flagged.

Re-run the check any time:

```
node scripts/verify-citations.mjs --check-links
```

Two URL repairs were made along the way: the ICTY case information sheet moved
from `cis_milutinovic_al_en.pdf` (404 — the case was renamed after the
Milutinović acquittal) to `cis_sainovic_al_en.pdf`, and the OSCE report's
`www.osce.org/odihr/17772` now 301s to `odihr.osce.org/odihr/17772`, which is
what the registry carries.

---

<!-- GENERATED BELOW — node scripts/verify-citations.mjs --markdown -->

### Reference list (IEEE, citation order)

Generated by `node scripts/verify-citations.mjs --markdown`. 36 references; every one is cited on /pse and every one resolves. Do not hand-edit below this point.

1. Accordance with International Law of the Unilateral Declaration of Independence in Respect of Kosovo, General List No. 141, Advisory Opinion, International Court of Justice, 22 July 2010. [Online]. Available: <https://www.icj-cij.org/case/141> [Accessed: 16-Sep-2026]
2. National Assembly of the Republic of Serbia, "Constitution of the Republic of Serbia," Preamble, 2006. [Online]. Available: <https://www.constituteproject.org/constitution/Serbia_2006.pdf?lang=en> [Accessed: 16-Sep-2026]
3. Prosecutor v. Milutinović et al., Case No. IT-05-87-T, Trial Judgement, ICTY, 26 February 2009. [Online]. Available: <https://www.icty.org/en/press/five-senior-serb-officials-convicted-kosovo-crimes-one-acquitted> [Accessed: 16-Sep-2026]
4. Prosecutor v. Šainović et al., Case No. IT-05-87-A, Appeal Judgement, ICTY, 23 January 2014. [Online]. Available: <https://www.icty.org/en/press/convictions-kosovo-crimes-upheld-four-senior-serbian-officials> [Accessed: 16-Sep-2026]
5. Humanitarian Law Center, "31,600 documents undoubtedly confirm death or disappearance of 13,535 individuals during war in Kosovo," Humanitarian Law Center (Kosovo Memory Book), Belgrade, Serbia, 6 February 2015. [Online]. Available: <https://www.hlc-rdc.org/en/dokumentovanje-i-pamcenje-2/31600-documents-undoubtedly-confirm-death-or-disappearance-of-13535-individuals-during-war-in-kosovo/> [Accessed: 16-Sep-2026]
6. OSCE Office for Democratic Institutions and Human Rights, "Human Rights in Kosovo: As Seen, As Told. Volume I, October 1998 – June 1999," Organization for Security and Co-operation in Europe, Warsaw, Poland, 5 November 1999. [Online]. Available: <https://odihr.osce.org/odihr/17772> [Accessed: 16-Sep-2026]
7. Prosecutor v. Milošević, Milutinović, Šainović, Ojdanić and Stojiljković, Case No. IT-99-37, Indictment (confirmed 24 May 1999), ICTY, 24 May 1999. [Online]. Available: <https://www.icty.org/x/cases/slobodan_milosevic/ind/en/mil-ii990524e.htm> [Accessed: 16-Sep-2026]
8. Human Rights Watch, "Under Orders: War Crimes in Kosovo," Human Rights Watch, New York, NY, USA, 2001. [Online]. Available: <https://www.hrw.org/reports/2001/kosovo/> [Accessed: 16-Sep-2026]
9. Humanitarian Law Center, "Saša Cvjetan, convicted for murder of women and children in Podujevo, set free before sentence expires," Humanitarian Law Center, Belgrade, Serbia, 25 April 2018. [Online]. Available: <https://www.hlc-rdc.org/en/public-information/press-releases-informisanje/sasa-cvjetan-convicted-for-murder-of-women-and-children-in-podujevo-set-free-before-sentence-expires/> [Accessed: 16-Sep-2026]
10. Humanitarian Law Center, "Too little, too late: After 14 years, the first-instance verdict was pronounced for crimes in the Kosovo villages of Ćuška, Ljubenić, Pavljan and Zahać," Humanitarian Law Center, Belgrade, Serbia, 26 April 2024. [Online]. Available: <https://www.hlc-rdc.org/en/public-information/press-releases-informisanje/too-little-too-late-after-14-years-the-first-instance-verdict-was-pronounced-for-crimes-in-the-kosovo-villages-of-cuska-ljubenic-pavljan-and-zahac/> [Accessed: 16-Sep-2026]
11. Tax Administration of the Republic of Serbia (Poreska uprava / PURS), "Zakon o porezu na dodatu vrednost (Law on Value Added Tax)," Article 23 — VAT rates, 2026. [Online]. Available: <https://www.purs.gov.rs/lat/fizicka-lica/pdv/opste-o-pdvu.html> [Accessed: 16-Sep-2026]
12. Tax Administration of the Republic of Serbia (Poreska uprava / PURS), "Zakon o porezu na dobit pravnih lica (Law on Corporate Income Tax)," Articles 39–40 — profit tax and withholding tax, 2025. [Online]. Available: <https://purs.gov.rs/upload/media/2025/2/4/417349/Zakonoporezunadobitpravnihlica.pdf> [Accessed: 16-Sep-2026]
13. World Bank (SIPRI indicator MS.MIL.XPND.CD / MS.MIL.XPND.GD.ZS), "Military expenditure (current USD and % of GDP), Serbia, 2015–2025," 2025. [Online]. Available: <https://api.worldbank.org/v2/country/SRB/indicator/MS.MIL.XPND.CD?format=json&date=2015:2025> [Accessed: 16-Sep-2026]
14. Stockholm International Peace Research Institute (SIPRI), "Trends in International Arms Transfers, 2024," SIPRI, Solna, Sweden, SIPRI Fact Sheet, March 2025, 2025. [Online]. Available: <https://www.sipri.org/sites/default/files/2025-03/fs_2503_at_2024_0.pdf> [Accessed: 16-Sep-2026]
15. United Nations Security Council, "Resolution 827 (1993) — Establishment of the International Tribunal," 1993. [Online]. Available: <https://www.icty.org/en/about/tribunal/establishment> [Accessed: 16-Sep-2026]
16. Prosecutor v. Vlastimir Đorđević, Case No. IT-05-87/1-T, Trial Judgement, ICTY, 23 February 2011. [Online]. Available: <https://www.icty.org/en/press/vlastimir-%C4%91or%C4%91evi%C4%87-convicted-crimes-kosovo> [Accessed: 16-Sep-2026]
17. International Criminal Tribunal for the former Yugoslavia, "Case Information Sheet "Kosovo" (IT-05-87/1) Đorđević," ICTY Communications Service, The Hague, Netherlands, 2014. [Online]. Available: <https://www.icty.org/x/cases/djordjevic/cis/en/cis_djordjevic_en.pdf> [Accessed: 16-Sep-2026]
18. Kosovo Agency of Statistics (ASK), "ASKDATA, External trade, Yearly indicators — tab02.px "Export and Import by partner country, 2010–2025"," 2026. [Online]. Available: <https://askdata.rks-gov.net/pxweb/en/ASKdata/ASKdata__External%20trade__Yearly%20indicators/tab02.px/> [Accessed: 16-Sep-2026]
19. Kosovo Agency of Statistics (ASK), "Vjetari Statistikor i Republikës së Kosovës 2024 (Statistical Yearbook), TAB 18.5, 18.7, 18.8," Agjencia e Statistikave të Kosovës, Prishtina, Kosovo, 2024. [Online]. Available: <https://askapi.rks-gov.net/Custom/323bbe7d-f5d2-47ce-a814-8dc7299fa4e3.pdf> [Accessed: 16-Sep-2026]
20. Kosovo Agency of Statistics (ASK), "ASKDATA, External trade, Yearly indicators — tab08.px "Turnover of goods in Kosovo international trade, 2001–2025"," 2026. [Online]. Available: <https://askdata.rks-gov.net/pxweb/en/ASKdata/ASKdata__External%20trade__Yearly%20indicators/tab08.px/> [Accessed: 16-Sep-2026]
21. "Kosovo raises tariffs on Serbian and Bosnian goods to 100% (2018); Kosovo bans imports of goods from Serbia (2023); Kosovo lifts the import ban at Merdare (2024)," European Western Balkans, 8 October 2024. [Online]. Available: <https://europeanwesternbalkans.com/2024/10/08/kosovo-lifts-import-ban-on-serbian-goods-at-merdare-border-crossing/> [Accessed: 16-Sep-2026]
22. "Kosovo Lifts Tariffs On Serbian Goods," Radio Free Europe/Radio Liberty, 1 April 2020. [Online]. Available: <https://www.rferl.org/a/kosovo-lifts-serbia-tariffs-belgrade/30521305.html> [Accessed: 16-Sep-2026]
23. Trading Economics, "Serbia — Military Expenditure," 2025. [Online]. Available: <https://tradingeconomics.com/serbia/military-expenditure> [Accessed: 16-Sep-2026]
24. Stockholm International Peace Research Institute (SIPRI), "SIPRI Military Expenditure Database — Serbia series," 2024. [Online]. Available: <https://www.sipri.org/databases/milex> [Accessed: 16-Sep-2026]
25. "Serbia to spend nearly EUR740 million on new weapons," Janes, 2024. [Online]. Available: <https://www.janes.com/osint-insights/defence-news/land/serbia-to-spend-nearly-eur740-million-on-new-weapons> [Accessed: 16-Sep-2026]
26. "Serbia Deepens Military Ties With China Through Drones, Air Defense Systems," Radio Free Europe/Radio Liberty, 2026. [Online]. Available: <https://www.rferl.org/a/serbia-china-military-cooperation-drones-air-defense-security/33626646.html> [Accessed: 16-Sep-2026]
27. Ministry of Defence of the Republic of Serbia, "Serbian Armed Forces receive 30 T-72MS tanks and 30 BRDM-2MS armoured reconnaissance vehicles," Ministry of Defence of the Republic of Serbia, Belgrade, Serbia, 2021. [Online]. Available: <https://www.mod.gov.rs/eng/17414/vojska-srbije-jaca-za-30-tenkova-t-72ms-i-30-oklopno-izvidjackih-automobila-brdm-2ms-17414> [Accessed: 16-Sep-2026]
28. "Assessing Serbia's ground forces procurement efforts," European Security & Defence, September 2025. [Online]. Available: <https://euro-sd.com/2025/09/articles/armament/46589/assessing-serbias-ground-forces-procurement-efforts/> [Accessed: 16-Sep-2026]
29. Dassault Aviation, "Press kit — Serbia acquires 12 Rafale fighters," Dassault Aviation, Paris, France, 2024. [Online]. Available: <https://www.dassault-aviation.com/en/group/press/press-kits/serbia-acquires-12-rafale-fighters/> [Accessed: 16-Sep-2026]
30. "Macron Hails Fighter Jet Deal Signed By Serbia As Historically Significant," Radio Free Europe/Radio Liberty, 29 August 2024. [Online]. Available: <https://www.rferl.org/a/macron-vucic-rafale-novi-sad-artificial-intelligence/33098413.html> [Accessed: 16-Sep-2026]
31. Ministry of Defence of the Republic of Serbia, "MiG-29 — A guarantee of the sovereignty of our sky," Ministry of Defence of the Republic of Serbia, Belgrade, Serbia, 2020. [Online]. Available: <https://www.mod.gov.rs/eng/16455/mig-29-garancija-suvereniteta-naseg-neba-16455> [Accessed: 16-Sep-2026]
32. Airbus, "Republic of Serbia orders nine H145M," Airbus Helicopters, Marignane, France, 2016. [Online]. Available: <https://www.airbus.com/en/newsroom/press-releases/2016-12-republic-of-serbia-orders-nine-h145m> [Accessed: 16-Sep-2026]
33. "China delivers anti-aircraft missiles to Serbia," Defense News, 11 April 2022. [Online]. Available: <https://www.defensenews.com/land/2022/04/11/china-delivers-anti-aircraft-missiles-to-serbia/> [Accessed: 16-Sep-2026]
34. "Russia delivers Pantsir-S1 systems to Serbia," Airforce Technology, 2020. [Online]. Available: <https://www.airforce-technology.com/news/russia-pantsir-s1-systems-serbia/> [Accessed: 16-Sep-2026]
35. "Serbia revealed as buyer in Elbit's $1.63 billion arms deal," Calcalist (CTech), 2025. [Online]. Available: <https://www.calcalistech.com/ctechnews/article/5vr2ehayj> [Accessed: 16-Sep-2026]
36. Ministry of Finance of the Republic of Serbia, "Macroeconomic and fiscal data — Table 2 (Budget Revenues and Expenditures), Table 3 (Consolidated General Government)," 2026. [Online]. Available: <https://www.mfin.gov.rs/en/documents2-2/macroeconomic-and-fiscal-data2> [Accessed: 16-Sep-2026]

### Which claim cites which reference

| Claim | References |
| --- | --- |
| argument.js :: non-recognition | [1], [2] |
| argument.js :: war-crimes | [3], [4] |
| argument.js :: kosova-1998-1999 | [3], [5] |
| argument.js :: kosova-1998-1999 :: site "Račak" | [3], [6], [7] |
| argument.js :: kosova-1998-1999 :: site "Meja and Korenica" | [4] |
| argument.js :: kosova-1998-1999 :: site "Izbica" | [4], [7] |
| argument.js :: kosova-1998-1999 :: site "Bela Crkva" | [4], [7] |
| argument.js :: kosova-1998-1999 :: site "Velika Kruša" | [7], [8] |
| argument.js :: kosova-1998-1999 :: site "Mala Kruša" | [4], [8] |
| argument.js :: kosova-1998-1999 :: site "Suva Reka" | [3], [4] |
| argument.js :: kosova-1998-1999 :: site "Đakovica" | [4], [7] |
| argument.js :: kosova-1998-1999 :: site "Podujevo" | [9] |
| argument.js :: kosova-1998-1999 :: site "Ćuška" | [8], [10] |
| argument.js :: kosova-1998-1999 :: site "Poklek" | [6], [8] |
| argument.js :: kosova-1998-1999 :: overallFigures.displaced | [3] |
| argument.js :: kosova-1998-1999 :: overallFigures.killed | [5] |
| argument.js :: financimi-860 | [11]–[14] |
| argument.js :: icty-established | [15] |
| argument.js :: kosovo-displacement | [3] |
| argument.js :: serbia-constitution | [2] |
| argument.js :: dordevic | [16], [17] |
| serbiaEconomy.js :: TRADE_STATS :: trade-imports-2025 | [18] |
| serbiaEconomy.js :: TRADE_STATS :: trade-imports-2024 | [18] |
| serbiaEconomy.js :: TRADE_STATS :: trade-imports-2023 | [18] |
| serbiaEconomy.js :: TRADE_STATS :: trade-imports-2022 | [18] |
| serbiaEconomy.js :: TRADE_STATS :: trade-imports-2019 | [19] |
| serbiaEconomy.js :: TRADE_STATS :: trade-imports-2017 | [19] |
| serbiaEconomy.js :: TRADE_STATS :: trade-share-2025 | [20] |
| serbiaEconomy.js :: TRADE_STATS :: trade-share-2022 | [19] |
| serbiaEconomy.js :: TRADE_STATS :: trade-share-2017 | [19] |
| serbiaEconomy.js :: TRADE_STATS :: trade-exports-2025 | [18] |
| serbiaEconomy.js :: TRADE_STATS :: trade-balance-2025 | [18] |
| serbiaEconomy.js :: TRADE_STATS :: trade-measure-tariff | [21], [22] |
| serbiaEconomy.js :: TRADE_STATS :: trade-measure-ban | [21] |
| serbiaEconomy.js :: MILITARY_SPEND :: milex-2025-usd | [23], [24] |
| serbiaEconomy.js :: MILITARY_SPEND :: milex-2024-usd | [13], [24] |
| serbiaEconomy.js :: MILITARY_SPEND :: milex-2024-gdp | [13], [24] |
| serbiaEconomy.js :: MILITARY_SPEND :: milex-2023-usd | [13], [24] |
| serbiaEconomy.js :: MILITARY_SPEND :: milex-2022-usd | [13], [24] |
| serbiaEconomy.js :: MILITARY_SPEND :: milex-2021-usd | [13], [24] |
| serbiaEconomy.js :: MILITARY_SPEND :: procurement-2024 | [25] |
| serbiaEconomy.js :: MILITARY_SPEND :: arms-import-rank | [14] |
| serbiaEconomy.js :: MILITARY_SPEND :: china-share-of-serbia-imports | [26] |
| serbiaEconomy.js :: MILITARY_SPEND :: serbia-share-of-china-exports | [14] |
| serbiaEconomy.js :: MILITARY_SPEND :: russia-exports-to-europe | [14] |
| serbiaEconomy.js :: ARMS_ACQUISITIONS :: arms-t72b1ms | [27] |
| serbiaEconomy.js :: ARMS_ACQUISITIONS :: arms-brdm2ms | [27] |
| serbiaEconomy.js :: ARMS_ACQUISITIONS :: arms-m84as2 | [28] |
| serbiaEconomy.js :: ARMS_ACQUISITIONS :: arms-lazar3 | [28] |
| serbiaEconomy.js :: ARMS_ACQUISITIONS :: arms-milos | [28] |
| serbiaEconomy.js :: ARMS_ACQUISITIONS :: arms-m80ab1 | [25] |
| serbiaEconomy.js :: ARMS_ACQUISITIONS :: arms-nora | [25] |
| serbiaEconomy.js :: ARMS_ACQUISITIONS :: arms-rafale | [29], [30] |
| serbiaEconomy.js :: ARMS_ACQUISITIONS :: arms-mig29-russia | [31] |
| serbiaEconomy.js :: ARMS_ACQUISITIONS :: arms-mig29-belarus | [31] |
| serbiaEconomy.js :: ARMS_ACQUISITIONS :: arms-h145m | [32] |
| serbiaEconomy.js :: ARMS_ACQUISITIONS :: arms-fk3 | [26], [33] |
| serbiaEconomy.js :: ARMS_ACQUISITIONS :: arms-hq17ae | [26] |
| serbiaEconomy.js :: ARMS_ACQUISITIONS :: arms-pantsir | [34] |
| serbiaEconomy.js :: ARMS_ACQUISITIONS :: arms-ch92a | [26] |
| serbiaEconomy.js :: ARMS_ACQUISITIONS :: arms-ch95 | [26] |
| serbiaEconomy.js :: ARMS_ACQUISITIONS :: arms-elbit | [35] |
| serbiaEconomy.js :: TAX_STATS :: tax-vat-standard | [11] |
| serbiaEconomy.js :: TAX_STATS :: tax-vat-reduced | [11] |
| serbiaEconomy.js :: TAX_STATS :: tax-cit | [12] |
| serbiaEconomy.js :: TAX_STATS :: tax-wht-dividends | [12] |
| serbiaEconomy.js :: TAX_STATS :: tax-pit-wages | [11] |
| serbiaEconomy.js :: TAX_STATS :: tax-budget-revenue-2025 | [36] |
| serbiaEconomy.js :: TAX_STATS :: tax-gg-revenue-2025 | [36] |
| serbiaEconomy.js :: TAX_STATS :: tax-vat-revenue-2025 | [36] |
| serbiaEconomy.js :: TAX_STATS :: tax-vat-gdp-2025 | [36] |
| serbiaEconomy.js :: TAX_STATS :: tax-cit-revenue-2025 | [36] |
| serbiaEconomy.js :: TAX_STATS :: tax-vat-share-of-tax-revenue-2025 | [36] |
| serbiaEconomy.js :: TAX_IMPACT_DERIVED :: vat-on-one-purchase | [11] |
| serbiaEconomy.js :: TAX_IMPACT_DERIVED :: vat-reduced-rate | [11] |
| serbiaEconomy.js :: TAX_IMPACT_DERIVED :: scaled-upper-bound | [11], [18] |
| serbiaEconomy.js :: TAX_IMPACT_DERIVED :: profit-tax-refusal | [12] |

verify-citations: OK
  · 77 claims audited
  · 36 references, numbered 1–36
  · 17 sources in the legal record
  · 23 sources in the economic dossier

