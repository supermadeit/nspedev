import { useState, type ComponentProps } from 'react'
import { Input } from './input'
import { cn } from '@/lib/utils'

// Drop-in replacement for `<Input type="password" />` with a "show"/"hide"
// toggle built in — used by LoginPage and SignupPage.
export function PasswordInput({ className, ...props }: Omit<ComponentProps<'input'>, 'type'>) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <Input type={visible ? 'text' : 'password'} className={cn('pr-14', className)} {...props} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        // tabIndex -1 keeps tab order moving from the field straight to the
        // next real form control, not through this toggle.
        tabIndex={-1}
        aria-label={visible ? 'Hide password' : 'Show password'}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-mono text-neutral-500 hover:text-neutral-200 transition-colors select-none"
      >
        {visible ? 'hide' : 'show'}
      </button>
    </div>
  )
}
