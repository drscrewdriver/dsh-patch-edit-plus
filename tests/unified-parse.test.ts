import { describe, expect, it } from 'vitest'
import { parseUnifiedDiff } from '../src/parse/unified.js'
import { PatchError } from '../src/errors.js'

describe('unified diff parser', () => {
  it('parses a single-file single-hunk update', () => {
    const parsed = parseUnifiedDiff([
      '--- a/file.txt',
      '+++ b/file.txt',
      '@@ -1,3 +1,3 @@',
      ' one',
      '-two',
      '+TWO',
      ' three',
    ].join('\n'))
    expect(parsed.format).toBe('unified')
    expect(parsed.ops).toHaveLength(1)
    const op = parsed.ops[0]
    expect(op.kind).toBe('update')
    if (op.kind === 'update') {
      expect(op.path).toBe('file.txt')
      expect(op.hunks).toHaveLength(1)
      expect(op.hunks[0].oldStart).toBe(1)
      expect(op.hunks[0].lines).toEqual([
        { kind: 'context', text: 'one' },
        { kind: 'delete', text: 'two' },
        { kind: 'add', text: 'TWO' },
        { kind: 'context', text: 'three' },
      ])
    }
  })

  it('parses multiple hunks in one file', () => {
    const parsed = parseUnifiedDiff([
      '--- a/f.txt', '+++ b/f.txt',
      '@@ -1,2 +1,2 @@', ' a', '-b', '+B',
      '@@ -10,3 +10,3 @@', ' x', '-y', '+Y', ' z',
    ].join('\n'))
    expect(parsed.ops[0].kind === 'update' && parsed.ops[0].hunks).toHaveLength(2)
  })

  it('parses a git new-file diff into an add op', () => {
    const parsed = parseUnifiedDiff([
      'diff --git a/new.txt b/new.txt',
      'new file mode 100644',
      '--- /dev/null',
      '+++ b/new.txt',
      '@@ -0,0 +1,2 @@',
      '+hello',
      '+world',
    ].join('\n'))
    expect(parsed.ops[0]).toMatchObject({ kind: 'add', path: 'new.txt', lines: ['hello', 'world'], trailingNewline: true })
  })

  it('parses a git deleted-file diff into a delete op', () => {
    const parsed = parseUnifiedDiff([
      'diff --git a/old.txt b/old.txt',
      'deleted file mode 100644',
      '--- a/old.txt',
      '+++ /dev/null',
      '@@ -1,1 +0,0 @@',
      '-bye',
    ].join('\n'))
    expect(parsed.ops[0]).toMatchObject({ kind: 'delete', path: 'old.txt' })
  })

  it('parses a pure rename into an update with moveTo and no hunks', () => {
    const parsed = parseUnifiedDiff([
      'diff --git a/old.txt b/renamed.txt',
      'similarity index 100%',
      'rename from old.txt',
      'rename to renamed.txt',
    ].join('\n'))
    expect(parsed.ops[0]).toMatchObject({ kind: 'update', path: 'old.txt', moveTo: 'renamed.txt', hunks: [] })
  })

  it('records \\ No newline markers for the new side', () => {
    const parsed = parseUnifiedDiff([
      '--- a/f.txt', '+++ b/f.txt',
      '@@ -1,1 +1,1 @@',
      '-old',
      '+new',
      '\\ No newline at end of file',
    ].join('\n'))
    const op = parsed.ops[0]
    expect(op.kind === 'update' && op.hunks[0].newNoNewline).toBe(true)
    expect(op.kind === 'update' && op.hunks[0].oldNoNewline).toBe(false)
  })

  it('normalizes CRLF input', () => {
    const parsed = parseUnifiedDiff('--- a/f.txt\r\n+++ b/f.txt\r\n@@ -1,1 +1,1 @@\r\n-a\r\n+b\r\n')
    expect(parsed.ops[0].kind === 'update' && parsed.ops[0].hunks[0].lines[0]).toEqual({ kind: 'delete', text: 'a' })
  })

  it('rejects a hunk whose counts do not match the body', () => {
    expect(() => parseUnifiedDiff([
      '--- a/f.txt', '+++ b/f.txt',
      '@@ -1,3 +1,3 @@', '-a', '+b',
    ].join('\n'))).toThrowError(PatchError)
  })

  it('rejects a hunk with context lines only', () => {
    expect(() => parseUnifiedDiff([
      '--- a/f.txt', '+++ b/f.txt',
      '@@ -1,2 +1,2 @@', ' a', ' b',
    ].join('\n'))).toThrowError(/no changes/)
  })

  it('rejects binary patches', () => {
    expect(() => parseUnifiedDiff('diff --git a/img.png b/img.png\nBinary files a/img.png and b/img.png differ\n')).toThrowError(/binary/)
  })

  it('rejects completely unrecognized text with both syntax examples', () => {
    try {
      parseUnifiedDiff('hello world\nnothing here\n')
      expect.unreachable()
    } catch (error) {
      expect(error).toBeInstanceOf(PatchError)
      expect((error as PatchError).code).toBe('PARSE')
      expect((error as PatchError).message).toContain('*** Begin Patch')
      expect((error as PatchError).message).toContain('@@ -1,3')
    }
  })

  it('parses a new-file diff at a nested path and strips a/b prefixes', () => {
    const parsed = parseUnifiedDiff([
      '--- /dev/null', '+++ b/src/dir/thing.ts',
      '@@ -0,0 +1,1 @@', '+x',
    ].join('\n'))
    expect(parsed.ops[0]).toMatchObject({ kind: 'add', path: 'src/dir/thing.ts' })
  })
})
