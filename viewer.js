const fileInput = document.getElementById('fileInput');
const emptyState = document.getElementById('emptyState');
const info = document.getElementById('info');
const pdfContainer = document.getElementById('pdfContainer');
const pptContainer = document.getElementById('pptContainer');
const themeToggle = document.getElementById('themeToggle');

const showInfo = (msg) => {
  info.textContent = msg;
  info.classList.remove('hidden');
};

const resetView = () => {
  pdfContainer.classList.add('hidden');
  pptContainer.classList.add('hidden');
  pdfContainer.innerHTML = '';
  pptContainer.innerHTML = '';
  info.classList.add('hidden');
  emptyState.classList.add('hidden');
};

themeToggle.addEventListener('click', () => {
  const dark = document.body.classList.toggle('dark');
  document.body.classList.toggle('light', !dark);
  themeToggle.textContent = `Night Mode: ${dark ? 'On' : 'Off'}`;
});

fileInput.addEventListener('change', async (event) => {
  const [file] = event.target.files;
  if (file) {
    await renderFile(file);
  }
});

document.addEventListener('dragover', (event) => {
  event.preventDefault();
});

document.addEventListener('drop', async (event) => {
  event.preventDefault();
  const [file] = event.dataTransfer.files;
  if (file) {
    await renderFile(file);
  }
});

const renderFile = async (file) => {
  resetView();
  const name = file.name.toLowerCase();

  if (name.endsWith('.pdf')) {
    await renderPdf(file);
    return;
  }

  if (name.endsWith('.pptx')) {
    await renderPptx(file);
    return;
  }

  if (name.endsWith('.ppt')) {
    showInfo('Legacy .ppt files are not directly parseable in-browser. Please convert to .pptx for full reading.');
    return;
  }

  emptyState.classList.remove('hidden');
  showInfo('Unsupported file type. Please use .pdf, .pptx, or .ppt.');
};

const renderPdf = async (file) => {
  const pdfjsLib = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.min.mjs');
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs';

  const data = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  showInfo(`PDF loaded: ${file.name} • ${pdf.numPages} pages`);

  pdfContainer.classList.remove('hidden');

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1.25 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const context = canvas.getContext('2d', { alpha: false });
    await page.render({ canvasContext: context, viewport }).promise;

    const pageWrap = document.createElement('div');
    pageWrap.className = 'pdf-page';
    pageWrap.append(canvas);
    pdfContainer.append(pageWrap);
  }
};

const extractSlideTexts = async (zip) => {
  const slideEntries = Object.keys(zip.files)
    .filter((path) => /^ppt\/slides\/slide\d+\.xml$/.test(path))
    .sort((a, b) => {
      const aNum = Number(a.match(/slide(\d+)\.xml$/)[1]);
      const bNum = Number(b.match(/slide(\d+)\.xml$/)[1]);
      return aNum - bNum;
    });

  const slides = [];
  for (const entry of slideEntries) {
    const xml = await zip.files[entry].async('text');
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'application/xml');
    const texts = [...doc.getElementsByTagName('a:t')]
      .map((node) => node.textContent?.trim())
      .filter(Boolean);
    slides.push(texts);
  }

  return slides;
};

const renderPptx = async (file) => {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const slides = await extractSlideTexts(zip);

  showInfo(`PPTX loaded: ${file.name} • ${slides.length} slides`);
  pptContainer.classList.remove('hidden');

  if (!slides.length) {
    const block = document.createElement('div');
    block.className = 'slide';
    block.textContent = 'No readable text found in slides.';
    pptContainer.append(block);
    return;
  }

  slides.forEach((slideTexts, index) => {
    const block = document.createElement('article');
    block.className = 'slide';

    const title = document.createElement('h3');
    title.textContent = `Slide ${index + 1}`;
    block.append(title);

    if (!slideTexts.length) {
      const empty = document.createElement('p');
      empty.textContent = '(No text content found on this slide)';
      block.append(empty);
    } else {
      const list = document.createElement('ul');
      for (const text of slideTexts) {
        const item = document.createElement('li');
        item.textContent = text;
        list.append(item);
      }
      block.append(list);
    }

    pptContainer.append(block);
  });
};
