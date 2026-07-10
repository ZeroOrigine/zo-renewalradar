// CANONICAL: RenewalRadar API helpers — response envelope + pagination parsing.
// Every route handler under app/api/** uses these, so clients always see ONE
// consistent shape: { data, error: null } on success, { data: null, error,
// code, fields? } on failure. Error strings are written for humans — never
// stack traces, never internal details.

import { NextResponse } from 'next/server'
import type { ZodError } from 'zod'
import type { ApiFailure, ApiSuccess, PaginationMeta } from '@/lib/db/types'

export const DEFAULT_PAGE_SIZE = 20
export const MAX_PAGE_SIZE = 100

export function apiSuccess<T>(payload: T, status: number = 200): NextResponse {
  const body: ApiSuccess<T> = { data: payload, error: null }
  return NextResponse.json(body, { status })
}

export function apiError(
  message: string,
  code: string,
  status: number,
  fields?: Record<string, string>
): NextResponse {
  const body: ApiFailure = fields
    ? { data: null, error: message, code, fields }
    : { data: null, error: message, code }
  return NextResponse.json(body, { status })
}

export interface PaginationInput {
  page: number
  limit: number
  from: number
  to: number
}

/**
 * Reads ?page= and ?limit= safely. Bad or missing values fall back to sane
 * defaults instead of erroring — pagination should never block a user.
 */
export function parsePagination(searchParams: URLSearchParams): PaginationInput {
  const parsedPage = Number.parseInt(searchParams.get('page') ?? '', 10)
  const parsedLimit = Number.parseInt(searchParams.get('limit') ?? '', 10)

  const page = Number.isFinite(parsedPage) && parsedPage >= 1 ? parsedPage : 1
  const limit =
    Number.isFinite(parsedLimit) && parsedLimit >= 1
      ? Math.min(parsedLimit, MAX_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE

  const from = (page - 1) * limit
  const to = from + limit - 1

  return { page, limit, from, to }
}

export function buildPaginationMeta(page: number, limit: number, total: number): PaginationMeta {
  return {
    page,
    limit,
    total,
    total_pages: total === 0 ? 0 : Math.ceil(total / limit),
  }
}

/** Flattens a ZodError into { fieldPath: firstHumanMessage } for 400 bodies. */
export function zodFieldErrors(error: ZodError): Record<string, string> {
  const fields: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join('.') : '_body'
    if (!fields[key]) {
      fields[key] = issue.message
    }
  }
  return fields
}
