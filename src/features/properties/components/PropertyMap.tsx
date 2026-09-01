'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

// Карта объектов на Яндекс.Картах.
//
// Скрипт грузится динамически и только когда на странице действительно есть
// что показать: JS API тяжёлый, а координаты заполнены не у всех объектов
// (у старых записей их нет — они появляются при вводе адреса через подсказки
// DaData). Без ключа и без координат компонент просто ничего не рисует, и
// страница продолжает работать как раньше.

export interface MapPoint {
 id: string
 latitude: number
 longitude: number
 title: string
 /** Подпись во всплывающей карточке: адрес, цена. */
 subtitle?: string | null
 href?: string | null
}

interface PropertyMapProps {
 points: MapPoint[]
 height?: number
 /** Заголовок над картой; если не нужен — не передавать. */
 heading?: string
}

// Типы JS API Яндекса минимальны намеренно: полноценные @types тянуть ради
// трёх вызовов не стоит, а any в проекте запрещён.
interface YMapsPlacemark {
 [key: string]: unknown
}

interface YMapsGeoObjects {
 add(object: YMapsPlacemark): void
 getBounds(): number[][] | null
}

interface YMapsMap {
 geoObjects: YMapsGeoObjects
 setBounds(bounds: number[][], options?: Record<string, unknown>): void
 destroy(): void
}

interface YMapsApi {
 ready(callback: () => void): void
 Map: new (element: HTMLElement, state: Record<string, unknown>, options?: Record<string, unknown>) => YMapsMap
 Placemark: new (
 coords: [number, number],
 properties: Record<string, unknown>,
 options?: Record<string, unknown>
 ) => YMapsPlacemark
}

declare global {
 interface Window {
 ymaps?: YMapsApi
 }
}

const SCRIPT_ID = 'yandex-maps-js-api'

function loadYandexMaps(apiKey: string): Promise<YMapsApi> {
 return new Promise((resolve, reject) => {
 if (typeof window === 'undefined') {
 reject(new Error('Карта доступна только в браузере'))
 return
 }
 if (window.ymaps) {
 resolve(window.ymaps)
 return
 }

 // Скрипт может уже грузиться из-за второй карты на странице — тогда просто
 // ждём его загрузки, а не вставляем второй тег.
 const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null
 const script = existing ?? document.createElement('script')

 if (!existing) {
 script.id = SCRIPT_ID
 script.src = `https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(apiKey)}&lang=ru_RU`
 script.async = true
 document.head.appendChild(script)
 }

 script.addEventListener('load', () => {
 if (window.ymaps) resolve(window.ymaps)
 else reject(new Error('API карт загрузился, но недоступен'))
 })
 script.addEventListener('error', () => reject(new Error('Не удалось загрузить карты')))
 })
}

export function PropertyMap({ points, height = 360, heading }: PropertyMapProps) {
 const containerRef = useRef<HTMLDivElement>(null)
 const [error, setError] = useState<string | null>(null)
 const apiKey = process.env.NEXT_PUBLIC_YANDEX_MAPS_KEY

 // useMemo обязателен: без него массив пересоздаётся на каждый рендер,
 // эффект перезапускается и карта бесконечно пересоздаётся.
 const valid = useMemo(
 () =>
 points.filter(
 (p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude) && p.latitude !== 0
 ),
 [points]
 )

 useEffect(() => {
 if (!apiKey || valid.length === 0 || !containerRef.current) return

 let map: YMapsMap | null = null
 let cancelled = false

 loadYandexMaps(apiKey)
 .then((ymaps) => {
 ymaps.ready(() => {
 if (cancelled || !containerRef.current) return

 const first = valid[0]
 map = new ymaps.Map(
 containerRef.current,
 { center: [first.latitude, first.longitude], zoom: 14, controls: ['zoomControl'] },
 { suppressMapOpenBlock: true }
 )

 for (const point of valid) {
 const placemark = new ymaps.Placemark(
 [point.latitude, point.longitude],
 {
 balloonContentHeader: point.href
 ? `<a href="${point.href}">${point.title}</a>`
 : point.title,
 balloonContentBody: point.subtitle ?? '',
 hintContent: point.title,
 },
 { preset: 'islands#greenDotIcon' }
 )
 map.geoObjects.add(placemark)
 }

 // Одна точка не даёт границ — для неё оставляем стартовый зум.
 if (valid.length > 1) {
 const bounds = map.geoObjects.getBounds()
 if (bounds) map.setBounds(bounds, { checkZoomRange: true, zoomMargin: 40 })
 }
 })
 })
 .catch((e: Error) => {
 if (!cancelled) setError(e.message)
 })

 return () => {
 cancelled = true
 map?.destroy()
 }
 }, [apiKey, valid])

 if (!apiKey || valid.length === 0) return null

 return (
 <div className="space-y-2">
 {heading && <h2 className="font-bold text-[var(--hp-ink)] text-[15px]">{heading}</h2>}
 {error ? (
 <p className="text-sm text-[var(--hp-sub)]">{error}</p>
 ) : (
 <div
 ref={containerRef}
 style={{ height }}
 className="w-full border border-[var(--hp-border)] bg-[var(--hp-neutral-tint)]"
 />
 )}
 </div>
 )
}
