export type LegalForm = 'individual' | 'ip' | 'ooo'

export const LEGAL_FORM_OPTIONS: { value: LegalForm; label: string; icon: string; nameLabel: string; namePlaceholder: string }[] = [
  { value: 'individual', label: 'Физ. лицо', icon: '🧑', nameLabel: 'ФИО', namePlaceholder: 'Иванов Иван Иванович' },
  { value: 'ip', label: 'ИП', icon: '💼', nameLabel: 'ФИО', namePlaceholder: 'ИП Иванов Иван Иванович' },
  { value: 'ooo', label: 'ООО', icon: '🏢', nameLabel: 'Полное наименование', namePlaceholder: 'ООО «HousePro»' },
]

export const LEGAL_FORM_LABELS: Record<string, string> = Object.fromEntries(
  LEGAL_FORM_OPTIONS.map(o => [o.value, o.label])
)

export function getLegalFormOption(value: string | null | undefined) {
  return LEGAL_FORM_OPTIONS.find(o => o.value === value) ?? LEGAL_FORM_OPTIONS[1]
}
