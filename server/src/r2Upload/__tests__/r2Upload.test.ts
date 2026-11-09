import { describe, expect, it } from 'vitest'
import { isAlreadyOnR2, needsR2Upload } from '../config.js'
import { isWithinTimeWindow } from '../../settings.js'

/** 构造一个「北京时间 hour:minute」对应的时刻：窗口判断内部按 UTC+8 折算 */
function bjDate(hour: number, minute = 0): Date {
  return new Date(Date.UTC(2026, 0, 1, ((hour - 8) + 24) % 24, minute))
}

describe('isAlreadyOnR2', () => {
  it('recognizes pub/pre r2 domains as already uploaded', () => {
    expect(isAlreadyOnR2('https://pub-50c373973c124f37836b65a15fa3fb38.r2.dev/abc.png')).toBe(true)
    expect(isAlreadyOnR2('https://prefix.example.com/abc.png')).toBe(true)
    expect(isAlreadyOnR2('https://chatimg.code2alita.com/d/images/abc.png')).toBe(false)
    expect(isAlreadyOnR2('/api/generations/task-1/images/0')).toBe(false)
  })
})

describe('needsR2Upload', () => {
  it('marks remote/local/base64 images as needing upload and skips r2 urls', () => {
    expect(needsR2Upload('https://chatimg.code2alita.com/d/images/abc.png')).toBe(true)
    expect(needsR2Upload('/api/generations/task-1/images/0')).toBe(true)
    expect(needsR2Upload('data:image/png;base64,iVBORw0KGgo=')).toBe(true)
    expect(needsR2Upload('https://pub-50c373973c124f37836b65a15fa3fb38.r2.dev/abc.png')).toBe(false)
    expect(needsR2Upload('')).toBe(false)
    expect(needsR2Upload(undefined)).toBe(false)
  })
})

describe('isWithinTimeWindow（按北京时间解释窗口）', () => {
  it('treats equal start/end as always open', () => {
    expect(isWithinTimeWindow(bjDate(23), '02:00', '02:00')).toBe(true)
  })

  it('supports normal and cross-midnight windows', () => {
    expect(isWithinTimeWindow(bjDate(3), '02:00', '08:00')).toBe(true)
    expect(isWithinTimeWindow(bjDate(9), '02:00', '08:00')).toBe(false)
    expect(isWithinTimeWindow(bjDate(23, 30), '22:00', '06:00')).toBe(true)
    expect(isWithinTimeWindow(bjDate(5), '22:00', '06:00')).toBe(true)
    expect(isWithinTimeWindow(bjDate(12), '22:00', '06:00')).toBe(false)
  })

  it('default prod window 19:00-07:00 covers late night and early morning', () => {
    expect(isWithinTimeWindow(bjDate(20), '19:00', '07:00')).toBe(true)
    expect(isWithinTimeWindow(bjDate(0, 30), '19:00', '07:00')).toBe(true)
    expect(isWithinTimeWindow(bjDate(6, 59), '19:00', '07:00')).toBe(true)
    expect(isWithinTimeWindow(bjDate(7), '19:00', '07:00')).toBe(false)
    expect(isWithinTimeWindow(bjDate(12), '19:00', '07:00')).toBe(false)
  })
})
