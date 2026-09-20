import { describe, it, expect } from 'vitest'
import { sanitizeTelegramHtml } from '@/lib/telegram/api'

describe('sanitizeTelegramHtml', () => {
  it('пропускает b/i/code и ссылку-CTA, экранирует остальное', () => {
    const text = '<b>Заголовок</b> 5 < 7 и A&B <script>x</script>\n\n<a href="https://housepro24.vercel.app/r/cd40e598">👉 Написать</a>'
    expect(sanitizeTelegramHtml(text)).toBe(
      '<b>Заголовок</b> 5 &lt; 7 и A&amp;B &lt;script&gt;x&lt;/script&gt;\n\n<a href="https://housepro24.vercel.app/r/cd40e598">👉 Написать</a>'
    )
  })

  it('ссылку не на http(s) и с лишними атрибутами не пропускает', () => {
    expect(sanitizeTelegramHtml('<a href="javascript:alert(1)">x</a>')).toBe('&lt;a href="javascript:alert(1)"&gt;x</a>')
    expect(sanitizeTelegramHtml('<a href="https://x.y" onclick="z">x</a>')).toBe('&lt;a href="https://x.y" onclick="z"&gt;x</a>')
  })
})
