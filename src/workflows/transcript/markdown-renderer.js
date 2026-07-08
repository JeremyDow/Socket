import { formatTimestamp, parseTimestamp } from '../../dropins/youtube/youtube-source.js';

/**
 * Render transcript data as quote-addressable markdown with YAML frontmatter.
 */

export function formatRangeTimestamp(ts) {
  if (ts == null || ts === '') return '00:00:00';
  const seconds = Math.floor(parseTimestamp(ts));
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function describeRange(startTime, endTime) {
  if (!startTime && !endTime) return 'full';

  const start = startTime ? formatRangeTimestamp(startTime) : '00:00:00';
  const end = endTime ? formatRangeTimestamp(endTime) : '';

  if (startTime && endTime) return `${start}-${end}`;
  if (startTime) return `${start}-`;
  return `00:00:00-${end}`;
}

export function isQuoteClip(startTime, endTime) {
  return Boolean(startTime || endTime);
}

export function quoteClipHeading(startTime, endTime) {
  const start = startTime ? formatRangeTimestamp(startTime) : '00:00:00';
  const end = endTime ? formatRangeTimestamp(endTime) : 'end';
  return `## Quote Clip: ${start}–${end}`;
}

export function renderTranscriptMarkdown({
  title,
  url,
  segments,
  speakerLabels,
  range,
  startTime,
  endTime,
  created,
  transcriptSource,
  transcriptionProvider,
  diarization,
}) {
  const date = created || new Date().toISOString().slice(0, 10);
  const quoteClip = isQuoteClip(startTime, endTime);
  const rangeLabel = range || describeRange(startTime, endTime);

  const frontmatter = [
    '---',
    'type: transcript',
    'source: youtube',
    `url: ${url}`,
    `video_title: ${escapeYaml(title)}`,
    `created: ${date}`,
    `range: ${rangeLabel}`,
    `transcript_source: ${transcriptSource || 'captions'}`,
  ];

  if (transcriptSource === 'audio_transcription') {
    frontmatter.push(`transcription_provider: ${transcriptionProvider || 'local_whisper'}`);
    frontmatter.push(`diarization: ${diarization === true ? 'true' : 'false'}`);
  }

  frontmatter.push(
    'speaker_labels:',
    ...Object.entries(speakerLabels || {}).map(
      ([key, name]) => `  ${key}: ${escapeYaml(name)}`
    ),
    '---',
  );

  const sectionHeading = quoteClip
    ? quoteClipHeading(startTime, endTime)
    : '## Transcript';

  const body = [
    `# ${title}`,
    sectionHeading,
    ...segments.map(seg => {
      const ts = formatTimestamp(seg.start);
      return `${ts} ${seg.speaker}:\n"${escapeQuotes(seg.text)}"`;
    }),
  ].join('\n\n');

  return `${frontmatter.join('\n')}\n\n${body}\n`;
}

/**
 * Extract quote blocks from rendered markdown (body only, no frontmatter).
 */
export function extractQuoteBlocks(markdown) {
  if (!markdown) return '';

  const withoutFrontmatter = markdown.replace(/^---[\s\S]*?---\n*/m, '');
  const titleMatch = withoutFrontmatter.match(/^# .+\n\n([\s\S]*)$/m);
  if (!titleMatch) return withoutFrontmatter.trim();

  return titleMatch[1].trim();
}

function escapeYaml(str) {
  if (!str) return '';
  if (/[:#\[\]{}|>&*!%@`,]/.test(str) || str.includes('\n')) {
    return `"${str.replace(/"/g, '\\"')}"`;
  }
  return str;
}

function escapeQuotes(str) {
  return (str || '').replace(/"/g, '\\"');
}