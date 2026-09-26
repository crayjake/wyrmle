import { Star } from 'lucide-react'
import './StarRating.css'

export default function StarRating({ stars, label }: { stars: number; label?: string }) {
  return <span className="star-rating" role="img" aria-label={label ?? `${stars} of 3 stars`}>
    {[1, 2, 3].map(star => <Star key={star} aria-hidden="true" data-earned={star <= stars} />)}
  </span>
}
