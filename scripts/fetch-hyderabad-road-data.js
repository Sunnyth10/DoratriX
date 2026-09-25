import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { graphFromElements, graphWithinBounds } from '../src/lib/graph.js'

const CENTER = [17.418, 78.489]
const HALF_SIDE_KILOMETERS = 8
const USER_AGENT = 'DoratriX/1.0 (https://doratri-x.vercel.app; road network map)'
const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.nchc.org.tw/api/interpreter',
]

function boundingBox([latitude, longitude], halfSideKilometers) {
  const latitudeOffset = halfSideKilometers / 110.574
  const longitudeOffset = halfSideKilometers / (111.32 * Math.cos((latitude * Math.PI) / 180))
  return {
    south: latitude - latitudeOffset,
    west: longitude - longitudeOffset,
    north: latitude + latitudeOffset,
    east: longitude + longitudeOffset,
  }
}

const bounds = boundingBox(CENTER, HALF_SIDE_KILOMETERS)
const query = `
  [out:json][timeout:90];
  way["highway"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});
  (._;>;);
  out body;
`

let elements
let lastError
for (const endpoint of ENDPOINTS) {
  try {
    console.log(`Requesting Hyderabad road data from ${endpoint}`)
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'User-Agent': USER_AGENT,
      },
      body: new URLSearchParams({ data: query }),
      signal: AbortSignal.timeout(120_000),
    })
    if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}: ${(await response.text()).slice(0, 300)}`)
    const payload = await response.json()
    if (!Array.isArray(payload.elements)) throw new Error('Response did not contain an elements array')
    elements = payload.elements
    console.log(`Received ${elements.length} OSM elements from ${endpoint}`)
    break
  } catch (error) {
    lastError = error
    console.error(`Failed ${endpoint}: ${error.name}: ${error.message}`)
  }
}

if (!elements) throw new Error(`All Overpass endpoints failed. ${lastError?.message ?? ''}`)

const graph = graphWithinBounds(graphFromElements(elements), bounds)
const compactGraph = {
  format: 'doratrix-compact-graph-v1',
  source: 'OpenStreetMap',
  license: 'ODbL-1.0',
  generatedAt: new Date().toISOString(),
  bounds,
  nodes: graph.nodes.map(({ id, lat, lng }) => [id, lat, lng]),
  edges: graph.edges.map(({ from, to, weight }) => [from, to, weight]),
}
const outputPath = resolve('public/road-data/hyderabad.json')
await mkdir(resolve('public/road-data'), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(compactGraph)}\n`)
console.log(`Saved ${graph.nodes.length} nodes and ${graph.edges.length} edges to ${outputPath}`)
