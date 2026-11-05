import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  pricistMesice,
  vypovedniDoba,
  konecPomeru,
  odstupne,
  vyberPravidel,
  vypocetPodpory,
  podpora,
  pracovniDnyPo,
  kontrolniSeznam,
} from './vypoved.js';

const rules = JSON.parse(readFileSync(new URL('./rules.json', import.meta.url), 'utf8'));

// --- Konec pracovního poměru -------------------------------------------------

test('doručení 10. 7. 2026, 2 měsíce → konec 10. 9. 2026', () => {
  assert.equal(pricistMesice('2026-07-10', 2), '2026-09-10');
  assert.equal(
    konecPomeru({ doruceni: '2026-07-10', kdo: 'zamestnanec' }, rules),
    '2026-09-10',
  );
});

test('doručení 31. 12. 2026, 2 měsíce → konec 28. 2. 2027', () => {
  assert.equal(pricistMesice('2026-12-31', 2), '2027-02-28');
  assert.equal(
    konecPomeru({ doruceni: '2026-12-31', kdo: 'zamestnavatel', duvod: 'c' }, rules),
    '2027-02-28',
  );
});

test('konec v přestupném roce a na konci kratšího měsíce', () => {
  assert.equal(pricistMesice('2027-12-31', 2), '2028-02-29');
  assert.equal(pricistMesice('2026-01-31', 1), '2026-02-28');
  assert.equal(pricistMesice('2026-08-31', 1), '2026-09-30');
  assert.equal(pricistMesice('2026-11-15', 2), '2027-01-15');
});

test('výpověď podle § 52 písm. g) → výpovědní doba 1 měsíc', () => {
  assert.equal(vypovedniDoba({ kdo: 'zamestnavatel', duvod: 'g' }, rules), 1);
  assert.equal(
    konecPomeru({ doruceni: '2026-07-10', kdo: 'zamestnavatel', duvod: 'g' }, rules),
    '2026-08-10',
  );
});

test('§ 52 písm. f) a h) také 1 měsíc, ostatní důvody 2 měsíce', () => {
  assert.equal(vypovedniDoba({ kdo: 'zamestnavatel', duvod: 'f' }, rules), 1);
  assert.equal(vypovedniDoba({ kdo: 'zamestnavatel', duvod: 'h' }, rules), 1);
  for (const d of ['a', 'b', 'c', 'd', 'e']) {
    assert.equal(vypovedniDoba({ kdo: 'zamestnavatel', duvod: d }, rules), 2);
  }
  assert.equal(vypovedniDoba({ kdo: 'zamestnanec' }, rules), 2);
});

test('zrušení ve zkušební době → konec dnem doručení', () => {
  assert.equal(
    konecPomeru({ doruceni: '2026-07-10', kdo: 'zamestnavatel', duvod: 'c', zkusebniDoba: true }, rules),
    '2026-07-10',
  );
  assert.equal(vypovedniDoba({ kdo: 'zamestnanec', zkusebniDoba: true }, rules), 0);
});

test('dohoda → konec sjednaným dnem', () => {
  assert.equal(
    konecPomeru({ doruceni: '2026-07-10', kdo: 'dohoda', duvod: 'c', konecDohody: '2026-07-31' }, rules),
    '2026-07-31',
  );
  assert.throws(() => konecPomeru({ doruceni: '2026-07-10', kdo: 'dohoda' }, rules));
});

test('neplatné datum vyhodí chybu', () => {
  assert.throws(() => pricistMesice('2026-02-30', 1));
  assert.throws(() => pricistMesice('10. 7. 2026', 1));
});

// --- Odstupné ----------------------------------------------------------------

test('PP 1,5 roku, průměrný výdělek 40 000 Kč, § 52 písm. c) → odstupné 80 000 Kč', () => {
  const r = odstupne({ kdo: 'zamestnavatel', duvod: 'c', delkaLet: 1.5, prumernyHruby: 40000 }, rules);
  assert.equal(r.castka, 80000);
  assert.equal(r.nasobek, 2);
});

test('výpověď ze strany zaměstnance → odstupné 0', () => {
  const r = odstupne({ kdo: 'zamestnanec', delkaLet: 5, prumernyHruby: 40000 }, rules);
  assert.equal(r.castka, 0);
  assert.equal(r.nasobek, 0);
});

test('násobky odstupného podle délky PP', () => {
  const o = (delkaLet) => odstupne({ kdo: 'zamestnavatel', duvod: 'a', delkaLet, prumernyHruby: 30000 }, rules).castka;
  assert.equal(o(0.5), 30000);
  assert.equal(o(1), 60000);
  assert.equal(o(1.99), 60000);
  assert.equal(o(2), 90000);
  assert.equal(o(10), 90000);
});

test('dohoda z organizačních důvodů → odstupné, dohoda z jiného důvodu → 0', () => {
  assert.equal(odstupne({ kdo: 'dohoda', duvod: 'b', delkaLet: 3, prumernyHruby: 40000 }, rules).castka, 120000);
  assert.equal(odstupne({ kdo: 'dohoda', duvod: 'jiny', delkaLet: 3, prumernyHruby: 40000 }, rules).castka, 0);
});

test('§ 52 písm. d) (pracovní úraz) → 12× průměrný výdělek', () => {
  const r = odstupne({ kdo: 'zamestnavatel', duvod: 'd', delkaLet: 0.3, prumernyHruby: 40000 }, rules);
  assert.equal(r.castka, 480000);
  assert.equal(r.nasobek, 12);
});

test('§ 52 písm. e) až h) a zkušební doba → odstupné 0', () => {
  for (const d of ['e', 'f', 'g', 'h']) {
    assert.equal(odstupne({ kdo: 'zamestnavatel', duvod: d, delkaLet: 5, prumernyHruby: 40000 }, rules).castka, 0);
  }
  assert.equal(
    odstupne({ kdo: 'zamestnavatel', duvod: 'c', zkusebniDoba: true, delkaLet: 0.2, prumernyHruby: 40000 }, rules).castka,
    0,
  );
});

// --- Podpora v nezaměstnanosti -----------------------------------------------

const castky = (r) => r.mesice.map((m) => m.castka);

test('věk 40, čistý výdělek 30 000 Kč, žádost 2026 → 24 000, 24 000, 15 000, 15 000, 12 000', () => {
  const r = podpora({ vek: 40, cistyVydelek: 30000, datumZadosti: '2026-09-11' }, rules);
  assert.deepEqual(castky(r.hlavni), [24000, 24000, 15000, 15000, 12000]);
  assert.equal(r.hlavni.celkem, 90000);
  assert.equal(r.navrh, null);
});

test('věk 40, čistý výdělek 60 000 Kč → první měsíce omezeny stropem 38 537 Kč', () => {
  const r = podpora({ vek: 40, cistyVydelek: 60000, datumZadosti: '2026-03-02' }, rules);
  assert.deepEqual(castky(r.hlavni), [38537, 38537, 30000, 30000, 24000]);
  assert.equal(r.hlavni.mesice[0].omezenoStropem, true);
  assert.equal(r.hlavni.mesice[2].omezenoStropem, false);
});

test('věk 52 → 8 měsíců (3 × 80 %, 3 × 50 %, 2 × 40 %)', () => {
  const r = podpora({ vek: 52, cistyVydelek: 30000, datumZadosti: '2026-06-01' }, rules);
  assert.equal(r.hlavni.podpurciDoba, 8);
  assert.deepEqual(r.hlavni.mesice.map((m) => m.procento), [80, 80, 80, 50, 50, 50, 40, 40]);
  assert.equal(podpora({ vek: 51, cistyVydelek: 30000, datumZadosti: '2026-06-01' }, rules).hlavni.podpurciDoba, 5);
});

test('věk 57 → 11 měsíců (3 × 80 %, 3 × 50 %, 5 × 40 %)', () => {
  const r = podpora({ vek: 57, cistyVydelek: 30000, datumZadosti: '2026-06-01' }, rules);
  assert.equal(r.hlavni.podpurciDoba, 11);
  assert.deepEqual(r.hlavni.mesice.map((m) => m.procento), [80, 80, 80, 50, 50, 50, 40, 40, 40, 40, 40]);
  assert.equal(podpora({ vek: 56, cistyVydelek: 30000, datumZadosti: '2026-06-01' }, rules).hlavni.podpurciDoba, 8);
});

test('zaokrouhlení podpory na celé koruny nahoru', () => {
  const r = vypocetPodpory(40, 30001, rules.podpora['2026']);
  assert.deepEqual(castky(r), [24001, 24001, 15001, 15001, 12001]);
});

test('žádost v roce 2027 → platný zákon + vládní návrh (tisk 300)', () => {
  const r = podpora({ vek: 40, cistyVydelek: 30000, datumZadosti: '2027-01-15' }, rules);
  assert.equal(r.rok, '2027');
  assert.deepEqual(castky(r.hlavni), [24000, 24000, 15000, 15000, 12000]);
  assert.equal(r.hlavni.predbezne, true);
  assert.ok(r.navrh);
  assert.deepEqual(castky(r.navrh), [19500, 19500, 15000, 15000, 13500]);
  // strop návrhu 0,6× (ilustračně 28 903 Kč)
  const vysoky = podpora({ vek: 40, cistyVydelek: 60000, datumZadosti: '2027-01-15' }, rules);
  assert.deepEqual(castky(vysoky.navrh), [28903, 28903, 28903, 28903, 27000]);
});

test('výběr pravidel podle data podání žádosti', () => {
  assert.equal(vyberPravidel(rules, '2026-12-31').rok, '2026');
  assert.equal(vyberPravidel(rules, '2027-01-01').rok, '2027');
  assert.throws(() => vyberPravidel(rules, '2025-12-31'));
  const pozdeji = vyberPravidel(rules, '2028-03-01');
  assert.equal(pozdeji.rok, '2027');
  assert.equal(pozdeji.mimoRozsah, true);
});

test('chybné vstupy podpory', () => {
  assert.throws(() => podpora({ vek: -1, cistyVydelek: 30000, datumZadosti: '2026-06-01' }, rules));
  assert.throws(() => podpora({ vek: 40, cistyVydelek: -5, datumZadosti: '2026-06-01' }, rules));
});

// --- Kontrolní seznam --------------------------------------------------------

test('pracovní dny přeskakují víkendy a svátky', () => {
  // čt 31. 12. 2026 → pá 1. 1. svátek, so, ne → po 4. 1., út 5. 1., st 6. 1.
  assert.equal(pracovniDnyPo('2026-12-31', 3), '2027-01-06');
  // st 2. 9. 2026 → čt 3., pá 4., po 7.
  assert.equal(pracovniDnyPo('2026-09-02', 3), '2026-09-07');
  // Velikonoce 2027: Velký pátek 26. 3., Velikonoční pondělí 29. 3.
  assert.equal(pracovniDnyPo('2027-03-25', 1), '2027-03-30');
});

test('kontrolní seznam obsahuje povinné položky s termíny', () => {
  const s = kontrolniSeznam({ konec: '2026-09-10' });
  const ids = s.map((p) => p.id);
  for (const id of ['zapoctovy-list', 'dovolena', 'urad-prace', 'zdravotni-pojistovna']) {
    assert.ok(ids.includes(id), id);
  }
  const up = s.find((p) => p.id === 'urad-prace');
  assert.equal(up.termin, '2026-09-15'); // čt 10. 9. → pá 11., po 14., út 15.
  assert.equal(s.find((p) => p.id === 'zapoctovy-list').termin, '2026-09-10');
  assert.equal(s.find((p) => p.id === 'zdravotni-pojistovna').termin, '2026-09-19');
});
