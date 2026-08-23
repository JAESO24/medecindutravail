/// <reference types="@cloudflare/workers-types" />
/// <reference lib="DOM" />

declare interface D1Database {
  prepare(query: string): D1PreparedStatement
}

declare interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement
  first(): Promise<any>
  all(): Promise<any>
  run(): Promise<any>
}

declare interface D1Result {
  results: any[]
  success: boolean
  meta: {
    last_row_id: number | null
    changes: number
  }
}

declare const crypto: Crypto
