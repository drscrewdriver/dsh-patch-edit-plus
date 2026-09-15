import { describe, expect, it } from 'vitest'
import { parseCodexPatch } from '../src/parse/codex.js'
import { PatchError } from '../src/errors.js'

describe('codex parser', () => {
  it('parses Add / Update (multi-hunk) / Delete in one patch', () => {
    const parsed = parseCodexPatch([
      '*** Begin Patch',
      '*** Add File: new.txt',
      '+created',
      '*** Update File: edit.txt',
      '@@ marker label',
      ' keep',
      '-gone',
      '+here',
      '*** End of File',
      '@@',
      '-second',
      '+SECOND',
      '*** Delete File: gone.txt',
      '*** End Patch',
    ].join('\n'))
    expect(parsed.format).toBe('codex')
    expect(parsed.ops).toHaveLength(3)
    const [add, update, del] = parsed.ops
    expect(add).toMatchObject({ kind: 'add', path: 'new.txt', lines: ['created'], trailingNewline: true })
    expect(update.kind === 'update' && update.path).toBe('edit.txt')
    if (update.kind === 'update') {
      expect(update.hunks).toHaveLength(2)
      expect(update.hunks[0].contextLabel).toBe('marker label')
      expect(update.hunks[0].endOfFile).toBe(true)
      expect(update.hunks[1].endOfFile).toBe(false)
    }
    expect(del).toMatchObject({ kind: 'delete', path: 'gone.txt' })
  })

  it('parses Move to as an update with moveTo', () => {
    const parsed = parseCodexPatch([
      '*** Begin Patch',
      '*** Update File: old-name.txt',
      '*** Move to: new-name.txt',
      '@@',
      ' content',
      '-x',
      '+y',
      '*** End Patch',
    ].join('\n'))
    expect(parsed.ops[0]).toMatchObject({ kind: 'update', path: 'old-name.txt', moveTo: 'new-name.txt' })
  })

  it('accepts a heredoc / fenced wrapper around the markers', () => {
    const wrapped = [
      'bash-3.2$ apply_patch << "EOF"',
      '*** Begin Patch',
      '*** Add File: a.txt',
      '+hi',
      '*** End Patch',
      'EOF',
    ].join('\n')
    const parsed = parseCodexPatch(wrapped)
    expect(parsed.ops[0]).toMatchObject({ kind: 'add', path: 'a.txt' })
  })

  it('rejects an empty hunk', () => {
    expect(() => parseCodexPatch([
      '*** Begin Patch',
      '*** Update File: f.txt',
      '@@',
      '*** End Patch',
    ].join('\n'))).toThrowError(PatchError)
  })

  it('rejects Environment ID patches', () => {
    expect(() => parseCodexPatch([
      '*** Begin Patch',
      '*** Environment ID: env_abc',
      '*** Add File: a.txt',
      '+x',
      '*** End Patch',
    ].join('\n'))).toThrowError(/Environment ID/)
  })

  it('rejects a missing End Patch marker', () => {
    expect(() => parseCodexPatch([
      '*** Begin Patch',
      '*** Add File: a.txt',
      '+x',
    ].join('\n'))).toThrowError(PatchError)
  })

  it('rejects a patch with zero operations', () => {
    expect(() => parseCodexPatch('*** Begin Patch\n*** End Patch\n')).toThrowError(PatchError)
  })

  it('rejects a bare file-content line inside Add File without the + marker', () => {
    expect(() => parseCodexPatch([
      '*** Begin Patch',
      '*** Add File: a.txt',
      'x',
      '*** End Patch',
    ].join('\n'))).toThrowError(/\+/)
  })
})
