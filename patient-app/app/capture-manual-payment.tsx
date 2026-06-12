import { Redirect } from 'expo-router';
import React from 'react';

import { PROGRESS_HREF } from '@/constants/routes';

export default function CaptureManualPaymentRedirect() {
  return <Redirect href={PROGRESS_HREF} />;
}
