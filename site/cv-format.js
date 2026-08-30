/*!
 * cv-format.js — Markdown -> pdfmake docDefinition
 * Formát: dvousloupcová tabulka "štítek | hodnota" s tenkou svislou linkou,
 * patkové písmo pro obsah, bezpatkové tučné pro nadpisy (šablona původního životopisu).
 *
 * Funguje v Node (module.exports) i v prohlížeči (window.CvFormat).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CvFormat = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DEFAULTS = {
    pageSize: 'A4',
    pageMargins: [85, 56, 55, 50],   // levý okraj drží štítky na ~14 % šířky strany
    labelWidth: 122,                 // svislá linka pak vychází na ~35 % šířky strany
    baseFontSize: 11,
    lineHeight: 1.15,
    sectionFontSize: 13.5,
    titleFontSize: 17,
    ruleWidth: 0.9,
    ruleColor: '#000000',
    cellPaddingV: 3.5,
    cellGap: 9,
    unbreakableMaxRows: 8            // delší tabulka se smí zalomit mezi stránky
  };

  // ---------------------------------------------------------------- parser --

  function parseMarkdown(src) {
    var lines = String(src).replace(/\r\n?/g, '\n').split('\n');
    var doc = { title: null, sections: [] };
    var section = null;
    var block = null;
    var row = null;

    function newSection(name) {
      section = { name: name, blocks: [] };
      doc.sections.push(section);
      block = null;
      row = null;
    }

    function ensureSection() {
      if (!section) newSection('');
    }

    function newBlock() {
      ensureSection();
      block = { items: [] };
      section.blocks.push(block);
      row = null;
    }

    function ensureBlock() {
      if (!block) newBlock();
    }

    for (var i = 0; i < lines.length; i++) {
      var raw = lines[i];
      var line = raw.trim();

      if (line === '') continue;

      // vodorovná čára = oddělovač bloků (nová "položka" v sekci)
      if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) {
        newBlock();
        continue;
      }

      var m;

      // # Nadpis dokumentu
      if ((m = line.match(/^#\s+(.*)$/))) {
        doc.title = m[1].trim();
        continue;
      }

      // ## Sekce
      if ((m = line.match(/^##\s+(.*)$/))) {
        newSection(m[1].trim());
        continue;
      }

      // ### Podnadpis uvnitř sekce (zároveň začíná nový blok)
      if ((m = line.match(/^###\s+(.*)$/))) {
        newBlock();
        block.items.push({ type: 'subheading', text: m[1].trim() });
        continue;
      }

      // **Štítek:** hodnota
      if ((m = line.match(/^\*\*\s*(.+?)\s*:?\s*\*\*\s*:?\s*(.*)$/))) {
        ensureBlock();
        row = { type: 'row', label: m[1].trim(), lines: [], bullets: [] };
        if (m[2].trim() !== '') row.lines.push(m[2].trim());
        block.items.push(row);
        continue;
      }

      // - odrážka
      if ((m = line.match(/^[-*+]\s+(.*)$/))) {
        ensureBlock();
        if (row) {
          row.bullets.push(m[1].trim());
        } else {
          var last = block.items[block.items.length - 1];
          if (!last || last.type !== 'list') {
            last = { type: 'list', items: [] };
            block.items.push(last);
          }
          last.items.push(m[1].trim());
        }
        continue;
      }

      // běžný text: pokračování hodnoty, jinak odstavec přes celou šířku
      ensureBlock();
      if (row) {
        row.lines.push(line);
      } else {
        block.items.push({ type: 'para', text: line });
      }
    }

    return doc;
  }

  // ------------------------------------------------------- inline formátování

  function inline(text) {
    var parts = [];
    var re = /(\*\*|__)(.+?)\1|(\*|_)(.+?)\3/g;
    var last = 0;
    var m;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) parts.push({ text: text.slice(last, m.index) });
      if (m[2] !== undefined) parts.push({ text: m[2], bold: true });
      else parts.push({ text: m[4], italics: true });
      last = re.lastIndex;
    }
    if (last < text.length) parts.push({ text: text.slice(last) });
    if (parts.length === 0) return '';
    if (parts.length === 1 && !parts[0].bold && !parts[0].italics) return parts[0].text;
    return parts;
  }

  // ---------------------------------------------------------------- builder --

  function valueCell(row) {
    var stack = [];
    row.lines.forEach(function (l) {
      stack.push({ text: inline(l) });
    });
    if (row.bullets.length) {
      stack.push({
        ul: row.bullets.map(function (b) { return { text: inline(b) }; }),
        margin: [10, row.lines.length ? 2 : 0, 0, 0]
      });
    }
    if (stack.length === 0) return { text: '' };
    if (stack.length === 1) return stack[0];
    return { stack: stack };
  }

  function buildDocDefinition(doc, options) {
    var o = Object.assign({}, DEFAULTS, options || {});

    var layout = {
      hLineWidth: function () { return 0; },
      vLineWidth: function (i) { return i === 1 ? o.ruleWidth : 0; },
      vLineColor: function () { return o.ruleColor; },
      paddingLeft: function (i) { return i === 0 ? 0 : o.cellGap; },
      paddingRight: function (i) { return i === 0 ? o.cellGap : 0; },
      paddingTop: function () { return o.cellPaddingV; },
      paddingBottom: function () { return o.cellPaddingV; }
    };

    var content = [];

    if (doc.title) {
      content.push({ text: inline(doc.title), style: 'title' });
    }

    doc.sections.forEach(function (section) {
      if (section.name) {
        content.push({ text: inline(section.name), style: 'sectionHeading', headlineLevel: 'section' });
      }

      section.blocks.forEach(function (block, blockIndex) {
        var pending = [];

        function flush() {
          if (!pending.length) return;
          content.push({
            unbreakable: pending.length <= o.unbreakableMaxRows,
            margin: [0, 0, 0, 4],
            table: { widths: [o.labelWidth, '*'], body: pending },
            layout: layout
          });
          pending = [];
        }

        block.items.forEach(function (item) {
          if (item.type === 'row') {
            pending.push([
              { text: inline(item.label), alignment: 'right' },
              valueCell(item)
            ]);
          } else if (item.type === 'subheading') {
            flush();
            content.push({ text: inline(item.text), style: 'subheading' });
          } else if (item.type === 'para') {
            flush();
            content.push({ text: inline(item.text), margin: [0, 0, 0, 4] });
          } else if (item.type === 'list') {
            flush();
            content.push({
              ul: item.items.map(function (t) { return { text: inline(t) }; }),
              margin: [10, 0, 0, 4]
            });
          }
        });

        flush();

        if (blockIndex < section.blocks.length - 1) {
          content.push({ text: '', margin: [0, 0, 0, 8] });
        }
      });
    });

    return {
      pageSize: o.pageSize,
      pageMargins: o.pageMargins,
      info: { title: doc.title || 'Životopis' },
      content: content,
      defaultStyle: {
        font: 'Serif',
        fontSize: o.baseFontSize,
        lineHeight: o.lineHeight
      },
      styles: {
        title: {
          font: 'Sans',
          bold: true,
          fontSize: o.titleFontSize,
          alignment: 'center',
          margin: [0, 0, 0, 16]
        },
        sectionHeading: {
          font: 'Sans',
          bold: true,
          fontSize: o.sectionFontSize,
          margin: [0, 14, 0, 8]
        },
        subheading: {
          bold: true,
          margin: [0, 4, 0, 4]
        }
      },
      pageBreakBefore: function (currentNode, followingNodesOnPage) {
        // osamocený nadpis sekce na patě stránky přesuneme na další stránku
        return currentNode.headlineLevel === 'section' && followingNodesOnPage.length === 0;
      }
    };
  }

  function markdownToDocDefinition(src, options) {
    return buildDocDefinition(parseMarkdown(src), options);
  }

  return {
    DEFAULTS: DEFAULTS,
    parseMarkdown: parseMarkdown,
    buildDocDefinition: buildDocDefinition,
    markdownToDocDefinition: markdownToDocDefinition
  };
});
