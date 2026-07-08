/**
 * Canonical Socket event-name registry.
 * Tools may only emit and listen to names declared here.
 */

import { INITIAL_EVENTS } from './initial-events.js';

const EVENTS = new Set(INITIAL_EVENTS);

export function listRegisteredEvents() {
  return [...EVENTS].sort();
}

export function isRegisteredEvent(name) {
  return EVENTS.has(name);
}

export function registerEvent(name) {
  if (!name || typeof name !== 'string') {
    throw new Error('event name must be a non-empty string');
  }
  EVENTS.add(name);
  return name;
}