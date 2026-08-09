/**
 * Play Console / public web URLs (host on Railway via sharvo.online custom domain).
 * In-app reading uses `/legal/[doc]` screens — see `constants/legalContent.ts`.
 *
 * Source drafts: Privacy + Terms Google Docs in LEGAL_GOOGLE_DOCS.
 */
export const LEGAL_URLS = {
  terms: 'https://sharvo.online/terms',
  privacy: 'https://sharvo.online/privacy',
  support: 'https://sharvo.online/support',
  deleteAccount: 'https://sharvo.online/delete-account',
} as const;

/** Optional Google Doc drafts (for editing); Play Console must use LEGAL_URLS, not these. */
export const LEGAL_GOOGLE_DOCS = {
  privacy:
    'https://docs.google.com/document/d/1BrnDj9YvWxi_qgOQISQ_FLFg1vgAqNDBwB_DmnR_X8s/edit?usp=sharing',
  terms:
    'https://docs.google.com/document/d/1hKi69nsd-xAIDDamKKuspp-nLdVspvx9t49C0svlLb8/edit?usp=sharing',
} as const;

/** Expo Router paths for in-app policy screens (no browser required). */
export const LEGAL_IN_APP = {
  privacy: '/legal/privacy',
  terms: '/legal/terms',
  support: '/legal/support',
} as const;

export type LegalDocId = keyof typeof LEGAL_IN_APP;
