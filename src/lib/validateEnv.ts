const REQUIRED = [
  'EXPO_PUBLIC_API_URL',
  'EXPO_PUBLIC_FIREBASE_API_KEY',
  'EXPO_PUBLIC_FIREBASE_DATABASE_URL',
  'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
]

export function validateEnv() {
  const missing = REQUIRED.filter(k => !process.env[k])
  if (missing.length > 0) {
    console.warn('[ENV] Missing variables:', missing.join(', '))
    if (__DEV__) throw new Error(`Missing env vars: ${missing.join(', ')}`)
  }
}
