// Čisté výpočetní funkce: konec pracovního poměru, odstupné, podpora v nezaměstnanosti,
// kontrolní seznam. Žádný přístup k DOM, síti ani úložišti. Data jsou řetězce 'RRRR-MM-DD'.

const DUVODY = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

// --- Datum -------------------------------------------------------------------

function parse(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso));
  if (!m) throw new Error(`Neplatné datum: ${iso}`);
  const [r, mes, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(r, mes - 1, d));
  if (dt.getUTCFullYear() !== r || dt.getUTCMonth() !== mes - 1 || dt.getUTCDate() !== d) {
    throw new Error(`Neplatné datum: ${iso}`);
  }
  return dt;
}

function iso(dt) {
  return dt.toISOString().slice(0, 10);
}

function posunDny(isoDatum, dny) {
  const dt = parse(isoDatum);
  dt.setUTCDate(dt.getUTCDate() + dny);
  return iso(dt);
}

function dnyVMesici(rok, mesic0) {
  return new Date(Date.UTC(rok, mesic0 + 1, 0)).getUTCDate();
}

/**
 * Přičte n měsíců: konec připadá na den se stejným číslem, a když takový den
 * v cílovém měsíci není, na poslední den měsíce (§ 51 odst. 2 ZP).
 */
export function pricistMesice(isoDatum, n) {
  const dt = parse(isoDatum);
  const celkem = dt.getUTCMonth() + n;
  const rok = dt.getUTCFullYear() + Math.floor(celkem / 12);
  const mesic0 = ((celkem % 12) + 12) % 12;
  const den = Math.min(dt.getUTCDate(), dnyVMesici(rok, mesic0));
  return iso(new Date(Date.UTC(rok, mesic0, den)));
}

/** Formát pro zobrazení: '10. 9. 2026'. */
export function formatDatum(isoDatum) {
  const dt = parse(isoDatum);
  return `${dt.getUTCDate()}. ${dt.getUTCMonth() + 1}. ${dt.getUTCFullYear()}`;
}

/** Den v týdnu česky. */
export function denVTydnu(isoDatum) {
  return ['neděle', 'pondělí', 'úterý', 'středa', 'čtvrtek', 'pátek', 'sobota'][parse(isoDatum).getUTCDay()];
}

// --- Svátky a pracovní dny ---------------------------------------------------

function velikonocniNedele(rok) {
  // Anonymní gregoriánský algoritmus (Meeus/Jones/Butcher)
  const a = rok % 19;
  const b = Math.floor(rok / 100);
  const c = rok % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mesic = Math.floor((h + l - 7 * m + 114) / 31);
  const den = ((h + l - 7 * m + 114) % 31) + 1;
  return iso(new Date(Date.UTC(rok, mesic - 1, den)));
}

/** Státní svátky a ostatní svátky ČR (zákon č. 245/2000 Sb.) pro daný rok. */
export function svatky(rok) {
  const pevne = ['01-01', '05-01', '05-08', '07-05', '07-06', '09-28', '10-28', '11-17', '12-24', '12-25', '12-26']
    .map((md) => `${rok}-${md}`);
  const nedele = velikonocniNedele(rok);
  return new Set([...pevne, posunDny(nedele, -2), posunDny(nedele, 1)]);
}

export function jePracovniDen(isoDatum) {
  const den = parse(isoDatum).getUTCDay();
  if (den === 0 || den === 6) return false;
  return !svatky(Number(isoDatum.slice(0, 4))).has(isoDatum);
}

/** Datum n-tého pracovního dne po zadaném dni. */
export function pracovniDnyPo(isoDatum, n) {
  let d = isoDatum;
  let zbyva = n;
  while (zbyva > 0) {
    d = posunDny(d, 1);
    if (jePracovniDen(d)) zbyva -= 1;
  }
  return d;
}

// --- Vstupy ------------------------------------------------------------------

/**
 * Převod čísla zapsaného česky na Number. Mezery (i nezlomitelné) se ignorují, čárka je
 * desetinná. Tečka následovaná přesně třemi číslicemi (v řetězci bez čárky) je oddělovač
 * tisíců ('40.000' → 40000), jiná tečka je desetinná ('1.5' → 1.5). Neplatný vstup → NaN.
 */
export function cislo(hodnota) {
  let t = String(hodnota ?? '').replace(/\s/g, '');
  if (t === '') return NaN;
  if (!t.includes(',') && /^\d+(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  else t = t.replace(',', '.');
  return /^\d+(\.\d+)?$/.test(t) ? Number(t) : NaN;
}

// --- Výpovědní doba a konec PP -----------------------------------------------

function overDuvod(kdo, duvod) {
  if (kdo === 'zamestnavatel' && !DUVODY.includes(duvod)) {
    throw new Error('U výpovědi od zaměstnavatele je nutný důvod podle § 52 písm. a) až h).');
  }
}

/**
 * Délka výpovědní doby v měsících. 0 = bez výpovědní doby (zrušení ve zkušební době, dohoda).
 * @param {{kdo:'zamestnanec'|'zamestnavatel'|'dohoda', duvod?:string, zkusebniDoba?:boolean}} vstup
 */
export function vypovedniDoba({ kdo, duvod, zkusebniDoba = false }, rules) {
  if (zkusebniDoba || kdo === 'dohoda') return 0;
  const vd = rules.zakonikPrace.vypovedniDoba;
  if (kdo === 'zamestnanec') return vd.zakladniMesice;
  if (kdo === 'zamestnavatel') {
    overDuvod(kdo, duvod);
    return vd.kratsiDuvody.includes(duvod) ? vd.kratsiMesice : vd.zakladniMesice;
  }
  throw new Error(`Neznámá strana: ${kdo}`);
}

/**
 * Poslední den pracovního poměru. Neřeší prodloužení o ochrannou dobu (§ 53 ZP).
 */
export function konecPomeru({ doruceni, kdo, duvod, zkusebniDoba = false, konecDohody }, rules) {
  parse(doruceni);
  if (zkusebniDoba) return doruceni;
  if (kdo === 'dohoda') {
    if (!konecDohody) throw new Error('U dohody zadejte sjednaný den skončení.');
    parse(konecDohody);
    if (konecDohody < doruceni) throw new Error('Sjednaný den skončení nemůže být dřív než den uzavření dohody.');
    return konecDohody;
  }
  return pricistMesice(doruceni, vypovedniDoba({ kdo, duvod }, rules));
}

// --- Odstupné ----------------------------------------------------------------

/**
 * Zákonné minimum odstupného (§ 67 ZP).
 * @returns {{castka:number, nasobek:number, duvod:string}}
 */
export function odstupne({ kdo, duvod, zkusebniDoba = false, delkaLet, prumernyHruby }, rules) {
  const o = rules.zakonikPrace.odstupne;
  const nic = (text) => ({ castka: 0, nasobek: 0, duvod: text });
  if (!(prumernyHruby >= 0)) throw new Error('Průměrný hrubý výdělek musí být nezáporné číslo.');
  if (zkusebniDoba) return nic('Při zrušení ve zkušební době odstupné nenáleží.');
  if (kdo === 'zamestnanec') return nic('Při výpovědi ze strany zaměstnance odstupné nenáleží.');
  if (kdo !== 'zamestnavatel' && kdo !== 'dohoda') throw new Error(`Neznámá strana: ${kdo}`);
  if (duvod === o.duvodExpozice) {
    return {
      castka: o.nasobekExpozice * prumernyHruby,
      nasobek: o.nasobekExpozice,
      duvod: 'Dosažení nejvyšší přípustné expozice (§ 52 písm. e) – nejméně 12× průměrný výdělek (§ 67 odst. 3 ZP).',
    };
  }
  if (duvod === rules.zakonikPrace.nahrada271ca.duvod) {
    return nic('Zdravotní důvod (§ 52 písm. d) – zákonné odstupné nenáleží. Byl-li příčinou pracovní úraz, nemoc z povolání nebo její ohrožení, náleží jednorázová náhrada podle § 271ca ZP.');
  }
  if (!o.duvody.includes(duvod)) {
    return nic(kdo === 'dohoda'
      ? 'Dohoda z jiných než organizačních důvodů (§ 52 a–c) nebo z důvodu nejvyšší přípustné expozice (§ 52 e) – zákonné odstupné nenáleží.'
      : `Výpověď podle § 52 písm. ${duvod}) – zákonné odstupné nenáleží.`);
  }
  if (!(delkaLet >= 0)) throw new Error('Délka pracovního poměru musí být nezáporné číslo.');
  const pasmo = o.nasobky.find((p) => p.doLet === null || delkaLet < p.doLet);
  return {
    castka: pasmo.nasobek * prumernyHruby,
    nasobek: pasmo.nasobek,
    duvod: `Organizační důvod (§ 52 písm. ${duvod}) – ${pasmo.nasobek}× průměrný výdělek.`,
  };
}

/**
 * Jednorázová náhrada podle § 271ca odst. 1 ZP: 12× průměrný měsíční výdělek při skončení
 * pracovního poměru výpovědí nebo dohodou podle § 52 písm. d) z důvodu pracovního úrazu,
 * nemoci z povolání nebo ohrožení nemocí z povolání. Není to odstupné.
 * @param {{kdo:string, duvod?:string, pricinaUraz?:boolean, zkusebniDoba?:boolean, prumernyHruby:number}} vstup
 * @returns {{castka:number, nasobek:number, duvod:string}}
 */
export function nahradaUraz({ kdo, duvod, pricinaUraz = false, zkusebniDoba = false, prumernyHruby }, rules) {
  const n = rules.zakonikPrace.nahrada271ca;
  if (!(prumernyHruby >= 0)) throw new Error('Průměrný hrubý výdělek musí být nezáporné číslo.');
  if (zkusebniDoba || (kdo !== 'zamestnavatel' && kdo !== 'dohoda') || duvod !== n.duvod || !pricinaUraz) {
    return { castka: 0, nasobek: 0, duvod: 'Jednorázová náhrada podle § 271ca ZP nenáleží.' };
  }
  return {
    castka: n.nasobek * prumernyHruby,
    nasobek: n.nasobek,
    duvod: `Jednorázová náhrada podle § 271ca ZP – ${n.nasobek}× průměrný měsíční výdělek; není to odstupné.`,
  };
}

// --- Podpora v nezaměstnanosti -----------------------------------------------

/**
 * Vybere sadu parametrů podle roku podání žádosti. Pro pozdější roky než poslední
 * známý použije poslední známý a označí `mimoRozsah`.
 */
export function vyberPravidel(rules, datumZadosti) {
  const rok = parse(datumZadosti).getUTCFullYear();
  const roky = Object.keys(rules.podpora).filter((k) => /^\d{4}$/.test(k)).sort();
  if (rok < Number(roky[0])) {
    throw new Error(`Kalkulačka počítá žádosti podané od roku ${roky[0]}.`);
  }
  const klic = roky.includes(String(rok)) ? String(rok) : roky[roky.length - 1];
  const sada = rules.podpora[klic];
  return {
    rok: klic,
    sada,
    navrh: sada.navrh ? rules.podpora[sada.navrh] : null,
    mimoRozsah: klic !== String(rok),
  };
}

/** Podpora po měsících pro jednu sadu parametrů. */
export function vypocetPodpory(vek, cistyVydelek, sada) {
  if (!(Number.isFinite(vek) && vek >= 0)) throw new Error('Věk musí být nezáporné číslo.');
  if (!(Number.isFinite(cistyVydelek) && cistyVydelek >= 0)) throw new Error('Čistý výdělek musí být nezáporné číslo.');
  const pasmo = [...sada.pasma].sort((a, b) => b.odVeku - a.odVeku).find((p) => vek >= p.odVeku);
  const mesice = pasmo.faze.map((procento, i) => {
    const vypocet = Math.ceil(Math.round(cistyVydelek * procento) / 100);
    return {
      poradi: i + 1,
      procento,
      castka: Math.min(vypocet, sada.strop),
      omezenoStropem: vypocet > sada.strop,
    };
  });
  return {
    nazev: sada.nazev,
    podpurciDoba: pasmo.mesice,
    strop: sada.strop,
    predbezne: Boolean(sada.predbezne),
    jeNavrh: Boolean(sada.jeNavrh),
    mesice,
    celkem: mesice.reduce((s, m) => s + m.castka, 0),
  };
}

/**
 * Je nárok na podporu vyloučen způsobem skončení? (§ 39 odst. 2 ZoZ: skončení pro porušení
 * povinností zvlášť hrubým způsobem – § 52 písm. h) vždy, § 52 písm. g) jen ve variantě
 * zvlášť hrubého porušení.)
 * @returns {{vylouceno:boolean, duvod:string|null}}
 */
export function narokNaPodporu({ kdo, duvod, zkusebniDoba = false, zvlastHrube = false }, rules) {
  const v = rules.podpora.vylouceni;
  const kOddilu = (kdo === 'zamestnavatel' || kdo === 'dohoda') && !zkusebniDoba;
  const vylouceno = kOddilu && (v.vzdy.includes(duvod) || (Boolean(zvlastHrube) && v.zvlastHrube.includes(duvod)));
  return {
    vylouceno,
    duvod: vylouceno
      ? 'Při skončení pracovního poměru pro zvlášť hrubé porušení povinností v posledních 6 měsících nárok na podporu nevzniká (§ 39 odst. 2 zákona o zaměstnanosti). Ověřte na úřadu práce.'
      : null,
  };
}

/**
 * Podpora podle data podání žádosti. Věk = dovršený věk ke dni podání žádosti.
 * Při vyloučení nároku (§ 39 odst. 2 ZoZ) vrací `vylouceno: true` a žádné částky.
 * @returns {{rok:string, mimoRozsah:boolean, vylouceno:boolean, duvodVylouceni:string|null, hlavni:object|null, navrh:object|null}}
 */
export function podpora({ vek, cistyVydelek, datumZadosti, kdo, duvod, zkusebniDoba, zvlastHrube }, rules) {
  const v = vyberPravidel(rules, datumZadosti);
  const n = narokNaPodporu({ kdo, duvod, zkusebniDoba, zvlastHrube }, rules);
  if (n.vylouceno) {
    return { rok: v.rok, mimoRozsah: v.mimoRozsah, vylouceno: true, duvodVylouceni: n.duvod, hlavni: null, navrh: null };
  }
  return {
    rok: v.rok,
    mimoRozsah: v.mimoRozsah,
    vylouceno: false,
    duvodVylouceni: null,
    hlavni: vypocetPodpory(vek, cistyVydelek, v.sada),
    navrh: v.navrh ? vypocetPodpory(vek, cistyVydelek, v.navrh) : null,
  };
}

// --- Kontrolní seznam --------------------------------------------------------

/**
 * Úkoly při skončení pracovního poměru s termíny.
 * @param {{konec:string}} vstup poslední den pracovního poměru
 */
export function kontrolniSeznam({ konec }) {
  const denPo = posunDny(konec, 1);
  return [
    {
      id: 'zapoctovy-list',
      nazev: 'Převzít zápočtový list (potvrzení o zaměstnání)',
      termin: konec,
      popis: 'Zaměstnavatel ho musí vydat při skončení pracovního poměru (§ 313 ZP). Úřad práce ho bude chtít.',
    },
    {
      id: 'dovolena',
      nazev: 'Zkontrolovat proplacení nevyčerpané dovolené',
      termin: konec,
      popis: 'Za nevyčerpanou dovolenou náleží náhrada mzdy (§ 222 odst. 2 ZP), obvykle s poslední výplatou. Ověřte ji na výplatní pásce.',
    },
    {
      id: 'urad-prace',
      nazev: 'Registrovat se na úřadu práce a požádat o podporu',
      termin: pracovniDnyPo(konec, 3),
      popis: 'Požádáte-li o zprostředkování zaměstnání do 3 pracovních dnů po skončení, podpora náleží od dne následujícího po skončení pracovního poměru. Jinak až ode dne podání žádosti. Podmínka: alespoň 12 měsíců důchodového pojištění za poslední 2 roky.',
    },
    {
      id: 'zdravotni-pojistovna',
      nazev: 'Vyřešit zdravotní pojištění',
      termin: posunDny(denPo, 8),
      popis: 'Jste-li v evidenci úřadu práce, pojistné za vás platí stát. Pokud se neregistrujete a nemáte jiný příjem, oznamte pojišťovně do 8 dnů změnu a plaťte pojistné jako osoba bez zdanitelných příjmů. Ověřte u své pojišťovny.',
    },
    {
      id: 'odstupne',
      nazev: 'Zkontrolovat výplatu odstupného (pokud náleží)',
      termin: null,
      popis: 'Odstupné se vyplácí po skončení pracovního poměru v nejbližším výplatním termínu, pokud se nedohodnete jinak. Výplatu podpory neodkládá.',
    },
  ];
}
