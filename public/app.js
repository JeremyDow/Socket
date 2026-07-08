const form = document.getElementById('transcript-form');
const toolTabsEl = document.getElementById('tool-tabs');
const activeToolStatusEl = document.getElementById('active-tool-status');
const markdownEmptyEl = document.getElementById('markdown-empty');
const obsidianEmptyEl = document.getElementById('obsidian-empty');
const transcriberRuntimeEl = document.getElementById('transcriber-runtime');
const obsidianValidationEl = document.getElementById('obsidian-validation');
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

let toolManifest = [];
let activeToolId = 'youtube';

const TABLIST_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'Home', 'End']);

toolTabsEl.addEventListener('keydown', handleToolTabKeydown);

loadToolShell();
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

async function loadToolShell() {
  try {
    const res = await fetch('/api/tools');
    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error((data.errors || []).join('; ') || 'Failed to load tool manifest');
    }
    toolManifest = data.tools;
    renderToolTabs(toolManifest);
    const initial = toolManifest.find((tool) => tool.selectable) || toolManifest[0];
    if (initial) setActiveTool(initial.id);
  } catch (err) {
    toolTabsEl.innerHTML = '<span class="tool-tabs-error">Tool manifest unavailable</span>';
    activeToolStatusEl.textContent = err.message || String(err);
  }
}

function renderToolTabs(tools) {
  toolTabsEl.innerHTML = '';
  for (const tool of tools) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.role = 'tab';
    btn.id = `tab-${tool.id}`;
    btn.dataset.toolId = tool.id;
    btn.textContent = tool.label;
    btn.setAttribute('aria-selected', 'false');
    btn.setAttribute('aria-controls', `panel-${tool.id}`);
    btn.setAttribute('tabindex', '-1');

    if (!tool.selectable) {
      btn.disabled = true;
      btn.className = 'tool-tab unavailable';
      btn.title = tool.unavailableReason || 'Unavailable';
      btn.setAttribute('aria-disabled', 'true');
    } else {
      btn.className = 'tool-tab';
      btn.addEventListener('click', () => setActiveTool(tool.id));
    }

    toolTabsEl.appendChild(btn);
  }
}

function setActiveTool(toolId) {
  const tool = toolManifest.find((entry) => entry.id === toolId);
  if (!tool || !tool.selectable) return;

  activeToolId = toolId;

  for (const btn of toolTabsEl.querySelectorAll('[data-tool-id]')) {
    const selected = btn.dataset.toolId === toolId;
    btn.classList.toggle('active', selected);
    btn.setAttribute('aria-selected', selected ? 'true' : 'false');
    if (!btn.disabled) {
      btn.setAttribute('tabindex', selected ? '0' : '-1');
    }
  }

  for (const surface of document.querySelectorAll('[data-tool-surface]')) {
    const active = surface.dataset.toolSurface === toolId;
    surface.classList.toggle('hidden', !active);
    surface.classList.toggle('active', active);
    surface.hidden = !active;
  }

  activeToolStatusEl.textContent = `Active tool: ${tool.label}`;
}

function getSelectableToolIds() {
  return toolManifest.filter((tool) => tool.selectable).map((tool) => tool.id);
}

function handleToolTabKeydown(event) {
  if (!TABLIST_KEYS.has(event.key)) return;

  const selectableIds = getSelectableToolIds();
  if (selectableIds.length === 0) return;

  const focusedToolId = document.activeElement?.dataset?.toolId;
  const startToolId = selectableIds.includes(focusedToolId) ? focusedToolId : activeToolId;
  const currentIndex = selectableIds.indexOf(startToolId);
  if (currentIndex === -1) return;

  let nextIndex = currentIndex;
  if (event.key === 'ArrowRight') {
    nextIndex = (currentIndex + 1) % selectableIds.length;
  } else if (event.key === 'ArrowLeft') {
    nextIndex = (currentIndex - 1 + selectableIds.length) % selectableIds.length;
  } else if (event.key === 'Home') {
    nextIndex = 0;
  } else if (event.key === 'End') {
    nextIndex = selectableIds.length - 1;
  }

  event.preventDefault();
  const nextToolId = selectableIds[nextIndex];
  setActiveTool(nextToolId);
  document.getElementById(`tab-${nextToolId}`)?.focus();
}

function updateTranscriberSurface(message) {
  if (transcriberRuntimeEl) {
    transcriberRuntimeEl.textContent = message;
  }
}

function clearObsidianValidation() {
  if (!obsidianValidationEl) return;
  obsidianValidationEl.textContent = '';
  obsidianValidationEl.classList.add('hidden');
}

function showObsidianValidation(message) {
  if (!obsidianValidationEl) return;
  obsidianValidationEl.textContent = message;
  obsidianValidationEl.classList.remove('hidden');
}

function validateTranscriptForm() {
  clearObsidianValidation();

  for (const field of form.querySelectorAll('[required]')) {
    if (field.disabled) continue;
    const value = typeof field.value === 'string' ? field.value.trim() : field.value;
    if (value) continue;

    const surface = field.closest('[data-tool-surface]');
    const toolId = surface?.dataset?.toolSurface;
    if (toolId) {
      setActiveTool(toolId);
    }

    if (toolId === 'obsidian') {
      showObsidianValidation('Complete the required Obsidian settings before generating a transcript.');
    }

    field.focus();
    field.reportValidity();
    setStatus('idle', 'Ready');
    return false;
  }

  if (form.checkValidity()) {
    return true;
  }

  const firstInvalid = form.querySelector(':invalid');
  if (!firstInvalid) {
    return false;
  }

  const surface = firstInvalid.closest('[data-tool-surface]');
  const toolId = surface?.dataset?.toolSurface;
  if (toolId) {
    setActiveTool(toolId);
  }

  if (toolId === 'obsidian') {
    showObsidianValidation('Complete the required Obsidian settings before generating a transcript.');
  }

  firstInvalid.focus();
  firstInvalid.reportValidity();
  setStatus('idle', 'Ready');
  return false;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!validateTranscriptForm()) {
    return;
  }

  clearResult();
  setStatus('running', 'Starting…');
  updateTranscriberSurface('Transcription in progress…');
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
          const label = STAGE_LABELS[event.stage] || event.message;
          setStatus('running', label);
          updateTranscriberSurface(label);
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
    updateTranscriberSurface('Transcription complete.');
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
  if (markdownEmptyEl) markdownEmptyEl.classList.remove('hidden');
  if (obsidianEmptyEl) obsidianEmptyEl.classList.remove('hidden');
  updateTranscriberSurface('Waiting for workflow status…');
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
  if (markdownEmptyEl) markdownEmptyEl.classList.add('hidden');
}

function showFilePath(path) {
  if (!path) return;
  currentWrittenPath = path;
  filePathEl.textContent = path;
  filePathPanel.classList.remove('hidden');
  if (obsidianEmptyEl) obsidianEmptyEl.classList.add('hidden');
}

function showError(message) {
  errorEl.textContent = message;
  errorEl.classList.remove('hidden');
}