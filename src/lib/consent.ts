// Версия текста согласия на обработку персональных данных.
//
// Версию, а не сам текст, пишем рядом с записью (leads/contacts.consent_pd_version):
// политика со временем меняется, и в споре важно знать, с какой редакцией
// согласился конкретный человек. При изменении текста политики на /policy
// ОБЯЗАТЕЛЬНО поднимать версию здесь — иначе отметки станут недостоверными.

export const CONSENT_VERSION = '2026-09-01'

export type ConsentSource = 'site_form' | 'crm_manual' | 'import' | 'telegram_bot' | 'api'

export interface ConsentFields {
  consent_pd_at: string
  consent_pd_version: string
  consent_source: ConsentSource
}

/** Набор полей для записи факта согласия — одинаков для лидов и контактов. */
export function consentFields(source: ConsentSource): ConsentFields {
  return {
    consent_pd_at: new Date().toISOString(),
    consent_pd_version: CONSENT_VERSION,
    consent_source: source,
  }
}
