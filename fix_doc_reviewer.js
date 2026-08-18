const fs = require('fs');

let code = fs.readFileSync('dashboard/src/components/DocReviewer.jsx', 'utf8');

const correctLoadFileContent = `
  const loadFileContent = async (idx) => {
    const doc = caseFiles[idx];
    if (doc.content) { setActiveDocIdx(idx); return; }
    setIsLoading(true); setError('');
    try {
      const url = doc.file_path.startsWith('http') ? doc.file_path : (BASE || 'http://localhost:3001') + doc.file_path;
      const res = await fetch(url);
      const blob = await res.blob();
      const ext = doc.ext;
      let content = '';
      let numPages = null;
      if (['txt', 'md', 'csv', 'xml', 'json'].includes(ext)) { content = await blob.text(); }
      else if (ext === 'pdf') {
        try {
          pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs';
          const pdfUrl = URL.createObjectURL(blob);
          const pdf = await pdfjsLib.getDocument(pdfUrl).promise;
          numPages = pdf.numPages;
          let fullText = '';
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const tc   = await page.getTextContent();
            fullText  += '\\n\\nPage ' + i + ' of ' + pdf.numPages + '\\n\\n';
            fullText  += tc.items.map(it => it.str).join(' ');
          }
          content = fullText;
        } catch (err) { content = '[PDF Parse Error: ' + err.message + ']'; }
      } else if (ext === 'docx') {
        try {
          const { renderAsync } = await import('docx-preview');
          const container = document.createElement('div');
          container.style.cssText = 'position:absolute;left:-9999px;top:-9999px';
          document.body.appendChild(container);
          await renderAsync(blob, container);
          content = container.innerText || '[DOCX ' + doc.file_name + ']';
          document.body.removeChild(container);
        } catch (err) { content = '[DOCX ' + doc.file_name + ']'; }
      } else {
        content = '[Format .' + ext + ' Preview not available]';
      }
      setCaseFiles(prev => prev.map((f, i) => i === idx ? { ...f, content, numPages } : f));
      setActiveDocIdx(idx);
    } catch (err) { setError('Failed to read file: ' + err.message); }
    setIsLoading(false);
  };
`;

const startIndex = code.indexOf('const loadFileContent = async');
const endIndex = code.indexOf('const handleTextSelection = useCallback(() => {');

if (startIndex !== -1 && endIndex !== -1) {
  code = code.substring(0, startIndex) + correctLoadFileContent + '\n  ' + code.substring(endIndex);
  fs.writeFileSync('dashboard/src/components/DocReviewer.jsx', code);
  console.log("Patched successfully");
} else {
  console.log("Could not find bounds");
}
