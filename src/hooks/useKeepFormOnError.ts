'use client'

import { startTransition, useCallback, useEffect, useRef, type FormEvent } from 'react'

/**
 * Отправка формы Server Action'ом: при ошибке введённое ОСТАЁТСЯ в полях,
 * при успехе форма очищается, как раньше.
 *
 * Зачем. React 19 при `<form action={fn}>` после завершения action всегда
 * вызывает `requestFormReset` — неуправляемые поля возвращаются к
 * `defaultValue`, в том числе когда action вернул ошибку валидации. Пользователь
 * видит «Укажите положительное число», а стороны договора, объект, даты и суммы
 * уже стёрты (QA 28.10.2026, ROOT-1: B-02, A-01, A-10, F-05, F-07).
 *
 * Как. Форма отправляется через onSubmit: отменяем нативную отправку и вызываем
 * dispatch из useActionState внутри startTransition — так React не планирует
 * сброс. Сброс делаем сами, только когда action завершился без `error`
 * (redirect() уводит со страницы раньше, ему это не мешает).
 *
 *   const [state, formAction, isPending] = useActionState(action, null)
 *   const { formRef, onSubmit } = useKeepFormOnError(formAction, state, isPending)
 *   <form ref={formRef} onSubmit={onSubmit}>…</form>
 *
 * Нативная проверка браузера (required, min, type=email) срабатывает до
 * события submit и продолжает работать.
 */
export function useKeepFormOnError(
  dispatch: (formData: FormData) => void,
  state: unknown,
  isPending: boolean,
  opts: { resetOnSuccess?: boolean } = {},
) {
  const { resetOnSuccess = true } = opts
  const formRef = useRef<HTMLFormElement>(null)
  const wasPending = useRef(false)

  useEffect(() => {
    if (wasPending.current && !isPending && resetOnSuccess && !hasError(state)) {
      formRef.current?.reset()
    }
    wasPending.current = isPending
  }, [isPending, state, resetOnSuccess])

  const onSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      const form = event.currentTarget
      const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | HTMLInputElement | null
      const formData = new FormData(form)
      // Кнопка с name/value (например «Сохранить и создать ещё») — как при нативной отправке.
      if (submitter?.name) formData.append(submitter.name, submitter.value)
      startTransition(() => dispatch(formData))
    },
    [dispatch],
  )

  return { formRef, onSubmit }
}

function hasError(state: unknown): boolean {
  return typeof state === 'object' && state !== null && 'error' in state && Boolean((state as { error?: unknown }).error)
}
