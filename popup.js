document.getElementById('openReader').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('viewer.html') });
});
