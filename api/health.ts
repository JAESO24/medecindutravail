import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  try {
    return response.status(200).json({
      status: 'ok',
      version: '2.0.0',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV
    })
  } catch (error) {
    return response.status(500).json({ error: 'Internal server error' })
  }
}
