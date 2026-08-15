import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '../..')

function readIfExists(rel: string): string | null {
  const path = resolve(root, rel)
  return existsSync(path) ? readFileSync(path, 'utf8') : null
}

describe('higiene de config móvil', () => {
  it('capacitor.config no trae service_role', () => {
    const src = readIfExists('capacitor.config.ts')
    expect(src).not.toBeNull()
    expect(src!).not.toMatch(/service_role/i)
    expect(src!).not.toContain('SUPABASE_SERVICE_ROLE')
  })

  it('AndroidManifest desactiva backup y no tiene service_role', () => {
    const src = readIfExists('android/app/src/main/AndroidManifest.xml')
    expect(src).not.toBeNull()
    expect(src!).not.toMatch(/service_role/i)
    expect(src!).not.toMatch(/android:allowBackup\s*=\s*"true"/)
    expect(src!).toMatch(/android:allowBackup\s*=\s*"false"/)
    expect(src!).toMatch(/android:usesCleartextTraffic\s*=\s*"false"/)
  })

  it('network_security_config bloquea cleartext', () => {
    const src = readIfExists('android/app/src/main/res/xml/network_security_config.xml')
    expect(src).not.toBeNull()
    expect(src!).toMatch(/cleartextTrafficPermitted="false"/)
  })

  it('invite-user no acepta cualquier https', () => {
    const src = readIfExists('supabase/functions/invite-user/index.ts')
    expect(src).not.toBeNull()
    expect(src!).toContain('calendario.bmatrix.org')
    expect(src!).toContain('bmx-calendario.pages.dev')
    expect(src!).not.toMatch(/if \(parsed\.protocol === 'https:'\) return true/)
  })
})
