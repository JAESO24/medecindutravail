export interface DeactivateUserInput {
  userId: string | number
  tenantId: string | number | null
  currentUserId: string | number | null | undefined
}

export interface DeactivateUserResult {
  success: boolean
}

export async function deactivateUser(db: any, { userId, tenantId, currentUserId }: DeactivateUserInput): Promise<DeactivateUserResult> {
  if (Number(userId) === Number(currentUserId)) {
    throw new Error('Vous ne pouvez pas supprimer votre propre compte.')
  }

  await db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(userId).run()
  await db.prepare('UPDATE users SET actif = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?').bind(userId, tenantId).run()

  return { success: true }
}
