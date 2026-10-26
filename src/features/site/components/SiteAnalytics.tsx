'use client'

import Script from 'next/script'

/**
 * Яндекс.Метрика + Google Analytics (GA4) — только на публичном сайте
 * «ХаусПро» (src/app/(site)), НЕ во всей CRM: внутренние экраны держат
 * персональные данные сотрудников/клиентов, собирать по ним статистику
 * сторонним аналитическим сервисам не нужно и не нужно владельцу.
 *
 * ID — не секреты (видны в исходнике любой страницы у любого посетителя),
 * хранить их в .env избыточно; хардкод здесь нормален для этого случая.
 */
const YANDEX_METRIKA_ID = 113813660
const GA_MEASUREMENT_ID = 'G-CFVHEBKTJB'

export function SiteAnalytics() {
  return (
    <>
      {/* Яндекс.Метрика */}
      <Script id="yandex-metrika" strategy="afterInteractive">
        {`
          (function(m,e,t,r,i,k,a){
              m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
              m[i].l=1*new Date();
              for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
              k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
          })(window, document,'script','https://mc.yandex.ru/metrika/tag.js?id=${YANDEX_METRIKA_ID}', 'ym');
          ym(${YANDEX_METRIKA_ID}, 'init', {ssr:true, webvisor:true, clickmap:true, ecommerce:"dataLayer", accurateTrackBounce:true, trackLinks:true});
        `}
      </Script>
      <noscript>
        <div>
          <img
            src={`https://mc.yandex.ru/watch/${YANDEX_METRIKA_ID}`}
            style={{ position: 'absolute', left: '-9999px' }}
            alt=""
          />
        </div>
      </noscript>

      {/* Google Analytics (GA4) */}
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`} strategy="afterInteractive" />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}');
        `}
      </Script>
    </>
  )
}
