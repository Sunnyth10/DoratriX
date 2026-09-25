const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.nchc.org.tw/api/interpreter',
]

const UPSTREAM_TIMEOUT_MS = 4_000
const RETRY_DELAY_MS = 750
const RETRIES_PER_MIRROR = 1
const CACHE_TTL_MS = 5 * 60_000
const MAX_CACHE_ENTRIES = 50
const MAX_QUERY_LENGTH = 20_000
const USER_AGENT = 'DoratriX/1.0 (https://doratri-x.vercel.app; road network map)'
const responseCache = new Map()

function sendJson(response, status, body) {
  response.status(status)
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.setHeader('Cache-Control', 'no-store')
  response.send(JSON.stringify(body))
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    return sendJson(response, 405, { error: 'Method not allowed. Use POST.' })
  }

  const query = typeof request.body?.query === 'string' ? request.body.query.trim() : ''
  if (!query || query.length > MAX_QUERY_LENGTH) {
    return sendJson(response, 400, { error: `A query of 1 to ${MAX_QUERY_LENGTH} characters is required.` })
  }

  const cacheKey = query.replace(/\s+/g, ' ').trim()
  const cachedResponse = responseCache.get(cacheKey)
  if (cachedResponse && cachedResponse.expiresAt > Date.now()) {
    console.info('Overpass proxy cache hit')
    response.setHeader('Content-Type', 'application/json; charset=utf-8')
    response.setHeader('Cache-Control', 'no-store')
    return response.status(200).send(cachedResponse.body)
  }
  if (cachedResponse) responseCache.delete(cacheKey)

  let lastFailure = 'No upstream response'
  for (const endpoint of OVERPASS_ENDPOINTS) {
    for (let attempt = 0; attempt <= RETRIES_PER_MIRROR; attempt += 1) {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)
      try {
        const upstream = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'User-Agent': USER_AGENT,
          },
          body: new URLSearchParams({ data: query }),
          signal: controller.signal,
        })
        const body = await upstream.text()
        if (!upstream.ok) {
          const error = new Error(`HTTP ${upstream.status} ${upstream.statusText}${body ? `: ${body.replace(/\s+/g, ' ').slice(0, 240)}` : ''}`)
          error.name = 'HttpError'
          lastFailure = `${endpoint} ${error.name}: ${error.message}`
          console.error(`Overpass mirror failed endpoint=${endpoint} attempt=${attempt + 1} name=${error.name} message=${error.message}`)
          if (attempt < RETRIES_PER_MIRROR) await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
          continue
        }

        let payload
        try {
          payload = JSON.parse(body)
        } catch {
          const error = new Error('Response was not valid JSON')
          error.name = 'InvalidResponseError'
          lastFailure = `${endpoint} ${error.name}: ${error.message}`
          console.error(`Overpass mirror failed endpoint=${endpoint} attempt=${attempt + 1} name=${error.name} message=${error.message}`)
          if (attempt < RETRIES_PER_MIRROR) await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
          continue
        }
        if (!Array.isArray(payload.elements)) {
          const error = new Error('JSON response did not contain an elements array')
          error.name = 'InvalidResponseError'
          lastFailure = `${endpoint} ${error.name}: ${error.message}`
          console.error(`Overpass mirror failed endpoint=${endpoint} attempt=${attempt + 1} name=${error.name} message=${error.message}`)
          if (attempt < RETRIES_PER_MIRROR) await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
          continue
        }

        responseCache.set(cacheKey, { body, expiresAt: Date.now() + CACHE_TTL_MS })
        if (responseCache.size > MAX_CACHE_ENTRIES) responseCache.delete(responseCache.keys().next().value)
        console.info(`Overpass mirror succeeded endpoint=${endpoint} status=${upstream.status}`)
        response.setHeader('Content-Type', 'application/json; charset=utf-8')
        response.setHeader('Cache-Control', 'no-store')
        return response.status(200).send(body)
      } catch (error) {
        const failure = error.name === 'AbortError'
          ? Object.assign(new Error(`Timed out after ${UPSTREAM_TIMEOUT_MS / 1000}s`), { name: 'TimeoutError' })
          : error
        lastFailure = `${endpoint} ${failure.name}: ${failure.message}`
        console.error(`Overpass mirror failed endpoint=${endpoint} attempt=${attempt + 1} name=${failure.name} message=${failure.message}`)
        if (attempt < RETRIES_PER_MIRROR) await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
      } finally {
        clearTimeout(timeoutId)
      }
    }
  }

  return sendJson(response, 502, { error: `All Overpass providers failed. Last: ${lastFailure}` })
}
