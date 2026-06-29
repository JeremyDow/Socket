import { registerDestination } from '../../core/capability-registry.js';
import { obsidianDestinationDropin } from './obsidian-destination.js';

export function registerObsidianDropin() {
  registerDestination('obsidian', obsidianDestinationDropin);
}

export { obsidianDestinationDropin };