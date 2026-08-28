import { createClient } from '@/lib/supabase/server'
import { FileUpload } from './FileUpload'
import { FileDeleteButton } from './FileDeleteButton'
import { FileText, Image, FileIcon, Download } from 'lucide-react'
import type { FileRecord } from '@/types/database'

interface FilesSectionProps {
 clientId?: string
 propertyId?: string
 contractId?: string
 title?: string
}

function FileTypeIcon({ type }: { type?: string }) {
 if (!type) return <FileIcon className="w-5 h-5 text-muted-foreground" />
 if (type.startsWith('image/')) return <Image className="w-5 h-5 text-blue-500" />
 if (type === 'application/pdf') return <FileText className="w-5 h-5 text-red-500" />
 return <FileIcon className="w-5 h-5 text-muted-foreground" />
}

function formatSize(url?: string) {
 return null // size not stored; omit
}

function formatDate(dateStr: string) {
 return new Date(dateStr).toLocaleDateString('ru-RU', {
 day: '2-digit', month: '2-digit', year: 'numeric',
 })
}

function formatType(type?: string) {
 if (!type) return 'Файл'
 if (type.startsWith('image/jpeg') || type.startsWith('image/jpg')) return 'JPEG'
 if (type === 'image/png') return 'PNG'
 if (type === 'image/webp') return 'WEBP'
 if (type === 'application/pdf') return 'PDF'
 if (type.includes('wordprocessingml') || type === 'application/msword') return 'DOCX'
 return type.split('/')[1]?.toUpperCase() ?? 'Файл'
}

export async function FilesSection({
 clientId, propertyId, contractId, title = 'Файлы и документы'
}: FilesSectionProps) {
 const supabase = await createClient()

 let query = supabase.from('files').select('*').order('created_at', { ascending: false })

 if (clientId) query = query.eq('client_id', clientId)
 else if (propertyId) query = query.eq('property_id', propertyId)
 else if (contractId) query = query.eq('contract_id', contractId)

 const { data: files } = await query

 return (
 <div className="bg-card border border-border p-5 space-y-4">
 <div className="flex items-center justify-between">
 <h2 className="font-semibold text-foreground">{title}</h2>
 {files && files.length > 0 && (
 <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
 {files.length}
 </span>
 )}
 </div>

 {/* File list */}
 {!files || files.length === 0 ? (
 <p className="text-sm text-muted-foreground">Файлы не загружены</p>
 ) : (
 <div className="space-y-2">
 {files.map((file: FileRecord) => (
 <div
 key={file.id}
 className="flex items-center gap-3 p-3 hover:bg-accent/50 transition-colors group"
 >
 <div className="shrink-0">
 <FileTypeIcon type={file.file_type ?? undefined} />
 </div>

 <div className="flex-1 min-w-0">
 <p className="text-sm font-medium text-foreground truncate">
 {file.file_name ?? 'Без названия'}
 </p>
 <p className="text-xs text-muted-foreground">
 {formatType(file.file_type ?? undefined)} · {formatDate(file.created_at)}
 </p>
 </div>

 <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
 {file.file_url && (
 <a
 href={file.file_url}
 target="_blank"
 rel="noopener noreferrer"
 download={file.file_name ?? true}
 className="p-1.5 hover:bg-muted transition-colors"
 title="Скачать"
 >
 <Download className="w-4 h-4 text-muted-foreground" />
 </a>
 )}
 <FileDeleteButton fileId={file.id} />
 </div>
 </div>
 ))}
 </div>
 )}

 {/* Divider */}
 <div className="border-t border-border pt-4">
 <p className="text-xs font-medium text-muted-foreground mb-3">Загрузить файл</p>
 <FileUpload clientId={clientId} propertyId={propertyId} contractId={contractId} />
 </div>
 </div>
 )
}
