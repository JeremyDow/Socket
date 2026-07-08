const form = document.getElementById('transcript-form');
const statusEl = document.getElementById('status');
const previewEl = document.getElementById('preview');
const errorEl = document.getElementById('error');
const filePathEl = document.getElementById('file-path');
const filePathPanel = document.getElementById('file-path-panel');
const previewPanel = document.getElementById('preview-panel');
const limitationEl = document.getElementById('limitation');
const transcriptSourceEl = document.getElementById('transcript-source');
const progressStagesEl = document.getElementById('progress-stages');
const submitBtn = document.getElementById('submit-btn');
const saveDefaultsBtn = document.getElementById('save-defaults-btn');
const defaultsNoticeEl = document.getElementById('defaults-notice');
const copyPathBtn = document.getElementById('copy-path-btn');
const revealBtn = document.getElementById('reveal-btn');
const copyMarkdownBtn = document.getElementById('copy-markdown-btn');
const copyQuotesBtn = document.getElementById('copy-quotes-btn');
const diagnosticsEl = document.getElementById('diagnostics');

let currentWrittenPath = '';
let currentMarkdown = '';
let revealSupported = false;

const STAGE_LABELS = {
  resolving_video: 'Resolving video',
  extracting_audio: 'Extracting audio',
  transcribing: 'Transcribing',
  rendering_markdown: 'Rendering markdown',
  writing_obsidian_file: 'Writing Obsidian file',
};

const SOURCE_STATUS_LABELS = {
  captions_found: 'Captions found',
  no_captions_using_audio_fallback: 'No captions — using audio fallback',
  audio_fallback_unavailable: 'Audio fallback unavailable',
};

loadDefaults();
loadDiagnostics();

copyPathBtn.addEventListener('click', () => copyText(currentWrittenPath, 'Path copied'));
copyMarkdownBtn.addEventListener('click', () => copyText(currentMarkdown, 'Markdown copied'));
copyQuotesBtn.addEventListener('click', () => copyText(extractQuoteBlocks(currentMarkdown), 'Quote block copied'));
revealBtn.addEventListener('click', revealInFinder);

saveDefaultsBtn.addEventListener('click', async () => {
  const vaultPath = form.vaultPath.value.trim();
  const transcriptFolder = form.transcriptFolder.value.trim();

  if (!vaultPath || !transcriptFolder) {
    showDefaultsNotice('Enter vault path and transcript folder before saving.', 'warning');
    return;
  }

  saveDefaultsBtn.disabled = true;
  try {
    const res = await fetch('/api/config/defaults', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        defaults: {
          destination: 'obsidian',
          obsidian: { vaultPath, transcriptFolder },
        },
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to save defaults');
    }

    showDefaultsNotice('Defaults saved.', 'success');
  } catch (err) {
    showDefaultsNotice(err.message || String(err), 'warning');
  } finally {
    saveDefaultsBtn.disabled = false;
  }
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearResult();
  setStatus('running', 'Starting…');
  initProgressStages();
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
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/x-ndjson',
      },
      body: JSON.stringify(input),
    });

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let finalResult = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        const event = JSON.parse(line);

        if (event.type === 'progress') {
          setStatus('running', STAGE_LABELS[event.stage] || event.message);
          markStageDone(event.stage);
        } else if (event.type === 'complete') {
          finalResult = event;
        } else if (event.type === 'error') {
          throw new Error(event.error);
        }
      }
    }

    if (!finalResult) {
      throw new Error('No result received from server');
    }

    if (!finalResult.success) {
      setStatus('error', 'Failed');
      showTranscriptSource(finalResult.meta?.transcriptSourceStatus || 'audio_fallback_unavailable');
      showError(finalResult.error || 'Unknown error');
      return;
    }

    setStatus('success', `Done — ${finalResult.meta?.segmentCount ?? 0} segments`);
    showTranscriptSource(finalResult.meta?.transcriptSourceStatus);
    showPreview(finalResult.preview);
    showFilePath(finalResult.writtenPath);

    if (finalResult.meta?.speakerLabelLimitation) {
      limitationEl.textContent = finalResult.meta.speakerLabelLimitation;
      limitationEl.classList.remove('hidden');
    }
  } catch (err) {
    setStatus('error', 'Failed');
    showError(err.message || String(err));
  } finally {
    submitBtn.disabled = false;
  }
});

async function loadDefaults() {
  try {
    const res = await fetch('/api/config');
    const data = await res.json();
    const obsidian = data.defaults?.obsidian;

    if (obsidian?.vaultPath) {
      form.vaultPath.value = obsidian.vaultPath;
    }
    if (obsidian?.transcriptFolder) {
      form.transcriptFolder.value = obsidian.transcriptFolder;
    }

    if (data.migration?.migrated) {
      showDefaultsNotice(data.migration.message, 'success');
    } else if (data.migration?.warning) {
      showDefaultsNotice(data.migration.warning, 'warning');
    } else if (data.exists && obsidian?.vaultPath && obsidian?.transcriptFolder) {
      showDefaultsNotice('Defaults loaded.', 'success');
    }
  } catch {
    // Non-fatal
  }
}

async function loadDiagnostics() {
  try {
    const res = await fetch('/api/health');
    const data = await res.json();
    const d = data.diagnostics || {};

    revealSupported = d.platform === 'darwin';
    revealBtn.style.display = revealSupported ? 'inline-block' : 'none';

    const fmt = (tool) => {
      if (!tool) return 'n/a';
      return tool.available ? tool.path : 'not found';
    };

    diagnosticsEl.textContent =
      `yt-dlp: ${fmt(d.ytDlp)} · ffmpeg: ${fmt(d.ffmpeg)} · whisper: ${fmt(d.whisper)}`;
  } catch {
    diagnosticsEl.textContent = 'Diagnostics unavailable';
  }
}

async function revealInFinder() {
  if (!currentWrittenPath) return;

  try {
    const res = await fetch('/api/reveal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: currentWrittenPath }),
    });
    const data = await res.json();
    if (!data.success) {
      if (res.status === 501) {
        await copyText(currentWrittenPath, 'Reveal unavailable — path copied instead');
      } else {
        throw new Error(data.error || 'Reveal failed');
      }
    }
  } catch (err) {
    showError(err.message || String(err));
  }
}

function extractQuoteBlocks(markdown) {
  if (!markdown) return '';
  const withoutFrontmatter = markdown.replace(/^---[\s\S]*?---\n*/m, '');
  const match = withoutFrontmatter.match(/^# .+\n\n([\s\S]*)$/m);
  return match ? match[1].trim() : withoutFrontmatter.trim();
}

async function copyText(text, successMessage) {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    flashButtonStatus(successMessage);
  } catch {
    showError('Clipboard copy failed');
  }
}

function flashButtonStatus(message) {
  const prev = statusEl.textContent;
  const prevClass = statusEl.className;
  setStatus('success', message);
  setTimeout(() => {
    statusEl.className = prevClass;
    statusEl.textContent = prev;
  }, 1500);
}

function showDefaultsNotice(message, kind = 'success') {
  defaultsNoticeEl.textContent = message;
  defaultsNoticeEl.className = `defaults-notice ${kind}`;
  defaultsNoticeEl.classList.remove('hidden');
}

function setStatus(kind, text) {
  statusEl.className = `status ${kind}`;
  statusEl.textContent = text;
}

function clearResult() {
  currentWrittenPath = '';
  currentMarkdown = '';
  previewPanel.classList.add('hidden');
  previewEl.textContent = '';
  errorEl.classList.add('hidden');
  errorEl.textContent = '';
  filePathPanel.classList.add('hidden');
  filePathEl.textContent = '';
  limitationEl.classList.add('hidden');
  limitationEl.textContent = '';
  transcriptSourceEl.classList.add('hidden');
  transcriptSourceEl.textContent = '';
  progressStagesEl.classList.add('hidden');
  progressStagesEl.innerHTML = '';
}

function initProgressStages() {
  progressStagesEl.innerHTML = Object.entries(STAGE_LABELS)
    .map(([key, label]) => `<li data-stage="${key}" class="stage pending">${label}</li>`)
    .join('');
  progressStagesEl.classList.remove('hidden');
}

function markStageDone(stage) {
  const el = progressStagesEl.querySelector(`[data-stage="${stage}"]`);
  if (el) {
    el.classList.remove('pending');
    el.classList.add('done');
  }
}

function showTranscriptSource(status) {
  if (!status) return;
  const label = SOURCE_STATUS_LABELS[status] || status;
  transcriptSourceEl.textContent = `Transcript source: ${label}`;
  transcriptSourceEl.className = `transcript-source ${status}`;
  transcriptSourceEl.classList.remove('hidden');
}

function showPreview(markdown) {
  if (!markdown) return;
  currentMarkdown = markdown;
  previewEl.textContent = markdown;
  previewPanel.classList.remove('hidden');
}

function showFilePath(path) {
  if (!path) return;
  currentWrittenPath = path;
  filePathEl.textContent = path;
  filePathPanel.classList.remove('hidden');
}

function showError(message) {
  errorEl.textContent = message;
  errorEl.classList.remove('hidden');
}