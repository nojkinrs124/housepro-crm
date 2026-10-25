---
version: alpha
name: ХаусПро v2
description: Фирменный стиль ХаусПро — Руслан Ножкин, частный риелтор, доверительное управление квартирами в Красноярске. Тёплый шалфей и мох, прямые углы, без теней, засечные заголовки, монограмма-печать ХП.
colors:
  primary: "#4B6B46"
  primaryHover: "#3D5A39"
  forest: "#1F2B1D"
  brass: "#C8A45C"
  ink: "#232A24"
  secondary: "#5C6659"
  tertiary: "#8A9382"
  neutral: "#EEF0E9"
  surface: "#FBFBF8"
  border: "#DFE4D6"
  borderSoft: "#EAEEE2"
  neutralTint: "#E4E8DA"
  accentTint: "#DBE1CF"
  onForest: "#EEF0E9"
  good: "#3D6238"
  goodTint: "#E2ECDD"
  warn: "#6B5D34"
  warnTint: "#F0ECDD"
  danger: "#A24B30"
  dangerTint: "#F3E5E0"
  info: "#41546B"
  infoTint: "#E6EAF0"
typography:
  display:
    fontFamily: Source Serif 4
    fontSize: 48px
    fontWeight: 700
    lineHeight: 1.08
    letterSpacing: "-0.02em"
  h1:
    fontFamily: Source Serif 4
    fontSize: 32px
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.015em"
  h2:
    fontFamily: Source Serif 4
    fontSize: 22px
    fontWeight: 700
    lineHeight: 1.25
  h3:
    fontFamily: Source Sans 3
    fontSize: 18px
    fontWeight: 700
    lineHeight: 1.3
  price:
    fontFamily: Source Serif 4
    fontSize: 28px
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.02em"
    fontFeature: "tnum"
  body:
    fontFamily: Source Sans 3
    fontSize: 16px
    lineHeight: 1.6
  body-sm:
    fontFamily: Source Sans 3
    fontSize: 14px
    lineHeight: 1.5
  ui:
    fontFamily: Source Sans 3
    fontSize: 13.5px
    lineHeight: 1.5
  label-caps:
    fontFamily: Source Sans 3
    fontSize: 12px
    fontWeight: 600
    letterSpacing: "0.08em"
rounded:
  none: 0px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  card: 20px
  xl: 48px
  section: 80px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#FFFFFF"
    rounded: "{rounded.none}"
    padding: 10px 18px
    height: 44px
  button-primary-hover:
    backgroundColor: "{colors.primaryHover}"
    textColor: "#FFFFFF"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: 10px 18px
  page:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.ink}"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.secondary}"
    rounded: "{rounded.none}"
    padding: 20px
  card-border:
    backgroundColor: "{colors.border}"
  row-divider:
    backgroundColor: "{colors.borderSoft}"
  icon-box:
    backgroundColor: "{colors.neutralTint}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    size: 44px
  footer:
    backgroundColor: "{colors.forest}"
    textColor: "{colors.onForest}"
  footer-highlight:
    backgroundColor: "{colors.forest}"
    textColor: "{colors.brass}"
  input-placeholder:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.tertiary}"
  avatar:
    backgroundColor: "{colors.accentTint}"
    textColor: "{colors.primaryHover}"
    rounded: "{rounded.none}"
    size: 34px
  badge-good:
    backgroundColor: "{colors.goodTint}"
    textColor: "{colors.good}"
    rounded: "{rounded.none}"
  badge-warn:
    backgroundColor: "{colors.warnTint}"
    textColor: "{colors.warn}"
    rounded: "{rounded.none}"
  badge-danger:
    backgroundColor: "{colors.dangerTint}"
    textColor: "{colors.danger}"
    rounded: "{rounded.none}"
  badge-info:
    backgroundColor: "{colors.infoTint}"
    textColor: "{colors.info}"
    rounded: "{rounded.none}"
---

## Overview

ХаусПро — личный бренд Руслана Ножкина, частного риелтора в Красноярске.
Главная услуга — доверительное управление квартирой («Сдаю и веду вашу
квартиру»). Клиент выбирает из-за доверия к человеку, поэтому стиль — как
аккуратно оформленный документ с подписью, а не реклама агентства. Принципы: один акцент (мох), тёплые
нейтральные цвета, прямые углы, никаких теней и градиентов, засечные заголовки.
Тон, логотип и правила для носителей описаны в `BRANDBOOK.md`.

## Colors

- **Primary (#4B6B46), «мох»:** единственный акцент в интерфейсе: CTA, ссылки, знак.
- **Forest (#1F2B1D):** тёмный цвет бренда для подвала, обложек соцсетей и оборота визитки.
- **Brass (#C8A45C), «латунь»:** только маркетинг, и только на тёмном лесном фоне
  (контраст 6.3:1). На светлом фоне не используется: контраст там недостаточный.
- **Ink (#232A24) / Secondary (#5C6659) / Tertiary (#8A9382):** текст трёх уровней.
  Tertiary — только плейсхолдеры и неактивные элементы (3:1), не основной текст.
- **Neutral (#EEF0E9) / Surface (#FBFBF8):** фон страницы и фон карточек.
- **Статусы:** good, warn, danger, info. Используются только для статусов, не для украшения.
  Warn затемнён до #6B5D34 (было #7A6B3F, 4.43:1), чтобы пройти WCAG AA.

## Typography

Source Serif 4 для заголовков и цен, Source Sans 3 для текста. Шкала сайта
48 / 32 / 22 / 18 / 16 / 14 / 12; основной текст сайта не меньше 16px.
`ui` (13.5px) — только для плотного интерфейса CRM. Оба шрифта
поддерживают кириллицу и бесплатно доступны в Google Fonts. В крупных заголовках
межбуквенный интервал отрицательный, в мелких капс-подписях положительный (+0.09em).
Цены набираются цифрами одинаковой ширины (`tnum`).

## Layout

Ширина контента 1180px. Отступы кратны 4 и 8. Между секциями сайта 80px.
Данные подаются строками «лейбл/значение», разделёнными тонкими линиями, а не
отдельными вложенными карточками.

## Elevation & Depth

Теней нет. Глубина задаётся только сменой фона (neutral → surface) и границей
толщиной 1px. При наведении меняется только цвет границы, без сдвигов и увеличения.

## Shapes

Радиус 0 у всех контейнеров, кнопок, фото и аватаров. Круглыми бывают только
точки статусов, индикаторы прогресса и спиннеры.

## Components

- `button-primary`: на экране одна такая кнопка (главное действие).
- `card`: бумажный фон, граница 1px, отступ 20px.
- `footer`: лесной фон, светлый текст, акценты латунью.
- `avatar`: квадрат с инициалами, текст тёмным мхом (5.8:1).
- Логотип: монограмма «ХП» в квадрате-печати с латунной чертой подписи;
  файлы в `logo/`, текст в кривых.
- `badge-*`: светлый фон своего статуса и насыщенный текст того же цвета, прямоугольная форма.

## Do's and Don'ts

- ✅ Один акцентный цвет на экране, один главный CTA.
- ✅ Цифры вместо прилагательных: сроки, суммы, документы.
- ✅ Латунь только на тёмном лесном фоне.
- ❌ Никаких скруглений, теней, градиентов и pill-бейджей.
- ❌ Не использовать чистый чёрный и холодный синий как цвет бренда.
- ❌ Статусные цвета (good/warn/danger/info) — только в CRM, не в маркетинге.
- ❌ Не писать «мы» и «агентство» — бренд личный, текст от первого лица.
- ❌ Не красить колонки канбана по этапу: цвет несёт только статус.
