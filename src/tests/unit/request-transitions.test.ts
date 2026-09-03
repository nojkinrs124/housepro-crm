import { describe, it, expect } from 'vitest'
import { canTransition, REQUEST_TRANSITIONS } from '@/features/portal/config/request-categories'

describe('переходы статусов заявки', () => {
  it('обычный путь заявки проходит', () => {
    expect(canTransition('new', 'accepted')).toBe(true)
    expect(canTransition('accepted', 'in_progress')).toBe(true)
    expect(canTransition('in_progress', 'done')).toBe(true)
  })

  it('отклонить можно только пока не начали', () => {
    expect(canTransition('new', 'rejected')).toBe(true)
    expect(canTransition('accepted', 'rejected')).toBe(true)
    expect(canTransition('in_progress', 'rejected')).toBe(false)
  })

  it('из закрытой заявки возврата нет', () => {
    // Иначе арендатор видит, как статус его заявки прыгает туда-сюда,
    // и история перестаёт что-либо значить.
    expect(REQUEST_TRANSITIONS.done).toEqual([])
    expect(REQUEST_TRANSITIONS.rejected).toEqual([])
    expect(canTransition('done', 'in_progress')).toBe(false)
    expect(canTransition('rejected', 'accepted')).toBe(false)
  })

  it('перепрыгнуть через этап нельзя', () => {
    expect(canTransition('new', 'done')).toBe(false)
    expect(canTransition('new', 'in_progress')).toBe(false)
  })

  it('неизвестный статус не открывает переходов', () => {
    expect(canTransition('нет такого', 'done')).toBe(false)
  })
})
