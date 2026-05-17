import { cn } from '@/lib/utils'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'brand' | 'green' | 'yellow' | 'red' | 'blue'
  className?: string
}

const variants = {
  default: 'bg-surface-800 text-surface-300 border-surface-700',
  brand:   'bg-brand-500/10 text-brand-400 border-brand-500/20',
  green:   'bg-green-500/10 text-green-400 border-green-500/20',
  yellow:  'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  red:     'bg-red-500/10 text-red-400 border-red-500/20',
  blue:    'bg-blue-500/10 text-blue-400 border-blue-500/20',
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border',
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  )
}
