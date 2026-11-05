import {
  konecPomeru,
  vypovedniDoba,
  odstupne,
  nahradaUraz,
  podpora,
  kontrolniSeznam,
  formatDatum,
  denVTydnu,
  cislo,
} from './vypoved.js';

const $ = (sel) => document.querySelector(sel);
const kc = new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK', maximumFractionDigits: 0 });

const form = $('#formular');
const duvod = $('#duvod');
const volbaJiny = duvod.querySelector('option[value="jiny"]');
let rules = null;
let zadostUpravena = false;

function kdo() {
  return form.elements.kdo.value;
}

function denPo(iso) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function aktualizujPole() {
  const k = kdo();
  $('#pole-duvod').hidden = k === 'zamestnanec';
  $('#pole-konec-dohody').hidden = k !== 'dohoda';
  $('#pole-zkusebni').hidden = k === 'dohoda';
  $('#pole-pricina').hidden = k === 'zamestnanec' || duvod.value !== 'd';
  $('#pole-zvlast-hrube').hidden = k === 'zamestnanec' || duvod.value !== 'g';
  if (k === 'dohoda') {
    volbaJiny.hidden = false;
    volbaJiny.disabled = false;
    $('#napoveda-duvod').textContent = 'Uvádí-li dohoda organizační důvod (§ 52 a–c) nebo dosažení nejvyšší přípustné expozice (§ 52 e), náleží odstupné; u § 52 d) z důvodu pracovního úrazu či nemoci z povolání náleží jednorázová náhrada podle § 271ca.';
  } else {
    if (duvod.value === 'jiny') duvod.value = 'c';
    volbaJiny.hidden = true;
    volbaJiny.disabled = true;
    $('#napoveda-duvod').textContent = 'Důvod najdete přímo ve výpovědi.';
  }
  if (k === 'dohoda') form.elements.zkusebniDoba.checked = false;
  navrhniDatumZadosti();
}

function vstupy() {
  const k = kdo();
  return {
    doruceni: form.elements.doruceni.value,
    kdo: k,
    duvod: k === 'zamestnanec' ? undefined : duvod.value,
    zkusebniDoba: k !== 'dohoda' && form.elements.zkusebniDoba.checked,
    konecDohody: form.elements.konecDohody.value || undefined,
    pricinaUraz: k !== 'zamestnanec' && duvod.value === 'd' && form.elements.pricina.value === 'uraz',
    zvlastHrube: k !== 'zamestnanec' && duvod.value === 'g' && form.elements.zvlastHrube.checked,
  };
}

function navrhniDatumZadosti() {
  if (zadostUpravena || !rules) return;
  try {
    const konec = konecPomeru(vstupy(), rules);
    form.elements.datumZadosti.value = denPo(konec);
  } catch {
    /* nekompletní zadání – nic nenavrhujeme */
  }
}

function zobrazChyby(chyby) {
  const box = $('#chyby');
  box.replaceChildren(...chyby.map((t) => Object.assign(document.createElement('p'), { textContent: t })));
  box.hidden = chyby.length === 0;
}

function bunka(tag, text, cls) {
  const el = document.createElement(tag);
  el.textContent = text;
  if (cls) el.className = cls;
  return el;
}

function vykresliPodporu(p) {
  const tabulka = $('#podpora');
  const sNavrhem = Boolean(p.navrh);
  const hlavicka = document.createElement('tr');
  hlavicka.append(bunka('th', 'Měsíc'), bunka('th', sNavrhem ? 'Platný zákon' : 'Částka', 'cislo'));
  if (sNavrhem) hlavicka.append(bunka('th', 'Pokud projde návrh', 'cislo'));
  tabulka.tHead.replaceChildren(hlavicka);

  const castkaBunka = (m) => {
    const td = bunka('td', kc.format(m.castka) + (m.omezenoStropem ? ' *' : ''), 'cislo');
    td.append(bunka('span', `${m.procento} % výdělku`, 'sazba'));
    return td;
  };
  const radky = p.hlavni.mesice.map((m, i) => {
    const tr = document.createElement('tr');
    tr.append(bunka('td', `${m.poradi}.`), castkaBunka(m));
    if (sNavrhem) tr.append(castkaBunka(p.navrh.mesice[i]));
    return tr;
  });
  tabulka.tBodies[0].replaceChildren(...radky);

  const soucet = document.createElement('tr');
  soucet.append(bunka('th', 'Celkem'), bunka('td', kc.format(p.hlavni.celkem), 'cislo'));
  if (sNavrhem) soucet.append(bunka('td', kc.format(p.navrh.celkem), 'cislo'));
  tabulka.tFoot.replaceChildren(soucet);
}

function spocitej(e) {
  e.preventDefault();
  if (!rules) return;
  const v = vstupy();
  const delka = cislo(form.elements.delka.value);
  const vek = cislo(form.elements.vek.value);
  const hruby = cislo(form.elements.hruby.value);
  const cisty = cislo(form.elements.cisty.value);
  const datumZadosti = form.elements.datumZadosti.value;

  const chyby = [];
  if (!v.doruceni) chyby.push('Zadejte den doručení výpovědi.');
  if (v.kdo === 'dohoda' && !v.konecDohody) chyby.push('Zadejte sjednaný den skončení podle dohody.');
  if (Number.isNaN(delka)) chyby.push('Zadejte délku pracovního poměru v letech (např. 1,5).');
  else if (delka > 60) chyby.push('Délka pracovního poměru je nepravděpodobně vysoká – desetinnou část oddělte čárkou (např. 1,5).');
  if (Number.isNaN(vek) || !Number.isInteger(vek) || vek < 15 || vek > 100) chyby.push('Zadejte věk celým číslem (15–100).');
  if (Number.isNaN(hruby)) chyby.push('Zadejte průměrný hrubý výdělek v Kč.');
  if (Number.isNaN(cisty)) chyby.push('Zadejte průměrný čistý výdělek v Kč.');
  if (hruby < 1000 || cisty < 1000) chyby.push('Výdělek je podezřele nízký – zadejte měsíční částku v Kč, např. 40 000.');
  if (!datumZadosti) chyby.push('Zadejte den podání žádosti o podporu.');
  zobrazChyby(chyby);
  if (chyby.length) return;

  let konec, od, nahrada, p;
  try {
    konec = konecPomeru(v, rules);
    od = odstupne({ ...v, delkaLet: delka, prumernyHruby: hruby }, rules);
    nahrada = nahradaUraz({ ...v, prumernyHruby: hruby }, rules);
    p = podpora({ ...v, vek, cistyVydelek: cisty, datumZadosti }, rules);
  } catch (err) {
    zobrazChyby([err.message]);
    return;
  }

  // Konec
  $('#konec').textContent = formatDatum(konec);
  const mesice = vypovedniDoba(v, rules);
  let popis;
  if (v.zkusebniDoba) popis = 'Zrušení ve zkušební době: pracovní poměr končí dnem doručení, pokud v oznámení není uveden pozdější den.';
  else if (v.kdo === 'dohoda') popis = 'Dohoda: pracovní poměr končí sjednaným dnem, výpovědní doba neběží.';
  else popis = `Výpovědní doba ${mesice} ${mesice === 1 ? 'měsíc' : 'měsíce'}, začíná dnem doručení (${formatDatum(v.doruceni)}). Den v týdnu: ${denVTydnu(konec)}.`;
  $('#konec-popis').textContent = popis;

  // Odstupné
  $('#odstupne').textContent = kc.format(od.castka);
  $('#odstupne-popis').textContent = od.duvod + (od.castka > 0 ? ' Kolektivní smlouva může určit víc.' : '');
  $('#nahrada').hidden = nahrada.castka === 0;
  $('#nahrada').textContent = nahrada.castka > 0
    ? `Jednorázová náhrada podle § 271ca ZP: ${kc.format(nahrada.castka)} – ${nahrada.nasobek}× průměrný měsíční výdělek; není to odstupné.`
    : '';

  // Podpora
  $('#podpora-obal').hidden = p.vylouceno;
  const poznamky = [];
  if (p.vylouceno) {
    $('#podpora-popis').textContent = p.duvodVylouceni;
  } else {
    vykresliPodporu(p);
    $('#podpora-popis').textContent =
      `Žádost podaná ${formatDatum(datumZadosti)}: podpůrčí doba ${p.hlavni.podpurciDoba} měsíců, ` +
      `strop ${kc.format(p.hlavni.strop)} měsíčně. Počítáno z čistého výdělku ${kc.format(cisty)}.`;
    if (p.hlavni.mesice.some((m) => m.omezenoStropem) || p.navrh?.mesice.some((m) => m.omezenoStropem)) {
      poznamky.push('* Částka je omezena maximální měsíční výší podpory.');
    }
  }
  if (v.duvod === 'g' && !v.zvlastHrube && v.kdo !== 'zamestnanec' && !v.zkusebniDoba) {
    poznamky.push('Šlo-li o porušení povinností zvlášť hrubým způsobem, nárok na podporu nevzniká (§ 39 odst. 2 zákona o zaměstnanosti).');
  }
  if (p.hlavni?.predbezne) {
    poznamky.push(`Strop pro rok ${p.rok} ještě nebyl vyhlášen; použita částka ${kc.format(p.hlavni.strop)} (rok 2026). Skutečná částka se bude lišit.`);
  }
  if (p.navrh) {
    poznamky.push('Sloupec „Pokud projde návrh“ ukazuje vládní návrh (sněmovní tisk 300): 65/50/45 % a strop 0,6× průměrné mzdy (ilustračně na hodnotách 2026). Návrh zatím není zákon a může se změnit.');
  }
  if (p.mimoRozsah && !p.vylouceno) {
    poznamky.push(`Pro rok ${datumZadosti.slice(0, 4)} nejsou parametry k dispozici; použita pravidla pro rok ${p.rok}.`);
  }
  if (!p.vylouceno && (vek === 52 || vek === 57)) {
    poznamky.push(`Hraniční věk ${vek} let: počítáno s delší podpůrčí dobou (dosavadní praxe úřadu práce). Ověřte na úřadu práce.`);
  }
  if (v.kdo === 'zamestnavatel' && !v.zkusebniDoba) {
    poznamky.push('Pokud by výpovědní doba skončila v ochranné době (např. pracovní neschopnost, mateřská), pracovní poměr se prodlouží o zbytek výpovědní doby (§ 53 ZP) – neplatí pro všechny důvody (§ 54 ZP).');
  }
  poznamky.push('Podpora náleží, máte-li za poslední 2 roky alespoň 12 měsíců důchodového pojištění a nepobíráte starobní důchod (§ 39 odst. 1 ZoZ). Výpověď dohodou ani odstupné podporu nesnižují ani neodkládají; výjimkou je skončení pro zvlášť hrubé porušení povinností (§ 39 odst. 2 ZoZ).');
  $('#poznamky').replaceChildren(...poznamky.map((t) => bunka('li', t)));

  // Kontrolní seznam
  const ukoly = kontrolniSeznam({ konec }).filter((u) => u.id !== 'odstupne' || od.castka > 0);
  $('#ukoly').replaceChildren(...ukoly.map((u) => {
    const li = document.createElement('li');
    const hlava = document.createElement('div');
    hlava.className = 'ukol-hlava';
    hlava.append(bunka('strong', u.nazev));
    if (u.termin) hlava.append(bunka('span', `do ${formatDatum(u.termin)}`, 'termin'));
    li.append(hlava, bunka('p', u.popis));
    return li;
  }));

  $('#vysledek').hidden = false;
  $('#seznam').hidden = false;
  $('#vysledek').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function vykresliPaticku() {
  $('#overeno').textContent = formatDatum(rules.overeno);
  $('#zdroje').replaceChildren(...rules.zdroje.map((z) => {
    const li = document.createElement('li');
    const a = Object.assign(document.createElement('a'), { href: z.url, textContent: z.nazev, rel: 'noopener noreferrer' });
    li.append(a);
    return li;
  }));
}

async function start() {
  form.addEventListener('submit', spocitej);
  form.addEventListener('change', (e) => {
    if (e.target.name === 'datumZadosti') zadostUpravena = Boolean(e.target.value);
    else aktualizujPole();
  });
  $('#tisk').addEventListener('click', () => window.print());
  window.addEventListener('beforeprint', () => { $('.paticka details').open = true; });
  aktualizujPole();
  try {
    const res = await fetch('rules.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(res.statusText);
    rules = await res.json();
    vykresliPaticku();
    navrhniDatumZadosti();
  } catch {
    zobrazChyby(['Nepodařilo se načíst pravidla (rules.json). Otevřete stránku přes webový server, ne jako soubor.']);
  }
}

start();
