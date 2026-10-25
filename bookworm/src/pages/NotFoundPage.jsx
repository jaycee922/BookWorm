import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { StateMessage } from '../components/ui/StateMessage'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

export function NotFoundPage() {
  useDocumentTitle('Page not found')
  return (
    <div className="page container not-found">
      <p className="not-found-code" aria-hidden="true">404</p>
      <StateMessage
        icon={Compass}
        title="This page wandered off the shelf"
        message="The page you're looking for doesn't exist."
        action={<Link to="/" className="btn btn-primary">Back to home</Link>}
      />
    </div>
  )
}
