/**
 * Валидация фотографии показания перед загрузкой в бакет `files`.
 *
 * Чистая функция без обращений к сети: её проверяет тест, а роут
 * `/api/v1/meters/photos` использует ровно её — чтобы правила «какой файл
 * принимаем» были в одном месте, а не расползались между ботом и CRM.
 *
 * Файл намеренно без 'use client'.
 */

/** Бакет `files` принимает только эти картинки (см. миграцию бакета). */
export const READING_PHOTO_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const

/** Потолок бакета `files` — 20 МБ. */
export const READING_PHOTO_MAX_BYTES = 20 * 1024 * 1024

export type ReadingPhotoMime = (typeof READING_PHOTO_MIME)[number]

/** Расширение файла по MIME — для пути в бакете. */
export function photoExtension(mime: string): string {
  switch (mime) {
    case 'image/jpeg':
      return 'jpg'
    case 'image/png':
      return 'png'
    case 'image/webp':
      return 'webp'
    default:
      return 'bin'
  }
}

/**
 * Проверка фотографии показания. Возвращает текст ошибки или `null`, если файл
 * годится. Размер и MIME — единственные правила: содержимое не разбираем.
 */
export function validateReadingPhoto(input: { type: string; size: number }): string | null {
  if (!(READING_PHOTO_MIME as readonly string[]).includes(input.type)) {
    return 'Допустимы только JPEG, PNG или WEBP'
  }
  if (input.size <= 0) {
    return 'Файл пустой'
  }
  if (input.size > READING_PHOTO_MAX_BYTES) {
    return 'Файл больше 20 МБ'
  }
  return null
}
