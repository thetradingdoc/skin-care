/**
 * Shared claim-safe redirect for conflict/verdict routes that stay registered
 * but must not render claim-bearing UI in the store build.
 */
import { Redirect } from 'expo-router';
import React from 'react';

import { SHELF_HREF } from '@/constants/routes';
import { isConflictVerdictUiEnabled } from '@/lib/claim-safe-ui';

export function ClaimSafeRedirect({ children }: { children: React.ReactNode }) {
  if (!isConflictVerdictUiEnabled()) {
    return <Redirect href={SHELF_HREF} />;
  }
  return <>{children}</>;
}
