/**
 * Socket action permission categories.
 * Autonomy is bounded by explicit operator approval gates.
 */

export const PERMISSION_CATEGORIES = {
  automatic: 'automatic',
  operator_approval: 'operator_approval',
  forbidden: 'forbidden',
};

export const DEFAULT_PERMISSIONS = {
  automatic: [
    'read_active_source',
    'start_transcription_after_user_selected_video',
    'draft_markdown',
    'update_temporary_working_state',
  ],
  operator_approval: [
    'write_to_obsidian',
    'replace_existing_file',
    'send_material_to_oracle',
    'publish_externally',
    'send_messages',
    'spend_money',
  ],
  forbidden: [
    'delete_repositories',
    'modify_oracle_governance_rules',
    'bypass_oracle_lifecycle_gates',
    'promote_oracle_decision_silently',
  ],
};

export function categoryForAction(actionId) {
  for (const [category, actions] of Object.entries(DEFAULT_PERMISSIONS)) {
    if (actions.includes(actionId)) return category;
  }
  return PERMISSION_CATEGORIES.operator_approval;
}