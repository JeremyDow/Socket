import { getSource, getDestination, getProcessor } from '../../core/capability-registry.js';
import { createArtifact } from '../../core/artifact.js';
import { assignSpeakerLabels } from './speaker-labels.js';
import { renderTranscriptMarkdown, describeRange } from './markdown-renderer.js';

/**
 * YouTube → Transcript Workflow
 *
 * Composes drop-ins through Socket core contracts:
 *   source (youtube) → [processor (local_whisper) if audio] → label + render → destination (obsidian)
 */

export const TRANSCRIPT_SOURCE_STATUS = {
  CAPTIONS: 'captions_found',
  AUDIO_FALLBACK: 'no_captions_using_audio_fallback',
  AUDIO_UNAVAILABLE: 'audio_fallback_unavailable',
};

export const youtubeToTranscriptWorkflow = {
  id: 'youtube-to-transcript',
  name: 'YouTube to Transcript',

  async run(input, context = {}) {
    const {
      url,
      startTime,
      endTime,
      hostName,
      guestName,
      vaultPath,
      transcriptFolder,
      sourceId = 'youtube',
      destinationId = 'obsidian',
      processorId = 'local_whisper',
    } = input;

    const onProgress = context.onProgress ?? (() => {});

    // Stage 1: Source drop-in (captions or audio)
    const source = getSource(sourceId);
    const sourceArtifact = await source.fetch({
      url,
      startTime,
      endTime,
      onProgress,
      _execYtDlp: context._execYtDlp,
    });

    const { title, url: videoUrl } = sourceArtifact.data;
    let rawSegments;
    let transcriptSource;
    let transcriptionProvider;
    let diarization;
    let transcriptSourceStatus;

    if (sourceArtifact.type === 'youtube.transcript') {
      rawSegments = sourceArtifact.data.segments;
      transcriptSource = 'captions';
      transcriptSourceStatus = TRANSCRIPT_SOURCE_STATUS.CAPTIONS;
    } else if (sourceArtifact.type === 'youtube.audio') {
      transcriptSourceStatus = TRANSCRIPT_SOURCE_STATUS.AUDIO_FALLBACK;
      onProgress('transcribing', 'Transcribing audio with local Whisper');

      try {
        const processor = getProcessor(processorId);
        const transcriptArtifact = await processor.transcribe(sourceArtifact, {
          _execWhisper: context._execWhisper,
          _checkWhisper: context._checkWhisper,
        });

        rawSegments = transcriptArtifact.data.segments;
        transcriptSource = transcriptArtifact.data.transcriptSource;
        transcriptionProvider = transcriptArtifact.data.transcriptionProvider;
        diarization = transcriptArtifact.data.diarization;
      } catch (err) {
        err.transcriptSourceStatus = TRANSCRIPT_SOURCE_STATUS.AUDIO_UNAVAILABLE;
        throw err;
      }
    } else {
      throw new Error(`Unexpected source artifact type: ${sourceArtifact.type}`);
    }

    if (!rawSegments || rawSegments.length === 0) {
      throw new Error('No transcript segments found in the selected range.');
    }

    // Stage 2: Processor — speaker labels + markdown render
    onProgress('rendering_markdown', 'Rendering markdown');
    const labeled = assignSpeakerLabels(rawSegments, { hostName, guestName });
    const range = describeRange(startTime, endTime);

    const markdown = renderTranscriptMarkdown({
      title,
      url: videoUrl,
      segments: labeled.segments,
      speakerLabels: labeled.speakerLabels,
      range,
      transcriptSource,
      transcriptionProvider,
      diarization,
    });

    const transcriptArtifact = createArtifact('transcript.markdown', {
      title,
      markdown,
      url: videoUrl,
    }, {
      speakerLabelMode: labeled.mode,
      speakerLabelLimitation: labeled.limitation,
      transcriptSource,
    });

    // Stage 3: Destination drop-in
    onProgress('writing_obsidian_file', 'Writing Obsidian file');
    const destination = getDestination(destinationId);
    const writeResult = await destination.write(transcriptArtifact, {
      vaultPath,
      transcriptFolder,
      filename: title,
    });

    return {
      artifact: transcriptArtifact,
      writtenPath: writeResult.data.path,
      preview: markdown,
      meta: {
        speakerLabelMode: labeled.mode,
        speakerLabelLimitation: labeled.limitation,
        segmentCount: labeled.segments.length,
        videoTitle: title,
        transcriptSource,
        transcriptSourceStatus,
        transcriptionProvider: transcriptionProvider ?? null,
        diarization: diarization ?? null,
      },
    };
  },
};