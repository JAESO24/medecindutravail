export interface DeactivateUserInput {
  userId: string | number
  tenantId: string | number
  currentUserId: string | number | null | undefined
}

export interface DeactivateUserResult {
  success: boolean
}

export declare function deactivateUser(
  db: any,
  params: DeactivateUserInput
): Promise<DeactivateUserResult>
