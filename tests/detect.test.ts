import { describe, expect, it } from 'vitest'
import { detectFormat } from '../src/detect.js'
import { PatchError } from '../src/errors.js'

describe('format detection', () => {
  it('detects Codex via the Begin Patch sentinel', () => {
    expect(detectFormat('*** Begin Patch\n*** End Patch\n')).toBe('codex')
  })

  it('detects unified via diff --git', () => {
    expect(detectFormat('diff --git a/x b/x\n')).toBe('unified')
  })

  it('detects bare unified via --- header', () => {
    expect(detectFormat('--- a/x\n+++ b/x\n@@ -1,1 +1,1 @@\n')).toBe('unified')
  })

  it('detects unified via a bare hunk header', () => {
    expect(detectFormat('@@ -1,2 +1,2 @@\n')).toBe('unified')
  })

  it('detects Codex via section headers', () => {
    expect(detectFormat('*** Update File: x\n')).toBe('codex')
    expect(detectFormat('*** Add File: x\n')).toBe('codex')
    expect(detectFormat('*** Delete File: x\n')).toBe('codex')
  })

  it('is indifferent to CRLF and leading whitespace', () => {
    expect(detectFormat('\r\n\r\n*** Begin Patch\r\n')).toBe('codex')
  })

  it('throws PARSE with both syntax examples on unrecognized text', () => {
    try {
      detectFormat('just some text\n')
      expect.unreachable()
    } catch (error) {
      expect(error).toBeInstanceOf(PatchError)
      expect((error as PatchError).message).toContain('git/unified diff')
      expect((error as PatchError).message).toContain('apply_patch')
    }
  })
})
