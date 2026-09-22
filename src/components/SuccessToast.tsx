import { Check } from 'lucide-react'

type SuccessToastProps = {
  message: string
}

export function SuccessToast({ message }: SuccessToastProps) {
  return (
    <div className="success-toast" role="status" aria-live="polite">
      <Check size={17} aria-hidden="true" />
      <span>{message}</span>
    </div>
  )
}
