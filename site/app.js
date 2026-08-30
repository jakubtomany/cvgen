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

  var editor = document.getElementById('editor');
  var preview = document.getElementById('preview');
  var status = document.getElementById('status');
  var counter = document.getElementById('counter');
  var filenameEl = document.getElementById('filename');
  var drop = document.getElementById('drop');
  var fileInput = document.getElementById('file');

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
        if (!res.ok) throw new Error('Failed to load font ' + name + ' (' + res.status + ').');
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

  function render() {
    if (!fontsReady) return;
    var md = editor.value;
    counter.textContent = md.split('\n').length + ' lines';
    try {
      var docDefinition = CvFormat.markdownToDocDefinition(md);
      pdfMake.createPdf(docDefinition).getBlob(function (blob) {
        if (lastUrl) URL.revokeObjectURL(lastUrl);
        lastUrl = URL.createObjectURL(blob);
        preview.src = lastUrl + '#toolbar=0&view=FitH';
        setStatus('Preview up to date — ' + baseName + '.pdf, ' + Math.round(blob.size / 1024) + ' kB.');
      });
    } catch (err) {
      setStatus('Typesetting error: ' + err.message, true);
    }
  }

  function scheduleRender() {
    clearTimeout(timer);
    timer = setTimeout(render, 350);
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
    reader.onerror = function () { setStatus('Could not read the file.', true); };
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

  document.getElementById('btn-open').addEventListener('click', function () { fileInput.click(); });

  fileInput.addEventListener('change', function () {
    if (fileInput.files[0]) readFile(fileInput.files[0]);
    fileInput.value = '';
  });

  document.getElementById('btn-sample').addEventListener('click', function () {
    fetch('sample/resume.md')
      .then(function (r) { return r.text(); })
      .then(function (t) { loadText(t, 'resume.md'); })
      .catch(function () { setStatus('Failed to load the sample.', true); });
  });

  document.getElementById('btn-save-md').addEventListener('click', function () {
    download(new Blob([editor.value], { type: 'text/markdown;charset=utf-8' }), baseName + '.md');
  });

  document.getElementById('btn-pdf').addEventListener('click', function () {
    if (!fontsReady) return;
    try {
      pdfMake.createPdf(CvFormat.markdownToDocDefinition(editor.value)).download(baseName + '.pdf');
    } catch (err) {
      setStatus('Typesetting error: ' + err.message, true);
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

  loadFonts()
    .then(function () {
      setStatus('Fonts loaded.');
      return fetch('sample/resume.md').then(function (r) { return r.ok ? r.text() : ''; });
    })
    .then(function (text) {
      if (text) loadText(text, 'resume.md');
      else render();
    })
    .catch(function (err) {
      setStatus(err.message + ' Serve the page over HTTP, not from file://.', true);
    });
})();
