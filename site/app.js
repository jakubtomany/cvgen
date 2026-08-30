/* app.js — wiring between the editor, pdfmake and the fonts */
(function () {
  'use strict';

  var FONT_FILES = [
    'LiberationSerif-Regular.ttf',
    'LiberationSerif-Bold.ttf',
    'LiberationSerif-Italic.ttf',
    'LiberationSerif-BoldItalic.ttf',
    'LiberationSans-Regular.ttf',
    'LiberationSans-Bold.ttf'
  ];

  var FONT_MAP = {
    Serif: {
      normal: 'LiberationSerif-Regular.ttf',
      bold: 'LiberationSerif-Bold.ttf',
      italics: 'LiberationSerif-Italic.ttf',
      bolditalics: 'LiberationSerif-BoldItalic.ttf'
    },
    Sans: {
      normal: 'LiberationSans-Regular.ttf',
      bold: 'LiberationSans-Bold.ttf',
      italics: 'LiberationSans-Regular.ttf',
      bolditalics: 'LiberationSans-Bold.ttf'
    }
  };

  // --- i18n -------------------------------------------------------------

  var I18N = {
    en: {
      docTitle: 'CV Generator — Markdown to PDF',
      heading: 'CV Generator',
      tagline: 'Markdown on the left, finished PDF on the right. Drop an .md file anywhere in the window.',
      btnOpen: 'Open .md',
      btnSample: 'Load sample',
      btnSaveMd: 'Save .md',
      btnPdf: 'Download PDF',
      editorAria: 'Markdown source',
      previewHead: 'PDF preview',
      loadingFonts: 'Loading fonts…',
      fontsLoaded: 'Fonts loaded.',
      fontError: 'Failed to load font ',
      previewUpToDate: 'Preview up to date — {name}, {size} kB.',
      typesetError: 'Typesetting error: ',
      fileReadError: 'Could not read the file.',
      sampleError: 'Failed to load the sample.',
      serveHint: ' Serve the page over HTTP, not from file://.',
      lines: ' lines',
      dropHere: 'Drop your .md file here',
      metaTitleFallback: 'Curriculum Vitae'
    },
    cs: {
      docTitle: 'Generátor životopisu — Markdown do PDF',
      heading: 'Generátor životopisu',
      tagline: 'Markdown vlevo, hotové PDF vpravo. Soubor .md můžete přetáhnout kamkoli do okna.',
      btnOpen: 'Otevřít .md',
      btnSample: 'Načíst ukázku',
      btnSaveMd: 'Uložit .md',
      btnPdf: 'Stáhnout PDF',
      editorAria: 'Zdrojový Markdown',
      previewHead: 'Náhled PDF',
      loadingFonts: 'Načítám písma…',
      fontsLoaded: 'Písma načtena.',
      fontError: 'Nepodařilo se načíst písmo ',
      previewUpToDate: 'Náhled aktuální — {name}, {size} kB.',
      typesetError: 'Chyba při sazbě: ',
      fileReadError: 'Soubor se nepodařilo přečíst.',
      sampleError: 'Ukázku se nepodařilo načíst.',
      serveHint: ' Spusťte stránku přes webový server, ne přes file://.',
      lines: ' řádků',
      dropHere: 'Pusťte soubor .md sem',
      metaTitleFallback: 'Životopis'
    }
  };

  var LANG_COOKIE = 'cvgen_lang';

  function getCookie(name) {
    var m = document.cookie.match('(?:^|; )' + name + '=([^;]*)');
    return m ? decodeURIComponent(m[1]) : null;
  }

  function setCookie(name, value) {
    document.cookie = name + '=' + encodeURIComponent(value) +
      '; path=/; max-age=31536000; SameSite=Lax';
  }

  var lang = getCookie(LANG_COOKIE);
  if (lang !== 'en' && lang !== 'cs') {
    lang = (navigator.language || '').toLowerCase().indexOf('cs') === 0 ? 'cs' : 'en';
  }

  function t() { return I18N[lang]; }

  // --- elements ---------------------------------------------------------

  var editor = document.getElementById('editor');
  var preview = document.getElementById('preview');
  var status = document.getElementById('status');
  var counter = document.getElementById('counter');
  var filenameEl = document.getElementById('filename');
  var drop = document.getElementById('drop');
  var fileInput = document.getElementById('file');
  var headingEl = document.getElementById('heading');
  var taglineEl = document.getElementById('tagline');
  var btnOpen = document.getElementById('btn-open');
  var btnSample = document.getElementById('btn-sample');
  var btnSaveMd = document.getElementById('btn-save-md');
  var btnPdf = document.getElementById('btn-pdf');
  var previewHead = document.getElementById('preview-head');
  var dropText = document.getElementById('drop-text');
  var langSelect = document.getElementById('lang');

  var baseName = 'resume';
  var fontsReady = false;
  var timer = null;
  var lastUrl = null;
  var dragDepth = 0;

  function setStatus(text, isError) {
    status.textContent = text;
    status.className = isError ? 'status error' : 'status';
  }

  function toBase64(buffer) {
    var bytes = new Uint8Array(buffer);
    var chunk = 0x8000;
    var parts = [];
    for (var i = 0; i < bytes.length; i += chunk) {
      parts.push(String.fromCharCode.apply(null, bytes.subarray(i, i + chunk)));
    }
    return btoa(parts.join(''));
  }

  function loadFonts() {
    return Promise.all(FONT_FILES.map(function (name) {
      return fetch('fonts/' + name).then(function (res) {
        if (!res.ok) throw new Error(t().fontError + name + ' (' + res.status + ').');
        return res.arrayBuffer();
      }).then(function (buf) {
        return [name, toBase64(buf)];
      });
    })).then(function (pairs) {
      var vfs = {};
      pairs.forEach(function (p) { vfs[p[0]] = p[1]; });
      pdfMake.vfs = vfs;
      pdfMake.fonts = FONT_MAP;
      fontsReady = true;
    });
  }

  function docDefinition(md) {
    return CvFormat.markdownToDocDefinition(md, { metaTitleFallback: t().metaTitleFallback });
  }

  function render() {
    if (!fontsReady) return;
    var md = editor.value;
    counter.textContent = md.split('\n').length + t().lines;
    try {
      pdfMake.createPdf(docDefinition(md)).getBlob(function (blob) {
        if (lastUrl) URL.revokeObjectURL(lastUrl);
        lastUrl = URL.createObjectURL(blob);
        preview.src = lastUrl + '#toolbar=0&view=FitH';
        setStatus(t().previewUpToDate
          .replace('{name}', baseName + '.pdf')
          .replace('{size}', Math.round(blob.size / 1024)));
      });
    } catch (err) {
      setStatus(t().typesetError + err.message, true);
    }
  }

  function scheduleRender() {
    clearTimeout(timer);
    timer = setTimeout(render, 350);
  }

  function applyLanguage() {
    document.documentElement.setAttribute('lang', lang);
    document.title = t().docTitle;
    headingEl.textContent = t().heading;
    taglineEl.textContent = t().tagline;
    btnOpen.textContent = t().btnOpen;
    btnSample.textContent = t().btnSample;
    btnSaveMd.textContent = t().btnSaveMd;
    btnPdf.textContent = t().btnPdf;
    editor.setAttribute('aria-label', t().editorAria);
    previewHead.textContent = t().previewHead;
    preview.setAttribute('title', t().previewHead);
    dropText.textContent = t().dropHere;
    langSelect.value = lang;
    if (fontsReady) render();
    else setStatus(t().loadingFonts);
  }

  function loadText(text, name) {
    editor.value = text;
    if (name) {
      baseName = name.replace(/\.(md|markdown|txt)$/i, '') || 'resume';
      filenameEl.textContent = name;
    }
    render();
  }

  function readFile(file) {
    var reader = new FileReader();
    reader.onload = function () { loadText(String(reader.result), file.name); };
    reader.onerror = function () { setStatus(t().fileReadError, true); };
    reader.readAsText(file, 'utf-8');
  }

  function download(blob, name) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  // --- events -----------------------------------------------------------

  editor.addEventListener('input', scheduleRender);

  langSelect.addEventListener('change', function () {
    lang = langSelect.value;
    setCookie(LANG_COOKIE, lang);
    applyLanguage();
  });

  btnOpen.addEventListener('click', function () { fileInput.click(); });

  fileInput.addEventListener('change', function () {
    if (fileInput.files[0]) readFile(fileInput.files[0]);
    fileInput.value = '';
  });

  btnSample.addEventListener('click', function () {
    fetch('sample/resume.md')
      .then(function (r) { return r.text(); })
      .then(function (text) { loadText(text, 'resume.md'); })
      .catch(function () { setStatus(t().sampleError, true); });
  });

  btnSaveMd.addEventListener('click', function () {
    download(new Blob([editor.value], { type: 'text/markdown;charset=utf-8' }), baseName + '.md');
  });

  btnPdf.addEventListener('click', function () {
    if (!fontsReady) return;
    try {
      pdfMake.createPdf(docDefinition(editor.value)).download(baseName + '.pdf');
    } catch (err) {
      setStatus(t().typesetError + err.message, true);
    }
  });

  ['dragenter', 'dragover'].forEach(function (evt) {
    window.addEventListener(evt, function (e) {
      e.preventDefault();
      if (evt === 'dragenter') dragDepth++;
      drop.classList.add('visible');
    });
  });

  window.addEventListener('dragleave', function (e) {
    e.preventDefault();
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) drop.classList.remove('visible');
  });

  window.addEventListener('drop', function (e) {
    e.preventDefault();
    dragDepth = 0;
    drop.classList.remove('visible');
    var file = e.dataTransfer && e.dataTransfer.files[0];
    if (file) readFile(file);
  });

  // --- start ------------------------------------------------------------

  applyLanguage();

  loadFonts()
    .then(function () {
      setStatus(t().fontsLoaded);
      return fetch('sample/resume.md').then(function (r) { return r.ok ? r.text() : ''; });
    })
    .then(function (text) {
      if (text) loadText(text, 'resume.md');
      else render();
    })
    .catch(function (err) {
      setStatus(err.message + t().serveHint, true);
    });
})();
