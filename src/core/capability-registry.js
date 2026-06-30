/**
 * Capability Registry — registers and resolves drop-ins by role.
 *
 * Contract roles:
 *   source      — fetches raw content from an external origin
 *   destination — writes artifacts to an external sink
 *   processor   — transforms artifacts (e.g. audio → transcript segments)
 */

const registry = {
  sources: new Map(),
  destinations: new Map(),
  processors: new Map(),
};

export function registerSource(id, dropin) {
  validateDropin(dropin, 'source');
  registry.sources.set(id, dropin);
}

export function registerDestination(id, dropin) {
  validateDropin(dropin, 'destination');
  registry.destinations.set(id, dropin);
}

export function registerProcessor(id, processor) {
  validateProcessor(processor);
  registry.processors.set(id, processor);
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

export function getProcessor(id) {
  const processor = registry.processors.get(id);
  if (!processor) throw new Error(`Processor not found: ${id}`);
  return processor;
}

export function listSources() {
  return [...registry.sources.keys()];
}

export function listDestinations() {
  return [...registry.destinations.keys()];
}

export function listProcessors() {
  return [...registry.processors.keys()];
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

function validateProcessor(processor) {
  if (!processor || typeof processor !== 'object') {
    throw new Error('Invalid processor: must be an object');
  }
  if (typeof processor.id !== 'string' || !processor.id) {
    throw new Error('Processor must have a string id');
  }
  if (typeof processor.transcribe !== 'function') {
    throw new Error(`Processor "${processor.id}" must implement transcribe()`);
  }
}

/** @internal — reset registry for tests */
export function _resetRegistry() {
  registry.sources.clear();
  registry.destinations.clear();
  registry.processors.clear();
}