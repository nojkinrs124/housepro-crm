'use client'

import { useState, useTransition } from 'react'
import { Trash2, Loader2 } from 'lucide-react'
import { deleteFileAction } from '../actions/files.actions'

interface FileDeleteButtonProps {
  fileId: string
}

export function FileDeleteButton({ fileId }: FileDeleteButtonProps) {
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    if (!confirm('Удалить файл? Это действие нельзя отменить.')) return
    startTransition(async () => {
      await deleteFileAction(fileId)
    })
  }

  return (
    <button
      onClick={handleDelete}
      disabled={isPending}
      className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors disabled:opacity-50"
      title="Удалить"
    >
      {isPending ? (
        <Loader2 className="w-4 h-4 animate-spin text-destructive" />
      ) : (
        <Trash2 className="w-4 h-4 text-destructive" />
      )}
    </button>
  )
}
