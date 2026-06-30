import { registerYoutubeDropin } from './dropins/youtube/index.js';
import { registerObsidianDropin } from './dropins/obsidian/index.js';
import { registerWhisperProcessor } from './processors/whisper/index.js';

export function bootstrapDropins() {
  registerYoutubeDropin();
  registerObsidianDropin();
  registerWhisperProcessor();
}