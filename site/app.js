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
      saveMd: 'Save {name}',
      downloadPdf: 'Download {name}',
      editorAria: 'Markdown source',
      nameAria: 'File name',
      previewHead: 'PDF preview',
      loadingFonts: 'Loading fonts…',
      fontsLoaded: 'Fonts loaded.',
      fontError: 'Failed to load font ',
      previewUpToDate: 'Preview up to date — {name}, {size} kB.',
      typesetError: 'Typesetting error: ',
      fileReadError: 'Could not read the file.',
      sampleError: 'Failed to load the sample.',
      serveHint: ' Serve the page over HTTP, not from file://.',
      dropHere: 'Drop your .md file here',
      metaTitleFallback: 'Curriculum Vitae'
    },
    cs: {
      docTitle: 'Generátor životopisu — Markdown do PDF',
      heading: 'Generátor životopisu',
      tagline: 'Markdown vlevo, hotové PDF vpravo. Soubor .md můžete přetáhnout kamkoli do okna.',
      btnOpen: 'Otevřít .md',
      saveMd: 'Uložit {name}',
      downloadPdf: 'Stáhnout {name}',
      editorAria: 'Zdrojový Markdown',
      nameAria: 'Název souboru',
      previewHead: 'Náhled PDF',
      loadingFonts: 'Načítám písma…',
      fontsLoaded: 'Písma načtena.',
      fontError: 'Nepodařilo se načíst písmo ',
      previewUpToDate: 'Náhled aktuální — {name}, {size} kB.',
      typesetError: 'Chyba při sazbě: ',
      fileReadError: 'Soubor se nepodařilo přečíst.',
      sampleError: 'Ukázku se nepodařilo načíst.',
      serveHint: ' Spusťte stránku přes webový server, ne přes file://.',
      dropHere: 'Pusťte soubor .md sem',
      metaTitleFallback: 'Životopis'
    }
  };

  var LANG_COOKIE = 'cvgen_lang';
  var STORAGE_KEY = 'cvgen_state';

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
  var drop = document.getElementById('drop');
  var fileInput = document.getElementById('file');
  var headingEl = document.getElementById('heading');
  var taglineEl = document.getElementById('tagline');
  var btnOpen = document.getElementById('btn-open');
  var btnSaveMd = document.getElementById('btn-save-md');
  var btnPdf = document.getElementById('btn-pdf');
  var nameInput = document.getElementById('name-input');
  var previewHead = document.getElementById('preview-head');
  var dropText = document.getElementById('drop-text');
  var langSelect = document.getElementById('lang');

  var uploadedBase = null;   // name of the user's uploaded file
  var manualBase = null;     // name typed into the header field, wins over everything
  var baseName = 'resume';   // effective download name, recomputed on render
  var fontsReady = false;
  var timer = null;
  var lastUrl = null;
  var dragDepth = 0;

  function setStatus(text, isError) {
    status.textContent = text;
    status.className = isError ? 'status error' : 'status';
  }

  // --- persistence ------------------------------------------------------

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        md: editor.value,
        manualBase: manualBase,
        uploadedBase: uploadedBase
      }));
    } catch (e) { /* storage unavailable — run without persistence */ }
  }

  function loadState() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY));
    } catch (e) {
      return null;
    }
  }

  // --- undo / redo ------------------------------------------------------

  var HISTORY_LIMIT = 200;
  var histStack = [];
  var histIndex = -1;
  var histTimer = null;

  function snapshot() {
    return { value: editor.value, start: editor.selectionStart, end: editor.selectionEnd };
  }

  function resetHistory() {
    clearTimeout(histTimer);
    histTimer = null;
    histStack = [snapshot()];
    histIndex = 0;
  }

  function commitHistory() {
    clearTimeout(histTimer);
    histTimer = null;
    if (histStack[histIndex] && histStack[histIndex].value === editor.value) return;
    histStack = histStack.slice(0, histIndex + 1);
    histStack.push(snapshot());
    if (histStack.length > HISTORY_LIMIT) histStack.shift();
    histIndex = histStack.length - 1;
  }

  function scheduleHistory() {
    clearTimeout(histTimer);
    histTimer = setTimeout(commitHistory, 300);
  }

  function applyHistory(entry) {
    editor.value = entry.value;
    editor.focus();
    editor.setSelectionRange(entry.start, entry.end);
    render();
  }

  function undo() {
    commitHistory();
    if (histIndex > 0) {
      histIndex--;
      applyHistory(histStack[histIndex]);
    }
  }

  function redo() {
    commitHistory();
    if (histIndex < histStack.length - 1) {
      histIndex++;
      applyHistory(histStack[histIndex]);
    }
  }

  // --- fonts ------------------------------------------------------------

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

  // --- naming and rendering ---------------------------------------------

  function docDefinition(md) {
    return CvFormat.markdownToDocDefinition(md, { metaTitleFallback: t().metaTitleFallback });
  }

  function slugify(text) {
    var s = String(text || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return s || null;
  }

  function autoBase() {
    return uploadedBase || slugify(CvFormat.parseMarkdown(editor.value).title) || 'resume';
  }

  function currentBase() {
    var manual = (manualBase || '').trim();
    return manual ? manual.replace(/[\/\\]/g, '-') : autoBase();
  }

  function updateButtons() {
    baseName = currentBase();
    var auto = autoBase();
    nameInput.placeholder = auto;
    if (nameInput.value !== (manualBase || '')) nameInput.value = manualBase || '';
    var shown = (manualBase || '').trim() || auto;
    nameInput.style.width = Math.min(Math.max(shown.length, 6), 40) + 'ch';
    btnSaveMd.textContent = t().saveMd.replace('{name}', baseName + '.md');
    btnPdf.textContent = t().downloadPdf.replace('{name}', baseName + '.pdf');
  }

  function render() {
    persist();
    updateButtons();
    if (!fontsReady) return;
    try {
      pdfMake.createPdf(docDefinition(editor.value)).getBlob(function (blob) {
        if (lastUrl) URL.revokeObjectURL(lastUrl);
        lastUrl = URL.createObjectURL(blob);
        var dest = lastUrl + '#toolbar=0&view=FitH';
        // location.replace keeps preview reloads out of the browser history
        try { preview.contentWindow.location.replace(dest); }
        catch (e) { preview.src = dest; }
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
    editor.setAttribute('aria-label', t().editorAria);
    nameInput.setAttribute('aria-label', t().nameAria);
    previewHead.textContent = t().previewHead;
    preview.setAttribute('title', t().previewHead);
    dropText.textContent = t().dropHere;
    langSelect.value = lang;
    updateButtons();
    if (fontsReady) render();
    else setStatus(t().loadingFonts);
  }

  function loadText(text, uploadedName) {
    editor.value = text;
    editor.setSelectionRange(0, 0);
    editor.scrollTop = 0;
    uploadedBase = uploadedName
      ? (uploadedName.replace(/\.(md|markdown|txt)$/i, '') || null)
      : null;
    manualBase = null;
    resetHistory();
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

  editor.addEventListener('input', function () {
    scheduleHistory();
    scheduleRender();
  });

  window.addEventListener('keydown', function (e) {
    if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
    if (document.activeElement === nameInput) return;  // native undo in the name field
    var key = e.key.toLowerCase();
    if (key === 'z') {
      e.preventDefault();
      if (e.shiftKey) redo(); else undo();
    } else if (key === 'y' && !e.shiftKey) {
      e.preventDefault();
      redo();
    }
  });

  nameInput.addEventListener('input', function () {
    manualBase = nameInput.value === '' ? null : nameInput.value;
    persist();
    updateButtons();
  });

  nameInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') nameInput.blur();
  });

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

  btnSaveMd.addEventListener('click', function () {
    download(new Blob([editor.value], { type: 'text/markdown;charset=utf-8' }), currentBase() + '.md');
  });

  btnPdf.addEventListener('click', function () {
    if (!fontsReady) return;
    try {
      pdfMake.createPdf(docDefinition(editor.value)).download(currentBase() + '.pdf');
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

  var saved = loadState();
  if (saved && saved.md) {
    editor.value = saved.md;
    uploadedBase = saved.uploadedBase || null;
    manualBase = saved.manualBase || null;
  }
  applyLanguage();
  resetHistory();

  loadFonts()
    .then(function () {
      setStatus(t().fontsLoaded);
      if (editor.value !== '') return '';
      return fetch('sample/resume.md').then(function (r) { return r.ok ? r.text() : ''; });
    })
    .then(function (text) {
      if (text) loadText(text);
      else render();
      editor.focus();
      editor.setSelectionRange(0, 0);
      editor.scrollTop = 0;
    })
    .catch(function (err) {
      setStatus(err.message + t().serveHint, true);
    });
})();
