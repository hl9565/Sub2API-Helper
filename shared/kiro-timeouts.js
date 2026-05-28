(function attachKiroTimeouts(root, factory) {
  root.MultiPageKiroTimeouts = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createKiroTimeoutsModule() {
  const DEFAULT_KIRO_PAGE_LOAD_TIMEOUT_MS = 3 * 60 * 1000;

  function normalizePositiveInteger(value, fallback) {
    const numeric = Math.floor(Number(value));
    if (Number.isInteger(numeric) && numeric > 0) {
      return numeric;
    }
    return fallback;
  }

  function normalizeKiroPageLoadTimeoutMs(value, fallback = DEFAULT_KIRO_PAGE_LOAD_TIMEOUT_MS) {
    return normalizePositiveInteger(
      value,
      normalizePositiveInteger(fallback, DEFAULT_KIRO_PAGE_LOAD_TIMEOUT_MS)
    );
  }

  return {
    DEFAULT_KIRO_PAGE_LOAD_TIMEOUT_MS,
    normalizeKiroPageLoadTimeoutMs,
  };
});
