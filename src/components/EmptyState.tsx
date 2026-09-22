import type { ReactNode } from 'react'

type EmptyStateProps = {
  icon: ReactNode
  eyebrow: string
  title: string
  description: string
  titleId: string
  actions: ReactNode
}

export function EmptyState({ icon, eyebrow, title, description, titleId, actions }: EmptyStateProps) {
  return (
    <section className="empty-state" aria-labelledby={titleId}>
      <div className="empty-illustration" aria-hidden="true">{icon}</div>
      <span className="eyebrow">{eyebrow}</span>
      <h2 id={titleId}>{title}</h2>
      <p>{description}</p>
      <div className="empty-actions">{actions}</div>
    </section>
  )
}
