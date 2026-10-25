import { Star } from 'lucide-react'

export function StarDisplay({ rating, size = 16 }) {
  if (!rating) return null
  return (
    <span className="stars" role="img" aria-label={`Rated ${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={size} aria-hidden="true" className={n <= rating ? 'star filled' : 'star'} />
      ))}
    </span>
  )
}

// Optional 1–5 rating as a radio group; "No rating" clears it.
export function StarInput({ value, onChange, name = 'rating', disabled = false }) {
  return (
    <fieldset className="star-input" disabled={disabled}>
      <legend>Rating <span className="muted">(optional)</span></legend>
      <div className="star-input-row">
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className={`star-option ${value && n <= value ? 'active' : ''}`}>
            <input type="radio" name={name} value={n} checked={value === n} onChange={() => onChange(n)} className="sr-only" />
            <Star size={24} aria-hidden="true" />
            <span className="sr-only">{n} star{n > 1 ? 's' : ''}</span>
          </label>
        ))}
        <button type="button" className="text-button" onClick={() => onChange(null)} disabled={!value}>
          No rating
        </button>
      </div>
    </fieldset>
  )
}
