import { useState } from 'react'
import { MAX_LOG_LENGTH } from '../../lib/constants'
import { errorMessage } from '../../services/errors'
import { StarInput } from '../ui/StarRating'
import { Spinner } from '../ui/Spinner'

export function LogForm({ initial, onSubmit, onCancel, submitLabel = 'Post log', idPrefix = 'log' }) {
  const [body, setBody] = useState(initial?.body ?? '')
  const [rating, setRating] = useState(initial?.rating ?? null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const trimmedLength = body.trim().length

  async function handleSubmit(event) {
    event.preventDefault()
    if (trimmedLength === 0) return setError('Write something before posting your log.')
    if (trimmedLength > MAX_LOG_LENGTH) return setError(`Logs can be at most ${MAX_LOG_LENGTH} characters.`)
    if (rating !== null && !(Number.isInteger(rating) && rating >= 1 && rating <= 5)) {
      return setError('Ratings must be between 1 and 5 stars.')
    }
    setBusy(true)
    setError(null)
    try {
      await onSubmit({ body: body.trim(), rating })
      if (!initial) {
        setBody('')
        setRating(null)
      }
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="log-form" onSubmit={handleSubmit} noValidate>
      <label htmlFor={`${idPrefix}-body`} className="field-label">Your reading log</label>
      <textarea
        id={`${idPrefix}-body`}
        className="input textarea"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={4}
        maxLength={MAX_LOG_LENGTH}
        placeholder="What stood out? Where are you in the story? What did you learn?"
        required
        aria-invalid={Boolean(error) && trimmedLength === 0}
        aria-describedby={`${idPrefix}-count`}
        disabled={busy}
      />
      <p id={`${idPrefix}-count`} className="field-hint">{body.length}/{MAX_LOG_LENGTH}</p>
      <StarInput value={rating} onChange={setRating} name={`${idPrefix}-rating`} disabled={busy} />
      {error && <p className="inline-error" role="alert">{error}</p>}
      <div className="form-actions">
        {onCancel && <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={busy}>Cancel</button>}
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy && <Spinner />} {busy ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  )
}
