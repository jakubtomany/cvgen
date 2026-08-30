/* CI smoke test: typeset the bundled sample with the shared cv-format.js
 * and verify that a sane PDF comes out. */
const fs = require('fs');
const path = require('path');
const PdfPrinter = require('pdfmake');
const CvFormat = require('../../site/cv-format.js');

const ROOT = path.join(__dirname, '..', '..');
const FONT_DIR = path.join(ROOT, 'site', 'fonts');

const fonts = {
  Serif: {
    normal: path.join(FONT_DIR, 'LiberationSerif-Regular.ttf'),
    bold: path.join(FONT_DIR, 'LiberationSerif-Bold.ttf'),
    italics: path.join(FONT_DIR, 'LiberationSerif-Italic.ttf'),
    bolditalics: path.join(FONT_DIR, 'LiberationSerif-BoldItalic.ttf')
  },
  Sans: {
    normal: path.join(FONT_DIR, 'LiberationSans-Regular.ttf'),
    bold: path.join(FONT_DIR, 'LiberationSans-Bold.ttf'),
    italics: path.join(FONT_DIR, 'LiberationSans-Regular.ttf'),
    bolditalics: path.join(FONT_DIR, 'LiberationSans-Bold.ttf')
  }
};

const md = fs.readFileSync(path.join(ROOT, 'site', 'sample', 'resume.md'), 'utf8');

const nodePages = {};
const docDefinition = CvFormat.markdownToDocDefinition(md, {
  onNodePosition: (id, page) => { nodePages[id] = page; }
});

if (!docDefinition.content.length) {
  console.error('FAIL: empty docDefinition content');
  process.exit(1);
}

const pdf = new PdfPrinter(fonts).createPdfKitDocument(docDefinition);
const chunks = [];
pdf.on('data', (c) => chunks.push(c));
pdf.on('end', () => {
  const buf = Buffer.concat(chunks);
  if (String(buf.subarray(0, 5)) !== '%PDF-') {
    console.error('FAIL: output is not a PDF');
    process.exit(1);
  }
  if (buf.length < 10000) {
    console.error('FAIL: PDF suspiciously small (' + buf.length + ' bytes)');
    process.exit(1);
  }
  const positioned = Object.keys(nodePages).length;
  if (positioned === 0) {
    console.error('FAIL: no node positions reported');
    process.exit(1);
  }
  console.log('OK: ' + buf.length + ' bytes, ' + positioned + ' positioned nodes');
});
pdf.end();
