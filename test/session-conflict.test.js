import test from 'node:test'
import assert from 'node:assert/strict'
import {createSession, loadSession, saveSession, saveSessionSafely, SESSION_KEY} from '../src/lib/gameSession.js'

const storage = initial => {
  const values = new Map(Object.entries(initial || {}))
  return {getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value)}
}
test('a stale round advance cannot erase a newer note; reloading can advance safely', () => {
  const db = storage()
  assert(saveSession(db, createSession()))
  const a = loadSession(db), b = loadSession(db)
  a.overallNotes = 'keep this note'
  assert(saveSession(db, a))
  const latest = db.getItem(SESSION_KEY)
  b.rounds.push({id: 'next', label: '第一天'})
  assert.equal(saveSession(db, b), false)
  assert.equal(db.getItem(SESSION_KEY), latest)
  const reloaded = loadSession(db)
  reloaded.rounds.push({id: 'next', label: '第一天'})
  assert(saveSession(db, reloaded))
  assert.equal(loadSession(db).overallNotes, 'keep this note')
  assert.equal(loadSession(db).rounds.length, 2)
  assert.equal(loadSession(db).storageRevision, 3)
})
test('old schema data remains compatible and changes without a revision are detected', () => {
  const legacy = createSession()
  legacy.overallNotes = 'old save'
  const db = storage({[SESSION_KEY]: JSON.stringify(legacy)})
  const a = loadSession(db), b = loadSession(db)
  a.overallNotes = 'updated by an older writer'
  db.setItem(SESSION_KEY, JSON.stringify(a))
  assert.equal(saveSession(db, b), false)
  assert.equal(loadSession(db).overallNotes, a.overallNotes)
  const reloaded = loadSession(db)
  assert(saveSession(db, reloaded))
  assert.equal(loadSession(db).schemaVersion, 3)
  assert.equal(loadSession(db).storageRevision, 1)
})
test('new sessions and resets cannot silently overwrite an existing or replaced game', () => {
  const db = storage()
  const old = createSession()
  assert(saveSession(db, old))
  const replacement = createSession()
  replacement.overallNotes = 'replacement'
  assert.equal(saveSession(db, replacement), false)
  assert(saveSession(db, replacement, {replace: true}))
  assert.equal(saveSession(db, old), false)
  assert.equal(loadSession(db).overallNotes, 'replacement')
})
test('simultaneous Web Locks writes reject one stale snapshot and preserve its in-page note', async () => {
  const db = storage()
  assert(saveSession(db, createSession()))
  const a = loadSession(db), b = loadSession(db)
  a.overallNotes = 'A'; b.overallNotes = 'B'
  let queue = Promise.resolve()
  const locks = {request: (key, fn) => {assert.equal(key, SESSION_KEY); const next = queue.then(fn); queue = next.catch(() => {}); return next}}
  assert.deepEqual(await Promise.all([saveSessionSafely(db, a, undefined, locks), saveSessionSafely(db, b, undefined, locks)]), [true, false])
  assert.equal(loadSession(db).overallNotes, 'A')
  assert.equal(b.overallNotes, 'B')
})
test('storage and lock failures do not overwrite saved data or consume the snapshot', async () => {
  const db = storage()
  const a = createSession()
  assert(saveSession(db, a))
  a.overallNotes = 'unsaved change'
  const before = db.getItem(SESSION_KEY), setItem = db.setItem
  db.setItem = () => {throw Error('quota')}
  assert.equal(saveSession(db, a), false)
  assert.equal(db.getItem(SESSION_KEY), before)
  db.setItem = setItem
  assert.equal(await saveSessionSafely(db, a, undefined, {request: () => Promise.reject(Error('lock'))}), false)
  assert.equal(db.getItem(SESSION_KEY), before)
  assert(saveSession(db, a))
  assert.equal(saveSession(undefined, a), false)
})

test('a no-op save does not advance the revision or invalidate another page', () => {
  const db = storage()
  assert(saveSession(db, createSession()))
  const a = loadSession(db), b = loadSession(db)
  assert(saveSession(db, b))
  assert.equal(loadSession(db).storageRevision, 1)
  a.overallNotes = 'still writable'
  assert(saveSession(db, a))
  assert.equal(loadSession(db).storageRevision, 2)
})
