// Every user-facing string lives here, in both languages. Albanian ("sq")
// is the default; English ("en") is secondary. Add a key to BOTH languages
// whenever you add a new string anywhere in the app.
//
// Poster type (Treatments A/B/C) renders visually UPPERCASE/lowercase per
// the design spec regardless of how it's typed here, and is always
// duplicated into a plain, full, readable aria-label on the screen's
// wrapper — see the `*Aria` keys below.
export const dictionary = {
  sq: {
    appName: "vendorja",

    // --- Owner-approved mottos (2026-09-11) — use these two, nothing else. ---
    mottoMain: "bleje tanen jo t'shkive!",
    mottoSecondary: "për një Kosovë pa produkte serbe",

    languageToggle: "English",
    navExplore: "eksploro",
    navManifesto: "pse",
    navHistory: "historiku",
    navBack: "kthehu",
    navPageResult: "rezultati",
    navPageScanner: "skano",
    backHome: "kthehu",
    close: "mbyll",
    footerNote: "vendorja identifikon vetëm ku është regjistruar barkodi, jo domosdoshmërisht origjinën e prodhimit. kontrollo gjithmonë etiketën fizike.",
    dataUnavailable: "të dhënat vendore nuk janë ngarkuar ende. disa veçori mund të mos punojnë plotësisht.",

    // --- GS1 FOOTNOTE (shown on result screens) ---
    gsFootnote: "prefiksi GS1 tregon vetëm ku u regjistrua barkodi, jo ku u prodhua produkti.",
    gsFootnoteMore: "pse?",

    // --- HOME --- (staggered sentence hard-wrapped into 4 lines exactly like
    // docs/vendorja-ui-reference.html, comma-leading line 2 included)
    homeStaggerLines: "bleje tanen, jo|t'shkive! skano produktin|para se ta vendosësh|në shportë.",
    homeTaglineAria: "bleje tanen, jo t'shkive! skano produktin para se ta vendosësh në shportë.",
    homeScanLabel: "skano",
    homeScanAria: "skano barkodin",
    homeSearchPlaceholder: "kërko produktin me emër",
    homeSearchSubmit: "kërko",
    homeCounterOne: "{count} produkt i skanuar",
    homeCounterOther: "{count} produkte të skanuara",
    homeCounterZero: "ende s'ke skanuar asnjë produkt",

    // --- SCANNER ---
    scannerTitle: "vendos barkodin brenda kornizës",
    scannerHint: "mbaje telefonin të qëndrueshëm, me dritë të mjaftueshme.",
    scannerCloseAria: "mbyll skanerin",
    scannerCloseLabel: "mbyll",
    scannerLogoAria: "vendorja",
    scannerStripHeadline: "drejtoje kamerën te barkodi",
    scannerStripSearchPlaceholder: "ose kërko me emër a barkod",
    noBarcodeYet: "ende s'po gjendet barkod — vazhdo së skanuari…",
    zxingLoading: "duke ngarkuar detektorin rezervë…",
    zxingLoadFailed: "detektori rezervë s'u ngarkua dot. përdor hyrjen dorazi më poshtë.",
    cameraPermissionDenied: "nuk u lejua përdorimi i kamerës. jepni leje te cilësimet e shfletuesit, ose shkruani barkodin dorazi.",
    cameraNotFound: "nuk u gjet asnjë kamerë në këtë pajisje. shkruani barkodin dorazi.",
    insecureContext: "kamera kërkon një lidhje të sigurt (HTTPS). hapeni faqen përmes HTTPS, ose shkruani barkodin dorazi.",
    cameraGenericError: "kamera nuk u hap dot. provoni sërish, ose shkruani barkodin dorazi.",
    switchToManual: "shkruaje dorazi",
    manualPlaceholder: "p.sh. 8600043000016",
    manualSubmit: "kërko",
    manualInvalid: "ky nuk duket si barkod i vlefshëm (duhen 8, 12 ose 13 shifra).",
    scannerDecoderNative: "detektor: kamerë (native)",
    scannerDecoderZxing: "detektor: ZXing (rezervë) — po punon",
    scannerDecoderStarting: "detektor: duke u nisur…",
    scannerDecoderFailedShort: "detektor: dështoi të ngarkohej",
    scannerTorchOn: "ndize dritën",
    scannerTorchOff: "fike dritën",
    scannerTimeoutHint: "ende s'po gjendet barkod. ndize dritën, afrohu më shumë, ose shkruaje dorazi më poshtë.",

    // --- FAILURE-STATE POSTER SCREENS (2026-09-11 requirement: every
    // failure gets a designed red/black/white screen, never a grey toast,
    // manual entry always reachable from each one) ---
    failPermissionWord: "s'lejohet kamera",
    failPermissionBody: "i ke mohuar leje kamerës. hape te cilësimet e shfletuesit dhe lejoje kamerën, ose shkruaj barkodin këtu poshtë.",
    failNotFoundWord: "s'ka kamerë",
    failNotFoundBody: "nuk u gjet asnjë kamerë në këtë pajisje. shkruaj barkodin këtu poshtë.",
    failInsecureWord: "kërkohet https",
    failInsecureBody: "kamera punon vetëm në një lidhje të sigurt (https). hape faqen përmes https, ose shkruaj barkodin këtu poshtë.",
    failDecoderWord: "s'u ngarkua detektori",
    failDecoderBody: "detektori rezervë (ZXing) s'u ngarkua nga interneti — kjo ndodh shpesh me sinjal të dobët. shkruaj barkodin këtu poshtë, ose provo përsëri kur të kesh internet më të mirë.",
    failGenericWord: "s'u hap kamera",
    failGenericBody: "diçka shkoi keq me kamerën. provo sërish, ose shkruaj barkodin këtu poshtë.",
    failRetry: "provo sërish",
    failManualLabel: "shkruaj barkodin",

    // Open Food Facts lookup failures — the verdict (above, on the same
    // screen) is ALREADY visible and never hidden by any of these.
    failOffNotFoundWord: "nuk e gjetëm",
    failOffNotFoundBody: "nuk e gjetëm këtë produkt në Open Food Facts, por regjistrimi i barkodit është i qartë nga vetë numri (lart).",
    failOffSubmitReview: "njofto për këtë produkt",
    failOffSubmitThanks: "faleminderit — u shënua për shqyrtim.",
    failOffSlowWord: "detajet po vonojnë",
    failOffSlowBody: "verdikti lart është i sigurt — vjen drejtpërdrejt nga vetë barkodi. detajet e produktit (emri, fotoja) s'u ngarkuan dot nga Open Food Facts. provo sërish pas pak.",

    // --- SCAN STORY: 1) VERDICT ---
    verdictStackWord: "jo e jona",
    originUnverified: "barkod i regjistruar në GS1 Serbi — mund të jetë nga Serbia, s'është konfirmuar",
    originVerifiedSerbia: "prodhuar në Serbi",
    originCorrectionNote: "kompania është e regjistruar në Serbi, por prodhimi është verifikuar në {country} — jo Serbi.",
    reportButton: "raporto",
    reportedThanks: "faleminderit, u raportua.",
    verdictScrollHint: "vazhdo ↓",
    verdictLoadingNote: "duke kërkuar detajet e produktit…",

    // --- PRODUCT PHOTO ---
    verdictPhotoLoading: "duke marrë foton…",
    verdictPhotoMissing: "pa foto",

    // --- PRODUCT SPECS (from Open Food Facts) ---
    specsTitle: "specifikat",
    specsFlavour: "shija / lloji",
    specsNetWeight: "pesha neto",
    specsServing: "një racion",
    specsIngredients: "përbërësit",
    specsAllergens: "alergenët",
    specsPackaging: "paketimi",
    specsNutriscore: "nutri-score",
    specsNova: "grupi NOVA",
    specsNutritionTitle: "vlerat ushqyese (për 100 g)",
    nutEnergyKj: "energji (kJ)",
    nutEnergyKcal: "energji (kcal)",
    nutFat: "yndyrna",
    nutSaturatedFat: "nga të cilat të ngopura",
    nutCarbohydrates: "karbohidrate",
    nutSugars: "nga të cilat sheqerna",
    nutFiber: "fibra",
    nutProteins: "proteina",
    nutSalt: "kripë",
    nutSodium: "natrium",
    specsUnavailable: "nuk kemi të dhëna nga Open Food Facts për këtë produkt, por vendikti mbetet i qartë.",

    // --- SCAN STORY: 3-5) THE ARGUMENT --- (label pattern + real content
    // comes from src/content/argument.js's ARGUMENT_SCREENS — this module
    // never invents facts, only labels/chrome around them)
    argumentLabel: "argumenti {i} / {n}",
    argumentSourceLabel: "burimi",
    argumentUnverifiedTag: "e paverifikuar",

    // --- SCAN STORY: 6) THE REMINDER --- (exact pairing from the reference)
    reminderWord: "kujto",
    reminderMotto: "bleje tanen jo t'shkive",

    // --- SCAN STORY: 7) THE SLOGAN ---
    sloganStackWord: "bleje tanen",
    sloganFinalLine: "jo t'shkive!",

    // --- SCAN STORY: 8) THE CHOICE (zgjedhja) ---
    altPagerLabel: "alternativa vendore · {i} / {n}",
    choiceCuratedHeading: "çift i raportuar",
    choiceFallbackHeading: "e njëjta kategori",
    choiceNoAlternatives: "nuk kemi ende alternativë të verifikuar për këtë kategori — nuk duam të sugjerojmë një markë të importuar si vendore vetëm për ta mbushur ekranin.",
    choiceFindStore: "ku ta gjej",
    choiceShare: "ndaje",
    choiceScanAnother: "skano një tjetër",
    choiceProducerFallback: "shembull vendor",
    packPhotoPlaceholder: "nuk ka foto ende",

    // --- BEST ALTERNATIVE (single best-matching replacement) ---
    bestAltTitle: "alternativa vendore",
    bestAltNone: "nuk kemi ende alternativë të verifikuar për këtë produkt në këtë kategori.",
    bestAltNoneWhy: "sugjerojmë zëvendësues vetëm në kategorinë e njëjtë — nuk do t'të ofrohemi një biskotkë në vend të vajit.",
    bestAltSameCategory: "e njëjta kategori: {category}",
    bestAltMore: "të gjitha alternativat më poshtë ↓",

    // --- RESULT (not from Serbia) ---
    resultCheckAria: "në rregull",
    resultVendoreWord: "vendore",
    resultNote: "nuk është regjistruar në GS1 Serbi",
    resultScanAnother: "skano tjetër",
    resultAriaPrefix: "vendore",
    verdictOtherNote: "ky barkod nuk është regjistruar në GS1 Serbi.",

    // --- RESULT: Foreign Country ---
    resultForeignWord: "i huaj",
    resultRegisteredNote: "barkod i regjistruar në GS1 {country} — tregon se ku është regjistruar zotëruesi i markës, jo domosdoshmërisht ku është prodhuar produkti",
    resultSeeLocalAnyway: "shiko alternativat vendore",

    // --- RESULT: Prefix Label ---
    prefixLabel: "prefiksi {prefix}",

    // --- NOT-A-COUNTRY RESULTS ---
    notCountryRestrictedWord: "barkod dyqani",
    notCountryRestrictedBody: "ky është barkod i brendshëm dyqani, p.sh. për peshën ose raftin. barkodi i vërtetë i prodhimit gjendet zakonisht më tutje në paketim.",
    notCountryCouponWord: "kupon",
    notCountryCouponBody: "ky nuk është barkodi i produktit — është kupon.",
    notCountryIsbnWord: "libër",
    notCountryIsbnBody: "ky është ISBN (barkodi i librit), jo barkodi i produktit.",
    notCountryIssnWord: "revistë",
    notCountryIssnBody: "ky është ISSN (barkodi i revistës/shtypjes), jo barkodi i produktit.",
    notCountryRefundWord: "kuitancë kthimi",
    notCountryRefundBody: "ky nuk është barkodi i produktit — është kuitancë kthimi/rimbursi.",
    notCountryOfficeWord: "alokacioni administrativ",
    notCountryOfficeBody: "ky nuk është produkt — është alokacioni administrativ i GS1 (për zyra dhe struktura të brendshme).",
    notCountryUnassignedWord: "pa ndarje",
    notCountryUnassignedBody: "prefiksi është i vlefshëm, por GS1 s\'e ka ndarë ende asnjë produkti real këtu.",
    notCountryUnknownWord: "barkod i paqartë",
    notCountryUnknownBody: "ky duket si barkod, por s\'mund ta identifikojmë — provoje skanimin e ri, ose lexoje më qartë.",
    notCountryTryAnother: "provo barkodin tjetër në paketim",

    // --- ALL-ALTERNATIVES ROSTER ---
    allAltTitle: "të gjitha alternativat vendore",
    allAltCount: "{total} marka — {kosovo} nga Kosova, {albania} nga Shqipëria",
    allAltEmpty: "bazën e alternativave lokale ende nuk u ngarkua. u thuje aplikacionit të përpiqet përsëri.",
    allAltFoot: "këto janë markat që mund të dokumentojmë. lista nuk është përfundimtare dhe po zmadhohet.",
    allAltReplaces: "në vend të: {brands}",
    catalogSourced: "gjendet në katalogun e shitësve",

    // --- ALTERNATIVE / PRODUCER PAGE ---
    backToExplore: "kthehu te eksploro",
    producerCompanyLine: "prodhohet nga {company}",
    producerCountryLine: "{company} — {country}",
    shareButton: "ndaje",
    whyBoycottTitle: "këtë produkt duhet ta bojkotoni!",
    ownershipLabel: "kush e zotëron këtë kompani",
    alternativesTitle: "alternativa vendore",
    alternativesSubtitleSerbian: "meqë ky produkt është regjistruar në GS1 Serbi, ja disa alternativa nga Kosova/Shqipëria në të njëjtën kategori:",
    alternativesFallbackSubtitle: "nuk gjetëm çift të raportuar, por ja produkte vendore në të njëjtën kategori:",
    alternativesNoneAtAll: "nuk gjetëm ende asnjë alternativë vendore të verifikuar për këtë kategori.",
    loadingAlternatives: "duke kërkuar alternativa…",

    // --- BOYCOTT OVERRIDE ---
    boycottIssuerDiffers: "e regjistruar përmes GS1 {issuer}, por e zotëruar nga {company} — paratë shkojnë në Serbi.",

    nearbyTitle: "ku ta blesh afër",
    nearbyNoStores: "ende nuk kemi të dhëna se ku mund ta blesh këtë produkt afër teje.",

    // --- STORES (verified stock locations) ---
    storesStockingTitle: "ku gjendet",
    storesChainCount: "{count} pika",
    storesNoneKnown: "nuk kemi të dhëna të verifikuara për këtë produkt, kështu që nuk do të shfaqim dyqane që thjesht mund ta kenë.",
    storesShowAll: "shfaq të gjitha",
    storesShowLess: "mbyll",
    storesOpenMap: "hap në hartë",
    storesCall: "telefono",

    listedAtIntro: "ky produkt shitet te:",
    findNearMe: "gjej më afër meje",
    locating: "duke gjetur vendndodhjen…",
    geoPermissionDenied: "nuk u lejua përdorimi i vendndodhjes. dyqanet janë renditur pa distancë.",
    geoUnavailable: "vendndodhja nuk është e disponueshme në këtë pajisje/shfletues.",
    geoTimeout: "kërkimi i vendndodhjes zgjati shumë. provo sërish.",
    openInMaps: "hap në Maps",
    viewOnStoreSite: "shiko te dyqani online",
    honestyExplainerTitle: "çfarë do të thotë kjo — dhe çfarë jo",
    honestyExplainerBody: "prefiksi GS1 tregon vetëm te cila organizatë është regjistruar kompania që zotëron barkodin — jo domosdoshmërisht ku është prodhuar produkti. origjina e vërtetë e prodhimit gjendet te etiketa \"prodhuar në\" e produktit fizik.",
    issuedBy: "prefiksi {prefix} është regjistruar te GS1 {country}",
    unknownProductName: "produkt pa emër",
    unknownBrand: "markë e panjohur",
    badgeVendore: "vendore",
    badgeKosovar: "vendore",
    badgeShqiptar: "shqiptare",
    // The THIRD state. An alternative with no proven producer is on the
    // shelf in Kosovo and nothing more — say that, and show no flag.
    badgeSoldInKosovo: "në shitje në Kosovë",
    badgeSoldInKosovoFull: "gjendet në shitje në Kosovë — nuk kemi dëshmi se prodhuesi është vendor",
    badgeLive: "kërkim live",
    sourceLink: "burimi",
    reportedPairing: "çift i raportuar",
    categoryMatchNotice: "e njëjta kategori — jo domosdoshmërisht çift i verifikuar",
    quantityLabel: "sasia",
    codeLabel: "barkodi",

    // --- ASGJË E PADOKUMENTUAR (pronari, 2026-09-16) ---
    // "leave nothing undocumented like a random product without a history
    // name or grams or price". Këto vargje ekzistojnë që asnjë fushë të mos
    // dalë bosh: nëse s'e dimë, e themi me fjalë.
    sizeUnknown: "sasia e panjohur",
    priceUnknown: "çmimi i panjohur",
    soldByWeight: "shitet me kilogram",
    soldByWeightNote: "mall i lirshëm — çmimi sipas peshës, s'ka sasi të paketuar",
    piecesLabel: "{count} copë",
    sizeFromName: "sasia e lexuar nga emri i produktit",
    noLocalAlternativeTitle: "nuk u gjet alternativë vendore",
    noLocalAlternativeForeign: "për këtë produkt nuk kemi ende një alternativë vendore të verifikuar në të njëjtën kategori. kjo është përgjigjja e ndershme — nuk të sugjerojmë diçka tjetër vetëm sa për të mbushur vendin.",
    noLocalAlternativeUnknownProduct: "pa e ditur se çfarë produkti është ky numër, nuk mund të kërkojmë alternativë vendore në të njëjtën kategori.",
    localAlternativeTitle: "alternativa vendore",
    productUnidentified: "nuk e gjetëm këtë produkt të saktë, por regjistrimi i barkodit është i qartë nga vetë numri.",
    categoryPickerPrompt: "zgjidh kategorinë e produktit për të parë alternativa vendore:",

    // --- EXPLORE ---
    exploreTitle: "eksploro",
    exploreTagline: "produkte nga supermarketet e Kosovës — çka është, çka alternativa, ku ta blesh afër.",
    exploreSearchPlaceholder: "kërko produkt ose markë…",
    exploreCategoryAll: "të gjitha",
    historyTotalScans: 'skanime',
    historyTotalProducts: 'produkte të ndryshme',
    historyUnaccounted: 'skanime më të vjetra pa të dhëna të ruajtura',
    flagSerbia: 'Serbi',
    homeAlternativaCta: 'shiko alternativat!',
    proposeLeadBetter: 'a e dish një zëvendësim edhe më të përafërt?',
    proposeOpenBetter: 'propozo një më të mirë',
    historySeedCta: 'mbushe me shembuj nga katalogu',
    exploreVendoreHeading: 'vendore',
    exploreEmpty: "nuk u gjet asnjë produkt për këtë kërkim/kategori.",
    exploreShowMore: "shfaq më shumë",
    exploreFlaggedBadge: "gs1 serbi",
    exploreLoading: "duke ngarkuar produktet…",
    exploreRetailLoading: "katalogu po ngarkohet ende — po shfaqim ndërkohë bazën ekzistuese.",

    // --- MANIFESTO ---
    manifestoTitle: "pse",
    // IEEE referencing (owner, 2026-09-16: "all must have links and IEEE
    // referencing"). "burimet" became "referencat" because the block is now
    // a numbered IEEE reference list, not a loose list of links.
    manifestoSourcesHeading: "referencat",
    manifestoSourcesEmpty: "burimet shtohen ndërkohë që raportohen produktet.",
    manifestoRecordHeading: "regjistri ligjor",
    manifestoSourcesLead:
      "Çdo pohim në këtë faqe mban një numër në kllapa që të çon te dokumenti përkatës më poshtë. Referencat janë të numëruara sipas radhës së citimit, sipas stilit IEEE. Çdo zë ka një lidhje që funksionon.",
    manifestoSourcesAvailable: "E qasshme",
    manifestoSourcesAccessed: "Qasur më",
    citationRefLabel: "referenca",
    argumentPositionTag: "qëndrim",
    manifestoBack: "kthehu",

    // --- SHARE CARD ---
    shareTitle: "ndaje",
    shareDownload: "shkarko",
    shareNative: "ndaje",
    shareClose: "mbyll",
    shareGenerating: "duke krijuar kartelën…",
    shareCardAlt: "kartelë për ndarje",

    // --- HISTORY ---
    historyTitle: "skanimet e fundit",
    historyEmpty: "ende s'keni skanuar asnjë produkt.",
    historyEmptyHint: "skano barkodin e parë dhe do ta shohësh këtu — bashkë me vendimin dhe alternativën vendore.",
    historyEmptyCta: "skano tani",
    historyClear: "pastro historikun",
    viewHistory: "historiku",

    // --- PUBLIC FEED (historiku i përbashkët) ---
    // Owner, 2026-09-14: "unë skanoj, ti skanon, ai skanon, ne të gjithë
    // skanojmë". Dy skeda në /historiku: skanimet e mia (vendore, private)
    // dhe skanimet e të gjithëve (publike, vetëm me pëlqim).
    historyTabMine: "të miat",
    historyTabEveryone: "të gjithëve",
    feedTitle: "çka skanoi populli",
    feedSubtitle: "unë skanoj, ti skanon, ai skanon — ne të gjithë skanojmë.",
    feedLoading: "duke ngarkuar skanimet…",
    feedEmpty: "ende askush s'ka ndarë asnjë skanim.",
    feedEmptyHint: "kjo listë mbushet vetëm me skanime të vërteta. asgjë këtu nuk është e trilluar.",
    feedUnavailable: "lista e përbashkët nuk arrihet tani.",
    feedUnavailableHint: "historiku yt në këtë pajisje punon normalisht — asgjë nuk humbet.",
    // Built-in shelf. It must never read as "50 people scanned these" —
    // nobody scanned them. It says what they are: real catalogue products,
    // a different fifty every day, until real scans replace them.
    feedBuiltinTitle: "50 produkte nga katalogu, të përditësuara çdo ditë",
    feedBuiltinHint:
      "këto nuk janë skanime të njerëzve — janë produkte të vërteta nga rafti, me barkodin, çmimin dhe verdiktin e tyre. lista ndërrohet çdo ditë. sapo të vijnë skanime të vërteta, ato e zënë vendin.",
    feedDisabled: "lista publike është e çkyçur për momentin.",
    feedDisabledHint: "historiku yt mbetet vetëm në këtë pajisje.",
    feedRetry: "provo përsëri",
    feedCount: "{count} skanime të ndara",
    feedRelativeNow: "tani",
    feedRelativeMin: "{n} min më parë",
    feedRelativeHour: "{n} orë më parë",
    feedRelativeDay: "{n} ditë më parë",

    // --- PËLQIMI (cookies) ---
    // Parazgjedhja është JO. Asgjë nuk publikohet pa u shtypur "po".
    // The owner's own sentence, 2026-09-16: "cookies always pre-ask ndaj
    // skanimet e mia me te tjeret per ta ndihmuar shoqerine! tick X".
    // His words, his voice — not rewritten into consultant Albanian.
    feedConsentTitle: "ndaj skanimet e mia me të tjerët për ta ndihmuar shoqërinë!",
    feedConsentAsk: "para se të dërgohet asgjë, vendos ti. asgjë nuk largohet nga kjo pajisje derisa të zgjedhësh.",
    // Banner face, 2026-09-16: the owner asked for short text, a "show
    // more", and PO as the red call to action. PO/JO are the visible
    // labels; feedConsentAccept/Decline stay as the buttons' aria-labels
    // and as the full-size wording on /historiku.
    feedConsentMore: "shfaq më shumë",
    feedConsentYesShort: "PO",
    feedConsentNoShort: "JO",
    // Matches api/feed.js toPublic() field for field — barkod, emër, markë,
    // verdikt, `at`, `by`. The earlier wording left out the timestamp and
    // the rotating id, i.e. it understated what is published.
    feedConsentBody: "po të pranosh, çdo produkt që skanon shkon në një listë publike që e sheh kushdo. publikohen: barkodi, emri i produktit, marka, vendimi (serbe / vendore / tjetër), ora e skanimit dhe një kod i shkurtër pa emër që ndërrohet çdo muaj.",
    feedConsentCookie: "në shfletuesin tënd ruajmë zgjedhjen tënde dhe një numër të rastësishëm pa emër — si cookie dhe si kopje në localStorage, po qe se cookie-t janë të bllokuara. asgjë tjetër.",
    // Do NOT overstate this. The IP *is* hashed into a rate-limit counter
    // that lives up to 48 h (api/feed.js handlePost), and the public `by`
    // hash does link one person's scans to each other within a month.
    feedConsentPrivacy: "s'publikojmë as emrin tënd, as adresën IP, as vendndodhjen, as pajisjen. adresa IP përdoret vetëm e koduar, si numërues kundër spamit, dhe skadon vetë brenda dy ditësh. e vetmja lidhje që mbetet: skanimet e tua brenda të njëjtit muaj mbajnë të njëjtin kod, prandaj mund të shihen si një grup.",
    feedConsentAccept: "po, ndaji skanimet e mia",
    feedConsentDecline: "jo, mbaji vetëm për mua",
    feedConsentNote: "mund ta ndryshosh kurdo te historiku, dhe mund t'i fshish kontributet e tua. nëse thua jo, nuk dërgohet asgjë — historiku yt punon vetëm në këtë pajisje.",
    feedConsentOnTitle: "po i ndan skanimet e tua",
    feedConsentOnBody: "skanimet e tua të reja shfaqen në listën publike më poshtë.",
    feedConsentWithdraw: "ndalo ndarjen",
    feedConsentDelete: "fshij kontributet e mia",
    feedConsentDeleting: "duke fshirë…",
    feedConsentDeleted: "u fshinë {count} skanime nga lista publike.",
    feedConsentDeleteNone: "s'ke asnjë skanim në listën publike.",
    feedConsentDeleteFailed: "s'u fshinë dot tani. provo më vonë.",
    feedConsentOffTitle: "skanimet e tua janë private",
    feedConsentOffBody: "s'po ndan asgjë. mund ta lexosh listën e të tjerëve pa dhënë asgjë.",
    feedConsentEnable: "ndaj skanimet e mia",

    // --- FLAG TONES / NJOHJA (owner, 2026-09-12) ---
    // A non-recogniser gets a GREY flag and this tag. A boycott target gets
    // a RED one. The two must never be confusable — they are different
    // claims of different strength.
    bojkoto: "BOJKOTO!",
    bleji: "bleje këtë",
    flagUnknownOrigin: "origjina e panjohur",
    flagNonRecogniser: "mos-njohës",
    flagNonRecogniserFull: "nuk e njeh pavarësinë e Kosovës",
    flagRecogniser: "e njeh Kosovën",
    flagBoycott: "mos e blej",

    // --- BARKODI, GJITHMONË (pronari, 2026-09-16: "show always barcode") ---
    barcodeLabel: "barkodi",
    barcodeNone: "pa barkod",
    barcodeNoneWhy: "pa barkod — origjina nuk mund të verifikohet nga numri",
    barcodeNoneNote:
      "Ky rresht nuk ka barkod, ndaj s'ka numër për ta kontrolluar me paketimin në dorë. Çdo gjykim për origjinën këtu është më i dobët se te një produkt me barkod.",
    barcodeCheckPack: "krahasoje me numrin në paketim",

    // --- ORIGJINË E NDARË: regjistrim ≠ prodhim ≠ pronësi ---
    originSplitBadge: "origjinë e ndarë",
    originRegisteredIn: "regjistruar: GS1 {country} (prefiksi {prefix})",
    originMadeIn: "prodhuar: {country}",
    originMadeInCity: "prodhuar: {city}, {country}",
    originOwnedBy: "pronësi: {owner}",
    originSplitExplain:
      "Prefiksi GS1 tregon zyrën ku u regjistrua numri, jo fabrikën. Për këtë produkt këto dy gjëra nuk përputhen, ndaj të dyja janë shkruar veç.",
    originSerbianOwned: "pronësi serbe",
    originSourceLink: "burimi",

    // --- /pse STATISTICS + COUNTRY CHECKLIST ---
    pseStatsTitle: "sa fiton Serbia",
    pseStatsTrade: "tregtia me Kosovën",
    pseStatsTax: "taksat e tyre",
    pseStatsMilitary: "shpenzimet ushtarake",
    pseStatsArms: "blerjet e armëve",
    pseStatsSource: "burimi",
    pseStatsUnverified: "e pakonfirmuar",
    pseStatsShowAll: "shfaq të gjitha shifrat",
    scannerAim: "vendos barkodin brenda kornizës",
    scannerShoot: "fotografo barkodin",
    scannerReading: "duke lexuar…",
    scannerMissed: "s'u lexua — afroje pak, mbaje qetë, provo prapë",
    scannerTypeInstead: "ose shkruaje numrin",
    pseStatsShowLess: "shfaq më pak",
    stanceTitle: "ky shtet dhe Kosova",
    stanceYes: "po",
    stanceNo: "jo",
    stanceUnknown: "e panjohur",
    stanceRecognises: "e njeh pavarësinë e Kosovës",
    stanceEu: "anëtar i BE-së",
    stanceNato: "anëtar i NATO-s",
    stanceBombed: "bombardimi i Beogradit 1999",
    stanceSanctioned: "zbatoi embargon e OKB-së ndaj RFJ-së",
    stanceDiplomatic: "marrëdhënie diplomatike me Kosovën",
    stanceSourceLink: "burimi",

    // --- Q&A SECTION ---
    faqTitle: "pyetje që i bën gjithkush",
    faqQ1: "Si mundet ndonjë mollë të ketë barkod?",
    faqA1: "Fruta dhe perime të lira të shitura sipas peshës nuk kanë barkod prodhimtari. Etiketa në raft ose stikerja që e printoi dyqani është kod PLU—në-dyqan, që i përket supermarketit, jo prodhimit, dhe nuk tregon origjinën.",
    faqQ2: "Prefiksi nuk është serb — pra produkti është i pastër?",
    faqA2: "Jo domosdoshmërisht. Një kompani serbe mund t'i regjistroj numrat përmes GS1-it të ndonjë vendi tjetër. Vendorja kontrollon edhe pronësinë e markës, jo vetëm prefiksin. Shembull: Chipsy 40g mban prefiks 387 (Bosnja) por është e Marbo Product / PepsiCo Serbia.",
    faqQ3: "860 do të thotë se produkti u prodhua në Serbi?",
    faqA3: "Jo. 860 do të thotë se barkodi u regjistrua në GS1 Serbi. Por—qëndrim i qartë i Vendorjës—produkti i regjistruar nën 860 vazhdon të gjeneron të ardhura dhe tatim për shtetin serb, kështu që është shënjestër bojkoti pavarësisht se ku ndodhet fabrika.",
    faqQ4: "Pse aplikacioni tregon flamurin atëherë?",
    faqA4: "Flamuri tregon organizatën GS1 që nxori numrin. Kur pronari i markës është diku tjetër, aplikacioni e thotë këtë në të njëjtën ekran.",
    faqQ5: "Ku është e vërteta origjina e produktit?",
    faqA5: "Në etiketën fizike, rreshti 'Prodhuar në'. Gjithmonë kontrollo paketimin.",
    faqQ6: "Çka nëse produkti nuk është në aplikacion?",
    faqA6: "Verdikti nga barkodi vazhdon të vlerë. Vetëm emri dhe fotoja e produktit vijnë nga baza e jashtme që nuk ka gjithçka, dhe mund t'i raportosh produktin që mungon.",

    // --- SHELF LABEL / PLU RESULT ---
    pluWord: "etiketë rafti",
    pluBody: "Ky është kod peshë/PLU vetjak i supermarketit për mallra të lirë; nuk identifikon prodhuesin as origjinën, kështu që nuk ka asgjë për të gjykuar. Kontrollo etiketën fizike për origjinën.",

    // --- BOYCOTT 860 FRAMING ---
    boycott860Word: "regjistruar në 860",
    boycott860Body: "Produkti i regjistruar nën 860 financon shtetin serb përmes tatimit dhe fitimit. Pavarësisht se ku u prodhua—paratë shkojnë në Beograd.",

    // --- /ALTERNATIVA (owner 2026-09-17: "another section. explicitly
    // called alternativa only serb products listed and alternative finding
    // for them ... always always X to X match 1:1 must be 100%"). The gate
    // is src/lib/exactMatch.js; these are only the words around it.
    navAlternativa: "alternativa",
    altTitle: "alternativa",
    altLede: "këtu janë vetëm produktet serbe — të gjetura nga prefiksi GS1 ose nga lista e bojkotit — dhe zëvendësimi i tyre i saktë vendor.",
    altRule: "vetëm përputhje 1:1. nëse s'kemi të njëjtin lloj produkti, nuk të ofrojmë diçka të afërt — të themi se s'kemi.",
    altTallyTotal: "produkte serbe",
    altTallyMatched: "me zëvendësim të saktë",
    altTallyGap: "raste të hapura",
    altFilterAll: "të gjitha",
    altFilterMatched: "me zëvendësim",
    altFilterGap: "raste të hapura",

    // --- RASTET E HAPURA (owner, 2026-09-18) ---
    // Një produkt serb pa zëvendësim të saktë s'është rrugë pa krye — është
    // punë e papërfunduar. Asnjë nga këto vargje s'premton ndjekje me
    // numër rasti a status: s'kemi ku t'i ruajmë (shih src/lib/openCases.js).
    altCasesTitle: "{n} raste të hapura",
    altCasesLede: "produkte serbe që i kemi në katalog dhe për të cilat ende s'kemi zëvendësim të saktë vendor. secili prej tyre është punë e papërfunduar, jo rrugë pa krye — mbyllet kur dikush na tregon produktin vendor që e zëvendëson.",
    altCasesKindKnown: "e dimë llojin, s'kemi produkt vendor në të",
    altCasesKindUnknown: "s'e përcaktojmë dot llojin e produktit",
    altCasesNote: "këto raste nuk i mbajmë të regjistruara me numër a status: lista rillogaritet çdo herë nga vetë të dhënat, dhe një rast zhduket vetvetiu kur zbrazëtira mbushet.",
    altCaseMarkKnown: "rast i hapur",
    altCaseMarkUnknown: "rast i hapur · lloj i papërcaktuar",
    altCaseCloseKnown: "e mbyll këtë rast kush na tregon një produkt kosovar a shqiptar të llojit: {v}. propozoje më poshtë — çdo propozim kalon nëpër verifikim njerëzor para se ta shohë dikush.",
    altCaseCloseUnknown: "e mbyll këtë rast kush na tregon çka është saktësisht ky produkt dhe cili produkt vendor e zëvendëson. propozoje më poshtë — çdo propozim kalon nëpër verifikim njerëzor.",
    altSearchPlaceholder: "kërko me emër ose markë",
    altAnswerLabel: "zëvendësim i saktë · {v}",
    altVendore: "vendore",
    altBrandLevel: "markë vendore",
    altEvidenceCurated: "çift i dokumentuar nga harta jonë e markave.",
    altEvidenceCatalog: "rresht i katalogut me isLocalBrand = true, i njëjti lloj produkti.",
    altEvidenceSource: "burimi",
    altPrice: "çmimi: {v}",
    altPriceUnknown: "çmimi: i panjohur",
    altBrand: "marka: {v}",
    altBrandUnknown: "marka: e panjohur",
    altCode: "barkodi: {v}",
    altCodeUnknown: "barkodi: i panjohur",
    altFamily: "lloji: {v}",
    altFamilyUnknown: "lloji: i papërcaktuar",
    altListings: "{n} listime në dyqane",
    altNoPhoto: "pa foto",
    altOpenProduct: "hap produktin",
    altUnknownName: "emri i panjohur",
    altWhyPrefix: "prefiks GS1 {prefix}",
    altWhyBoycott: "listë bojkoti: {brand}",
    altGapTitle: "ende s'ka zëvendësim të saktë",
    altGapBody: "nuk njohim ende asnjë produkt kosovar ose shqiptar të të njëjtit lloj. s'po të ofrojmë diçka të ngjashme — kjo do të ishte gënjeshtër.",
    altGapWhyNoStock: "asnjë produkt i provuar vendor në kategorinë: {v}",
    altGapWhyUndetermined: "s'e përcaktojmë dot me siguri llojin e këtij produkti, andaj s'mund të themi se çka e zëvendëson.",
    altNoProposeNoCode: "ky rresht s'ka barkod në katalog, andaj s'mund të propozohet alternativë nga këtu.",
    altShowMore: "shfaq më shumë ({n})",
    altEmpty: "asnjë produkt nuk përputhet me këtë filtër.",
    altLoading: "duke kontrolluar katalogun…",

    // --- PROPOSE AN ALTERNATIVE (owner 2026-09-17: "IF NO MATCH FOUND>
    // ... people can ... propose alternatives ... they will undergo a
    // vetting process"). Every success string has to say QUEUED, never
    // "added": nothing a person submits here reaches another shopper
    // before a human has vetted it. See src/components/ProposeAlternative.jsx.
    proposeLead: "s'kemi zëvendësim vendor për këtë produkt. a njeh ti një?",
    proposeOpen: "propozo një alternativë",
    proposeTitle: "propozo një alternativë",
    proposeIntro: "shkruaj çka e zëvendëson këtë produkt. propozimi nuk publikohet menjëherë — një person e shqyrton, e verifikon, dhe vetëm atëherë shfaqet.",
    proposeCodeLabel: "barkodi i alternativës",
    proposeCodePlaceholder: "p.sh. 3811234567890",
    proposeCodeHint: "kjo është e dhëna më e mirë: barkodin mund ta kontrollojmë vetë, emrin jo.",
    proposeBrandLabel: "marka",
    proposeBrandPlaceholder: "p.sh. Sempre",
    proposeNameLabel: "emri i produktit (opsional)",
    proposeNamePlaceholder: "p.sh. biskota me kakao 150g",
    proposeSeenLabel: "ku e pe (opsional)",
    proposeSeenPlaceholder: "p.sh. Viva Fresh, Prishtinë",
    proposeSeenHint: "ndihmon shqyrtuesin ta gjejë. por të shitet në Kosovë nuk do të thotë se e prodhon një markë kosovare — atë e verifikojmë veçmas.",
    proposeSubmit: "dërgo për shqyrtim",
    proposeSending: "duke dërguar…",
    proposeCancel: "anulo",
    proposeVettingNote: "ruhet vetëm ajo që shkruan më lart. asnjë adresë IP, asnjë vendndodhje e saktë, asnjë e dhënë kontakti.",
    proposeQueuedTitle: "e morëm — tani pret shqyrtimin",
    proposeQueuedBody: "propozimi yt nuk është publikuar. dikush do ta kontrollojë barkodin, markën dhe kategorinë, dhe vetëm nëse qëndron do të shfaqet si alternativë.",
    proposeError_no_product: "s'ka produkt për të cilin po propozohet kjo alternativë.",
    proposeError_bad_code: "ky s'është barkod i vlefshëm. një barkod ka 8, 12, 13 ose 14 shifra.",
    proposeError_nothing_named: "shkruaj së paku barkodin ose markën e alternativës.",
    proposeError_same_product: "ky është vetë produkti — nuk mund të jetë alternativë e vetvetes.",
    proposeError_same_brand: "kjo është e njëjta markë. alternativa duhet të jetë markë tjetër.",
    proposeError_alternative_serbian: "ky barkod është i regjistruar në 860 (GS1 Serbi) — pikërisht ajo që po kërkojmë ta shmangim.",
    proposeError_invalid: "propozimi s'u pranua kështu siç është. kontrollo fushat dhe provo sërish.",
    proposeError_unavailable: "s'po arrijmë ta dërgojmë tani. provo më vonë.",
    proposeError_store: "s'po arrijmë ta dërgojmë tani. provo më vonë.",
    proposeError_rate_limited: "shumë propozime brenda pak kohe. prit pak dhe provo sërish.",
    proposeError_queue_full: "radha e shqyrtimit është plot. provo sërish më vonë.",
    // Shown NEXT TO an accepted pairing, so a vetted community proposal is
    // never mistaken for a source-cited curated pairing.
    proposeOriginLabel: "propozuar nga një blerës, e shqyrtuar",
    proposeOriginNote: "nuk është çiftëzim i kuruar me burim — e propozoi një person dhe e miratoi një shqyrtues.",
    proposeMatch1to1: "zëvendësim 1:1",
    proposeMatchSimilar: "i ngjashëm, jo 1:1",
  },
  en: {
    appName: "vendorja",

    mottoMain: "bleje tanen jo t'shkive!",
    mottoSecondary: "për një Kosovë pa produkte serbe",

    languageToggle: "Shqip",
    navExplore: "explore",
    navManifesto: "why",
    navHistory: "history",
    navBack: "back",
    navPageResult: "result",
    navPageScanner: "scan",
    backHome: "back",
    close: "close",
    footerNote: "vendorja only identifies where a barcode was registered, not necessarily where the product was made. Always check the physical label.",
    dataUnavailable: "Local data hasn't loaded yet. Some features may not work fully.",

    // --- GS1 FOOTNOTE (shown on result screens) ---
    gsFootnote: "The GS1 prefix shows where the barcode was registered, not where it was made.",
    gsFootnoteMore: "why?",

    // --- HOME --- (English wrap is our own approximation of the reference's
    // hand-wrapped Albanian sample — same 4-line shape, comma-leading line 2)
    homeStaggerLines: "buy ours, not from|belgrade! scan the product|before you put it|in your basket.",
    homeTaglineAria: "buy ours, not from belgrade! scan the product before you put it in your basket.",
    homeScanLabel: "scan",
    homeScanAria: "scan a barcode",
    homeSearchPlaceholder: "search product by name",
    homeSearchSubmit: "search",
    homeCounterOne: "{count} product scanned",
    homeCounterOther: "{count} products scanned",
    homeCounterZero: "you haven't scanned anything yet",

    // --- SCANNER ---
    scannerTitle: "Line up the barcode inside the frame",
    scannerHint: "Hold the phone steady, with good light.",
    scannerCloseAria: "Close scanner",
    scannerCloseLabel: "close",
    scannerLogoAria: "vendorja",
    scannerStripHeadline: "point the camera at the barcode",
    scannerStripSearchPlaceholder: "or search by name or barcode",
    noBarcodeYet: "No barcode found yet — still scanning…",
    zxingLoading: "Loading the fallback scanner…",
    zxingLoadFailed: "The fallback scanner failed to load. Use manual entry below.",
    cameraPermissionDenied: "Camera access was denied. Allow it in your browser settings, or type the barcode manually.",
    cameraNotFound: "No camera was found on this device. Type the barcode manually.",
    insecureContext: "The camera requires a secure connection (HTTPS). Open this page over HTTPS, or type the barcode manually.",
    cameraGenericError: "The camera could not be opened. Try again, or type the barcode manually.",
    switchToManual: "Type it in instead",
    manualPlaceholder: "e.g. 8600043000016",
    manualSubmit: "Look up",
    manualInvalid: "That doesn't look like a valid barcode (needs 8, 12 or 13 digits).",
    scannerDecoderNative: "decoder: camera (native)",
    scannerDecoderZxing: "decoder: ZXing (fallback)",
    scannerDecoderStarting: "decoder: starting…",
    scannerDecoderFailedShort: "decoder: failed to load",
    scannerTorchOn: "Turn on flash",
    scannerTorchOff: "Turn off flash",
    scannerTimeoutHint: "Still no barcode found. Turn on the flash, get closer, or type it in below.",

    failPermissionWord: "camera blocked",
    failPermissionBody: "You denied camera access. Re-enable it in your browser settings, or type the barcode below.",
    failNotFoundWord: "no camera",
    failNotFoundBody: "No camera was found on this device. Type the barcode below.",
    failInsecureWord: "https required",
    failInsecureBody: "The camera only works over a secure connection (HTTPS). Open the page over HTTPS, or type the barcode below.",
    failDecoderWord: "decoder failed",
    failDecoderBody: "The fallback decoder (ZXing) failed to load — often a weak-signal problem. Type the barcode below, or try again with better internet.",
    failGenericWord: "camera failed",
    failGenericBody: "Something went wrong with the camera. Try again, or type the barcode below.",
    failRetry: "try again",
    failManualLabel: "type the barcode",

    failOffNotFoundWord: "not found",
    failOffNotFoundBody: "We couldn't find this product on Open Food Facts, but the barcode's registration is clear from the number itself (above).",
    failOffSubmitReview: "flag this product",
    failOffSubmitThanks: "Thanks — flagged for review.",
    failOffSlowWord: "details are slow",
    failOffSlowBody: "The verdict above is certain — it comes straight from the barcode itself. The product details (name, photo) failed to load from Open Food Facts. Try again shortly.",

    // --- SCAN STORY: 1) VERDICT ---
    verdictStackWord: "not ours",
    originUnverified: "barcode registered with GS1 Serbia — may be from Serbia, not confirmed",
    originVerifiedSerbia: "made in Serbia",
    originCorrectionNote: "The company is registered in Serbia, but production is verified in {country} — not Serbia.",
    reportButton: "report",
    reportedThanks: "Thanks, reported.",
    verdictScrollHint: "continue ↓",
    verdictLoadingNote: "Looking up product details…",

    // --- PRODUCT PHOTO ---
    verdictPhotoLoading: "loading photo…",
    verdictPhotoMissing: "no photo available",

    // --- PRODUCT SPECS (from Open Food Facts) ---
    specsTitle: "specifications",
    specsFlavour: "flavour / type",
    specsNetWeight: "net weight",
    specsServing: "serving size",
    specsIngredients: "ingredients",
    specsAllergens: "allergens",
    specsPackaging: "packaging",
    specsNutriscore: "nutri-score",
    specsNova: "NOVA group",
    specsNutritionTitle: "nutrition (per 100 g)",
    nutEnergyKj: "energy (kJ)",
    nutEnergyKcal: "energy (kcal)",
    nutFat: "fat",
    nutSaturatedFat: "of which saturates",
    nutCarbohydrates: "carbohydrate",
    nutSugars: "of which sugars",
    nutFiber: "fibre",
    nutProteins: "protein",
    nutSalt: "salt",
    nutSodium: "sodium",
    specsUnavailable: "Open Food Facts has no spec data for this barcode, but the verdict still stands.",

    // --- SCAN STORY: 3-5) THE ARGUMENT ---
    argumentLabel: "argument {i} / {n}",
    argumentSourceLabel: "source",
    argumentUnverifiedTag: "unverified",

    // --- SCAN STORY: 6) THE REMINDER ---
    reminderWord: "remember",
    reminderMotto: "buy ours not from belgrade",

    // --- SCAN STORY: 7) THE SLOGAN ---
    sloganStackWord: "buy ours",
    sloganFinalLine: "not from belgrade!",

    // --- SCAN STORY: 8) THE CHOICE ---
    altPagerLabel: "local alternative · {i} / {n}",
    choiceCuratedHeading: "reported pairing",
    choiceFallbackHeading: "same category",
    choiceNoAlternatives: "We haven't found a verified local alternative for this category yet — we'd rather say that than label an imported brand \"local\" just to fill the screen.",
    choiceFindStore: "find it nearby",
    choiceShare: "share",
    choiceScanAnother: "scan another",
    choiceProducerFallback: "local example",
    packPhotoPlaceholder: "no photo yet",

    // --- BEST ALTERNATIVE (single best-matching replacement) ---
    bestAltTitle: "the local alternative",
    bestAltNone: "we have no confirmed alternative in this exact product category yet.",
    bestAltNoneWhy: "we propose a replacement only in the same product category — we will not offer you a biscuit in place of an oil.",
    bestAltSameCategory: "same category: {category}",
    bestAltMore: "every alternative below ↓",

    // --- RESULT (not from Serbia) ---
    resultCheckAria: "all clear",
    resultVendoreWord: "local",
    resultNote: "not registered with GS1 Serbia",
    resultScanAnother: "scan another",
    resultAriaPrefix: "local",
    verdictOtherNote: "This barcode is not registered with GS1 Serbia.",

    // --- RESULT: Foreign Country ---
    resultForeignWord: "foreign",
    resultRegisteredNote: "barcode registered with GS1 {country} — this shows where the brand owner registered, not necessarily where the product was made",
    resultSeeLocalAnyway: "see local alternatives anyway",

    // --- RESULT: Prefix Label ---
    prefixLabel: "prefix {prefix}",

    // --- NOT-A-COUNTRY RESULTS ---
    notCountryRestrictedWord: "store barcode",
    notCountryRestrictedBody: "This is an internal store barcode — for example, a scale label or shelf tag. The real product barcode is usually elsewhere on the packaging.",
    notCountryCouponWord: "Coupon",
    notCountryCouponBody: "This is not a product barcode — it\'s a coupon.",
    notCountryIsbnWord: "Book",
    notCountryIsbnBody: "This is an ISBN (book barcode), not a product barcode.",
    notCountryIssnWord: "Magazine",
    notCountryIssnBody: "This is an ISSN (magazine/journal barcode), not a product barcode.",
    notCountryRefundWord: "Refund receipt",
    notCountryRefundBody: "This is not a product barcode — it\'s a refund/return receipt.",
    notCountryOfficeWord: "Administrative use",
    notCountryOfficeBody: "This is not a product — it\'s a GS1 Global Office allocation (for internal offices and structures).",
    notCountryUnassignedWord: "Unassigned prefix",
    notCountryUnassignedBody: "The prefix is valid, but GS1 hasn\'t allocated any real products to it yet.",
    notCountryUnknownWord: "Invalid barcode",
    notCountryUnknownBody: "This looks like a barcode, but we can\'t identify it. Try scanning again, or read it more clearly.",
    notCountryTryAnother: "try the other barcode on the packaging",

    // --- ALL-ALTERNATIVES ROSTER ---
    allAltTitle: "every local alternative",
    allAltCount: "{total} brands — {kosovo} from Kosovo, {albania} from Albania",
    allAltEmpty: "Local alternatives haven\'t loaded yet. Ask the app to try again.",
    allAltFoot: "These are brands we can document. The list is not exhaustive and is still growing.",
    allAltReplaces: "instead of: {brands}",
    catalogSourced: "found in a Kosovo retail catalogue",

    // --- ALTERNATIVE / PRODUCER PAGE ---
    backToExplore: "Back to explore",
    producerCompanyLine: "Made by {company}",
    producerCountryLine: "{company} — {country}",
    shareButton: "share",
    whyBoycottTitle: "boycott this product!",
    ownershipLabel: "who owns this company",
    alternativesTitle: "Local alternatives",
    alternativesSubtitleSerbian: "Since this product is registered with GS1 Serbia, here are some Kosovo/Albania alternatives in the same category:",
    alternativesFallbackSubtitle: "We didn't find a reported pairing, but here are local products in the same category:",
    alternativesNoneAtAll: "We haven't found a verified local alternative for this category yet.",
    loadingAlternatives: "Searching for alternatives…",

    // --- BOYCOTT OVERRIDE ---
    boycottIssuerDiffers: "registered through GS1 {issuer}, but owned by {company} — the money goes to Serbia.",

    nearbyTitle: "Where to buy nearby",
    nearbyNoStores: "We don't have store data for this product nearby yet.",

    // --- STORES (verified stock locations) ---
    storesStockingTitle: "where to find it",
    storesChainCount: "{count} locations",
    storesNoneKnown: "we have no confirmed stock data for this product, so we are not listing shops that merely might have it.",
    storesShowAll: "show all",
    storesShowLess: "collapse",
    storesOpenMap: "open in maps",
    storesCall: "call",

    listedAtIntro: "This product is sold at:",
    findNearMe: "Find nearest to me",
    locating: "Finding your location…",
    geoPermissionDenied: "Location access was denied. Stores are listed without distance.",
    geoUnavailable: "Location isn't available on this device/browser.",
    geoTimeout: "Finding your location took too long. Try again.",
    openInMaps: "Open in Maps",
    viewOnStoreSite: "View on store site",
    honestyExplainerTitle: "What this means — and what it doesn't",
    honestyExplainerBody: "A GS1 prefix only shows which organisation the barcode owner is registered with — not necessarily where the product was manufactured. The real place of manufacture is on the physical product's \"Made in\" label.",
    issuedBy: "Prefix {prefix} is registered with GS1 {country}",
    unknownProductName: "Unnamed product",
    unknownBrand: "Unknown brand",
    badgeVendore: "local",
    badgeKosovar: "local",
    badgeShqiptar: "Albanian",
    badgeSoldInKosovo: "on sale in Kosovo",
    badgeSoldInKosovoFull: "found on sale in Kosovo — we have no evidence that the producer is local",
    badgeLive: "live search",
    sourceLink: "Source",
    reportedPairing: "Reported pairing",
    categoryMatchNotice: "Same category — not necessarily a verified pairing",
    quantityLabel: "Quantity",
    codeLabel: "Barcode",

    // --- NOTHING UNDOCUMENTED (owner, 2026-09-16) ---
    sizeUnknown: "Size unknown",
    priceUnknown: "Price unknown",
    soldByWeight: "Sold by the kilo",
    soldByWeightNote: "Loose goods — priced by weight, there is no pack size",
    piecesLabel: "{count} pcs",
    sizeFromName: "Size read from the product name",
    noLocalAlternativeTitle: "No local alternative found",
    noLocalAlternativeForeign: "We have no verified local alternative in this product's category yet. That is the honest answer — we will not suggest something else just to fill the space.",
    noLocalAlternativeUnknownProduct: "Without knowing what product this number is, we cannot look for a local alternative in the same category.",
    localAlternativeTitle: "Local alternative",
    productUnidentified: "We couldn't find this exact product, but the barcode's registration is clear from the number itself.",
    categoryPickerPrompt: "Pick the product's category to see local alternatives:",

    // --- EXPLORE ---
    exploreTitle: "explore",
    exploreTagline: "Products from Kosovo supermarkets — what it is, what the alternative is, where to buy nearby.",
    exploreSearchPlaceholder: "Search a product or brand…",
    exploreCategoryAll: "All",
    historyTotalScans: 'scans',
    historyTotalProducts: 'distinct products',
    historyUnaccounted: 'older scans whose records were not kept',
    flagSerbia: 'Serbia',
    homeAlternativaCta: 'see the alternatives!',
    proposeLeadBetter: 'know an even closer replacement?',
    proposeOpenBetter: 'propose a better one',
    historySeedCta: 'fill with examples from the catalogue',
    exploreVendoreHeading: 'local',
    exploreEmpty: "No products matched that search/category.",
    exploreShowMore: "Show more",
    exploreFlaggedBadge: "GS1 Serbia",
    exploreLoading: "Loading products…",
    exploreRetailLoading: "The catalogue is still loading — showing the existing database in the meantime.",

    // --- MANIFESTO ---
    manifestoTitle: "why",
    manifestoSourcesHeading: "References",
    manifestoSourcesEmpty: "Sources are added as products get reported.",
    manifestoRecordHeading: "The legal record",
    manifestoSourcesLead:
      "Every claim on this page carries a bracketed number that links to its document below. References are numbered in order of citation, IEEE style. Every entry has a working link.",
    manifestoSourcesAvailable: "Available",
    manifestoSourcesAccessed: "Accessed",
    citationRefLabel: "reference",
    argumentPositionTag: "position",
    manifestoBack: "Back",

    // --- SHARE CARD ---
    shareTitle: "Share",
    shareDownload: "Download",
    shareNative: "Share",
    shareClose: "Close",
    shareGenerating: "Building the card…",
    shareCardAlt: "Share card",

    // --- HISTORY ---
    historyTitle: "Recent scans",
    historyEmpty: "You haven't scanned anything yet.",
    historyEmptyHint: "Scan your first barcode and it will appear here — with the verdict and the local alternative.",
    historyEmptyCta: "Scan now",
    historyClear: "Clear history",
    viewHistory: "History",

    // --- PUBLIC FEED ---
    historyTabMine: "Mine",
    historyTabEveryone: "Everyone",
    feedTitle: "What everyone scanned",
    feedSubtitle: "I scan, you scan, he scans — we all scan.",
    feedLoading: "Loading scans…",
    feedEmpty: "Nobody has shared a scan yet.",
    feedEmptyHint: "This list only ever fills with real scans. Nothing here is made up.",
    feedUnavailable: "The shared list can't be reached right now.",
    feedUnavailableHint: "Your own history on this device keeps working — nothing is lost.",
    feedBuiltinTitle: "50 products from the catalogue, refreshed daily",
    feedBuiltinHint:
      "These are not people's scans — they are real shelf products with their own barcode, price and verdict. The list changes every day, and real scans replace it as soon as there are any.",
    feedDisabled: "The public list is switched off for now.",
    feedDisabledHint: "Your history stays on this device only.",
    feedRetry: "Try again",
    feedCount: "{count} shared scans",
    feedRelativeNow: "just now",
    feedRelativeMin: "{n} min ago",
    feedRelativeHour: "{n} h ago",
    feedRelativeDay: "{n} d ago",

    // --- CONSENT (cookies) ---
    feedConsentTitle: "Share my scans with others, to help society!",
    feedConsentAsk: "Before anything is sent, you decide. Nothing leaves this device until you choose.",
    feedConsentMore: "show more",
    feedConsentYesShort: "YES",
    feedConsentNoShort: "NO",
    feedConsentBody: "If you accept, every product you scan goes into a public list anyone can read. What gets published: the barcode, the product name, the brand, the verdict (Serbian / local / other), the time of the scan, and a short nameless code that changes every month.",
    feedConsentCookie: "In your browser we keep your choice and one random, nameless number — as a cookie and as a localStorage copy in case cookies are blocked. Nothing else.",
    feedConsentPrivacy: "We publish no name, no IP address, no location, no device identifier. Your IP is used only in hashed form, as an anti-spam counter, and expires by itself within two days. The one link that remains: your scans inside the same month carry the same code, so they can be seen as a group.",
    feedConsentAccept: "Yes, share my scans",
    feedConsentDecline: "No, keep them to myself",
    feedConsentNote: "You can change this at any time in your history, and you can delete your contributions. If you say no, nothing is sent — your history works on this device only.",
    feedConsentOnTitle: "You're sharing your scans",
    feedConsentOnBody: "Your new scans show up in the public list below.",
    feedConsentWithdraw: "Stop sharing",
    feedConsentDelete: "Delete my contributions",
    feedConsentDeleting: "Deleting…",
    feedConsentDeleted: "Removed {count} scans from the public list.",
    feedConsentDeleteNone: "You have no scans in the public list.",
    feedConsentDeleteFailed: "Couldn't delete them right now. Try again later.",
    feedConsentOffTitle: "Your scans are private",
    feedConsentOffBody: "You're sharing nothing. You can still read everyone else's list without giving anything.",
    feedConsentEnable: "Share my scans",

    // --- FLAG TONES / RECOGNITION ---
    bojkoto: "BOYCOTT!",
    bleji: "buy this",
    flagUnknownOrigin: "origin unknown",
    flagNonRecogniser: "non-recogniser",
    flagNonRecogniserFull: "does not recognise Kosovo's independence",
    flagRecogniser: "recognises Kosovo",
    flagBoycott: "do not buy",

    // --- THE BARCODE, ALWAYS (owner, 2026-09-16: "show always barcode") ---
    barcodeLabel: "barcode",
    barcodeNone: "no barcode",
    barcodeNoneWhy: "no barcode — origin cannot be checked against the number",
    barcodeNoneNote:
      "This row carries no barcode, so there is no number to check against the pack in your hand. Any origin verdict here is weaker than one on a product that has a barcode.",
    barcodeCheckPack: "check this against the number on the pack",

    // --- SPLIT ORIGIN: registration ≠ manufacture ≠ ownership ---
    originSplitBadge: "split origin",
    originRegisteredIn: "registered: GS1 {country} (prefix {prefix})",
    originMadeIn: "made in: {country}",
    originMadeInCity: "made in: {city}, {country}",
    originOwnedBy: "owned by: {owner}",
    originSplitExplain:
      "A GS1 prefix names the office the number was registered with, not the factory. For this product those two are not the same country, so both are stated separately.",
    originSerbianOwned: "Serbian-owned",
    originSourceLink: "source",

    // --- /pse STATISTICS + COUNTRY CHECKLIST ---
    pseStatsTitle: "What Serbia earns",
    pseStatsTrade: "Trade with Kosovo",
    pseStatsTax: "Their taxes",
    pseStatsMilitary: "Military spending",
    pseStatsArms: "Arms purchases",
    pseStatsSource: "source",
    pseStatsUnverified: "unconfirmed",
    pseStatsShowAll: "show every figure",
    scannerAim: "put the barcode inside the frame",
    scannerShoot: "photograph the barcode",
    scannerReading: "reading…",
    scannerMissed: "couldn't read it — move closer, hold still, try again",
    scannerTypeInstead: "or type the number",
    pseStatsShowLess: "show fewer",
    stanceTitle: "This country and Kosovo",
    stanceYes: "yes",
    stanceNo: "no",
    stanceUnknown: "unknown",
    stanceRecognises: "recognises Kosovo's independence",
    stanceEu: "EU member",
    stanceNato: "NATO member",
    stanceBombed: "bombing of Belgrade 1999",
    stanceSanctioned: "implemented the UN embargo on the FRY",
    stanceDiplomatic: "diplomatic relations with Kosovo",
    stanceSourceLink: "source",

    // --- Q&A SECTION ---
    faqTitle: "questions everyone asks",
    faqQ1: "How does an apple have a barcode?",
    faqA1: "Loose fruit and vegetables sold by weight don't carry a manufacturer barcode. The label on the shelf or the sticker the till prints is a PLU code that belongs to the supermarket, not the producer, and it tells you nothing about origin.",
    faqQ2: "The prefix isn't Serbian — so is it clean?",
    faqA2: "Not necessarily. A Serbian company can register its numbers through another country's GS1 organisation. Vendorja checks the brand owner too, not just the prefix. Example: Chipsy 40g carries a 387 (Bosnia) prefix but is owned by Marbo Product / PepsiCo Serbia.",
    faqQ3: "Does 860 mean it was made in Serbia?",
    faqA3: "No. 860 means the barcode was registered with GS1 Serbia. But—Vendorja's clear position—a product registered under 860 still generates revenue and tax for the Serbian state, so it's a boycott target regardless of where the factory is.",
    faqQ4: "Why does the app show a flag then?",
    faqA4: "The flag shows the GS1 organisation that issued the number. When the brand owner is elsewhere, the app says so on the same screen.",
    faqQ5: "Where is the real country of origin?",
    faqA5: "On the physical label, the 'Made in' line. Always check the packaging.",
    faqQ6: "What if the product is not in the app?",
    faqA6: "The barcode verdict still stands. Only the product name and photo come from an external database that doesn't have everything. You can report a missing product.",

    // --- SHELF LABEL / PLU RESULT ---
    pluWord: "shelf label",
    pluBody: "This is a supermarket's own weight/PLU code for loose goods. It identifies no producer and no origin, so there's nothing to judge. Check the physical label for origin.",

    // --- BOYCOTT 860 FRAMING ---
    boycott860Word: "registered as 860",
    boycott860Body: "A product registered under 860 funds the Serbian state through tax and profit. No matter where it was made—the money goes to Belgrade.",

    // --- /ALTERNATIVA — see the note in the `sq` block above. ---
    navAlternativa: "alternativa",
    altTitle: "alternativa",
    altLede: "Serbian products only — found by GS1 prefix or by the boycott table — and their exact local replacement.",
    altRule: "1:1 matches only. If we do not have the same kind of product, we do not offer you something close — we say we do not have it.",
    altTallyTotal: "Serbian products",
    altTallyMatched: "with an exact match",
    altTallyGap: "open cases",
    altFilterAll: "all",
    altFilterMatched: "with a match",
    altFilterGap: "open cases",

    // --- OPEN CASES (owner, 2026-09-18) ---
    // A Serbian product with no exact replacement is not a dead end, it is
    // outstanding work. None of these strings promises a tracked case with
    // a number or a status: there is nowhere to keep one (see
    // src/lib/openCases.js).
    altCasesTitle: "{n} open cases",
    altCasesLede: "Serbian products we hold in the catalogue and still have no exact local replacement for. Each one is outstanding work rather than a dead end — it closes when somebody names the local product that replaces it.",
    altCasesKindKnown: "we know the kind, we have no local product in it",
    altCasesKindUnknown: "we cannot establish what the product is",
    altCasesNote: "These cases are not tracked with a number or a status: the list is recomputed from the data every time, and a case disappears by itself once the gap is filled.",
    altCaseMarkKnown: "open case",
    altCaseMarkUnknown: "open case · kind undetermined",
    altCaseCloseKnown: "This case closes when someone names a Kosovar or Albanian product of the kind: {v}. Propose one below — every proposal is checked by a human before anyone sees it.",
    altCaseCloseUnknown: "This case closes when someone tells us what this product actually is and which local product replaces it. Propose one below — every proposal is checked by a human.",
    altSearchPlaceholder: "search by name or brand",
    altAnswerLabel: "exact replacement · {v}",
    altVendore: "local",
    altBrandLevel: "local brand",
    altEvidenceCurated: "Documented pairing from our brand map.",
    altEvidenceCatalog: "Catalogue row with isLocalBrand = true, same kind of product.",
    altEvidenceSource: "source",
    altPrice: "price: {v}",
    altPriceUnknown: "price: unknown",
    altBrand: "brand: {v}",
    altBrandUnknown: "brand: unknown",
    altCode: "barcode: {v}",
    altCodeUnknown: "barcode: unknown",
    altFamily: "kind: {v}",
    altFamilyUnknown: "kind: undetermined",
    altListings: "{n} shop listings",
    altNoPhoto: "no photo",
    altOpenProduct: "open product",
    altUnknownName: "name unknown",
    altWhyPrefix: "GS1 prefix {prefix}",
    altWhyBoycott: "boycott table: {brand}",
    altGapTitle: "no exact match yet",
    altGapBody: "We do not yet know of any Kosovar or Albanian product of the same kind. We are not offering you something similar — that would be a lie.",
    altGapWhyNoStock: "no proven-local product in the category: {v}",
    altGapWhyUndetermined: "We cannot establish with confidence what kind of product this is, so we cannot say what replaces it.",
    altNoProposeNoCode: "This row carries no barcode in the catalogue, so an alternative cannot be proposed from here.",
    altShowMore: "show more ({n})",
    altEmpty: "No product matches this filter.",
    altLoading: "checking the catalogue…",

    // --- PROPOSE AN ALTERNATIVE — see the note in the `sq` block above. ---
    proposeLead: "We have no local replacement for this product. Do you know one?",
    proposeOpen: "Propose an alternative",
    proposeTitle: "Propose an alternative",
    proposeIntro: "Name what replaces this product. It is not published straight away — a person checks it, verifies it, and only then does it appear.",
    proposeCodeLabel: "alternative's barcode",
    proposeCodePlaceholder: "e.g. 3811234567890",
    proposeCodeHint: "This is the best thing to give us: we can check a barcode ourselves, we cannot check a name.",
    proposeBrandLabel: "brand",
    proposeBrandPlaceholder: "e.g. Sempre",
    proposeNameLabel: "product name (optional)",
    proposeNamePlaceholder: "e.g. cocoa biscuits 150g",
    proposeSeenLabel: "where you saw it (optional)",
    proposeSeenPlaceholder: "e.g. Viva Fresh, Prishtinë",
    proposeSeenHint: "Helps the reviewer find it. But sold in Kosovo is not made by a Kosovar brand — that is checked separately.",
    proposeSubmit: "Send for review",
    proposeSending: "Sending…",
    proposeCancel: "Cancel",
    proposeVettingNote: "Only what you typed above is stored. No IP address, no precise location, no contact details.",
    proposeQueuedTitle: "Got it — now it waits for review",
    proposeQueuedBody: "Your proposal is not published. Someone will check the barcode, the brand and the category, and it only appears as an alternative if it holds up.",
    proposeError_no_product: "There is no product this alternative would be for.",
    proposeError_bad_code: "That is not a valid barcode. A barcode has 8, 12, 13 or 14 digits.",
    proposeError_nothing_named: "Give us at least the barcode or the brand of the alternative.",
    proposeError_same_product: "That is the product itself — it cannot be its own alternative.",
    proposeError_same_brand: "That is the same brand. An alternative has to be a different one.",
    proposeError_alternative_serbian: "That barcode is registered under 860 (GS1 Serbia) — exactly what we are trying to avoid.",
    proposeError_invalid: "The proposal was not accepted as it stands. Check the fields and try again.",
    proposeError_unavailable: "We cannot send this right now. Try again later.",
    proposeError_store: "We cannot send this right now. Try again later.",
    proposeError_rate_limited: "Too many proposals in a short time. Wait a moment and try again.",
    proposeError_queue_full: "The review queue is full. Try again later.",
    proposeOriginLabel: "Proposed by a shopper, reviewed",
    proposeOriginNote: "Not a source-cited curated pairing — a person proposed it and a reviewer approved it.",
    proposeMatch1to1: "1:1 replacement",
    proposeMatchSimilar: "Similar, not 1:1",
  },
};

export function translate(lang, key, vars) {
  const table = dictionary[lang] || dictionary.sq;
  let str = table[key] ?? dictionary.sq[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replaceAll(`{${k}}`, v);
    }
  }
  return str;
}
