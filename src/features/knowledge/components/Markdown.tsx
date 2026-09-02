import type { ReactNode } from 'react'

/**
 * Рендер markdown статей базы знаний.
 *
 * Свой, а не библиотека, по двум причинам: поддерживать нужно ровно то
 * подмножество, которым написаны инструкции (заголовки, списки, таблицы,
 * код, ссылки, выделение), и результат собирается React-элементами — без
 * dangerouslySetInnerHTML, поэтому разметка из статьи не может выполнить
 * скрипт, кто бы её ни написал.
 */

type Inline = string

/** `код`, **жирный**, *курсив*, [текст](ссылка) */
function inline(text: Inline, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = []
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(\[[^\]]+\]\([^)]+\))/g
  let last = 0
  let match: RegExpExecArray | null
  let i = 0

  while ((match = re.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index))
    const token = match[0]
    const key = `${keyPrefix}-${i++}`

    if (token.startsWith('`')) {
      nodes.push(
        <code key={key} className="px-1.5 py-0.5 bg-[var(--hp-neutral-tint)] border border-[var(--hp-border)] text-[12.5px]">
          {token.slice(1, -1)}
        </code>
      )
    } else if (token.startsWith('**')) {
      nodes.push(<strong key={key} className="font-semibold text-[var(--hp-ink)]">{token.slice(2, -2)}</strong>)
    } else if (token.startsWith('*')) {
      nodes.push(<em key={key}>{token.slice(1, -1)}</em>)
    } else {
      const m = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token)!
      const href = m[2]
      // Внешние ссылки открываем в новой вкладке; javascript: и подобное не пускаем
      const safe = /^(https?:\/\/|\/|#)/.test(href) ? href : '#'
      nodes.push(
        <a key={key} href={safe} className="text-[var(--hp-accent)] hover:underline"
          {...(safe.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
          {m[1]}
        </a>
      )
    }
    last = match.index + token.length
  }

  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

function splitRow(line: string): string[] {
  return line.replace(/^\||\|$/g, '').split('|').map(c => c.trim())
}

export function Markdown({ source }: { source: string }) {
  const lines = source.replace(/\r\n/g, '\n').split('\n')
  const blocks: ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (line.trim() === '') { i++; continue }

    // ``` блок кода
    if (line.startsWith('```')) {
      const body: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) body.push(lines[i++])
      i++
      blocks.push(
        <pre key={`c${i}`} className="bg-[var(--hp-neutral-tint)] border border-[var(--hp-border)] p-4 overflow-x-auto text-[12.5px] leading-relaxed">
          <code>{body.join('\n')}</code>
        </pre>
      )
      continue
    }

    // Заголовки
    const heading = /^(#{1,4})\s+(.*)$/.exec(line)
    if (heading) {
      const level = heading[1].length
      const content = inline(heading[2], `h${i}`)
      const cls = level === 1 ? 'text-xl font-bold mt-2'
        : level === 2 ? 'text-[17px] font-bold mt-6'
        : 'text-[15px] font-semibold mt-4'
      blocks.push(<p key={`h${i}`} className={`${cls} text-[var(--hp-ink)]`}>{content}</p>)
      i++
      continue
    }

    // Горизонтальная черта
    if (/^---+$/.test(line.trim())) {
      blocks.push(<hr key={`r${i}`} className="border-t border-[var(--hp-border)] my-2" />)
      i++
      continue
    }

    // Таблица: строка с | и следующая из дефисов
    if (line.includes('|') && i + 1 < lines.length && /^\s*\|?[\s:-]+\|[\s:|-]*$/.test(lines[i + 1])) {
      const head = splitRow(line)
      i += 2
      const rows: string[][] = []
      while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') {
        rows.push(splitRow(lines[i]))
        i++
      }
      blocks.push(
        <div key={`t${i}`} className="overflow-x-auto">
          <table className="hp-registry border border-[var(--hp-border)]">
            <thead>
              <tr>{head.map((c, n) => <th key={n}>{inline(c, `th${i}-${n}`)}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r, n) => (
                <tr key={n}>{r.map((c, m) => <td key={m}>{inline(c, `td${i}-${n}-${m}`)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )
      continue
    }

    // Списки
    if (/^\s*[-*]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
      const ordered = /^\s*\d+\.\s+/.test(line)
      const items: string[] = []
      while (i < lines.length && (/^\s*[-*]\s+/.test(lines[i]) || /^\s*\d+\.\s+/.test(lines[i]))) {
        items.push(lines[i].replace(/^\s*(?:[-*]|\d+\.)\s+/, ''))
        i++
      }
      const inner = items.map((item, n) => (
        <li key={n} className="text-[var(--hp-sub)] leading-relaxed">{inline(item, `li${i}-${n}`)}</li>
      ))
      blocks.push(
        ordered
          ? <ol key={`l${i}`} className="list-decimal pl-5 space-y-1">{inner}</ol>
          : <ul key={`l${i}`} className="list-disc pl-5 space-y-1">{inner}</ul>
      )
      continue
    }

    // Абзац — до пустой строки
    const para: string[] = []
    while (i < lines.length && lines[i].trim() !== '' && !/^(#{1,4}\s|```|\s*[-*]\s|\s*\d+\.\s)/.test(lines[i])) {
      para.push(lines[i])
      i++
    }
    blocks.push(
      <p key={`p${i}`} className="text-[var(--hp-sub)] leading-relaxed">{inline(para.join(' '), `p${i}`)}</p>
    )
  }

  return <div className="space-y-3 text-sm">{blocks}</div>
}
