'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Image from 'next/image'
import { toast } from 'sonner'
import { Upload, X, Star, Loader2, ImagePlus, GripVertical } from 'lucide-react'
import {
 uploadPropertyPhotoAction,
 deletePropertyPhotoAction,
 setPropertyCoverPhotoAction,
 preparePhotoUploadAction,
 confirmPhotoUploadAction,
 reorderPropertyPhotosAction,
} from '@/features/properties/actions/property-photos.actions'
import { validateMagicBytes } from '@/lib/validate-file'

interface Props {
 propertyId: string
 initialPhotos: string[]
}

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
// Дублирует MAX_PHOTO_SIZE экшена: отсеять на клиенте дешевле, чем гонять 20 МБ ради отказа
const MAX_PHOTO_SIZE = 10 * 1024 * 1024
// Сколько файлов идёт в Яндекс одновременно. Больше — упирается в канал клиента, не в сервер
const PARALLEL_UPLOADS = 3

interface UploadItem {
 id: number
 name: string
 /** 0–100; для загрузки через сервер прогресса нет — держим 0 до конца */
 progress: number
 status: 'queued' | 'uploading' | 'done' | 'error'
 error?: string
}

/** PUT файла по подписанной ссылке с прогрессом. fetch прогресс отдачи не умеет — XHR. */
function putWithProgress(url: string, headers: Record<string, string>, file: File, onProgress: (pct: number) => void) {
 return new Promise<void>((resolve, reject) => {
 const xhr = new XMLHttpRequest()
 xhr.open('PUT', url)
 for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v)
 xhr.upload.onprogress = (e) => {
 if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
 }
 xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`хранилище ответило ${xhr.status}`)))
 xhr.onerror = () => reject(new Error('обрыв соединения с хранилищем'))
 xhr.send(file)
 })
}

export function PropertyPhotosManager({ propertyId, initialPhotos }: Props) {
 const [photos, setPhotos] = useState<string[]>(initialPhotos)
 const [dragging, setDragging] = useState(false)
 const [uploads, setUploads] = useState<UploadItem[]>([])
 const [busyUrl, setBusyUrl] = useState<string | null>(null)
 const [dragIndex, setDragIndex] = useState<number | null>(null)
 const [overIndex, setOverIndex] = useState<number | null>(null)
 const [, startTransition] = useTransition()
 const inputRef = useRef<HTMLInputElement>(null)
 const nextId = useRef(0)
 // Подтверждения идут по одному: экшен читает photo_urls и пишет обратно,
 // два параллельных подтверждения потеряли бы друг друга
 const confirmQueue = useRef<Promise<unknown>>(Promise.resolve())

 const activeUploads = uploads.filter(u => u.status === 'queued' || u.status === 'uploading').length

 // Уход со страницы посреди загрузки — остаток очереди пропадает молча. Именно
 // так «загрузились не все»: 19 файлов выглядят как зависание, страницу обновляют
 useEffect(() => {
 if (activeUploads === 0) return
 const warn = (e: BeforeUnloadEvent) => { e.preventDefault() }
 window.addEventListener('beforeunload', warn)
 return () => window.removeEventListener('beforeunload', warn)
 }, [activeUploads])

 function patchUpload(id: number, patch: Partial<UploadItem>) {
 setUploads(prev => prev.map(u => (u.id === id ? { ...u, ...patch } : u)))
 }

 async function uploadOne(file: File, id: number) {
 patchUpload(id, { status: 'uploading' })
 try {
 const head = new Uint8Array(await file.slice(0, 16).arrayBuffer())
 const magicError = validateMagicBytes(head, file.type)
 if (magicError) throw new Error(magicError)

 const prep = await preparePhotoUploadAction(propertyId, { name: file.name, type: file.type, size: file.size })
 if ('error' in prep && prep.error) throw new Error(prep.error)

 let url: string | undefined
 if ('mode' in prep && prep.mode === 'direct') {
 await putWithProgress(prep.uploadUrl, prep.headers, file, pct => patchUpload(id, { progress: pct }))
 const confirmed = await (confirmQueue.current = confirmQueue.current.then(
 () => confirmPhotoUploadAction(propertyId, prep.publicUrl),
 () => confirmPhotoUploadAction(propertyId, prep.publicUrl),
 ))
 if ('error' in confirmed) throw new Error(confirmed.error)
 url = confirmed.url
 } else {
 // Драйвер supabase: файл идёт через Server Action как раньше
 const formData = new FormData()
 formData.append('file', file)
 const res = await uploadPropertyPhotoAction(propertyId, formData)
 if ('error' in res) throw new Error(res.error)
 url = res.url
 }

 if (url) setPhotos(prev => (prev.includes(url!) ? prev : [...prev, url!]))
 patchUpload(id, { status: 'done', progress: 100 })
 } catch (e) {
 const raw = e instanceof Error ? e.message : String(e)
 const message = /body|413|limit/i.test(raw) ? 'файл слишком большой для загрузки' : raw
 patchUpload(id, { status: 'error', error: message })
 toast.error(`${file.name}: ${message}`)
 }
 }

 async function uploadFiles(files: FileList | File[]) {
 const list = Array.from(files)
 const typed = list.filter(f => ACCEPTED_TYPES.includes(f.type))
 const rejected = list.length - typed.length
 if (rejected > 0) toast.error(`${rejected} файл(ов) пропущено — разрешены только JPG, PNG, WEBP (HEIC не подходит)`)
 const valid = typed.filter(f => f.size <= MAX_PHOTO_SIZE)
 const tooBig = typed.length - valid.length
 if (tooBig > 0) toast.error(`${tooBig} файл(ов) пропущено — больше 10 МБ`)
 if (valid.length === 0) return

 const items = valid.map(file => ({ file, id: nextId.current++ }))
 setUploads(prev => [
 ...prev.filter(u => u.status !== 'done'),
 ...items.map(({ file, id }) => ({ id, name: file.name, progress: 0, status: 'queued' as const })),
 ])

 // Пул на PARALLEL_UPLOADS воркеров: каждый берёт следующий файл из очереди
 let cursor = 0
 await Promise.all(
 Array.from({ length: Math.min(PARALLEL_UPLOADS, items.length) }, async () => {
 while (cursor < items.length) {
 const { file, id } = items[cursor++]
 await uploadOne(file, id)
 }
 }),
 )
 }

 function handleDrop(e: React.DragEvent) {
 e.preventDefault()
 setDragging(false)
 if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files)
 }

 function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
 if (e.target.files?.length) uploadFiles(e.target.files)
 if (inputRef.current) inputRef.current.value = ''
 }

 function handleDelete(url: string) {
 setBusyUrl(url)
 startTransition(async () => {
 const res = await deletePropertyPhotoAction(propertyId, url)
 setBusyUrl(null)
 if (res && 'error' in res && res.error) {
 toast.error(res.error)
 return
 }
 setPhotos(prev => prev.filter(u => u !== url))
 })
 }

 function handleMakeCover(url: string) {
 setBusyUrl(url)
 startTransition(async () => {
 const res = await setPropertyCoverPhotoAction(propertyId, url)
 setBusyUrl(null)
 if (res && 'error' in res && res.error) {
 toast.error(res.error)
 return
 }
 setPhotos(prev => [url, ...prev.filter(u => u !== url)])
 })
 }

 function handleReorderDrop(to: number) {
 const from = dragIndex
 setDragIndex(null)
 setOverIndex(null)
 if (from === null || from === to) return
 const next = [...photos]
 const [moved] = next.splice(from, 1)
 next.splice(to, 0, moved)
 const before = photos
 setPhotos(next)
 startTransition(async () => {
 const res = await reorderPropertyPhotosAction(propertyId, next)
 if (res && 'error' in res && res.error) {
 setPhotos(before)
 toast.error(res.error)
 }
 })
 }

 const visibleUploads = uploads.filter(u => u.status !== 'done')

 return (
 <div className="space-y-3">
 {photos.length > 0 && (
 <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
 {photos.map((url, i) => (
 <div
 key={url}
 draggable
 onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; setDragIndex(i) }}
 onDragOver={(e) => { if (dragIndex !== null) { e.preventDefault(); setOverIndex(i) } }}
 onDragLeave={() => setOverIndex(prev => (prev === i ? null : prev))}
 onDrop={(e) => { if (dragIndex !== null) { e.preventDefault(); handleReorderDrop(i) } }}
 onDragEnd={() => { setDragIndex(null); setOverIndex(null) }}
 title="Перетащите, чтобы изменить порядок публикации"
 className={`relative group aspect-[4/3] overflow-hidden border bg-[var(--hp-neutral-tint)] cursor-grab active:cursor-grabbing ${
 overIndex === i && dragIndex !== i ? 'border-[var(--hp-ink)]' : 'border-[var(--hp-border-soft)]'
 } ${dragIndex === i ? 'opacity-40' : ''}`}
 >
 <Image src={url} alt={`Фото ${i + 1}`} fill sizes="200px" className="object-cover pointer-events-none" />
 <span className="absolute top-1.5 right-1.5 w-6 h-6 flex items-center justify-center bg-[var(--hp-surface)]/90 text-[var(--hp-muted)] opacity-0 group-hover:opacity-100">
 <GripVertical className="w-3.5 h-3.5" />
 </span>
 {i === 0 && (
 <span className="absolute top-1.5 left-1.5 flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-[var(--hp-radius-badge)] bg-[var(--hp-surface)]/90 text-[var(--hp-warn)]">
 <Star className="w-2.5 h-2.5 fill-amber-500 text-[var(--hp-warn)]" />
 Обложка
 </span>
 )}
 <span className="absolute bottom-1.5 left-1.5 text-[10px] font-bold px-1.5 py-0.5 bg-[var(--hp-surface)]/90 text-[var(--hp-muted)]">
 {i + 1}
 </span>
 <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
 {i !== 0 && (
 <button
 type="button"
 onClick={() => handleMakeCover(url)}
 disabled={busyUrl === url}
 title="Сделать обложкой"
 className="w-7 h-7 rounded-[var(--hp-radius)] bg-[var(--hp-surface)]/90 flex items-center justify-center hover:bg-[var(--hp-surface)] transition disabled:opacity-50"
 >
 {busyUrl === url ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Star className="w-3.5 h-3.5 text-[var(--hp-warn)]" />}
 </button>
 )}
 <button
 type="button"
 onClick={() => handleDelete(url)}
 disabled={busyUrl === url}
 title="Удалить"
 className="w-7 h-7 rounded-[var(--hp-radius)] bg-[var(--hp-surface)]/90 flex items-center justify-center hover:bg-[var(--hp-surface)] transition disabled:opacity-50"
 >
 {busyUrl === url ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5 text-[var(--hp-danger)]" />}
 </button>
 </div>
 </div>
 ))}
 </div>
 )}

 {photos.length > 1 && (
 <p className="text-xs text-muted-foreground">
 Порядок фото — порядок публикации на площадках: перетащите плитку, первая идёт обложкой.
 </p>
 )}

 <div
 onClick={() => inputRef.current?.click()}
 onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDragging(true) } }}
 onDragLeave={() => setDragging(false)}
 onDrop={handleDrop}
 className={`border-2 border-dashed p-5 cursor-pointer transition-all text-center ${
 dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-accent/50'
 }`}
 >
 <input ref={inputRef} type="file" multiple accept={ACCEPTED_TYPES.join(',')} className="hidden" onChange={handleChange} />
 <div className="flex flex-col items-center gap-2">
 <div className="w-9 h-9 bg-primary/10 flex items-center justify-center">
 {activeUploads > 0 ? <Loader2 className="w-4 h-4 text-primary animate-spin" /> : <ImagePlus className="w-4 h-4 text-primary" />}
 </div>
 <p className="text-sm font-medium text-foreground">
 {activeUploads > 0
 ? `Загрузка… осталось ${activeUploads} — не закрывайте страницу`
 : <>Перетащите фото или <span className="text-primary">выберите</span></>}
 </p>
 <p className="text-xs text-muted-foreground">JPG, PNG, WEBP · до 10 МБ · можно несколько сразу</p>
 </div>
 </div>

 {visibleUploads.length > 0 && (
 <ul className="space-y-1.5">
 {visibleUploads.map(u => (
 <li key={u.id} className="text-xs flex items-center gap-2">
 <span className={`truncate flex-1 ${u.status === 'error' ? 'text-[var(--hp-danger)]' : 'text-muted-foreground'}`}>
 {u.name}{u.status === 'error' && u.error ? ` — ${u.error}` : ''}
 </span>
 {u.status !== 'error' && (
 <span className="w-24 h-1 bg-[var(--hp-neutral-tint)] rounded-full overflow-hidden shrink-0">
 <span className="block h-full bg-[var(--hp-accent)] rounded-full" style={{ width: `${u.progress}%` }} />
 </span>
 )}
 </li>
 ))}
 </ul>
 )}

 {photos.length === 0 && activeUploads === 0 && (
 <p className="text-xs text-[var(--hp-warn)] bg-[var(--hp-warn-tint)] border border-[var(--hp-border)] p-2 leading-relaxed flex items-start gap-1.5">
 <Upload className="w-3 h-3 mt-0.5 shrink-0" />
 Без фото Авито почти наверняка отклонит объявление — добавьте хотя бы одно
 </p>
 )}
 </div>
 )
}
