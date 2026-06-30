import { formatTimestamp } from '../../dropins/youtube/youtube-source.js';

/**
 * Render transcript data as quote-addressable markdown with YAML frontmatter.
 */

export function renderTranscriptMarkdown({
  title,
  url,
  segments,
  speakerLabels,
  range,
  created,
  transcriptSource,
  transcriptionProvider,
  diarization,
}) {
  const date = created || new Date().toISOString().slice(0, 10);

  const frontmatter = [
    '---',
    'type: transcript',
    'source: youtube',
    `url: ${url}`,
    `video_title: ${escapeYaml(title)}`,
    `created: ${date}`,
    `range: ${range || 'full'}`,
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

  const body = [
    `# ${title}`,
    '## Transcript',
    ...segments.map(seg => {
      const ts = formatTimestamp(seg.start);
      return `${ts} ${seg.speaker}:\n"${escapeQuotes(seg.text)}"`;
    }),
  ].join('\n\n');

  return `${frontmatter.join('\n')}\n\n${body}\n`;
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

export function describeRange(startTime, endTime) {
  if (!startTime && !endTime) return 'full';
  const parts = [];
  if (startTime) parts.push(`from ${startTime}`);
  if (endTime) parts.push(`to ${endTime}`);
  return parts.join(' ');
}