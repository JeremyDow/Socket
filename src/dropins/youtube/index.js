import { registerSource } from '../../core/capability-registry.js';
import { youtubeSourceDropin } from './youtube-source.js';

export function registerYoutubeDropin() {
  registerSource('youtube', youtubeSourceDropin);
}

export { youtubeSourceDropin };