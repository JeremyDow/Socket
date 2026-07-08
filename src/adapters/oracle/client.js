/**
 * Oracle external-app client placeholder.
 * Future: connect to Oracle Control Panel or intake APIs with operator approval.
 */

export const ORACLE_ADAPTER_STATUS = 'placeholder';

export function createOracleClient(options = {}) {
  return {
    status: ORACLE_ADAPTER_STATUS,
    enabled: Boolean(options.enabled),
    async connect() {
      throw new Error('Oracle adapter is not implemented in this Blue-mode pass');
    },
    async proposeIntake(_draft) {
      throw new Error('Oracle intake proposals require operator approval and adapter implementation');
    },
  };
}