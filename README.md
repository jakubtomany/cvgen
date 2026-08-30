# Generátor životopisu (Markdown → PDF)

Statická webová aplikace: do okna přetáhnete soubor `.md`, vpravo se objeví PDF ve formátu
původního životopisu a stáhnete ho tlačítkem. Sazba běží celá v prohlížeči (pdfmake),
nic se nikam neodesílá a nasazení je čistě statické.

## Struktura

```
site/                  ← tuhle složku nasazujete na Cloudflare Pages
  index.html           UI (editor + náhled + drag&drop)
  app.js               načtení písem, živý náhled, export
  cv-format.js         JÁDRO: Markdown → pdfmake docDefinition (formát životopisu)
  vendor/pdfmake.min.js
  fonts/               Liberation Serif + Sans (OFL, metricky = Times New Roman / Arial)
  ukazka/zivotopis.md  výchozí obsah
build-pdf.js           stejná sazba z příkazové řádky (Node)
package.json
```

Formát PDF je na jednom místě — `site/cv-format.js`. Objekt `DEFAULTS` nahoře drží okraje
stránky, šířku sloupce se štítky, velikosti písma a sílu svislé linky; funkce
`buildDocDefinition` sestavuje samotný dokument. Web i CLI používají tenhle jeden soubor,
takže náhled v prohlížeči a soubor z terminálu jsou vždy identické.

## Spuštění lokálně

Musí to běžet přes HTTP (kvůli načítání písem `fetch`em), ne přes `file://`:

```bash
cd site && python3 -m http.server 8080     # nebo: npx serve site
```

## Nasazení na Cloudflare Pages

Bez build kroku, jde o statické soubory.

```bash
npx wrangler pages deploy site --project-name zivotopis
```

Nebo přes dashboard: Workers & Pages → Create → Pages → Upload assets a nahrát obsah
složky `site`. Při napojení na Git repo nechte build command prázdný a output directory `site`.

## Generování z příkazové řádky

```bash
npm install
node build-pdf.js site/ukazka/zivotopis.md out/zivotopis.pdf
```

## Syntaxe Markdownu

| Zápis | Význam |
|---|---|
| `# Text` | název dokumentu (nahoře, na střed, bezpatkově tučně) |
| `## Text` | nadpis sekce (Osobní informace, Vzdělání, …) |
| `**Štítek:** hodnota` | řádek tabulky — štítek vpravo, svislá linka, hodnota vlevo |
| další řádek bez `**` | pokračování hodnoty na novém řádku ve stejné buňce |
| `- položka` | odrážka uvnitř právě otevřené hodnoty |
| `---` | oddělovač položek v sekci (další zaměstnání, další škola) |
| `### Text` | tučný mezinadpis přes celou šířku (volitelné) |
| volný odstavec | text přes celou šířku (např. sekce Zájmy) |

Uvnitř hodnot funguje `**tučně**` a `*kurzíva*`.

Příklad:

```markdown
## Vzdělání

**Období:** 2010 – 2012
**Dosažená kvalifikace:** Ing. v oboru Informační management
**Získané dovednosti (hlavní předměty):**
- Projektové řízení
- Analýza a návrh informačních systémů
**Organizace, která vzdělání poskytla:** Fakulta informatiky a managementu
Vysoká škola polytechnická v Novém Městě

---

**Období:** 2002 – 2006
**Dosažená kvalifikace:** Maturita
```

## Poznámky

- Skupina řádků do 8 řádků tabulky se nikdy nezalomí přes stránky (`unbreakableMaxRows`
  v `cv-format.js`); delší tabulky se zalomit smějí, aby nevznikaly poloprázdné stránky.
- Osamocený nadpis sekce na patě stránky se automaticky přesune na další stránku.
- Písma jsou součástí repozitáře (~2,3 MB), takže aplikace funguje i bez internetu
  a diakritika je vždy správně. Liberation jsou licencí OFL volně šiřitelná.

## Licence

- Písma Liberation Serif a Liberation Sans jsou šířena pod licencí
  [SIL Open Font License 1.1](site/fonts/LICENSE-OFL.txt) — plný text je přiložen
  v `site/fonts/LICENSE-OFL.txt`.
- Knihovna [pdfmake](https://github.com/bpampuch/pdfmake) (v `site/vendor/`) je
  šířena pod licencí MIT.
