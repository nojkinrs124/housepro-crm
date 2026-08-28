import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/**
 * Единая кнопка HousePro — «Кабинет» (см. docs/DESIGN_SYSTEM_AUDIT.md).
 * Плоский цвет вместо градиента, hairline-граница вместо тени, radius 12px.
 * Раньше стили primary/secondary кнопок были скопированы вручную в 40+
 * файлах — теперь любое визуальное изменение кнопки — правка в одном месте.
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-[var(--hp-radius)] text-sm font-semibold transition-colors duration-150 disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap',
  {
    variants: {
      variant: {
        primary:
          'bg-[var(--hp-accent)] text-white border border-[var(--hp-accent)] hover:bg-[var(--hp-accent-hover)] hover:border-[var(--hp-accent-hover)]',
        secondary:
          'bg-white text-foreground border border-[var(--hp-border)] hover:border-[var(--hp-sub)]',
        ghost:
          'text-muted-foreground hover:text-foreground hover:bg-[var(--hp-neutral-tint)]',
        destructive:
          'bg-[var(--hp-danger-tint)] text-[var(--hp-danger)] border border-[var(--hp-danger-tint)] hover:border-[var(--hp-danger)]',
      },
      size: {
        sm: 'h-9 px-4 text-xs',
        md: 'h-10 px-5',
        lg: 'h-11 px-6',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
)

export { buttonVariants }

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'
