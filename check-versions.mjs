import { readFileSync } from 'node:fs'

function read(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8')
}

function requiredMatch(content, pattern, label) {
  const match = content.match(pattern)
  if (!match) throw new Error(`No se pudo leer ${label}`)
  return match[1]
}

const packageJson = JSON.parse(read('./package.json'))
const packageLock = JSON.parse(read('./package-lock.json'))
const tauriConfig = JSON.parse(read('./src-tauri/tauri.conf.json'))
const cargoVersion = requiredMatch(
  read('./src-tauri/Cargo.toml'),
  /^\[package\][\s\S]*?^version = "([^"]+)"/m,
  'src-tauri/Cargo.toml',
)
const cargoLockVersion = requiredMatch(
  read('./src-tauri/Cargo.lock'),
  /\[\[package\]\]\s+name = "calendario"\s+version = "([^"]+)"/,
  'src-tauri/Cargo.lock',
)
const gradle = read('./android/app/build.gradle')
const androidVersion = requiredMatch(gradle, /versionName "([^"]+)"/, 'Android versionName')
const androidVersionCode = Number(requiredMatch(gradle, /versionCode (\d+)/, 'Android versionCode'))

const versions = {
  'package.json': packageJson.version,
  'package-lock.json': packageLock.version,
  'package-lock.json packages root': packageLock.packages?.['']?.version,
  'src-tauri/tauri.conf.json': tauriConfig.version,
  'src-tauri/Cargo.toml': cargoVersion,
  'src-tauri/Cargo.lock': cargoLockVersion,
  'android/app/build.gradle': androidVersion,
}
const expected = packageJson.version
const mismatches = Object.entries(versions).filter(([, version]) => version !== expected)

const parts = expected.split('.').map(Number)
const expectedVersionCode = parts[0] * 10000 + parts[1] * 100 + parts[2]
if (parts.length !== 3 || parts.some(Number.isNaN)) {
  throw new Error(`Versión semver inválida: ${expected}`)
}
if (androidVersionCode !== expectedVersionCode) {
  mismatches.push([
    'android/app/build.gradle versionCode',
    `${androidVersionCode} (esperado ${expectedVersionCode})`,
  ])
}

if (mismatches.length > 0) {
  console.error('Versiones desalineadas:')
  for (const [file, version] of mismatches) console.error(`- ${file}: ${version}`)
  process.exit(1)
}

console.log(`Versiones alineadas en ${expected} (Android versionCode ${androidVersionCode})`)
