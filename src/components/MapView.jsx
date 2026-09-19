import { useEffect, useState } from 'react'
import { MapContainer, Polyline, TileLayer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { fetchRoadGraph } from '../lib/graph'

// Replace these with the latitude and longitude of your city.
const cityCenter = [12.9716, 77.5946]

export default function MapView() {
  const [graph, setGraph] = useState(null)

  useEffect(() => {
    const controller = new AbortController()

    fetchRoadGraph(cityCenter, { signal: controller.signal })
      .then((roadGraph) => {
        console.log('Road graph:', roadGraph)
        setGraph(roadGraph)
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          console.error('Could not load road graph:', error)
        }
      })

    return () => controller.abort()
  }, [])

  const nodesById = new Map(graph?.nodes.map((node) => [node.id, node]))

  return (
    <MapContainer center={cityCenter} zoom={15} className="map">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {graph?.edges.map((edge) => {
        const from = nodesById.get(edge.from)
        const to = nodesById.get(edge.to)

        return (
          <Polyline
            key={edge.id}
            positions={[[from.lat, from.lng], [to.lat, to.lng]]}
            pathOptions={{ color: 'blue', weight: 1 }}
          />
        )
      })}
    </MapContainer>
  )
}
