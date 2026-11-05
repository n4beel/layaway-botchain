// lib/limits.ts - Layaway numeric constraints & parameter bounds (Spec §2.1)

export const MAX_ITEM_BYTES = 64;
export const MAX_TERMS_BYTES = 300;
export const MIN_INSTALMENT = 10_000_000_000_000_000n; // 0.01 ether
export const MAX_INSTALMENT = 10_000_000_000_000_000_000_000n; // 10,000 ether
export const MIN_COUNT = 2;
export const MAX_COUNT = 24;
export const MIN_PERIOD = 86400; // 1 day
export const MAX_PERIOD = 7776000; // 90 days
export const MIN_GRACE = 86400; // 1 day
export const MAX_GRACE = 1209600; // 14 days
export const MAX_FORFEIT_BPS = 3000; // 30%
export const OFFER_WINDOW = 604800; // 7 days
export const MAX_PAGE = 50;

export const LIMITS = {
  MAX_ITEM_BYTES,
  MAX_TERMS_BYTES,
  MIN_INSTALMENT,
  MAX_INSTALMENT,
  MIN_COUNT,
  MAX_COUNT,
  MIN_PERIOD,
  MAX_PERIOD,
  MIN_GRACE,
  MAX_GRACE,
  MAX_FORFEIT_BPS,
  OFFER_WINDOW,
  MAX_PAGE,
} as const;

export const CONTRACT_LIMITS = LIMITS;
