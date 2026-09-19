import { useCallback, useEffect, useState } from 'react'

export function useSearchAnimation(frames) {
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const lastFrameIndex = Math.max(frames.length - 1, 0)

  useEffect(() => {
    setCurrentFrameIndex(0)
    setIsPlaying(false)
  }, [frames])

  useEffect(() => {
    if (!isPlaying || frames.length === 0) return undefined

    if (currentFrameIndex >= lastFrameIndex) {
      setIsPlaying(false)
      return undefined
    }

    const intervalId = window.setInterval(() => {
      setCurrentFrameIndex((index) => {
        if (index >= lastFrameIndex - 1) {
          setIsPlaying(false)
          return lastFrameIndex
        }

        return index + 1
      })
    }, 100)

    return () => window.clearInterval(intervalId)
  }, [currentFrameIndex, frames.length, isPlaying, lastFrameIndex])

  const play = useCallback(() => {
    if (frames.length === 0) return
    if (currentFrameIndex >= lastFrameIndex) setCurrentFrameIndex(0)
    setIsPlaying(true)
  }, [currentFrameIndex, frames.length, lastFrameIndex])

  const pause = useCallback(() => setIsPlaying(false), [])

  const reset = useCallback(() => {
    setIsPlaying(false)
    setCurrentFrameIndex(0)
  }, [])

  const setFrameIndex = useCallback(
    (index) => {
      setIsPlaying(false)
      setCurrentFrameIndex(Math.min(Math.max(Number(index), 0), lastFrameIndex))
    },
    [lastFrameIndex],
  )

  return { currentFrameIndex, isPlaying, play, pause, reset, setFrameIndex }
}
