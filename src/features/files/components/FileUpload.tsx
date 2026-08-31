'use client'

import { useRef, useState, useTransition } from 'react'
import { Upload, X, CheckCircle, AlertCircle, Loader2, FileImage, FileText, File as FileIcon } from 'lucide-react'
import { uploadFileAction } from '../actions/files.actions'

interface FileUploadProps {
 clientId?: string
 propertyId?: string
 contractId?: string
 dealId?: string
}

const ACCEPTED_TYPES = [
 'application/pdf',
 'image/jpeg', 'image/png', 'image/webp',
 'application/msword',
 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]

const ACCEPTED_LABEL = 'PDF, JPG, PNG, WEBP, DOC, DOCX'

function getFileIcon(type: string) {
 if (type.startsWith('image/')) return FileImage
 if (type === 'application/pdf') return FileText
 if (type.includes('word')) return FileText
 return FileIcon
}

type Status = 'idle' | 'uploading' | 'success' | 'error'

export function FileUpload({ clientId, propertyId, contractId, dealId }: FileUploadProps) {
 const [dragging, setDragging] = useState(false)
 const [selectedFile, setSelectedFile] = useState<File | null>(null)
 const [status, setStatus] = useState<Status>('idle')
 const [errorMsg, setErrorMsg] = useState('')
 const [isPending, startTransition] = useTransition()
 const inputRef = useRef<HTMLInputElement>(null)

 function handleFile(file: File) {
 if (!ACCEPTED_TYPES.includes(file.type)) {
 setErrorMsg(`Тип файла не поддерживается. Разрешены: ${ACCEPTED_LABEL}`)
 setStatus('error')
 return
 }
 if (file.size > 20 * 1024 * 1024) {
 setErrorMsg('Файл слишком большой. Максимум 20 МБ')
 setStatus('error')
 return
 }
 setSelectedFile(file)
 setStatus('idle')
 setErrorMsg('')
 }

 function handleDrop(e: React.DragEvent) {
 e.preventDefault()
 setDragging(false)
 const file = e.dataTransfer.files[0]
 if (file) handleFile(file)
 }

 function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
 const file = e.target.files?.[0]
 if (file) handleFile(file)
 }

 function handleUpload() {
 if (!selectedFile) return

 setStatus('uploading')
 const formData = new FormData()
 formData.append('file', selectedFile)
 if (clientId) formData.append('client_id', clientId)
 if (propertyId) formData.append('property_id', propertyId)
 if (contractId) formData.append('contract_id', contractId)
 if (dealId) formData.append('deal_id', dealId)

 startTransition(async () => {
 const result = await uploadFileAction(formData)
 if ('error' in result) {
 setStatus('error')
 setErrorMsg(result.error ?? 'Ошибка загрузки')
 } else {
 setStatus('success')
 setSelectedFile(null)
 if (inputRef.current) inputRef.current.value = ''
 setTimeout(() => setStatus('idle'), 2000)
 }
 })
 }

 return (
 <div className="space-y-3">
 {/* Drop zone */}
 <div
 onClick={() => inputRef.current?.click()}
 onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
 onDragLeave={() => setDragging(false)}
 onDrop={handleDrop}
 className={`
 relative border-2 border-dashed p-6 cursor-pointer transition-all text-center
 ${dragging
 ? 'border-primary bg-primary/5 scale-[1.01]'
 : 'border-border hover:border-primary/50 hover:bg-accent/50'
 }
 ${status === 'error' ? 'border-destructive/50 bg-destructive/5' : ''}
 ${status === 'success' ? 'border-[var(--hp-border)]/50 bg-[var(--hp-good-tint)]' : ''}
 `}
 >
 <input
 ref={inputRef}
 type="file"
 className="hidden"
 accept={ACCEPTED_TYPES.join(',')}
 onChange={handleChange}
 />

 {status === 'success' ? (
 <div className="flex flex-col items-center gap-2">
 <CheckCircle className="w-8 h-8 text-[var(--hp-good)]" />
 <p className="text-sm font-medium text-[var(--hp-good)]">Файл загружен!</p>
 </div>
 ) : status === 'error' ? (
 <div className="flex flex-col items-center gap-2">
 <AlertCircle className="w-8 h-8 text-destructive" />
 <p className="text-sm text-destructive">{errorMsg}</p>
 <p className="text-xs text-muted-foreground">Нажмите, чтобы выбрать другой файл</p>
 </div>
 ) : selectedFile ? (
 <div className="flex items-center gap-3 justify-center">
 {(() => {
 const Icon = getFileIcon(selectedFile.type)
 return <Icon className="w-6 h-6 text-muted-foreground shrink-0" />
 })()}
 <div className="text-left">
 <p className="text-sm font-medium text-foreground truncate max-w-[200px]">
 {selectedFile.name}
 </p>
 <p className="text-xs text-muted-foreground">
 {(selectedFile.size / 1024).toFixed(0)} КБ
 </p>
 </div>
 <button
 onClick={(e) => { e.stopPropagation(); setSelectedFile(null); setStatus('idle') }}
 className="ml-2 p-1 hover:bg-muted transition-colors"
 >
 <X className="w-4 h-4 text-muted-foreground" />
 </button>
 </div>
 ) : (
 <div className="flex flex-col items-center gap-2">
 <div className="w-10 h-10 bg-primary/10 flex items-center justify-center">
 <Upload className="w-5 h-5 text-primary" />
 </div>
 <div>
 <p className="text-sm font-medium text-foreground">
 Перетащите файл или{' '}
 <span className="text-primary">выберите</span>
 </p>
 <p className="text-xs text-muted-foreground mt-0.5">{ACCEPTED_LABEL} · до 20 МБ</p>
 </div>
 </div>
 )}
 </div>

 {/* Upload button */}
 {selectedFile && status !== 'success' && (
 <button
 onClick={handleUpload}
 disabled={isPending || status === 'uploading'}
 className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-all"
 >
 {isPending || status === 'uploading' ? (
 <>
 <Loader2 className="w-4 h-4 animate-spin" />
 Загрузка...
 </>
 ) : (
 <>
 <Upload className="w-4 h-4" />
 Загрузить
 </>
 )}
 </button>
 )}
 </div>
 )
}
