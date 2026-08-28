'use client'

import { useActionState } from 'react'
import { AlertCircle } from 'lucide-react'

type ActionResult = { error?: string; success?: boolean; fields?: Record<string, string[] | undefined> } | void | undefined

interface ServerActionFormProps extends Omit<React.FormHTMLAttributes<HTMLFormElement>, 'action' | 'children'> {
 /**
 * Любой Server Action (или уже забинженный через .bind), принимающий
 * FormData первым/единственным релевантным аргументом и возвращающий
 * { error } при неудаче. Лишние аргументы из useActionState игнорируются
 * вызываемой функцией, если она их не объявляет — это безопасно в JS.
 */
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 action: (...args: any[]) => any
 children: React.ReactNode
}

/**
 * Замена для form-action.ts: вместо простого приведения типов
 * оборачивает Server Action в useActionState и показывает ошибку
 * пользователю (баннер сверху формы), а не проглатывает её молча.
 */
export function ServerActionForm({ action, children, ...rest }: ServerActionFormProps) {
 const wrapped = async (_prevState: ActionResult, formData: FormData): Promise<ActionResult> => {
 return (await action(formData)) as ActionResult
 }
 const [state, formAction, isPending] = useActionState(wrapped, undefined)

 return (
 <form action={formAction} {...rest}>
 {state?.error && (
 <div className="flex items-center gap-2 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mb-4">
 <AlertCircle className="w-4 h-4 shrink-0" />
 {state.error}
 </div>
 )}
 <fieldset disabled={isPending} className="contents">
 {children}
 </fieldset>
 </form>
 )
}
