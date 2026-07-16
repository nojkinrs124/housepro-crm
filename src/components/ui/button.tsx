import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/**
 * Единая кнопка HousePro. Раньше стили primary/secondary кнопок были
 * скопированы вручную в 40+ файлах (разные варианты одного и того же
 * зелёного градиента). Теперь любое визуальное изменение кнопки —
 * правка в одном месте.
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-[14px] text-sm font-bold transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap',
  {
    variants: {
      variant: {
        // Класс hp-gradient-primary-bg (globals.css) задаёт фон — раньше это
        // был инлайн-стиль, который легко забыть при использовании
        // buttonVariants() напрямую на <Link>. Теперь фон приходит вместе
        // с классом, и его невозможно случайно не подключить.
        primary:
          'hp-gradient-primary-bg text-white hover:-translate-y-0.5 shadow-[0_4px_16px_rgba(22,163,74,0.35)] hover:shadow-[0_6px_20px_rgba(22,163,74,0.45)]',
        secondary:
          'bg-white text-foreground border-[1.5px] border-[rgba(214,219,235,0.9)] hover:bg-background hover:border-[rgba(22,163,74,0.3)] hover:text-[#16A34A]',
        ghost:
          'text-muted-foreground hover:text-foreground hover:bg-[#F1F5F9]',
        destructive:
          'bg-red-50 text-red-600 border border-red-100 hover:bg-red-100',
      },
      size: {
        sm: 'h-9 px-4 text-xs',
        md: 'h-11 px-5',
        lg: 'h-12 px-6',
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
