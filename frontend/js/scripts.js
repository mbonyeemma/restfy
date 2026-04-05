// ═══════════════════════════════════════════
// PRE-REQUEST & TEST SCRIPTS
// ═══════════════════════════════════════════

function runPreRequestScript(script, context) {
  if (!script || !script.trim()) return;
  const pm = {
    environment: {
      get: (key) => {
        const env = environments.find(e => e.id === activeEnvId);
        if (!env) return undefined;
        const v = env.variables.find(v => v.key === key);
        return v ? v.value : undefined;
      },
      set: (key, value) => {
        const env = environments.find(e => e.id === activeEnvId);
        if (!env) return;
        const v = env.variables.find(v => v.key === key);
        if (v) v.value = value;
        else env.variables.push({ key, value, enabled: true });
      }
    },
    globals: {
      get: (key) => { const v = globalVars.find(v => v.key === key); return v ? v.value : undefined; },
      set: (key, value) => {
        const v = globalVars.find(v => v.key === key);
        if (v) v.value = value;
        else globalVars.push({ key, value, enabled: true });
      }
    },
    request: {
      url: context.url,
      method: context.method,
      headers: Object.assign({}, context.headers),
      body: context.body,
      addHeader: function(key, value) { this.headers[key] = value; },
      removeHeader: function(key) { delete this.headers[key]; }
    },
    variables: {
      get: (key) => resolveVariables('{{' + key + '}}'),
      set: (key, value) => {
        const env = environments.find(e => e.id === activeEnvId);
        if (env) {
          const v = env.variables.find(v => v.key === key);
          if (v) v.value = value;
          else env.variables.push({ key, value, enabled: true });
        }
      }
    }
  };

  try {
    const fn = new Function('pm', 'console', script);
    fn(pm, console);
  } catch (e) {
    throw new Error('Pre-request script error: ' + e.message);
  }
  // Return mutated request so callers can apply changes
  return { url: pm.request.url, method: pm.request.method, headers: pm.request.headers, body: pm.request.body };
}

function runTestScript(script, context) {
  if (!script || !script.trim()) return [];
  const results = [];

  const pm = {
    response: {
      code: context.status,
      status: context.statusText,
      body: context.body,
      headers: context.headers,
      json: () => {
        try { return JSON.parse(context.body); }
        catch { return null; }
      }
    },
    test: (name, fn) => {
      try {
        fn();
        results.push({ name, passed: true });
      } catch (e) {
        results.push({ name, passed: false, error: e.message });
      }
    },
    expect: (actual) => ({
      to: {
        equal: (expected) => { if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`); },
        get be() {
          if (actual === true) return { not: { true: true } };
          return {
            above: (val) => { if (!(actual > val)) throw new Error(`Expected ${actual} to be above ${val}`); },
            below: (val) => { if (!(actual < val)) throw new Error(`Expected ${actual} to be below ${val}`); },
            oneOf: (arr) => { if (!arr.includes(actual)) throw new Error(`Expected ${actual} to be one of [${arr}]`); },
            a: (type) => { if (typeof actual !== type) throw new Error(`Expected type ${type}, got ${typeof actual}`); },
          };
        },
        have: {
          property: (prop) => { if (typeof actual !== 'object' || !(prop in actual)) throw new Error(`Missing property: ${prop}`); },
          length: (len) => { if (!actual || actual.length !== len) throw new Error(`Expected length ${len}, got ${actual?.length}`); }
        },
        include: (val) => {
          if (typeof actual === 'string' && !actual.includes(val)) throw new Error(`Expected string to include "${val}"`);
          if (Array.isArray(actual) && !actual.includes(val)) throw new Error(`Expected array to include ${val}`);
        },
        get exist() { if (actual === null || actual === undefined) throw new Error('Expected value to exist'); return true; }
      },
      toBe: (expected) => { if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`); },
      toContain: (val) => { if (!String(actual).includes(val)) throw new Error(`Expected to contain "${val}"`); },
      toBeGreaterThan: (val) => { if (!(actual > val)) throw new Error(`Expected ${actual} > ${val}`); }
    }),
    environment: {
      get: (key) => {
        const env = environments.find(e => e.id === activeEnvId);
        const v = env?.variables?.find(v => v.key === key);
        return v ? v.value : undefined;
      },
      set: (key, value) => {
        const env = environments.find(e => e.id === activeEnvId);
        if (env) {
          const v = env.variables.find(v => v.key === key);
          if (v) v.value = value;
          else env.variables.push({ key, value, enabled: true });
        }
      }
    },
    globals: {
      get: (key) => { const v = globalVars.find(v => v.key === key); return v ? v.value : undefined; },
      set: (key, value) => {
        const v = globalVars.find(v => v.key === key);
        if (v) v.value = value;
        else globalVars.push({ key, value, enabled: true });
      }
    }
  };

  try {
    const fn = new Function('pm', 'console', script);
    fn(pm, console);
  } catch (e) {
    results.push({ name: 'Script Execution', passed: false, error: e.message });
  }

  return results;
}
