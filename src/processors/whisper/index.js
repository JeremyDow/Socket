import { registerProcessor } from '../../core/capability-registry.js';
import { localWhisperProcessor } from './local-whisper.js';

export function registerWhisperProcessor() {
  registerProcessor('local_whisper', localWhisperProcessor);
}

export { localWhisperProcessor };