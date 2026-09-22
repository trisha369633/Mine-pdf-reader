import { AlertCircle } from 'lucide-react'

type ErrorToastProps = {
  message: string
}

export function ErrorToast({ message }: ErrorToastProps) {
  return (
    <div className="success-toast error-toast" role="alert" aria-live="assertive">
      <AlertCircle size={17} aria-hidden="true" />
      <span>{message}</span>
    </div>
  )
}
