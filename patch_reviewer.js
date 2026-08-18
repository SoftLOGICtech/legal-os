const fs = require('fs');
let code = fs.readFileSync('dashboard/src/components/DocReviewer.jsx', 'utf8');

// 1. Inject loadFileContent
const loadFileContentStr = `
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
          const pdfjsLib = await import('pdfjs-dist');
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
        } catch { content = '[PDF text layer not available]'; }
      } else if (ext === 'docx') {
        try {
          const { renderAsync } = await import('docx-preview');
          const container = document.createElement('div');
          container.style.cssText = 'position:absolute;left:-9999px;top:-9999px';
          document.body.appendChild(container);
          await renderAsync(blob, container);
          content = container.innerText || '[DOCX ' + doc.file_name + ']';
          document.body.removeChild(container);
        } catch { content = '[DOCX ' + doc.file_name + ']'; }
      } else {
        content = '[Format .' + ext + ' Preview not available]';
      }
      setCaseFiles(prev => prev.map((f, i) => i === idx ? { ...f, content, numPages } : f));
      setActiveDocIdx(idx);
    } catch (err) { setError('Failed to read file: ' + err.message); }
    setIsLoading(false);
  };
`;

code = code.replace('const handleTextSelection = useCallback(() => {', loadFileContentStr + '\n  const handleTextSelection = useCallback(() => {');

// 2. Fix handleFileUpload
code = code.replace(/const handleFileUpload = useCallback.*?\}, \[caseFiles\.length, activeDocIdx\]\);/s, `
  const handleFileUpload = async (files) => {
    if (!files || !files.length) return;
    setIsLoading(true); setError('');
    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', 'exhibits');
      try {
        const res = await apiUpload('/api/cases/' + caseId + '/files', formData);
        if (!res?.ok) setError('Upload failed for ' + file.name);
      } catch (err) { setError(err.message); }
    }
    await fetchFiles();
    setIsLoading(false);
  };
`);

// 3. Fix handleSubmitFact
code = code.replace(/const handleSubmitFact = async \(\) => \{.*?catch \(err\) \{/s, `
  const handleSubmitFact = async () => {
    if (!factForm.date || !factForm.description) return;
    try {
      const activeDoc = caseFiles[activeDocIdx];
      const payload = {
        fact_date: factForm.date,
        description: factForm.description,
        pincite: factForm.pincite,
        status: factForm.status,
        issues: factForm.issues,
        contacts: factForm.witness ? [factForm.witness] : [],
        sources: activeDoc ? [{ file_id: activeDoc.id, pincite: 'p.' + selection.page + ', l.' + selection.line }] : [],
      };
      const rawRes = await apiPost('/api/cases/' + caseId + '/facts', payload);
      const res = await rawRes.json();
      if (res && res.id) {
        if (onFactExtracted) onFactExtracted({ ...payload, id: res.id });
        setFactForm(emptyFact); 
        setShowFactForm(false);
      }
    } catch (err) {
`);

fs.writeFileSync('dashboard/src/components/DocReviewer.jsx', code);
