import { describe, expect, it } from 'vitest'
import {
  APP_VIEW_NAV_ITEMS,
  resolveAppViewFromPath,
  resolveAppViewPath,
  resolveAppViewTitle,
} from '../appRoutes'

describe('appRoutes', () => {
  it('keeps the product navigation order stable', () => {
    expect(APP_VIEW_NAV_ITEMS.map((item) => item.label)).toEqual([
      '首页',
      '创作台',
      '作品广场',
    ])
  })

  it('resolves each public product path back to its AppView', () => {
    expect(resolveAppViewFromPath('/')).toBe('home')
    expect(resolveAppViewFromPath('/workspace')).toBe('local')
    expect(resolveAppViewFromPath('/square')).toBe('square')
    expect(resolveAppViewFromPath('/models')).toBe('models')
    expect(resolveAppViewFromPath('/library')).toBe('assets')
  })

  it('keeps the asset library away from the static /assets directory', () => {
    expect(resolveAppViewPath('assets')).toBe('/library')
    expect(resolveAppViewFromPath('/assets')).toBeNull()
  })

  it('provides product-specific browser titles', () => {
    expect(resolveAppViewTitle('home')).toBe('造境 Proxima')
    expect(resolveAppViewTitle('local')).toBe('创作台 - 造境 Proxima')
    expect(resolveAppViewTitle('square')).toBe('作品广场 - 造境 Proxima')
    expect(resolveAppViewTitle('models')).toBe('模型中心 - 造境 Proxima')
    expect(resolveAppViewTitle('assets')).toBe('资产库 - 造境 Proxima')
  })
})
