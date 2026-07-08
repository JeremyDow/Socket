/**
 * Speaker label assignment.
 *
 * LIMITATION: True speaker diarization is NOT implemented.
 * - Host + Guest → alternate by segment
 * - Host only → all segments labeled Host
 * - Neither → all segments labeled Speaker 1
 */

export const SPEAKER_WARNING =
  'Speaker labels are provisional. True diarization is not available.';

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
      limitation: `${SPEAKER_WARNING} Host and Guest alternate by segment.`,
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
  const detail = hasHost
    ? 'All segments labeled as Host.'
    : 'All segments labeled as Speaker 1.';

  return {
    mode: SPEAKER_MODES.SINGLE,
    limitation: `${SPEAKER_WARNING} ${detail}`,
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