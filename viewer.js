import { unzipSync, strFromU8 } from './vendor/fflate.js';
import * as pdfjsLib from './vendor/pdf.min.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = './vendor/pdf.worker.min.mjs';

const fileInput = document.getElementById('fileInput');
const fileName = document.getElementById('fileName');
const themeSelect = document.getElementById('themeSelect');
const welcome = document.getElementById('welcome');
const status = document.getElementById('status');
const pdfReader = document.getElementById('pdfReader');
const pptWorkspace = document.getElementById('pptWorkspace');

const thumbPane = document.getElementById('thumbPane');
const pageCanvas = document.getElementById('pageCanvas');
const pageNumber = document.getElementById('pageNumber');
const pageCount = document.getElementById('pageCount');
const prevPage = document.getElementById('prevPage');
const nextPage = document.getElementById('nextPage');
const zoomIn = document.getElementById('zoomIn');
const zoomOut = document.getElementById('zoomOut');
const zoomSelect = document.getElementById('zoomSelect');
const toggleSidebar = document.getElementById('toggleSidebar');

let currentPdf = null;
let currentPage = 1;
let currentScale = 1;

const setStatus = (message, type = 'info') => {
  status.textContent = message;
  status.classList.remove('hidden');
  status.style.borderColor = type === 'error' ? '#ef4444' : '';
};

const clearStatus = () => {
  status.classList.add('hidden');
  status.style.borderColor = '';
};

const resetWorkspaces = () => {
  pdfReader.classList.add('hidden');
  pptWorkspace.classList.add('hidden');
  pptWorkspace.innerHTML = '';
  welcome.classList.remove('hidden');
  clearStatus();
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

const renderPage = async () => {
  if (!currentPdf) return;

  const page = await currentPdf.getPage(currentPage);
  const viewport = page.getViewport({ scale: currentScale });
  const ratio = Math.max(window.devicePixelRatio || 1, 1.25);

  pageCanvas.width = Math.floor(viewport.width * ratio);
  pageCanvas.height = Math.floor(viewport.height * ratio);
  pageCanvas.style.width = `${Math.floor(viewport.width)}px`;
  pageCanvas.style.height = `${Math.floor(viewport.height)}px`;

  const ctx = pageCanvas.getContext('2d', { alpha: false });
  await page.render({
    canvasContext: ctx,
    viewport,
    transform: [ratio, 0, 0, ratio, 0, 0],
  }).promise;

  pageNumber.value = String(currentPage);
};

const setPage = async (page) => {
  if (!currentPdf) return;
  currentPage = Math.max(1, Math.min(page, currentPdf.numPages));
  await renderPage();
  updateActiveThumb();
};

const updateActiveThumb = () => {
  [...thumbPane.querySelectorAll('.thumb-item')].forEach((el) => {
    el.classList.toggle('active', Number(el.dataset.page) === currentPage);
  });
};

const renderThumbnails = async () => {
  thumbPane.innerHTML = '';
  if (!currentPdf) return;

  for (let i = 1; i <= currentPdf.numPages; i += 1) {
    const page = await currentPdf.getPage(i);
    const viewport = page.getViewport({ scale: 0.2 });
    const thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = Math.floor(viewport.width);
    thumbCanvas.height = Math.floor(viewport.height);

    const ctx = thumbCanvas.getContext('2d', { alpha: false });
    await page.render({ canvasContext: ctx, viewport }).promise;

    const item = document.createElement('button');
    item.className = 'thumb-item';
    item.dataset.page = String(i);
    item.append(thumbCanvas);

    const label = document.createElement('span');
    label.textContent = String(i);
    item.append(label);

    item.addEventListener('click', async () => {
      await setPage(i);
    });

    thumbPane.append(item);
  }

  updateActiveThumb();
};

const loadPdf = async (file) => {
  const bytes = await file.arrayBuffer();
  currentPdf = await pdfjsLib.getDocument({ data: bytes }).promise;
  currentPage = 1;
  currentScale = Number(zoomSelect.value) || 1;

  resetWorkspaces();
  pdfReader.classList.remove('hidden');
  welcome.classList.add('hidden');

  fileName.textContent = file.name;
  pageCount.textContent = `of ${currentPdf.numPages}`;
  setStatus(`PDF loaded: ${file.name}`);

  await renderThumbnails();
  await renderPage();
};

const parsePptxSlides = (arrayBuffer) => {
  const zip = unzipSync(new Uint8Array(arrayBuffer));
  const paths = Object.keys(zip)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => Number(a.match(/slide(\d+)\.xml$/)?.[1] || 0) - Number(b.match(/slide(\d+)\.xml$/)?.[1] || 0));

  return paths.map((path) => {
    const xml = strFromU8(zip[path]);
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    return [...doc.getElementsByTagName('a:t')].map((node) => node.textContent?.trim()).filter(Boolean);
  });
};

const loadPptx = async (file) => {
  const slides = parsePptxSlides(await file.arrayBuffer());

  resetWorkspaces();
  pptWorkspace.classList.remove('hidden');
  welcome.classList.add('hidden');
  fileName.textContent = file.name;
  setStatus(`PPTX loaded: ${file.name} • ${slides.length} slides`);

  slides.forEach((texts, idx) => {
    const card = document.createElement('article');
    card.className = 'slide';

    const title = document.createElement('h3');
    title.textContent = `Slide ${idx + 1}`;
    card.append(title);

    const list = document.createElement('ul');
    (texts.length ? texts : ['(No text on this slide)']).forEach((text) => {
      const li = document.createElement('li');
      li.textContent = text;
      list.append(li);
    });

    card.append(list);
    pptWorkspace.append(card);
  });
};

const handleFile = async (file) => {
  try {
    const name = file.name.toLowerCase();
    if (name.endsWith('.pdf')) return await loadPdf(file);
    if (name.endsWith('.pptx')) return await loadPptx(file);

    resetWorkspaces();
    fileName.textContent = file.name;
    if (name.endsWith('.ppt')) {
      setStatus('Legacy .ppt is not supported directly. Convert to .pptx for best results.', 'error');
    } else {
      setStatus('Unsupported file type. Use .pdf, .pptx, or .ppt.', 'error');
    }
  } catch (error) {
    resetWorkspaces();
    setStatus(`Failed to load file: ${error.message}`, 'error');
  }
};

fileInput.addEventListener('change', async (event) => {
  const [file] = event.target.files;
  if (file) await handleFile(file);
});

pageNumber.addEventListener('change', async () => {
  await setPage(Number(pageNumber.value || 1));
});

prevPage.addEventListener('click', async () => {
  await setPage(currentPage - 1);
});

nextPage.addEventListener('click', async () => {
  await setPage(currentPage + 1);
});

zoomSelect.addEventListener('change', async () => {
  currentScale = Number(zoomSelect.value);
  await renderPage();
});

zoomIn.addEventListener('click', async () => {
  currentScale = Math.min(currentScale + 0.15, 3);
  zoomSelect.value = String(Math.round(currentScale * 100) / 100);
  await renderPage();
});

zoomOut.addEventListener('click', async () => {
  currentScale = Math.max(currentScale - 0.15, 0.5);
  zoomSelect.value = String(Math.round(currentScale * 100) / 100);
  await renderPage();
});

toggleSidebar.addEventListener('click', () => {
  thumbPane.classList.toggle('hidden');
});

document.addEventListener('dragover', (event) => event.preventDefault());
document.addEventListener('drop', async (event) => {
  event.preventDefault();
  const [file] = event.dataTransfer.files;
  if (file) await handleFile(file);
});
