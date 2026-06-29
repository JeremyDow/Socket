/**
 * Artifact — typed payload passed between workflow stages.
 */

export function createArtifact(type, data, meta = {}) {
  return Object.freeze({
    type,
    data,
    meta: Object.freeze({ ...meta }),
    createdAt: new Date().toISOString(),
  });
}

export function isArtifact(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof value.type === 'string' &&
    'data' in value &&
    'meta' in value
  );
}