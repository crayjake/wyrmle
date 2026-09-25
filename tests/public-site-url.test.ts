import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DEFAULT_PUBLIC_SITE_URL, getPublicSiteUrl, normalizePublicSiteUrl } from '../src/lib/publicSiteUrl.ts'

test('public site URLs retain the deployed project path and support custom domains', () => {
  assert.equal(getPublicSiteUrl(), DEFAULT_PUBLIC_SITE_URL)
  assert.equal(normalizePublicSiteUrl('https://crayjake.github.io/wyrmle'), DEFAULT_PUBLIC_SITE_URL)
  assert.equal(normalizePublicSiteUrl('https://wyrmle.example'), 'https://wyrmle.example/')
  assert.equal(normalizePublicSiteUrl('https://wyrmle.example/play/'), 'https://wyrmle.example/play/')
})

test('public links reject relative paths, credentials, query parameters, and fragments', () => {
  for (const value of [
    '/wyrmle/',
    'javascript:alert(1)',
    'https://name:password@wyrmle.example/',
    'https://wyrmle.example/?session=private',
    'https://wyrmle.example/#dev',
  ]) assert.throws(() => normalizePublicSiteUrl(value))
})
