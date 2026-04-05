import { unzipSync, strFromU8 } from './vendor/fflate.js';
import * as pdfjsLib from './vendor/pdf.min.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = './vendor/pdf.worker.min.mjs';

const fileInput = document.getElementById('fileInput');
const themeSelect = document.getElementById('themeSelect');
const welcome = document.getElementById('welcome');
const status = document.getElementById('status');
const pdfWorkspace = document.getElementById('pdfWorkspace');
const pptWorkspace = document.getElementById('pptWorkspace');
const pdfPages = document.getElementById('pdfPages');
const zoomLabel = document.getElementById('zoomLabel');
const pageInfo = document.getElementById('pageInfo');
const zoomIn = document.getElementById('zoomIn');
const zoomOut = document.getElementById('zoomOut');
const fitWidth = document.getElementById('fitWidth');

let currentPdf = null;
let scale = 1.2;

const setStatus = (message, type = 'info') => {
  status.textContent = message;
  status.classList.remove('hidden');
  status.style.borderColor = type === 'error' ? '#f97373aa' : '';
};

const resetView = () => {
  pdfWorkspace.classList.add('hidden');
  pptWorkspace.classList.add('hidden');
  pdfPages.innerHTML = '';
  pptWorkspace.innerHTML = '';
  status.classList.add('hidden');
  welcome.classList.remove('hidden');
};

const applyTheme = (theme) => {
  document.body.dataset.theme = theme;
  localStorage.setItem('night-owl-theme', theme);
};

themeSelect.addEventListener('change', () => applyTheme(themeSelect.value));

const savedTheme = localStorage.getItem('night-owl-theme');
if (savedTheme) {
  themeSelect.value = savedTheme;
  applyTheme(savedTheme);
}

const updateZoomLabel = () => {
  zoomLabel.textContent = `${Math.round(scale * 100)}%`;
};

const renderPdfPages = async () => {
  if (!currentPdf) return;

  pdfPages.innerHTML = '';
  pageInfo.textContent = `${currentPdf.numPages} pages`;

  for (let pageNumber = 1; pageNumber <= currentPdf.numPages; pageNumber += 1) {
    const page = await currentPdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    const ctx = canvas.getContext('2d', { alpha: false });
    await page.render({ canvasContext: ctx, viewport }).promise;

    const wrapper = document.createElement('article');
    wrapper.className = 'pdf-page';
    wrapper.append(canvas);
    pdfPages.append(wrapper);
  }

  updateZoomLabel();
};

zoomIn.addEventListener('click', async () => {
  if (!currentPdf) return;
  scale = Math.min(scale + 0.15, 3);
  await renderPdfPages();
});

zoomOut.addEventListener('click', async () => {
  if (!currentPdf) return;
  scale = Math.max(scale - 0.15, 0.55);
  await renderPdfPages();
});

fitWidth.addEventListener('click', async () => {
  if (!currentPdf) return;
  const maxWidth = Math.max(680, pdfPages.clientWidth - 40);
  const firstPage = await currentPdf.getPage(1);
  const natural = firstPage.getViewport({ scale: 1 });
  scale = maxWidth / natural.width;
  await renderPdfPages();
});

const parsePptxSlides = (arrayBuffer) => {
  const zip = unzipSync(new Uint8Array(arrayBuffer));
  const slidePaths = Object.keys(zip)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => Number(a.match(/slide(\d+)\.xml$/)?.[1] || 0) - Number(b.match(/slide(\d+)\.xml$/)?.[1] || 0));

  return slidePaths.map((slidePath) => {
    const xml = strFromU8(zip[slidePath]);
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'application/xml');

    return [...doc.getElementsByTagName('a:t')]
      .map((node) => node.textContent?.trim())
      .filter(Boolean);
  });
};

const renderPptx = async (file) => {
  const slides = parsePptxSlides(await file.arrayBuffer());

  resetView();
  pptWorkspace.classList.remove('hidden');
  welcome.classList.add('hidden');
  setStatus(`PPTX loaded: ${file.name} • ${slides.length} slides`);

  if (!slides.length) {
    const empty = document.createElement('article');
    empty.className = 'slide';
    empty.textContent = 'No readable text was found in this PPTX file.';
    pptWorkspace.append(empty);
    return;
  }

  slides.forEach((texts, index) => {
    const slideCard = document.createElement('article');
    slideCard.className = 'slide';

    const title = document.createElement('h3');
    title.textContent = `Slide ${index + 1}`;
    slideCard.append(title);

    const list = document.createElement('ul');
    if (!texts.length) {
      const item = document.createElement('li');
      item.textContent = '(No text on this slide)';
      list.append(item);
    } else {
      texts.forEach((text) => {
        const item = document.createElement('li');
        item.textContent = text;
        list.append(item);
      });
    }

    slideCard.append(list);
    pptWorkspace.append(slideCard);
  });
};

const renderPdf = async (file) => {
  currentPdf = null;
  scale = 1.2;

  const bytes = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: bytes }).promise;
  currentPdf = doc;

  resetView();
  pdfWorkspace.classList.remove('hidden');
  welcome.classList.add('hidden');
  setStatus(`PDF loaded: ${file.name}`);
  await renderPdfPages();
};

const handleFile = async (file) => {
  try {
    const name = file.name.toLowerCase();

    if (name.endsWith('.pdf')) {
      await renderPdf(file);
      return;
    }

    if (name.endsWith('.pptx')) {
      await renderPptx(file);
      return;
    }

    resetView();
    if (name.endsWith('.ppt')) {
      setStatus('Legacy .ppt files cannot be parsed reliably in-browser. Convert to .pptx for full reading.', 'error');
    } else {
      setStatus('Unsupported file type. Please upload .pdf, .pptx, or .ppt.', 'error');
    }
  } catch (error) {
    resetView();
    setStatus(`Failed to render file: ${error.message}`, 'error');
  }
};

fileInput.addEventListener('change', async (event) => {
  const [file] = event.target.files;
  if (file) await handleFile(file);
});

document.addEventListener('dragover', (event) => event.preventDefault());

document.addEventListener('drop', async (event) => {
  event.preventDefault();
  const [file] = event.dataTransfer.files;
  if (file) await handleFile(file);
});
