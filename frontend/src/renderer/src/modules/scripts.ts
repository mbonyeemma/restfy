import { state, resolveVariables } from './state'
import type { TestResult } from '../types'

export function runPreRequestScript(script: string, context: any): any {
  if (!script || !script.trim()) return

  const pm = {
    environment: {
      get: (key: string) => {
        const env = state.environments.find(e => e.id === state.activeEnvId)
        if (!env) return undefined
        const v = env.variables.find(v => v.key === key)
        return v ? v.value : undefined
      },
      set: (key: string, value: string) => {
        const env = state.environments.find(e => e.id === state.activeEnvId)
        if (!env) return
        const v = env.variables.find(v => v.key === key)
        if (v) v.value = value
        else env.variables.push({ key, value, enabled: true })
      }
    },
    globals: {
      get: (key: string) => {
        const v = state.globalVars.find(v => v.key === key)
        return v ? v.value : undefined
      },
      set: (key: string, value: string) => {
        const v = state.globalVars.find(v => v.key === key)
        if (v) v.value = value
        else state.globalVars.push({ key, value, enabled: true })
      }
    },
    request: {
      url: context.url,
      method: context.method,
      headers: Object.assign({}, context.headers),
      body: context.body,
      addHeader(key: string, value: string) { this.headers[key] = value },
      removeHeader(key: string) { delete this.headers[key] }
    },
    variables: {
      get: (key: string) => resolveVariables('{{' + key + '}}'),
      set: (key: string, value: string) => {
        const env = state.environments.find(e => e.id === state.activeEnvId)
        if (env) {
          const v = env.variables.find(v => v.key === key)
          if (v) v.value = value
          else env.variables.push({ key, value, enabled: true })
        }
      }
    }
  }

  try {
    const fn = new Function('pm', 'console', script)
    fn(pm, console)
  } catch (e: any) {
    throw new Error('Pre-request script error: ' + e.message)
  }
  return { url: pm.request.url, method: pm.request.method, headers: pm.request.headers, body: pm.request.body }
}

export function runTestScript(script: string, context: any): TestResult[] {
  if (!script || !script.trim()) return []
  const results: TestResult[] = []

  const pm = {
    response: {
      code: context.status,
      status: context.statusText,
      body: context.body,
      headers: context.headers,
      json: () => {
        try { return JSON.parse(context.body) } catch { return null }
      }
    },
    test: (name: string, fn: () => void) => {
      try {
        fn()
        results.push({ name, passed: true })
      } catch (e: any) {
        results.push({ name, passed: false, error: e.message })
      }
    },
    expect: (actual: any) => ({
      to: {
        equal: (expected: any) => { if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`) },
        get be() {
          return {
            above: (val: any) => { if (!(actual > val)) throw new Error(`Expected ${actual} to be above ${val}`) },
            below: (val: any) => { if (!(actual < val)) throw new Error(`Expected ${actual} to be below ${val}`) },
            oneOf: (arr: any[]) => { if (!arr.includes(actual)) throw new Error(`Expected ${actual} to be one of [${arr}]`) },
            a: (type: string) => { if (typeof actual !== type) throw new Error(`Expected type ${type}, got ${typeof actual}`) }
          }
        },
        have: {
          property: (prop: string) => { if (typeof actual !== 'object' || !(prop in actual)) throw new Error(`Missing property: ${prop}`) },
          length: (len: number) => { if (!actual || actual.length !== len) throw new Error(`Expected length ${len}, got ${actual?.length}`) }
        },
        include: (val: any) => {
          if (typeof actual === 'string' && !actual.includes(val)) throw new Error(`Expected string to include "${val}"`)
          if (Array.isArray(actual) && !actual.includes(val)) throw new Error(`Expected array to include ${val}`)
        },
        get exist() {
          if (actual === null || actual === undefined) throw new Error('Expected value to exist')
          return true
        }
      },
      toBe: (expected: any) => { if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`) },
      toContain: (val: any) => { if (!String(actual).includes(val)) throw new Error(`Expected to contain "${val}"`) },
      toBeGreaterThan: (val: any) => { if (!(actual > val)) throw new Error(`Expected ${actual} > ${val}`) }
    }),
    environment: {
      get: (key: string) => {
        const env = state.environments.find(e => e.id === state.activeEnvId)
        const v = env?.variables?.find(v => v.key === key)
        return v ? v.value : undefined
      },
      set: (key: string, value: string) => {
        const env = state.environments.find(e => e.id === state.activeEnvId)
        if (env) {
          const v = env.variables.find(v => v.key === key)
          if (v) v.value = value
          else env.variables.push({ key, value, enabled: true })
        }
      }
    },
    globals: {
      get: (key: string) => {
        const v = state.globalVars.find(v => v.key === key)
        return v ? v.value : undefined
      },
      set: (key: string, value: string) => {
        const v = state.globalVars.find(v => v.key === key)
        if (v) v.value = value
        else state.globalVars.push({ key, value, enabled: true })
      }
    }
  }

  try {
    const fn = new Function('pm', 'console', script)
    fn(pm, console)
  } catch (e: any) {
    results.push({ name: 'Script Execution', passed: false, error: e.message })
  }

  return results
}
