#!/usr/bin/env node
/* Usage: node build-pdf.js input.md output.pdf */
const fs = require('fs');
const path = require('path');
const PdfPrinter = require('pdfmake');
const CvFormat = require('./site/cv-format.js');

const FONT_DIR = path.join(__dirname, 'site', 'fonts');
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

const input = process.argv[2] || path.join(__dirname, 'site', 'sample', 'resume.md');
const output = process.argv[3] || path.join(__dirname, 'out', 'resume.pdf');

fs.mkdirSync(path.dirname(output), { recursive: true });

const md = fs.readFileSync(input, 'utf8');
const docDefinition = CvFormat.markdownToDocDefinition(md);

const printer = new PdfPrinter(fonts);
const pdf = printer.createPdfKitDocument(docDefinition);
const stream = fs.createWriteStream(output);
pdf.pipe(stream);
pdf.end();
stream.on('finish', () => console.log('Done:', output));
