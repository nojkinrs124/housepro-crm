import { describe, expect, it } from 'vitest'
import { parseMeterCorrectionInput, planMeterCorrection } from '@/features/meters/services/meter-correction'

describe('parseMeterCorrectionInput', () => {
  it('accepts a value, ISO date, and reason and trims presentation whitespace', () => {
    expect(parseMeterCorrectionInput({
      value: ' 123,45 ',
      reading_date: '2026-11-23',
      correction_reason: '  Опечатка в цифре  ',
    })).toEqual({
      ok: true,
      data: {
        value: 123.45,
        reading_date: '2026-11-23',
        correction_reason: 'Опечатка в цифре',
      },
    })
  })

  it('rejects an empty or oversized correction reason', () => {
    expect(parseMeterCorrectionInput({ value: '10', reading_date: '2026-11-23', correction_reason: '  ' }).ok).toBe(false)
    expect(parseMeterCorrectionInput({ value: '10', reading_date: '2026-11-23', correction_reason: 'x'.repeat(301) }).ok).toBe(false)
  })

  it('rejects invalid values and non-calendar dates', () => {
    expect(parseMeterCorrectionInput({ value: '-1', reading_date: '2026-11-23', correction_reason: 'Причина' }).ok).toBe(false)
    expect(parseMeterCorrectionInput({ value: 'abc', reading_date: '2026-11-23', correction_reason: 'Причина' }).ok).toBe(false)
    expect(parseMeterCorrectionInput({ value: '10', reading_date: '2026-02-30', correction_reason: 'Причина' }).ok).toBe(false)
  })
})

describe('planMeterCorrection', () => {
  const input = { value: 160, reading_date: '2026-11-23', correction_reason: 'Опечатка' }

  it('appends a correction and calculates from the prior logical reading', () => {
    expect(planMeterCorrection({
      targetId: 'target',
      input,
      tariff: 38.06,
      history: [
        { id: 'target', reading_date: '2026-11-23', value: 150, corrects_reading_id: null },
        { id: 'older', reading_date: '2026-10-23', value: 100, corrects_reading_id: null },
        { id: 'later', reading_date: '2026-12-23', value: 180, corrects_reading_id: null },
      ],
    })).toEqual({
      ok: true,
      data: {
        target_id: 'target',
        reading_date: '2026-11-23',
        value: 160,
        correction_reason: 'Опечатка',
        previous_value: 100,
        consumption: 60,
        amount: 2283.6,
      },
    })
  })

  it('rejects an already superseded reading as a correction target', () => {
    expect(planMeterCorrection({
      targetId: 'target',
      input,
      tariff: null,
      history: [
        { id: 'target', reading_date: '2026-11-23', value: 150, corrects_reading_id: null },
        { id: 'newer-correction', reading_date: '2026-11-23', value: 155, corrects_reading_id: 'target' },
      ],
    })).toMatchObject({ ok: false })
  })
})
