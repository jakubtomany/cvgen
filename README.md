# cvgen — Markdown → PDF CV generator

[![Cloudflare Pages](https://img.shields.io/badge/Cloudflare%20Pages-cvcko.pages.dev-f38020?logo=cloudflare&logoColor=white)](https://cvcko.pages.dev)
[![Production status](https://img.shields.io/website?url=https%3A%2F%2Fcvcko.pages.dev&label=production&up_message=online&down_message=offline)](https://cvcko.pages.dev)

**Live: <https://cvcko.pages.dev>** — every pull request gets its own preview
deployment (linked by the Cloudflare bot in the PR), and merging to `main`
redeploys production automatically.

A static web app: drop an `.md` file into the window, the right pane shows a PDF
typeset in a classic CV layout, and a button downloads it. Typesetting runs
entirely in the browser (pdfmake), nothing is uploaded anywhere, and deployment
is purely static.

The CV content itself can be written in any language — the input is plain UTF-8
Markdown. Glyph coverage is determined by the embedded Liberation fonts, which
cover Latin, Greek and Cyrillic scripts.

## Structure

```
site/                  ← deploy this folder to Cloudflare Pages
  index.html           UI (editor + preview + drag & drop)
  app.js               font loading, live preview, export
  cv-format.js         CORE: Markdown → pdfmake docDefinition (the CV layout)
  vendor/pdfmake.min.js
  fonts/               Liberation Serif + Sans (OFL, metrically compatible with Times New Roman / Arial)
  sample/resume.md     default content
build-pdf.js           the same typesetting from the command line (Node)
package.json
```

The PDF layout lives in one place — `site/cv-format.js`. The `DEFAULTS` object
at the top holds the page margins, the label column width, font sizes and the
weight of the vertical rule; `buildDocDefinition` assembles the document itself.
Both the web app and the CLI use this single file, so the browser preview and a
file generated from the terminal are always identical.

## Running locally

The page must be served over HTTP (fonts are loaded with `fetch`), not from
`file://`:

```bash
cd site && python3 -m http.server 8080     # or: npx serve site
```

## Deploying to Cloudflare Pages

Production runs as the Cloudflare Pages project `cvcko`, connected to this
repository — pushes to `main` deploy production and every pull request gets a
preview deployment. There is no build step: the build command is empty and the
output directory is `site`.

A one-off manual deploy is also possible:

```bash
npx wrangler pages deploy site --project-name cvcko
```

## Generating from the command line

```bash
npm install
node build-pdf.js site/sample/resume.md out/resume.pdf
```

## Markdown syntax

| Syntax | Meaning |
|---|---|
| `# Text` | document title (top, centred, bold sans-serif) |
| `## Text` | section heading (Personal information, Education, …) |
| `**Label:** value` | table row — label on the left of a thin vertical rule, value on the right |
| next line without `**` | continuation of the value on a new line in the same cell |
| `- item` | bullet inside the currently open value |
| `---` | item separator within a section (next job, next school) |
| `### Text` | bold full-width subheading (optional) |
| plain paragraph | full-width text (e.g. an Interests section) |

`**bold**` and `*italics*` work inside values.

Example:

```markdown
## Education

**Period:** 2010 – 2012
**Qualification obtained:** MSc in Information Management
**Skills acquired (main subjects):**
- Project management
- Information systems analysis and design
**Institution:** Faculty of Informatics and Management
Polytechnic University of Springfield

---

**Period:** 2002 – 2006
**Qualification obtained:** Secondary school diploma
```

## Notes

- Downloaded files are named by the editable field in the editor header; a
  manually entered name wins, and clearing the field returns to automatic
  naming: the name of the file you opened or dropped in, else the document's
  `# title` with diacritics stripped (`# Životopis` → `zivotopis.pdf`), else
  `resume`. The effective name is shown directly in the download buttons.
- The draft is saved to the browser's `localStorage` as you type, so reloading
  the page restores it; the bundled sample only loads when there is no saved
  draft.
- Undo and redo work with Cmd/Ctrl+Z and Cmd/Ctrl+Shift+Z (or Ctrl+Y) and
  always apply to the editor, regardless of what currently has focus. The
  history is stored with the draft as compact diffs (capped at 500 steps /
  200 kB, oldest steps dropped first), so it survives a page reload. Opening
  a file and discarding are themselves undoable steps.
- The Discard button resets the editor back to the bundled sample. It asks for
  confirmation in place (a second click at least half a second later), and the
  discarded draft can still be brought back with undo.
- After every re-render the preview opens on the page that contains the block
  under the cursor, so it follows your editing instead of jumping back to the
  first page.
- The UI is available in English and Czech — the selector in the header stores
  the choice in a `cvgen_lang` cookie. The typeset PDF contains only text from
  the Markdown input; the only language-specific piece is the PDF metadata
  title used as a fallback when the document has no `# title`.
- A group of up to 8 table rows never breaks across pages (`unbreakableMaxRows`
  in `cv-format.js`); longer tables are allowed to break so that half-empty
  pages don't pile up.
- A section heading orphaned at the bottom of a page is automatically moved to
  the next page.
- The fonts ship with the repository (~2.3 MB), so the app works offline and
  diacritics always render correctly. The Liberation fonts are freely
  redistributable under the OFL.

## License

- The Liberation Serif and Liberation Sans fonts are distributed under the
  [SIL Open Font License 1.1](site/fonts/LICENSE-OFL.txt) — the full text is
  included in `site/fonts/LICENSE-OFL.txt`.
- The [pdfmake](https://github.com/bpampuch/pdfmake) library (in `site/vendor/`)
  is distributed under the MIT license.
