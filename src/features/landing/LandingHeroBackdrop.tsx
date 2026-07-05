import { useEffect, useState } from 'react'
import { platformApi } from '../../lib/platformApi'
import { LANDING_HERO_SLIDES, type LandingHeroSlide } from './landingHeroSlides'

const HERO_ROTATE_MS = 3600

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function normalizeSlide(item: unknown, index: number): LandingHeroSlide | null {
  if (!isRecord(item)) return null
  const imageUrl = typeof item.imageUrl === 'string' ? item.imageUrl.trim() : ''
  if (!imageUrl) return null
  return {
    id: typeof item.id === 'string' && item.id.trim() ? item.id.trim() : `hero-slide-${index}`,
    title: typeof item.title === 'string' ? item.title.trim() : '',
    category: typeof item.category === 'string' ? item.category.trim() : '',
    imageUrl,
    accent: typeof item.accent === 'string' && item.accent.trim() ? item.accent.trim() : '#ffffff',
  }
}

function parseConfiguredSlides(value: string): LandingHeroSlide[] {
  try {
    const parsed = JSON.parse(value) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((item, index) => normalizeSlide(item, index))
      .filter((item): item is LandingHeroSlide => item !== null)
  } catch (error) {
    console.warn('[landing] invalid hero slides config', error)
    return []
  }
}

export default function LandingHeroBackdrop() {
  const [slides, setSlides] = useState<LandingHeroSlide[]>(LANDING_HERO_SLIDES)
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    let cancelled = false

    platformApi.getPublicLanding()
      .then((result) => {
        const configuredSlides = parseConfiguredSlides(result.landingHeroSlidesJson)
        if (!cancelled && configuredSlides.length > 0) {
          setSlides(configuredSlides)
          setActiveIndex(0)
        }
      })
      .catch((error) => {
        console.warn('[landing] failed to load hero slides config', error)
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (slides.length <= 1) return undefined
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (mediaQuery.matches) return undefined
    const timer = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % slides.length)
    }, HERO_ROTATE_MS)
    return () => window.clearInterval(timer)
  }, [slides.length])

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 bg-slate-950" />
      {slides.map((slide, index) => (
        <div
          key={slide.id}
          className={`absolute inset-0 transition duration-[1400ms] ease-out ${
            index === activeIndex ? 'scale-100 opacity-100' : 'scale-[1.035] opacity-0'
          }`}
        >
          <img
            src={slide.imageUrl}
            alt=""
            className="h-full w-full object-cover"
            draggable={false}
          />
        </div>
      ))}

      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.58),rgba(2,6,23,0.20)_34%,rgba(2,6,23,0.72)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(255,255,255,0.22),transparent_32%),linear-gradient(90deg,rgba(2,6,23,0.36),transparent_30%,transparent_70%,rgba(2,6,23,0.36))]" />
      <div className="absolute inset-0 backdrop-blur-[1px]" />

      <div className="absolute bottom-7 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/22 bg-white/14 px-3 py-2 backdrop-blur-xl">
        {slides.map((slide, index) => (
          <span
            key={slide.id}
            className={`h-1.5 rounded-full transition-all duration-500 ${index === activeIndex ? 'w-8 bg-white' : 'w-2 bg-white/44'}`}
          />
        ))}
      </div>
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#f7f9fc] to-transparent dark:from-slate-950" />
    </div>
  )
}
