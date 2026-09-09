import { router, type Href } from 'expo-router';

import type { LegalDocId } from '@/constants/legal';

/** Absolute hrefs so nested stacks (onboarding / tabs) don't 404. */
const LEGAL_HREFS: Record<LegalDocId, Href> = {
  privacy: '/legal/privacy',
  terms: '/legal/terms',
  support: '/legal/support',
};

export function openLegalDoc(doc: LegalDocId) {
  router.navigate(LEGAL_HREFS[doc]);
}
