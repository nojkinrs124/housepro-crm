import { getSupabaseAdmin } from '@/lib/supabase/admin'

export async function uploadChannelImage(postId: string, imageBuffer: Buffer): Promise<string | null> {
  const supabaseAdmin = getSupabaseAdmin()
  const path = `channel-images/${postId}.png`

  const { error } = await supabaseAdmin.storage.from('files').upload(path, imageBuffer, {
    contentType: 'image/png',
    upsert: true,
  })
  if (error) {
    console.error('[channel-image] upload error:', error)
    return null
  }

  const { data } = supabaseAdmin.storage.from('files').getPublicUrl(path)
  return data.publicUrl ?? null
}
