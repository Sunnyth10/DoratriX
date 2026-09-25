const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.nchc.org.tw/api/interpreter',
]

const UPSTREAM_TIMEOUT_MS = 5_000
const MAX_QUERY_LENGTH = 20_000

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

  let lastFailure = 'No upstream response'
  for (const endpoint of OVERPASS_ENDPOINTS) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)
    try {
      const upstream = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'User-Agent': 'DoratriX/1.0 (road network map)',
        },
        body: new URLSearchParams({ data: query }),
        signal: controller.signal,
      })
      const body = await upstream.text()
      if (!upstream.ok) {
        lastFailure = `${endpoint} returned ${upstream.status} ${upstream.statusText}${body ? `: ${body.replace(/\s+/g, ' ').slice(0, 240)}` : ''}`
        console.warn(`Overpass proxy upstream failed: ${lastFailure}`)
        continue
      }

      let payload
      try {
        payload = JSON.parse(body)
      } catch {
        lastFailure = `${endpoint} returned invalid JSON`
        console.warn(`Overpass proxy upstream failed: ${lastFailure}`)
        continue
      }
      if (!Array.isArray(payload.elements)) {
        lastFailure = `${endpoint} returned JSON without an elements array`
        console.warn(`Overpass proxy upstream failed: ${lastFailure}`)
        continue
      }

      response.setHeader('Content-Type', 'application/json; charset=utf-8')
      response.setHeader('Cache-Control', 'no-store')
      return response.status(200).send(body)
    } catch (error) {
      lastFailure = `${endpoint} ${error.name === 'AbortError' ? `timed out after ${UPSTREAM_TIMEOUT_MS / 1000}s` : `${error.name}: ${error.message}`}`
      console.warn(`Overpass proxy upstream failed: ${lastFailure}`)
    } finally {
      clearTimeout(timeoutId)
    }
  }

  return sendJson(response, 502, { error: `All Overpass providers failed. Last: ${lastFailure}` })
}
