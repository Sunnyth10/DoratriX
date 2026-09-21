const EARTH_RADIUS_METERS = 6_371_000
const NON_WALKABLE_HIGHWAYS = new Set([
  'motorway',
  'motorway_link',
  'trunk',
  'trunk_link',
  'construction',
  'proposed',
])

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.nchc.org.tw/api/interpreter',
]
const ROAD_DATA_TIMEOUT_MS = 8_000

async function fetchRoadData(url, { signal }) {
  const controller = new AbortController()
  let timedOut = false
  const timeoutId = window.setTimeout(() => {
    timedOut = true
    controller.abort()
  }, ROAD_DATA_TIMEOUT_MS)
  const abortRequest = () => controller.abort()
  signal?.addEventListener('abort', abortRequest, { once: true })

  try {
    return await fetch(url, { signal: controller.signal })
  } catch (error) {
    if (timedOut) throw new Error('Road data request timed out')
    throw error
  } finally {
    window.clearTimeout(timeoutId)
    signal?.removeEventListener('abort', abortRequest)
  }
}

export function haversineDistance(first, second) {
  const toRadians = (degrees) => (degrees * Math.PI) / 180
  const latitudeDelta = toRadians(second.lat - first.lat)
  const longitudeDelta = toRadians(second.lng - first.lng)
  const latitudeOne = toRadians(first.lat)
  const latitudeTwo = toRadians(second.lat)

  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitudeOne) * Math.cos(latitudeTwo) * Math.sin(longitudeDelta / 2) ** 2

  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function findNearestNode(graph, lat, lng) {
  let nearestNode = null
  let shortestDistance = Infinity

  for (const node of graph.nodes) {
    const distance = haversineDistance({ lat, lng }, node)

    if (distance < shortestDistance) {
      nearestNode = node
      shortestDistance = distance
    }
  }

  return nearestNode
}

function pointToSegmentDistance(point, from, to) {
  const metersPerLatitudeDegree = 111_320
  const metersPerLongitudeDegree = metersPerLatitudeDegree * Math.cos((point.lat * Math.PI) / 180)
  const fromX = (from.lng - point.lng) * metersPerLongitudeDegree
  const fromY = (from.lat - point.lat) * metersPerLatitudeDegree
  const toX = (to.lng - point.lng) * metersPerLongitudeDegree
  const toY = (to.lat - point.lat) * metersPerLatitudeDegree
  const segmentLengthSquared = (toX - fromX) ** 2 + (toY - fromY) ** 2
  const progress =
    segmentLengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, -(fromX * (toX - fromX) + fromY * (toY - fromY)) / segmentLengthSquared))

  return Math.hypot(fromX + progress * (toX - fromX), fromY + progress * (toY - fromY))
}

// Snap to the closest road segment first. This prevents a sparse node on a nearby,
// parallel road from winning over the road the user actually clicked.
export function findNearestRoadNode(graph, lat, lng) {
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]))
  const point = { lat, lng }
  let nearestEdge = null
  let shortestDistance = Infinity

  for (const edge of graph.edges) {
    const from = nodesById.get(edge.from)
    const to = nodesById.get(edge.to)
    const distance = pointToSegmentDistance(point, from, to)

    if (distance < shortestDistance) {
      nearestEdge = edge
      shortestDistance = distance
    }
  }

  if (!nearestEdge) return null

  const from = nodesById.get(nearestEdge.from)
  const to = nodesById.get(nearestEdge.to)
  return haversineDistance(point, from) <= haversineDistance(point, to) ? from : to
}

function isWalkableWay(way) {
  const { highway, access, foot } = way.tags ?? {}

  return (
    highway &&
    !NON_WALKABLE_HIGHWAYS.has(highway) &&
    !['no', 'private'].includes(access) &&
    !['no', 'private'].includes(foot)
  )
}

function buildAdjacency(graph) {
  const adjacency = new Map(graph.nodes.map((node) => [node.id, []]))

  for (const edge of graph.edges) {
    adjacency.get(edge.from)?.push({ nodeId: edge.to, edge })
    adjacency.get(edge.to)?.push({ nodeId: edge.from, edge })
  }

  return adjacency
}

export function logNearestGraphNode(graph, lat, lng) {
  const node = findNearestNode(graph, lat, lng)
  const edges = graph.edges.filter((edge) => edge.from === node.id || edge.to === node.id)

  console.log('Nearest graph node:', {
    id: node.id,
    lat: node.lat,
    lng: node.lng,
    degree: edges.length,
    edges,
  })

  return { node, edges }
}

export function checkShortReachability(graph, startNodeId, endNodeId, { maxHops = 12 } = {}) {
  const adjacency = buildAdjacency(graph)
  const queue = [{ nodeId: startNodeId, hops: 0, path: [startNodeId] }]
  const visited = new Set([startNodeId])

  while (queue.length > 0) {
    const current = queue.shift()

    if (current.nodeId === endNodeId) {
      const result = { reachable: true, hops: current.hops, path: current.path }
      console.log('Short connectivity check:', result)
      return result
    }

    if (current.hops === maxHops) continue

    for (const neighbor of adjacency.get(current.nodeId) ?? []) {
      if (visited.has(neighbor.nodeId)) continue

      visited.add(neighbor.nodeId)
      queue.push({
        nodeId: neighbor.nodeId,
        hops: current.hops + 1,
        path: [...current.path, neighbor.nodeId],
      })
    }
  }

  const start = graph.nodes.find((node) => node.id === startNodeId)
  const end = graph.nodes.find((node) => node.id === endNodeId)
  const result = {
    reachable: false,
    maxHops,
    start: {
      node: start,
      edges: graph.edges.filter((edge) => edge.from === startNodeId || edge.to === startNodeId),
    },
    end: {
      node: end,
      edges: graph.edges.filter((edge) => edge.from === endNodeId || edge.to === endNodeId),
    },
  }

  console.warn('Short connectivity check failed:', result)
  return result
}

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

function graphFromElements(elements) {
  const pointsById = new Map(
    elements
      .filter((element) => element.type === 'node')
      .filter((node) => Number.isFinite(node.lat) && Number.isFinite(node.lon))
      .map((node) => [node.id, { id: node.id, lat: node.lat, lng: node.lon }]),
  )
  const usedNodeIds = new Set()
  const seenEdges = new Set()
  const edges = []

  for (const way of elements.filter((element) => element.type === 'way' && isWalkableWay(element))) {
    for (let index = 0; index < way.nodes.length - 1; index += 1) {
      const from = pointsById.get(way.nodes[index])
      const to = pointsById.get(way.nodes[index + 1])
      if (!from || !to) continue

      const edgeKey = [from.id, to.id].sort((a, b) => a - b).join(':')
      if (seenEdges.has(edgeKey)) continue

      seenEdges.add(edgeKey)
      usedNodeIds.add(from.id)
      usedNodeIds.add(to.id)
      edges.push({ id: edgeKey, from: from.id, to: to.id, weight: haversineDistance(from, to) })
    }
  }

  const nodes = [...usedNodeIds].map((id) => pointsById.get(id))
  if (nodes.length === 0 || edges.length === 0) {
    throw new Error('Road graph response contained no usable walkable nodes or edges')
  }

  const adjacency = new Map(nodes.map((node) => [node.id, []]))
  for (const edge of edges) {
    adjacency.get(edge.from).push(edge.to)
    adjacency.get(edge.to).push(edge.from)
  }

  let largestComponent = []
  const visited = new Set()
  for (const node of nodes) {
    if (visited.has(node.id)) continue

    const component = []
    const queue = [node.id]
    visited.add(node.id)
    for (let index = 0; index < queue.length; index += 1) {
      const current = queue[index]
      component.push(current)
      for (const neighbor of adjacency.get(current)) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor)
          queue.push(neighbor)
        }
      }
    }
    if (component.length > largestComponent.length) largestComponent = component
  }

  const connectedNodeIds = new Set(largestComponent)
  return {
    nodes: nodes.filter((node) => connectedNodeIds.has(node.id)),
    edges: edges.filter((edge) => connectedNodeIds.has(edge.from) && connectedNodeIds.has(edge.to)),
  }
}

function parseOsmMapXml(xmlText) {
  const document = new DOMParser().parseFromString(xmlText, 'application/xml')
  if (document.querySelector('parsererror')) throw new Error('Official OSM map response was invalid XML')

  const nodes = [...document.querySelectorAll('node')].map((node) => ({
    type: 'node',
    id: Number(node.getAttribute('id')),
    lat: Number(node.getAttribute('lat')),
    lon: Number(node.getAttribute('lon')),
  }))
  const ways = [...document.querySelectorAll('way')].map((way) => ({
    type: 'way',
    id: Number(way.getAttribute('id')),
    nodes: [...way.querySelectorAll(':scope > nd')].map((node) => Number(node.getAttribute('ref'))),
    tags: Object.fromEntries(
      [...way.querySelectorAll(':scope > tag')].map((tag) => [tag.getAttribute('k'), tag.getAttribute('v')]),
    ),
  }))

  return [...nodes, ...ways]
}

async function fetchOfficialOsmRoadGraph(center, { signal, halfSideKilometers }) {
  const { south, west, north, east } = boundingBox(center, halfSideKilometers)
  const response = await fetchRoadData(`/osm-api/api/0.6/map?bbox=${west},${south},${east},${north}`, { signal })
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)

  return graphFromElements(parseOsmMapXml(await response.text()))
}

export async function fetchRoadGraph(center, { signal, halfSideKilometers = 0.75 } = {}) {
  if (import .meta.env.DEV){
    try{
      return await fetchOfficialOsmRoadGraph(center,{signal, halfSideKilometers})
    }catch(error){
      if (error.name ==='AbortError')throw error
      console.warn('Official OSM map request failed; trying overpass provider:', error)
    }
  }
  const { south, west, north, east } = boundingBox(center, halfSideKilometers)
  const query = `
    [out:json][timeout:25];
    way["highway"](${south},${west},${north},${east});
    (._;>;);
    out body;
  `
  let elements
  let lastError

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await fetchRoadData(`${endpoint}?data=${encodeURIComponent(query)}`, { signal })
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`)
      }

      const payload = await response.json()
      if (!Array.isArray(payload.elements)) {
        throw new Error('Invalid road graph response')
      }

      elements = payload.elements
      break
    } catch (error) {
      if (error.name === 'AbortError') throw error
      lastError = error
      console.warn(`Road graph request failed via ${endpoint}:`, error)
    }
  }

  if (!elements) {
    throw new Error(`All road graph providers failed. ${lastError?.message ?? ''}`.trim())
  }

  return graphFromElements(elements)
}
