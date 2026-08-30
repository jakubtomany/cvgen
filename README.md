# cvgen — Markdown → PDF CV generator

[![Cloudflare Pages](https://img.shields.io/badge/Cloudflare%20Pages-cvcko.pages.dev-f38020?logo=cloudflare&logoColor=white)](https://cvcko.pages.dev)
[![Production status](https://img.shields.io/website?url=https%3A%2F%2Fcvcko.pages.dev&label=production&up_message=online&down_message=offline)](https://cvcko.pages.dev)

**Live: <https://cvcko.pages.dev>**

A static web app that typesets a CV from Markdown entirely in the browser
(pdfmake) — nothing is uploaded anywhere. Content can be written in any
language (UTF-8; the embedded Liberation fonts cover Latin, Greek and
Cyrillic). The draft and its undo history are kept in the browser's
`localStorage`, so a reload loses nothing.

## Markdown syntax

| Syntax | Meaning |
|---|---|
| `# Text` | document title |
| `## Text` | section heading |
| `**Label:** value` | table row — label left of the vertical rule, value right |
| next line without `**` | continuation of the value in the same cell |
| `- item` | bullet inside the current value |
| `---` | item separator within a section (next job, next school) |
| `### Text` | bold full-width subheading (optional) |
| plain paragraph | full-width text |

`**bold**` and `*italics*` work inside values. See
[`site/sample/resume.md`](site/sample/resume.md) for a complete example.

## Running and development

There are no dependencies and no build step — everything ships in `site/`
(pdfmake is vendored). Serve it over HTTP, not from `file://`:

```bash
cd site && python3 -m http.server 8080
```

The PDF layout lives in one place, `site/cv-format.js`.

Production is the Cloudflare Pages project `cvcko`, Git-connected to this
repository: pushes to `main` deploy production, pull requests get preview
deployments. The output directory is `site`. One-off manual deploy:
`npx wrangler pages deploy site --project-name cvcko`.

## License

Liberation fonts: [SIL OFL 1.1](site/fonts/LICENSE-OFL.txt). pdfmake
(vendored in `site/vendor/`): MIT.
