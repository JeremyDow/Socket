/**
 * Capability Registry — registers and resolves drop-ins by role.
 *
 * Contract roles:
 *   source      — fetches raw content from an external origin
 *   destination — writes artifacts to an external sink
 */

const registry = {
  sources: new Map(),
  destinations: new Map(),
};

export function registerSource(id, dropin) {
  validateDropin(dropin, 'source');
  registry.sources.set(id, dropin);
}

export function registerDestination(id, dropin) {
  validateDropin(dropin, 'destination');
  registry.destinations.set(id, dropin);
}

export function getSource(id) {
  const dropin = registry.sources.get(id);
  if (!dropin) throw new Error(`Source drop-in not found: ${id}`);
  return dropin;
}

export function getDestination(id) {
  const dropin = registry.destinations.get(id);
  if (!dropin) throw new Error(`Destination drop-in not found: ${id}`);
  return dropin;
}

export function listSources() {
  return [...registry.sources.keys()];
}

export function listDestinations() {
  return [...registry.destinations.keys()];
}

function validateDropin(dropin, role) {
  if (!dropin || typeof dropin !== 'object') {
    throw new Error(`Invalid ${role} drop-in: must be an object`);
  }
  if (typeof dropin.id !== 'string' || !dropin.id) {
    throw new Error(`${role} drop-in must have a string id`);
  }
  if (typeof dropin.fetch !== 'function' && role === 'source') {
    throw new Error(`Source drop-in "${dropin.id}" must implement fetch()`);
  }
  if (typeof dropin.write !== 'function' && role === 'destination') {
    throw new Error(`Destination drop-in "${dropin.id}" must implement write()`);
  }
}

/** @internal — reset registry for tests */
export function _resetRegistry() {
  registry.sources.clear();
  registry.destinations.clear();
}