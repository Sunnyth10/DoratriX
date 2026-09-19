import { useEffect, useState } from 'react'
import { divIcon } from 'leaflet'
import { MapContainer, Marker, Polyline, TileLayer, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { dijkstra } from '../lib/dijkstra'
import { fetchRoadGraph, findNearestNode } from '../lib/graph'

// Replace these with the latitude and longitude of your city.
const cityCenter = [17.418, 78.489]

const markerIcon = (color) =>
  divIcon({
    className: 'snapped-marker-container',
    html: `<span class="snapped-marker" style="background: ${color}"></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  })

const startIcon = markerIcon('#16a34a')
const endIcon = markerIcon('#dc2626')

function MapClickHandler({ graph, onNodeClick }) {
  useMapEvents({
    click(event) {
      if (!graph) return

      const node = findNearestNode(graph, event.latlng.lat, event.latlng.lng)
      if (node) onNodeClick(node.id)
    },
  })

  return null
}

export default function MapView() {
  const [graph, setGraph] = useState(null)
  const [startNodeId, setStartNodeId] = useState(null)
  const [endNodeId, setEndNodeId] = useState(null)
  const [route, setRoute] = useState(null)

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
  const startNode = nodesById.get(startNodeId)
  const endNode = nodesById.get(endNodeId)
  const routePositions = route?.path
    .map((nodeId) => nodesById.get(nodeId))
    .filter(Boolean)
    .map((node) => [node.lat, node.lng])

  function handleNodeClick(nodeId) {
    setRoute(null)

    if (!startNodeId) {
      setStartNodeId(nodeId)
    } else if (!endNodeId) {
      setEndNodeId(nodeId)
    }
  }

  function handleMarkerDrag(nodeType, event) {
    const { lat, lng } = event.target.getLatLng()
    const nearestNode = findNearestNode(graph, lat, lng)

    setRoute(null)

    if (nodeType === 'start') {
      setStartNodeId(nearestNode.id)
    } else {
      setEndNodeId(nearestNode.id)
    }
  }

  function findShortestPath() {
    const result = dijkstra(graph, startNodeId, endNodeId)
    console.log(result.frames.length)
    setRoute(result)
  }

  return (
    <div className="map-shell">
      <div className="map-controls">
        <button
          className="reset-button"
          type="button"
          onClick={() => {
            setStartNodeId(null)
            setEndNodeId(null)
            setRoute(null)
          }}
        >
          Reset
        </button>
        <button
          className="path-button"
          type="button"
          disabled={!startNodeId || !endNodeId}
          onClick={findShortestPath}
        >
          Find Shortest Path
        </button>
        {route && Number.isFinite(route.distance) && (
          <span className="distance-label">Distance: {(route.distance / 1000).toFixed(2)} km</span>
        )}
      </div>
      <MapContainer center={cityCenter} zoom={15} className="map">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapClickHandler graph={graph} onNodeClick={handleNodeClick} />
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
        {routePositions?.length > 1 && (
          <Polyline positions={routePositions} pathOptions={{ color: '#0057ff', weight: 5 }} />
        )}
        {startNode && (
          <Marker
            draggable
            eventHandlers={{ dragend: (event) => handleMarkerDrag('start', event) }}
            icon={startIcon}
            position={[startNode.lat, startNode.lng]}
          />
        )}
        {endNode && (
          <Marker
            draggable
            eventHandlers={{ dragend: (event) => handleMarkerDrag('end', event) }}
            icon={endIcon}
            position={[endNode.lat, endNode.lng]}
          />
        )}
      </MapContainer>
    </div>
  )
}
