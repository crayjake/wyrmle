import { animate, motion, motionValue, useReducedMotion } from 'framer-motion'
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Star } from 'lucide-react'
import { createBingoTour } from '../intro/bingoTour'
import { sampleWalkingPiece, smoothTravelDistance } from '../intro/walk'
import { WyrmLifePart } from './WyrmLifeMeter'
import './BingoStars.css'

export default function BingoStars() {
  const reducedMotion = useReducedMotion()
  const stage = useRef<HTMLDivElement>(null)
  const [lit, setLit] = useState(0)
  const visibleLit = reducedMotion ? 3 : lit
  const pieces = useMemo(() => Array.from({ length: 5 }, () => ({
    x: motionValue(0), y: motionValue(0), rotate: motionValue(0),
  })), [])
  const opacity = useMemo(() => motionValue(0), [])
  useLayoutEffect(() => {
    if (reducedMotion) { opacity.set(0); return }
    const element = stage.current!
    const bounds = element.getBoundingClientRect()
    const centers = [...element.querySelectorAll('.bingo-tour-star')].map(star => {
      const r = star.getBoundingClientRect()
      return { x: r.x + r.width / 2 - bounds.x, y: r.y + r.height / 2 - bounds.y }
    })
    const { route, arrivals } = createBingoTour(bounds.width, centers)
    const duration = 2.8
    let revealed = -1
    const finish = () => { setLit(3); opacity.set(0) }
    const playback = animate(0, duration, { duration, delay: 0.15, ease: 'linear', onUpdate: elapsed => {
      const distance = smoothTravelDistance(elapsed, duration, route.length, 0.25)
      opacity.set(Math.min(1, elapsed / 0.15, (duration - elapsed) / 0.2))
      pieces.forEach((piece, index) => {
        const pose = sampleWalkingPiece(route, distance, (4 - index) * 11, elapsed, 0.7, index)
        piece.x.set(pose.x); piece.y.set(pose.y); piece.rotate.set(index === 4 ? pose.angle : 0)
      })
      const count = arrivals.filter(arrival => arrival <= distance).length
      if (count !== revealed) { revealed = count; setLit(count) }
    }, onComplete: finish })
    const observer = new ResizeObserver(() => {
      const r = element.getBoundingClientRect()
      if (Math.abs(r.width - bounds.width) > 1 || Math.abs(r.height - bounds.height) > 1) {
        playback.stop(); finish()
      }
    })
    observer.observe(element)
    return () => { playback.stop(); observer.disconnect() }
  }, [reducedMotion, pieces, opacity])

  return <div ref={stage} className="bingo-result-stars bingo-stars-tour" role="img" aria-label="3 of 3 stars" data-lit-count={visibleLit}>
    {[1, 2, 3].map(star => <span className="bingo-tour-star" key={star}>
      <Star aria-hidden="true" data-lit={star <= visibleLit} />
    </span>)}
    <motion.span className="bingo-result-wyrm" aria-hidden="true" style={{ opacity }}>
      {pieces.map((piece, index) => <motion.span key={index} className="bingo-wyrm-piece"
        data-piece={index} style={{ x: piece.x, y: piece.y, rotate: piece.rotate }}>
        <WyrmLifePart kind={index === 4 ? 'head' : index === 0 ? 'tail' : 'body'} filled />
      </motion.span>)}
    </motion.span>
  </div>
}
