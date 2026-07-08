/**
 * Oracle-facing Socket events (adapter boundary).
 */

export const ORACLE_ADAPTER_EVENTS = {
  intakeProposed: 'oracle_intake_proposed',
};

export function mapOracleIntakeProposal(payload = {}) {
  return {
    event: ORACLE_ADAPTER_EVENTS.intakeProposed,
    payload: {
      ...payload,
      authority: 'proposal_only',
      requiresOracleGate: true,
    },
  };
}