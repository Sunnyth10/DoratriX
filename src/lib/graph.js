const EARTH_RADIUS_METERS = 6_371_000

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

export async function fetchRoadGraph(center, { signal, halfSideKilometers = 0.75 } = {}) {
  const { south, west, north, east } = boundingBox(center, halfSideKilometers)
  const query = `
    [out:json][timeout:25];
    way["highway"](${south},${west},${north},${east});
    (._;>;);
    out body;
  `
  const response = await fetch(
    `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`,
    { signal },
  )

  if (!response.ok) {
    throw new Error(`Overpass request failed: ${response.status} ${response.statusText}`)
  }

  const { elements } = await response.json()
  const pointsById = new Map(
    elements
      .filter((element) => element.type === 'node')
      .map((node) => [node.id, { id: node.id, lat: node.lat, lng: node.lon }]),
  )
  const usedNodeIds = new Set()
  const seenEdges = new Set()
  const edges = []

  for (const way of elements.filter((element) => element.type === 'way')) {
    for (let index = 0; index < way.nodes.length - 1; index += 1) {
      const from = pointsById.get(way.nodes[index])
      const to = pointsById.get(way.nodes[index + 1])

      if (!from || !to) continue

      const edgeKey = [from.id, to.id].sort((a, b) => a - b).join(':')
      if (seenEdges.has(edgeKey)) continue

      seenEdges.add(edgeKey)
      usedNodeIds.add(from.id)
      usedNodeIds.add(to.id)
      edges.push({
        id: edgeKey,
        from: from.id,
        to: to.id,
        weight: haversineDistance(from, to),
      })
    }
  }

  return {
    nodes: [...usedNodeIds].map((id) => pointsById.get(id)),
    edges,
  }
}
