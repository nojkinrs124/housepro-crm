// Сумма прописью для счёта на оплату.
//
// Вынесена из страницы счёта в lib по двум причинам: страница — серверный
// компонент и её нельзя импортировать в тесты, а правила склонения рублей
// и копеек — как раз то, что стоит покрыть тестами, а не проверять глазами
// на печатной форме.

/** Сумма прописью: в счёте это требование делового оборота, а не украшение. */
export function amountInWords(amount: number): string {
 const units = ['', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять']
 const unitsF = ['', 'одна', 'две', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять']
 const teens = ['десять', 'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать', 'пятнадцать',
 'шестнадцать', 'семнадцать', 'восемнадцать', 'девятнадцать']
 const tens = ['', '', 'двадцать', 'тридцать', 'сорок', 'пятьдесят', 'шестьдесят', 'семьдесят', 'восемьдесят', 'девяносто']
 const hundreds = ['', 'сто', 'двести', 'триста', 'четыреста', 'пятьсот', 'шестьсот', 'семьсот', 'восемьсот', 'девятьсот']

 function triad(value: number, feminine: boolean): string[] {
 const words: string[] = []
 const h = Math.floor(value / 100)
 const t = Math.floor((value % 100) / 10)
 const u = value % 10

 if (h > 0) words.push(hundreds[h])
 if (t === 1) {
 words.push(teens[u])
 } else {
 if (t > 1) words.push(tens[t])
 if (u > 0) words.push(feminine ? unitsF[u] : units[u])
 }
 return words
 }

 function plural(value: number, forms: [string, string, string]): string {
 const n = value % 100
 if (n > 10 && n < 20) return forms[2]
 const last = n % 10
 if (last === 1) return forms[0]
 if (last >= 2 && last <= 4) return forms[1]
 return forms[2]
 }

 const rubles = Math.floor(amount)
 const kopecks = Math.round((amount - rubles) * 100)

 const millions = Math.floor(rubles / 1_000_000)
 const thousands = Math.floor((rubles % 1_000_000) / 1000)
 const rest = rubles % 1000

 const parts: string[] = []
 if (millions > 0) parts.push(...triad(millions, false), plural(millions, ['миллион', 'миллиона', 'миллионов']))
 if (thousands > 0) parts.push(...triad(thousands, true), plural(thousands, ['тысяча', 'тысячи', 'тысяч']))
 if (rest > 0 || rubles === 0) parts.push(...triad(rest, false))

 const text = parts.filter(Boolean).join(' ') || 'ноль'
 const rubleWord = plural(rubles, ['рубль', 'рубля', 'рублей'])
 const kopeckWord = plural(kopecks, ['копейка', 'копейки', 'копеек'])

 return `${text.charAt(0).toUpperCase()}${text.slice(1)} ${rubleWord} ${String(kopecks).padStart(2, '0')} ${kopeckWord}`
}
