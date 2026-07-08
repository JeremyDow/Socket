/**
 * Placeholder shared-session model for synchronized Socket tool tabs.
 * Tools must not call one another directly; they publish and subscribe here.
 */

import { isRegisteredEvent } from '../events/registry.js';

export function createSharedSession(initial = {}) {
  const state = {
    activeSourceId: null,
    activeVideoId: null,
    activeDestinationId: null,
    workingArtifacts: {},
    ...initial,
  };

  const listeners = new Map();

  return {
    getState() {
      return { ...state };
    },

    patch(partial) {
      Object.assign(state, partial);
      return state;
    },

    on(eventName, handler) {
      if (!isRegisteredEvent(eventName)) {
        throw new Error(`Unregistered event: ${eventName}`);
      }
      if (!listeners.has(eventName)) listeners.set(eventName, new Set());
      listeners.get(eventName).add(handler);
      return () => listeners.get(eventName)?.delete(handler);
    },

    emit(eventName, payload = {}) {
      if (!isRegisteredEvent(eventName)) {
        throw new Error(`Unregistered event: ${eventName}`);
      }
      const handlers = listeners.get(eventName);
      if (!handlers) return;
      for (const handler of handlers) handler({ eventName, payload, state: { ...state } });
    },
  };
}