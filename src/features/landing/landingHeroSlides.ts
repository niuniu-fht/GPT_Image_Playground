export interface LandingHeroSlide {
  id: string
  title: string
  category: string
  imageUrl: string
  accent: string
}

export const LANDING_HERO_SLIDES: LandingHeroSlide[] = [
  {
    id: 'portrait-office',
    title: '职业头像套图',
    category: '人像写真',
    imageUrl: '/landing/showcase/portrait-office.png',
    accent: '#2563eb',
  },
  {
    id: 'headphone-product',
    title: '耳机产品展示',
    category: '商品图',
    imageUrl: '/landing/showcase/headphone-product.png',
    accent: '#dc2626',
  },
  {
    id: 'perfume-product',
    title: '香水电商大片',
    category: '电商主图',
    imageUrl: '/landing/showcase/perfume-product.png',
    accent: '#d97706',
  },
  {
    id: 'travel-portrait',
    title: '旅行人像换景',
    category: '场景生成',
    imageUrl: '/landing/showcase/travel-portrait.png',
    accent: '#0ea5e9',
  },
  {
    id: 'fashion-street',
    title: '街拍穿搭海报',
    category: '服装换装',
    imageUrl: '/landing/showcase/fashion-street.png',
    accent: '#b45309',
  },
]
