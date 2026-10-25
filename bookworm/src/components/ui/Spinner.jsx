export function Spinner({ size = 18, label }) {
  return (
    <span className="spinner" style={{ width: size, height: size }} role={label ? 'status' : undefined} aria-label={label} aria-hidden={label ? undefined : true} />
  )
}

export function PageLoader({ label = 'Loading' }) {
  return (
    <div className="page-loader">
      <Spinner size={36} label={label} />
    </div>
  )
}
