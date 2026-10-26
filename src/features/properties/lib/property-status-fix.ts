/**
 * Решение кнопки «Исправить статус» на карточке объекта.
 *
 * Вынесено из Server Action в чистую функцию, чтобы правило можно было
 * покрыть юнит-тестом: рассинхрон двусторонний, и его легко снова сузить до
 * одного направления (именно так и появился баг из аудита 26.10.2026, P0-2 —
 * кнопка чинила «rented → available» и молча ничего не делала для
 * «available + подписанный договор»).
 */

export type PropertyStatusFix =
  /** Статус уже соответствует данным — менять нечего. */
  | { kind: 'noop'; message: string }
  /** Нужно записать новый статус объекта. */
  | { kind: 'update'; nextStatus: 'available' | 'rented' }

export function decidePropertyStatusFix(input: {
  /** Текущий статус объекта (`properties.status`). */
  status: string | null | undefined
  /** Есть ли действующий договор аренды/найма (любой, кроме отменённого и истёкшего). */
  hasActiveRentContract: boolean
  /** Есть ли действующий договор именно в статусе «подписан»/«завершён». */
  hasSignedRentContract: boolean
}): PropertyStatusFix {
  const { status, hasActiveRentContract, hasSignedRentContract } = input

  // «Сдано», но договора нет — объект ошибочно занят.
  if (status === 'rented' && !hasActiveRentContract) {
    return { kind: 'update', nextStatus: 'available' }
  }

  // Договор подписан, а объект всё ещё висит свободным в рекламе.
  if (status === 'available' && hasSignedRentContract) {
    return { kind: 'update', nextStatus: 'rented' }
  }

  // Договор есть, но не подписан: «сдано» ставить нельзя, и лучше сказать
  // об этом прямо, чем молча не сработать.
  if (status === 'available' && hasActiveRentContract && !hasSignedRentContract) {
    return {
      kind: 'noop',
      message:
        'Договор аренды по объекту ещё не подписан — отметьте его подписанным, и статус можно будет исправить этой кнопкой',
    }
  }

  // Продан/неактивен/зарезервирован не трогаем: договор аренды о них ничего
  // не говорит.
  return {
    kind: 'noop',
    message: hasActiveRentContract
      ? 'По объекту есть действующий договор аренды — статус менять не нужно'
      : 'Статус уже соответствует данным договора',
  }
}
