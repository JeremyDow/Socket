const form = document.getElementById('transcript-form');
const statusEl = document.getElementById('status');
const previewEl = document.getElementById('preview');
const errorEl = document.getElementById('error');
const filePathEl = document.getElementById('file-path');
const limitationEl = document.getElementById('limitation');
const submitBtn = document.getElementById('submit-btn');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearResult();
  setStatus('running', 'Generating transcript…');
  submitBtn.disabled = true;

  const input = {
    url: form.url.value.trim(),
    startTime: form.startTime.value.trim() || undefined,
    endTime: form.endTime.value.trim() || undefined,
    hostName: form.hostName.value.trim() || undefined,
    guestName: form.guestName.value.trim() || undefined,
    vaultPath: form.vaultPath.value.trim(),
    transcriptFolder: form.transcriptFolder.value.trim(),
  };

  try {
    const res = await fetch('/api/workflows/transcript', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    const data = await res.json();

    if (!data.success) {
      setStatus('error', 'Failed');
      showError(data.error || 'Unknown error');
      return;
    }

    setStatus('success', `Done — ${data.meta?.segmentCount ?? 0} segments`);
    showPreview(data.preview);
    showFilePath(data.writtenPath);

    if (data.meta?.speakerLabelLimitation) {
      limitationEl.textContent = data.meta.speakerLabelLimitation;
      limitationEl.classList.remove('hidden');
    }
  } catch (err) {
    setStatus('error', 'Failed');
    showError(err.message || String(err));
  } finally {
    submitBtn.disabled = false;
  }
});

function setStatus(kind, text) {
  statusEl.className = `status ${kind}`;
  statusEl.textContent = text;
}

function clearResult() {
  previewEl.classList.add('hidden');
  previewEl.textContent = '';
  errorEl.classList.add('hidden');
  errorEl.textContent = '';
  filePathEl.classList.add('hidden');
  filePathEl.textContent = '';
  limitationEl.classList.add('hidden');
  limitationEl.textContent = '';
}

function showPreview(markdown) {
  if (!markdown) return;
  previewEl.textContent = markdown;
  previewEl.classList.remove('hidden');
}

function showFilePath(path) {
  if (!path) return;
  filePathEl.textContent = `Written to: ${path}`;
  filePathEl.classList.remove('hidden');
}

function showError(message) {
  errorEl.textContent = message;
  errorEl.classList.remove('hidden');
}