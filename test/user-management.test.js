import test from 'node:test'
import assert from 'node:assert/strict'
import { deactivateUser } from '../src/user-management.js'

test('deactivateUser disables the account and clears sessions', async () => {
  const calls = []
  const db = {
    prepare(sql) {
      calls.push(sql)
      return {
        bind(...params) {
          return {
            async run() {
              return { meta: { changes: 1 }, params }
            }
          }
        }
      }
    }
  }

  const result = await deactivateUser(db, { userId: 7, tenantId: 42, currentUserId: 3 })

  assert.equal(calls[0], 'DELETE FROM sessions WHERE user_id = ?')
  assert.equal(calls[1], 'UPDATE users SET actif = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?')
  assert.equal(result.success, true)
})

test('deactivateUser refuses to disable the current user', async () => {
  const db = {
    prepare() {
      return {
        bind() {
          return {
            async run() {
              return { meta: { changes: 1 } }
            }
          }
        }
      }
    }
  }

  await assert.rejects(
    () => deactivateUser(db, { userId: 7, tenantId: 42, currentUserId: 7 }),
    /Vous ne pouvez pas supprimer votre propre compte/
  )
})
