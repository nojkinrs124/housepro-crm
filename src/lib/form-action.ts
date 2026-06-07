/**
 * Приводит Server Action к типу, совместимому с form action prop.
 * Next.js 16 / React 19 требует (formData: FormData) => void | Promise<void>,
 * но Server Actions часто возвращают { error: string } для обработки ошибок.
 * Этот хелпер убирает несовместимость типов без потери runtime-поведения.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function formAction<T extends (...args: any[]) => any>(
  action: T
): (formData: FormData) => void | Promise<void> {
  return action as unknown as (formData: FormData) => void | Promise<void>
}
