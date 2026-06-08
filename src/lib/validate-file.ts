/**
 * Magic bytes (file signature) validation.
 * Checks actual binary content, not just file extension or MIME type.
 * This prevents renamed malicious files (e.g. malware.exe → document.pdf).
 */

interface MagicSignature {
  bytes: number[]
  offset?: number // byte offset where signature starts (default 0)
}

const MAGIC_SIGNATURES: Record<string, MagicSignature[]> = {
  // Images
  'image/jpeg':  [{ bytes: [0xFF, 0xD8, 0xFF] }],
  'image/png':   [{ bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] }],
  'image/webp':  [{ bytes: [0x52, 0x49, 0x46, 0x46], offset: 0 }], // RIFF...WEBP
  'image/gif':   [{ bytes: [0x47, 0x49, 0x46, 0x38] }], // GIF8
  // Documents
  'application/pdf': [{ bytes: [0x25, 0x50, 0x44, 0x46] }], // %PDF
  // DOCX/XLSX/PPTX are ZIP-based
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [
    { bytes: [0x50, 0x4B, 0x03, 0x04] }, // PK (ZIP)
  ],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [
    { bytes: [0x50, 0x4B, 0x03, 0x04] },
  ],
  // Legacy Office (OLE2)
  'application/msword': [{ bytes: [0xD0, 0xCF, 0x11, 0xE0] }],
  // Plain text — no magic bytes, allow by mime check only
  'text/plain': [],
  // Images fallback
  'image/svg+xml': [], // SVG is XML text, no magic bytes
}

/**
 * Dangerous EXE/PE/script magic bytes — always blocked regardless of extension.
 */
const BLOCKED_MAGIC: MagicSignature[] = [
  { bytes: [0x4D, 0x5A] },              // MZ — Windows EXE/DLL
  { bytes: [0x7F, 0x45, 0x4C, 0x46] },  // ELF — Linux binary
  { bytes: [0xCA, 0xFE, 0xBA, 0xBE] },  // Java class / Mach-O fat binary
  { bytes: [0x23, 0x21] },              // #! shebang (shell scripts)
]

function matchesSignature(buffer: Uint8Array, sig: MagicSignature): boolean {
  const offset = sig.offset ?? 0
  for (let i = 0; i < sig.bytes.length; i++) {
    if (buffer[offset + i] !== sig.bytes[i]) return false
  }
  return true
}

/**
 * Returns error string if file fails magic bytes check, or null if OK.
 */
export function validateMagicBytes(
  buffer: Uint8Array,
  declaredMimeType: string,
): string | null {
  // 1. Always block dangerous executables regardless of extension/mime
  for (const sig of BLOCKED_MAGIC) {
    if (matchesSignature(buffer, sig)) {
      return 'Файл содержит исполняемый код и не может быть загружен'
    }
  }

  // 2. If we have signatures for this MIME type, verify at least one matches
  const knownSigs = MAGIC_SIGNATURES[declaredMimeType]
  if (knownSigs === undefined) {
    // Unknown MIME type — allow (extension check is done separately)
    return null
  }
  if (knownSigs.length === 0) {
    // Text/SVG etc — no binary signature to check
    return null
  }

  const matches = knownSigs.some(sig => matchesSignature(buffer, sig))
  if (!matches) {
    return 'Содержимое файла не соответствует его расширению'
  }

  return null
}

/**
 * Full file validation: size + extension + magic bytes.
 */
export function validateUploadedFile(
  file: File,
  buffer: Uint8Array,
  options: {
    blockedExtensions?: string[]
    allowedMimeTypes?: string[]
    maxSizeBytes?: number
  } = {},
): string | null {
  const {
    blockedExtensions = ['exe', 'bat', 'cmd', 'com', 'msi', 'scr', 'vbs', 'js', 'jar', 'zip', 'sh', 'ps1', 'dll'],
    allowedMimeTypes,
    maxSizeBytes = 20 * 1024 * 1024,
  } = options

  if (file.size > maxSizeBytes) {
    return `Файл слишком большой (максимум ${Math.round(maxSizeBytes / 1024 / 1024)} МБ)`
  }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (blockedExtensions.includes(ext)) {
    return `Недопустимый тип файла: .${ext}`
  }

  if (allowedMimeTypes && !allowedMimeTypes.includes(file.type)) {
    return `Недопустимый формат файла`
  }

  return validateMagicBytes(buffer, file.type)
}
