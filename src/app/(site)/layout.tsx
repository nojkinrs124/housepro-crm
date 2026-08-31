import { SiteHeader } from '@/features/site/components/SiteHeader'
import { SiteFooter } from '@/features/site/components/SiteFooter'
import { getSiteContacts } from '@/features/site/lib/contacts'

/**
 * Оболочка публичного сайта «ХаусПро».
 *
 * Фон и цвет текста задаются токенами явно, а не наследуются от body: корневой
 * layout включает next-themes с enableSystem, и у посетителя с тёмной темой ОС
 * на <html> появится класс .dark. Токены --hp-* в .dark не переопределяются,
 * поэтому без явной заливки публичная страница получила бы тёмный фон под
 * светлыми панелями. Сайт намеренно всегда светлый.
 */
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const contacts = await getSiteContacts()

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'var(--hp-bg)', color: 'var(--hp-ink)' }}
    >
      <SiteHeader phone={contacts.phone} phoneHref={contacts.phoneHref} />
      <main className="flex-1">{children}</main>
      <SiteFooter
        phone={contacts.phone}
        phoneHref={contacts.phoneHref}
        email={contacts.email}
        address={contacts.address}
        legalName={contacts.legalName}
        inn={contacts.inn}
      />
    </div>
  )
}
