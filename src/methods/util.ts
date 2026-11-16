import { createHash } from 'node:crypto'

export const md5 = (s: string): string => createHash('md5').update(s).digest('hex')
export const sha1 = (s: string): string => createHash('sha1').update(s).digest('hex')

export const qs = (o: Record<string, string | number>): string =>
  new URLSearchParams(Object.entries(o).map(([k, v]) => [k, String(v)] as [string, string])).toString()

/** 'YYYY-MM-DD HH:mm:ss'（北京时间，无时区标记）→ ISO；已带 T/Z 的直通 Date 解析。 */
export const cst = (s: string): string => {
  if (/[T Z][0-9:.+-]+Z?$/i.test(s) && !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(s)) {
    const d = new Date(s)
    return Number.isFinite(d.getTime()) ? d.toISOString() : new Date().toISOString()
  }
  const d = new Date(`${s.replace(' ', 'T')}+08:00`)
  return Number.isFinite(d.getTime()) ? d.toISOString() : new Date().toISOString()
}

export const stripTags = (s: string): string => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
