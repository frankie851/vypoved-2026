# Výpověď 2026 – kdy končím a co mi náleží

Statický web v češtině pro zaměstnance, který dostal nebo podává výpověď. Spočítá:

1. poslední den pracovního poměru z data doručení a důvodu výpovědi,
2. zákonné minimum odstupného,
3. odhad podpory v nezaměstnanosti po měsících podle data podání žádosti
   (pro žádosti v roce 2027 i variantu podle vládního návrhu – sněmovní tisk 300),
4. kontrolní seznam s termíny (zápočtový list, dovolená, úřad práce, zdravotní pojišťovna).

Orientační výpočet, nejde o právní poradenství. Nic se neukládá ani neodesílá.

## Soubory

| Soubor | Obsah |
|---|---|
| `index.html`, `styles.css`, `app.js` | Uživatelské rozhraní |
| `vypoved.js` | Čisté výpočetní funkce (ES modul, bez DOM) |
| `rules.json` | Parametry po letech se zdrojem a datem ověření |
| `vypoved.test.js` | Testy (`node --test`) |

## Ověřená pravidla (k 5. 11. 2026)

- **Výpovědní doba** začíná dnem doručení a končí dnem se stejným číslem o N měsíců později;
  když takový den v měsíci není, končí posledním dnem měsíce (§ 51 ZP ve znění zák. č. 120/2025 Sb., od 1. 6. 2025).
- Délka 2 měsíce; **1 měsíc** u výpovědi podle § 52 písm. f), g), h).
- **Zrušení ve zkušební době** – konec dnem doručení (§ 66 ZP).
- **Odstupné** (§ 67 ZP): § 52 a)–c) nebo dohoda z týchž důvodů 1× / 2× / 3× průměrný výdělek
  (PP < 1 rok / 1–2 roky / ≥ 2 roky); § 52 d) (pracovní úraz, nemoc z povolání) 12×.
- **Podpora 2026** (zák. č. 435/2004 Sb. ve znění zák. č. 120/2025 Sb.): podle věku ke dni podání žádosti
  do 52 let 5 měsíců (80, 80, 50, 50, 40 %), od 52 let 8 měsíců (3× 80, 3× 50, 2× 40 %),
  od 57 let 11 měsíců (3× 80, 3× 50, 5× 40 %); strop 38 537 Kč měsíčně (0,8× průměrné mzdy).
- **2027**: platný zákon se stejnými sazbami (strop zatím nevyhlášen – předběžně 38 537 Kč) a vedle něj
  vládní návrh (tisk 300, neschválen): 65, 65, 50, 50, 45 %…, strop 0,6× průměrné mzdy (ilustračně 28 903 Kč).

Podrobnosti a zdroje jsou v `rules.json`. Při změně zákona stačí upravit `rules.json` (a testy).

## Spuštění

Stránka načítá `rules.json` přes `fetch`, takže ji otevřete přes webový server, ne jako soubor:

```bash
python3 -m http.server 8000
```

Pak otevřete <http://localhost:8000/>.

## Testy

```bash
node --test
```

## Nasazení na GitHub Pages

Repozitář → **Settings → Pages → Build and deployment → Deploy from a branch**, zvolte větev
a složku `/ (root)`. Žádný build není potřeba.
