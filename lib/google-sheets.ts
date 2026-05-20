/**
 * Minimal Google Sheets client — auth via service account, no
 * external dependencies, Web Crypto so it runs in both Node and Edge.
 *
 * Auth: parses `GOOGLE_SERVICE_ACCOUNT_JSON` (full JSON blob copied
 * from the service account key download), signs a JWT with RS256
 * using the embedded private key, exchanges it at the OAuth2 token
 * endpoint for an access token, then issues normal REST calls
 * against https://sheets.googleapis.com/v4/spreadsheets.
 *
 * Sheets API keys (`GOOGLE_SHEETS_API_KEY`) are NOT supported for
 * writes — Google only allows reads with bare API keys; mutating
 * spreadsheet contents requires OAuth2 + the spreadsheets scope.
 */

import {
  formatReportAsDetailGrid,
  formatReportAsSummaryGrid,
  weeklyTabTitle,
  type WeeklyReport,
} from './weekly-report'

// ── JWT signing (RS256, Web Crypto) ─────────────────────────

function base64UrlEncode(input: Uint8Array | string): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input
  let str = ''
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i])
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s+/g, '')
  const bin = atob(b64)
  const buf = new ArrayBuffer(bin.length)
  const view = new Uint8Array(buf)
  for (let i = 0; i < bin.length; i++) view[i] = bin.charCodeAt(i)
  return buf
}

async function importPrivateKey(pemPkcs8: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(pemPkcs8),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
}

async function makeJwt(clientEmail: string, privateKeyPem: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const payload = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  }
  const signingInput = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(payload))}`
  const key = await importPrivateKey(privateKeyPem)
  const sig = await crypto.subtle.sign({ name: 'RSASSA-PKCS1-v1_5' }, key, new TextEncoder().encode(signingInput))
  return `${signingInput}.${base64UrlEncode(new Uint8Array(sig))}`
}

async function getAccessToken(): Promise<string> {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!raw) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON no está configurada en Vercel. Sin esta env la integración con Sheets no funciona.')
  }
  let sa: { client_email?: string; private_key?: string }
  try {
    sa = JSON.parse(raw) as { client_email?: string; private_key?: string }
  } catch {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON no es JSON válido')
  }
  if (!sa.client_email || !sa.private_key) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON debe tener client_email y private_key')
  }
  // Vercel sometimes stores newlines as literal "\n" when an env var
  // is pasted in directly. Normalize so importKey can parse the PEM.
  const privateKeyPem = sa.private_key.replace(/\\n/g, '\n')

  const jwt = await makeJwt(sa.client_email, privateKeyPem)
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`OAuth token: ${res.status} ${body.slice(0, 240)}`)
  }
  const data = (await res.json()) as { access_token?: string }
  if (!data.access_token) throw new Error('OAuth token response: no access_token')
  return data.access_token
}

// ── Sheets API helpers ──────────────────────────────────────

async function sheetsFetch<T>(path: string, init: RequestInit, token: string): Promise<T> {
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Sheets ${path}: ${res.status} ${body.slice(0, 300)}`)
  }
  return res.json() as Promise<T>
}

/**
 * Add a new tab. If a tab with the same title already exists Sheets
 * returns 400 with "already exists" — we swallow that and let the
 * caller overwrite via setValues.
 */
async function addSheetTab(spreadsheetId: string, title: string, token: string): Promise<void> {
  try {
    await sheetsFetch(`/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title } } }] }),
    }, token)
  } catch (e) {
    const msg = e instanceof Error ? e.message : ''
    if (!/already exists|duplicate/i.test(msg)) throw e
  }
}

async function setValues(
  spreadsheetId: string,
  range: string,
  values: (string | number)[][],
  token: string,
): Promise<void> {
  await sheetsFetch(`/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`, {
    method: 'PUT',
    body: JSON.stringify({ values }),
  }, token)
}

async function clearRange(spreadsheetId: string, range: string, token: string): Promise<void> {
  await sheetsFetch(`/${spreadsheetId}/values/${encodeURIComponent(range)}:clear`, {
    method: 'POST',
    body: JSON.stringify({}),
  }, token)
}

/**
 * Wrap the tab name in single quotes for the range syntax. Required
 * if the tab name contains spaces or non-alphanumeric chars.
 */
function quoteTab(name: string): string {
  return `'${name.replace(/'/g, "''")}'`
}

/**
 * Top-level orchestrator. Two tabs:
 *
 *   · "Resumen" — first tab, cleared + rewritten with the latest
 *     week's totals + top 5. Always overwrites so the manager sees
 *     the most recent numbers when they open the spreadsheet.
 *   · "Semana YYYY-MM-DD" — per-week tab with the full per-creator
 *     detail. New tab each Monday; if today's tab already exists
 *     (e.g. manual re-export) we overwrite the values.
 */
export async function writeWeeklyReportToSheet(
  spreadsheetId: string,
  report: WeeklyReport,
): Promise<void> {
  const token = await getAccessToken()

  // Weekly detail tab
  const tab = weeklyTabTitle(report)
  await addSheetTab(spreadsheetId, tab, token)
  await setValues(spreadsheetId, `${quoteTab(tab)}!A1`, formatReportAsDetailGrid(report), token)

  // Summary tab — clear-then-write so removed creators don't linger.
  await addSheetTab(spreadsheetId, 'Resumen', token)
  await clearRange(spreadsheetId, `${quoteTab('Resumen')}!A1:Z500`, token)
  await setValues(spreadsheetId, `${quoteTab('Resumen')}!A1`, formatReportAsSummaryGrid(report), token)
}
