const REFERRAL_KEY = 'referral_code';
const REFERRAL_TTL_KEY = 'referral_code_ttl';
const SESSION_KEY = 'referral_code_session';
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const CODE_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

// In-memory fallback for environments where both storages are blocked
let _memoryCode: string | null = null;

/**
 * Get valid referral code from localStorage, falling back to sessionStorage
 * and in-memory cache. Clears expired localStorage entries.
 */
function getValidCode(): string | null {
  // 1. Try localStorage (with TTL)
  try {
    const code = localStorage.getItem(REFERRAL_KEY);
    if (code) {
      const ttl = localStorage.getItem(REFERRAL_TTL_KEY);
      if (!ttl || Number.isNaN(Number(ttl)) || Date.now() > Number(ttl)) {
        localStorage.removeItem(REFERRAL_KEY);
        localStorage.removeItem(REFERRAL_TTL_KEY);
      } else {
        return code;
      }
    }
  } catch {}

  // 2. Fallback: sessionStorage (works in most private/incognito modes)
  try {
    const code = sessionStorage.getItem(SESSION_KEY);
    if (code) return code;
  } catch {}

  // 3. Last resort: in-memory (survives within same page load only)
  return _memoryCode;
}

function clearCode(): void {
  _memoryCode = null;
  try {
    localStorage.removeItem(REFERRAL_KEY);
    localStorage.removeItem(REFERRAL_TTL_KEY);
  } catch {}
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {}
}

/**
 * Capture referral code from URL query param (?ref=), store in localStorage/sessionStorage/memory,
 * and clean the URL.
 */
export function captureReferralFromUrl(): void {
  try {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('ref');
    if (!code || !CODE_PATTERN.test(code)) return;

    // Store in all available storages as fallbacks
    _memoryCode = code;
    try {
      localStorage.setItem(REFERRAL_KEY, code);
      localStorage.setItem(REFERRAL_TTL_KEY, String(Date.now() + TTL_MS));
    } catch {}
    try {
      sessionStorage.setItem(SESSION_KEY, code);
    } catch {}

    // Clean URL
    params.delete('ref');
    const newSearch = params.toString();
    const newUrl =
      window.location.pathname + (newSearch ? `?${newSearch}` : '') + window.location.hash;
    window.history.replaceState(null, '', newUrl);
  } catch {}
}

/**
 * Consume (get + clear) the stored referral code. One-time use during auth.
 */
export function consumeReferralCode(): string | null {
  const code = getValidCode();
  if (code) clearCode();
  return code;
}

/**
 * Read stored referral code without clearing it (for UI display).
 */
export function getPendingReferralCode(): string | null {
  return getValidCode();
}
