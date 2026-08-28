'use client'

import { useRef, useState, useTransition } from 'react'
import Image from 'next/image'
import { toast } from 'sonner'
import { Upload, X, Star, Loader2, ImagePlus } from 'lucide-react'
import {
  uploadPropertyPhotoAction,
  deletePropertyPhotoAction,
  setPropertyCoverPhotoAction,
} from '@/features/properties/actions/property-photos.actions'

interface Props {
  propertyId: string
  initialPhotos: string[]
}

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export function PropertyPhotosManager({ propertyId, initialPhotos }: Props) {
  const [photos, setPhotos] = useState<string[]>(initialPhotos)
  const [dragging, setDragging] = useState(false)
  const [uploadingCount, setUploadingCount] = useState(0)
  const [busyUrl, setBusyUrl] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  async function uploadFiles(files: FileList | File[]) {
    const list = Array.from(files)
    const valid = list.filter(f => ACCEPTED_TYPES.includes(f.type))
    const rejected = list.length - valid.length
    if (rejected > 0) toast.error(`${rejected} файл(ов) пропущено — разрешены только JPG, PNG, WEBP`)
    if (valid.length === 0) return

    setUploadingCount(valid.length)
    for (const file of valid) {
      const formData = new FormData()
      formData.append('file', file)
      const res = await uploadPropertyPhotoAction(propertyId, formData)
      if (res && 'error' in res && res.error) {
        toast.error(`${file.name}: ${res.error}`)
      } else if (res && 'url' in res && res.url) {
        setPhotos(prev => [...prev, res.url as string])
      }
      setUploadingCount(prev => Math.max(0, prev - 1))
    }
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

  return (
    <div className="space-y-3">
      {photos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {photos.map((url, i) => (
            <div key={url} className="relative group aspect-[4/3] rounded-xl overflow-hidden border border-slate-100 bg-slate-50">
              <Image src={url} alt={`Фото ${i + 1}`} fill sizes="200px" className="object-cover" />
              {i === 0 && (
                <span className="absolute top-1.5 left-1.5 flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-white/90 text-amber-600">
                  <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                  Обложка
                </span>
              )}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                {i !== 0 && (
                  <button
                    type="button"
                    onClick={() => handleMakeCover(url)}
                    disabled={busyUrl === url}
                    title="Сделать обложкой"
                    className="w-7 h-7 rounded-full bg-white/90 flex items-center justify-center hover:bg-white transition disabled:opacity-50"
                  >
                    {busyUrl === url ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Star className="w-3.5 h-3.5 text-amber-600" />}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleDelete(url)}
                  disabled={busyUrl === url}
                  title="Удалить"
                  className="w-7 h-7 rounded-full bg-white/90 flex items-center justify-center hover:bg-white transition disabled:opacity-50"
                >
                  {busyUrl === url ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5 text-red-600" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-5 cursor-pointer transition-all text-center ${
          dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-accent/50'
        }`}
      >
        <input ref={inputRef} type="file" multiple accept={ACCEPTED_TYPES.join(',')} className="hidden" onChange={handleChange} />
        <div className="flex flex-col items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            {uploadingCount > 0 ? <Loader2 className="w-4 h-4 text-primary animate-spin" /> : <ImagePlus className="w-4 h-4 text-primary" />}
          </div>
          <p className="text-sm font-medium text-foreground">
            {uploadingCount > 0
              ? `Загрузка… осталось ${uploadingCount}`
              : <>Перетащите фото или <span className="text-primary">выберите</span></>}
          </p>
          <p className="text-xs text-muted-foreground">JPG, PNG, WEBP · до 10 МБ · можно несколько сразу</p>
        </div>
      </div>

      {photos.length === 0 && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-2 leading-relaxed flex items-start gap-1.5">
          <Upload className="w-3 h-3 mt-0.5 shrink-0" />
          Без фото Авито почти наверняка отклонит объявление — добавьте хотя бы одно
        </p>
      )}
    </div>
  )
}
