(function attachMultiPageSourceRegistry(root, factory) {
  root.MultiPageSourceRegistry = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createSourceRegistryModule() {
  const rootScope = typeof self !== 'undefined' ? self : globalThis;
  const flowRegistryApi = rootScope.MultiPageFlowRegistry || {};

  const SHARED_SOURCE_DEFINITIONS = Object.freeze({
    'qq-mail': {
      flowId: null,
      kind: 'mail-provider',
      label: 'QQ \u90ae\u7bb1',
      readyPolicy: 'top-frame-only',
      family: 'qq-mail-family',
      driverId: 'content/qq-mail',
      cleanupScopes: [],
      detectionMatchers: [
        { hostnames: ['mail.qq.com', 'wx.mail.qq.com'] },
      ],
      familyMatchers: [
        { hostnames: ['mail.qq.com', 'wx.mail.qq.com'] },
      ],
    },
    'mail-163': {
      flowId: null,
      kind: 'mail-provider',
      label: '163 \u90ae\u7bb1',
      readyPolicy: 'top-frame-only',
      family: 'mail-163-family',
      driverId: 'content/mail-163',
      cleanupScopes: [],
      detectionMatchers: [
        {
          hostnames: ['mail.163.com', 'mail.126.com', 'webmail.vip.163.com'],
          hostnameEndsWith: ['.mail.163.com', '.mail.126.com'],
          matchMode: 'any',
        },
      ],
      familyMatchers: [
        {
          hostnames: ['mail.163.com', 'mail.126.com', 'webmail.vip.163.com'],
          hostnameEndsWith: ['.mail.163.com', '.mail.126.com'],
          matchMode: 'any',
        },
      ],
    },
    'gmail-mail': {
      flowId: null,
      kind: 'mail-provider',
      label: 'Gmail \u90ae\u7bb1',
      readyPolicy: 'top-frame-only',
      family: 'gmail-mail-family',
      driverId: 'content/gmail-mail',
      cleanupScopes: [],
      detectionMatchers: [
        { hostnames: ['mail.google.com'] },
      ],
      familyMatchers: [
        { hostnames: ['mail.google.com'] },
      ],
    },
    'icloud-mail': {
      flowId: null,
      kind: 'mail-provider',
      label: 'iCloud \u90ae\u7bb1',
      readyPolicy: 'allow-child-frame',
      family: 'icloud-mail-family',
      driverId: 'content/icloud-mail',
      cleanupScopes: [],
      detectionMatchers: [
        { hostnames: ['www.icloud.com', 'www.icloud.com.cn'] },
      ],
      familyMatchers: [
        { hostnames: ['www.icloud.com', 'www.icloud.com.cn'] },
      ],
    },
    'inbucket-mail': {
      flowId: null,
      kind: 'mail-provider',
      label: 'Inbucket \u90ae\u7bb1',
      readyPolicy: 'top-frame-only',
      family: 'inbucket-mail-family',
      driverId: 'content/inbucket-mail',
      cleanupScopes: [],
      familyMatchers: [
        { originEqualsReference: true, pathPrefixes: ['/m/'] },
      ],
    },
    'mail-2925': {
      flowId: null,
      kind: 'mail-provider',
      label: '2925 \u90ae\u7bb1',
      readyPolicy: 'top-frame-only',
      family: 'mail-2925-family',
      driverId: 'content/mail-2925',
      cleanupScopes: [],
      detectionMatchers: [
        { hostnames: ['2925.com', 'www.2925.com'] },
      ],
      familyMatchers: [
        { hostnames: ['2925.com', 'www.2925.com'] },
      ],
    },
    'duck-mail': {
      flowId: null,
      kind: 'mail-provider',
      label: 'Duck \u90ae\u7bb1',
      readyPolicy: 'allow-child-frame',
      family: 'duck-mail-family',
      driverId: 'content/duck-mail',
      cleanupScopes: [],
      detectionMatchers: [
        { urlIncludes: 'duckduckgo.com/email/settings/autofill' },
      ],
      familyMatchers: [
        { hostnames: ['duckduckgo.com'], pathPrefixes: ['/email/'] },
      ],
    },
    'unknown-source': {
      flowId: null,
      kind: 'unknown',
      label: '\u672a\u77e5\u6765\u6e90',
      readyPolicy: 'disabled',
      family: 'unknown-family',
      driverId: null,
      cleanupScopes: [],
    },
  });

  const SHARED_DRIVER_DEFINITIONS = Object.freeze({
    'content/qq-mail': {
      sourceId: 'qq-mail',
      commands: ['POLL_EMAIL'],
    },
    'content/mail-163': {
      sourceId: 'mail-163',
      commands: ['POLL_EMAIL'],
    },
    'content/gmail-mail': {
      sourceId: 'gmail-mail',
      commands: ['POLL_EMAIL'],
    },
    'content/icloud-mail': {
      sourceId: 'icloud-mail',
      commands: ['POLL_EMAIL'],
    },
    'content/mail-2925': {
      sourceId: 'mail-2925',
      commands: ['POLL_EMAIL'],
    },
    'content/duck-mail': {
      sourceId: 'duck-mail',
      commands: ['FETCH_ALIAS_EMAIL'],
    },
  });

  function normalizeHostname(hostname = '') {
    return String(hostname || '').trim().toLowerCase();
  }

  function matchesNamedHostFamily(hostname = '', family = '') {
    const normalizedHost = normalizeHostname(hostname);
    const normalizedFamily = normalizeHostname(family);
    if (!normalizedHost || !normalizedFamily) {
      return false;
    }
    return normalizedHost === normalizedFamily
      || normalizedHost.endsWith(`.${normalizedFamily}`)
      || normalizedHost.startsWith(`${normalizedFamily}.`)
      || normalizedHost.includes(`.${normalizedFamily}.`);
  }

  function parseUrlSafely(rawUrl) {
    if (!rawUrl) {
      return null;
    }
    try {
      return new URL(rawUrl);
    } catch {
      return null;
    }
  }

  function buildCandidateUrl(url = '', hostname = '') {
    const candidate = parseUrlSafely(url);
    if (candidate) {
      return candidate;
    }
    const normalizedHostname = normalizeHostname(hostname);
    if (!normalizedHostname) {
      return null;
    }
    return parseUrlSafely(`https://${normalizedHostname}/`);
  }

  function normalizeSourceId(source) {
    return String(source || '').trim();
  }

  function normalizeStringArray(values = []) {
    if (!Array.isArray(values)) {
      return [];
    }
    return values
      .map((value) => String(value || '').trim())
      .filter(Boolean);
  }

  function hostnameMatchesSuffix(hostname = '', suffix = '') {
    const normalizedHost = normalizeHostname(hostname);
    const normalizedSuffix = normalizeHostname(suffix);
    if (!normalizedHost || !normalizedSuffix) {
      return false;
    }
    if (normalizedHost === normalizedSuffix) {
      return true;
    }
    const dottedSuffix = normalizedSuffix.startsWith('.')
      ? normalizedSuffix
      : `.${normalizedSuffix}`;
    return normalizedHost.endsWith(dottedSuffix);
  }

  function getRuntimeSourceDefinitions() {
    return {
      ...(typeof flowRegistryApi.getRuntimeSourceDefinitions === 'function'
        ? flowRegistryApi.getRuntimeSourceDefinitions()
        : {}),
      ...SHARED_SOURCE_DEFINITIONS,
    };
  }

  function getDriverDefinitions() {
    return {
      ...(typeof flowRegistryApi.getDriverDefinitions === 'function'
        ? flowRegistryApi.getDriverDefinitions()
        : {}),
      ...SHARED_DRIVER_DEFINITIONS,
    };
  }

  function getSourceAliases() {
    return {
      ...(typeof flowRegistryApi.getSourceAliases === 'function'
        ? flowRegistryApi.getSourceAliases()
        : {}),
    };
  }

  function createSourceRegistry() {
    const SOURCE_DEFINITIONS = getRuntimeSourceDefinitions();
    const DRIVER_DEFINITIONS = getDriverDefinitions();
    const SOURCE_ALIASES = getSourceAliases();

    function resolveCanonicalSource(source) {
      const normalized = normalizeSourceId(source);
      if (!normalized) {
        return '';
      }
      return SOURCE_ALIASES[normalized] || normalized;
    }

    function getAliasKeysForCanonicalSource(source) {
      const canonical = resolveCanonicalSource(source);
      return Object.keys(SOURCE_ALIASES).filter((alias) => SOURCE_ALIASES[alias] === canonical);
    }

    function getSourceKeys(source) {
      const normalized = normalizeSourceId(source);
      const canonical = resolveCanonicalSource(normalized);
      return Array.from(new Set([
        canonical,
        ...getAliasKeysForCanonicalSource(canonical),
        normalized,
      ].filter(Boolean)));
    }

    function getSourceMeta(source) {
      const canonical = resolveCanonicalSource(source);
      const definition = SOURCE_DEFINITIONS[canonical];
      if (!definition) {
        return null;
      }
      return {
        id: canonical,
        aliases: getAliasKeysForCanonicalSource(canonical),
        ...definition,
      };
    }

    function getSourceLabel(source) {
      return getSourceMeta(source)?.label || normalizeSourceId(source) || '\u672a\u77e5\u6765\u6e90';
    }

    function getDriverIdForSource(source) {
      return getSourceMeta(source)?.driverId || null;
    }

    function getDriverMeta(sourceOrDriverId) {
      const directDriverId = normalizeSourceId(sourceOrDriverId);
      const driverId = Object.prototype.hasOwnProperty.call(DRIVER_DEFINITIONS, directDriverId)
        ? directDriverId
        : getDriverIdForSource(sourceOrDriverId);
      if (!driverId || !Object.prototype.hasOwnProperty.call(DRIVER_DEFINITIONS, driverId)) {
        return null;
      }
      return {
        id: driverId,
        ...DRIVER_DEFINITIONS[driverId],
      };
    }

    function driverAcceptsCommand(sourceOrDriverId, command) {
      const normalizedCommand = normalizeSourceId(command);
      if (!normalizedCommand) {
        return false;
      }
      const driver = getDriverMeta(sourceOrDriverId);
      return Array.isArray(driver?.commands) && driver.commands.includes(normalizedCommand);
    }

    function matchesUrlRule(rule = {}, candidate, reference) {
      if (!candidate) {
        return false;
      }
      const matchMode = String(rule?.matchMode || 'all').trim().toLowerCase() === 'any'
        ? 'any'
        : 'all';
      const conditions = [];

      const hostnames = normalizeStringArray(rule.hostnames);
      if (hostnames.length) {
        conditions.push(hostnames.includes(candidate.hostname));
      }

      const hostnameFamilies = normalizeStringArray(rule.hostnameFamilies);
      if (hostnameFamilies.length) {
        conditions.push(hostnameFamilies.some((family) => matchesNamedHostFamily(candidate.hostname, family)));
      }

      const hostnameEndsWith = normalizeStringArray(rule.hostnameEndsWith);
      if (hostnameEndsWith.length) {
        conditions.push(hostnameEndsWith.some((suffix) => hostnameMatchesSuffix(candidate.hostname, suffix)));
      }

      if (rule.hostnameRegex) {
        conditions.push(new RegExp(rule.hostnameRegex, rule.hostnameRegexFlags || '').test(candidate.hostname));
      }

      if (rule.urlIncludes) {
        conditions.push(String(candidate.href || '').includes(String(rule.urlIncludes)));
      }

      const pathPrefixes = normalizeStringArray(rule.pathPrefixes);
      if (pathPrefixes.length) {
        conditions.push(pathPrefixes.some((prefix) => candidate.pathname.startsWith(prefix)));
      }

      if (rule.pathEquals) {
        conditions.push(candidate.pathname === String(rule.pathEquals));
      }

      const pathEqualsOneOf = normalizeStringArray(rule.pathEqualsOneOf);
      if (pathEqualsOneOf.length) {
        conditions.push(pathEqualsOneOf.includes(candidate.pathname));
      }

      if (rule.originEqualsReference) {
        conditions.push(Boolean(reference) && candidate.origin === reference.origin);
      }

      if (rule.pathEqualsReference) {
        conditions.push(Boolean(reference) && candidate.pathname === reference.pathname);
      }

      if (!conditions.length) {
        return false;
      }

      return matchMode === 'any'
        ? conditions.some(Boolean)
        : conditions.every(Boolean);
    }

    function matchesSourceDetection(source, url = '', hostname = '') {
      const candidate = buildCandidateUrl(url, hostname);
      if (!candidate) {
        return false;
      }
      const canonical = resolveCanonicalSource(source);
      const detectionMatchers = getSourceMeta(canonical)?.detectionMatchers || [];
      return detectionMatchers.some((rule) => matchesUrlRule(rule, candidate, null));
    }

    function isSignupPageHost(hostname = '') {
      return matchesSourceDetection('openai-auth', '', hostname);
    }

    function isSignupEntryHost(hostname = '') {
      return matchesSourceDetection('chatgpt', '', hostname);
    }

    function is163MailHost(hostname = '') {
      return matchesSourceDetection('mail-163', '', hostname);
    }

    function matchesSourceUrlFamily(source, candidateUrl, referenceUrl) {
      const candidate = parseUrlSafely(candidateUrl);
      if (!candidate) {
        return false;
      }
      const canonical = resolveCanonicalSource(source);
      const familyMatchers = getSourceMeta(canonical)?.familyMatchers || [];
      const reference = parseUrlSafely(referenceUrl);
      return familyMatchers.some((rule) => matchesUrlRule(rule, candidate, reference));
    }

    function detectSourceFromLocation({
      injectedSource,
      url = '',
      hostname = '',
    } = {}) {
      if (injectedSource) {
        return resolveCanonicalSource(injectedSource);
      }

      const candidate = buildCandidateUrl(url, hostname);
      if (!candidate) {
        return 'unknown-source';
      }

      const detectionSourceIds = Object.keys(SOURCE_DEFINITIONS).filter((sourceId) => sourceId !== 'unknown-source');
      for (const sourceId of detectionSourceIds) {
        if (matchesSourceDetection(sourceId, candidate.href, candidate.hostname)) {
          return sourceId;
        }
      }

      return 'unknown-source';
    }

    function shouldReportReadyForFrame(source, isChildFrame) {
      const canonical = resolveCanonicalSource(source);
      const readyPolicy = getSourceMeta(canonical)?.readyPolicy || 'allow-child-frame';
      if (readyPolicy === 'disabled') {
        return false;
      }
      if (!isChildFrame) {
        return true;
      }
      return readyPolicy === 'allow-child-frame';
    }

    function getCleanupOwnerSource(cleanupScope) {
      const normalizedCleanupScope = String(cleanupScope || '').trim();
      const owner = Object.keys(SOURCE_DEFINITIONS).find((sourceId) => {
        const cleanupScopes = Array.isArray(SOURCE_DEFINITIONS[sourceId]?.cleanupScopes)
          ? SOURCE_DEFINITIONS[sourceId].cleanupScopes
          : [];
        return cleanupScopes.includes(normalizedCleanupScope);
      });
      return resolveCanonicalSource(owner || '');
    }

    return {
      detectSourceFromLocation,
      driverAcceptsCommand,
      getCleanupOwnerSource,
      getDriverIdForSource,
      getDriverMeta,
      getSourceKeys,
      getSourceLabel,
      getSourceMeta,
      is163MailHost,
      isSignupEntryHost,
      isSignupPageHost,
      matchesSourceUrlFamily,
      parseUrlSafely,
      resolveCanonicalSource,
      shouldReportReadyForFrame,
    };
  }

  return {
    createSourceRegistry,
  };
});
