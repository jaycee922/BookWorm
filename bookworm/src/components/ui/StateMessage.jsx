import { AlertTriangle, Inbox } from 'lucide-react'

export function StateMessage({ variant = 'empty', icon, title, message, action, compact = false }) {
  const Icon = icon ?? (variant === 'error' ? AlertTriangle : Inbox)
  return (
    <div className={`state-message ${variant} ${compact ? 'compact' : ''}`} role={variant === 'error' ? 'alert' : 'status'}>
      <span className="state-icon"><Icon size={compact ? 22 : 30} aria-hidden="true" /></span>
      <div>
        <h3>{title}</h3>
        {message && <p>{message}</p>}
        {action && <div className="state-action">{action}</div>}
      </div>
    </div>
  )
}
