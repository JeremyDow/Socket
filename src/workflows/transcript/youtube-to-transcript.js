import { getSource, getDestination } from '../../core/capability-registry.js';
import { createArtifact } from '../../core/artifact.js';
import { assignSpeakerLabels } from './speaker-labels.js';
import { renderTranscriptMarkdown, describeRange } from './markdown-renderer.js';

/**
 * YouTube → Transcript Workflow
 *
 * Composes drop-ins through Socket core contracts:
 *   source (youtube) → processor (label + render) → destination (obsidian)
 */

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
    } = input;

    // Stage 1: Source drop-in
    const source = getSource(sourceId);
    const rawArtifact = await source.fetch({
      url,
      startTime,
      endTime,
      _execYtDlp: context._execYtDlp,
    });

    const { title, segments: rawSegments, url: videoUrl } = rawArtifact.data;

    if (!rawSegments || rawSegments.length === 0) {
      throw new Error('No transcript segments found in the selected range.');
    }

    // Stage 2: Processor — speaker labels + markdown render
    const labeled = assignSpeakerLabels(rawSegments, { hostName, guestName });
    const range = describeRange(startTime, endTime);

    const markdown = renderTranscriptMarkdown({
      title,
      url: videoUrl,
      segments: labeled.segments,
      speakerLabels: labeled.speakerLabels,
      range,
    });

    const transcriptArtifact = createArtifact('transcript.markdown', {
      title,
      markdown,
      url: videoUrl,
    }, {
      speakerLabelMode: labeled.mode,
      speakerLabelLimitation: labeled.limitation,
    });

    // Stage 3: Destination drop-in
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
      },
    };
  },
};