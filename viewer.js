import { unzipSync, strFromU8 } from './vendor/fflate.js';

const fileInput = document.getElementById('fileInput');
const themeSelect = document.getElementById('themeSelect');
const welcome = document.getElementById('welcome');
const status = document.getElementById('status');
const pdfView = document.getElementById('pdfView');
const pptView = document.getElementById('pptView');

const renderStatus = (message, type = 'info') => {
  status.textContent = message;
  status.classList.remove('hidden');
  status.style.borderColor = type === 'error' ? '#f97373aa' : '';
};

const resetView = () => {
  pdfView.classList.add('hidden');
  pptView.classList.add('hidden');
  pptView.innerHTML = '';
  pdfView.innerHTML = '';
  status.classList.add('hidden');
  welcome.classList.remove('hidden');
};

const clearStatusStyle = () => {
  status.style.borderColor = '';
};

themeSelect.addEventListener('change', () => {
  document.body.dataset.theme = themeSelect.value;
  localStorage.setItem('night-owl-theme', themeSelect.value);
});

const savedTheme = localStorage.getItem('night-owl-theme');
if (savedTheme) {
  document.body.dataset.theme = savedTheme;
  themeSelect.value = savedTheme;
}

const handleFile = async (file) => {
  resetView();
  clearStatusStyle();
  const name = file.name.toLowerCase();

  try {
    if (name.endsWith('.pdf')) {
      await renderPdf(file);
      return;
    }

    if (name.endsWith('.pptx')) {
      await renderPptx(file);
      return;
    }

    if (name.endsWith('.ppt')) {
      renderStatus('Legacy .ppt format is not browser-readable. Please convert to .pptx for full preview.', 'error');
      return;
    }

    renderStatus('Unsupported file type. Choose .pdf, .pptx, or .ppt.', 'error');
  } catch (error) {
    renderStatus(`Failed to read file: ${error.message}`, 'error');
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

const renderPdf = async (file) => {
  const objectUrl = URL.createObjectURL(file);
  const frame = document.createElement('iframe');
  frame.src = objectUrl;
  frame.title = file.name;

  pdfView.append(frame);
  pdfView.classList.remove('hidden');
  welcome.classList.add('hidden');
  renderStatus(`PDF loaded: ${file.name}`);

  frame.addEventListener('load', () => {
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  });
};

const parsePptxSlides = (arrayBuffer) => {
  const zip = unzipSync(new Uint8Array(arrayBuffer));

  const slidePaths = Object.keys(zip)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const aNumber = Number(a.match(/slide(\d+)\.xml$/)?.[1] || 0);
      const bNumber = Number(b.match(/slide(\d+)\.xml$/)?.[1] || 0);
      return aNumber - bNumber;
    });

  return slidePaths.map((slidePath) => {
    const xml = strFromU8(zip[slidePath]);
    const parser = new DOMParser();
    const documentNode = parser.parseFromString(xml, 'application/xml');

    return [...documentNode.getElementsByTagName('a:t')]
      .map((node) => node.textContent?.trim())
      .filter(Boolean);
  });
};

const renderPptx = async (file) => {
  const slides = parsePptxSlides(await file.arrayBuffer());
  pptView.classList.remove('hidden');
  welcome.classList.add('hidden');

  renderStatus(`PPTX loaded: ${file.name} • ${slides.length} slides`);

  if (!slides.length) {
    const empty = document.createElement('article');
    empty.className = 'slide';
    empty.textContent = 'No text content found in this PPTX file.';
    pptView.append(empty);
    return;
  }

  slides.forEach((texts, index) => {
    const card = document.createElement('article');
    card.className = 'slide';

    const title = document.createElement('h3');
    title.textContent = `Slide ${index + 1}`;
    card.append(title);

    if (!texts.length) {
      const p = document.createElement('p');
      p.textContent = '(No text found on this slide)';
      card.append(p);
    } else {
      const list = document.createElement('ul');
      texts.forEach((text) => {
        const item = document.createElement('li');
        item.textContent = text;
        list.append(item);
      });
      card.append(list);
    }

    pptView.append(card);
  });
};
