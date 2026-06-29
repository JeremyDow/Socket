/**
 * Speaker label assignment.
 *
 * LIMITATION (v0): True speaker diarization is NOT implemented.
 * When Host and Guest names are provided, labels alternate by segment index.
 * Otherwise all segments are labeled "Speaker 1".
 *
 * This limitation is surfaced in the UI via speakerLabelMode in workflow meta.
 */

export const SPEAKER_MODES = {
  ALTERNATING: 'alternating',
  SINGLE: 'single',
};

export function assignSpeakerLabels(segments, { hostName, guestName } = {}) {
  const hasHost = hostName && hostName.trim();
  const hasGuest = guestName && guestName.trim();

  if (hasHost && hasGuest) {
    return {
      mode: SPEAKER_MODES.ALTERNATING,
      limitation:
        'Speaker labels alternate by segment (Host/Guest). True diarization is not available in v0.',
      segments: segments.map((seg, i) => ({
        ...seg,
        speaker: i % 2 === 0 ? hostName.trim() : guestName.trim(),
        speakerKey: i % 2 === 0 ? 'speaker_1' : 'speaker_2',
      })),
      speakerLabels: {
        speaker_1: hostName.trim(),
        speaker_2: guestName.trim(),
      },
    };
  }

  const label = hasHost ? hostName.trim() : 'Speaker 1';
  return {
    mode: SPEAKER_MODES.SINGLE,
    limitation:
      'All segments labeled as a single speaker. Provide Host and Guest names for alternating labels.',
    segments: segments.map(seg => ({
      ...seg,
      speaker: label,
      speakerKey: 'speaker_1',
    })),
    speakerLabels: {
      speaker_1: label,
    },
  };
}