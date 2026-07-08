/**
 * Oracle adapter permission boundary.
 */

import { PERMISSION_CATEGORIES } from '../../permissions/categories.js';

export const ORACLE_ADAPTER_PERMISSIONS = {
  readOracleHealth: PERMISSION_CATEGORIES.automatic,
  proposeIntakeDraft: PERMISSION_CATEGORIES.operator_approval,
  submitIntake: PERMISSION_CATEGORIES.forbidden,
  lifecycleTransition: PERMISSION_CATEGORIES.forbidden,
  councilAction: PERMISSION_CATEGORIES.forbidden,
  vaultPromotion: PERMISSION_CATEGORIES.forbidden,
  silentDecision: PERMISSION_CATEGORIES.forbidden,
};