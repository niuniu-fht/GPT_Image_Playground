import { useRef, type PointerEvent } from 'react'
import ExperienceTopNav from '../../app/components/experience-nav/ExperienceTopNav'
import { useStore } from '../../store'
import type { AppView } from '../../types'
import LandingHeroBackdrop from './LandingHeroBackdrop'

export default function LandingPage() {
  const openAuthModal = useStore((state) => state.openAuthModal)
  const currentUser = useStore((state) => state.currentUser)
  const setAppView = useStore((state) => state.setAppView)
  const setShowAdminModels = useStore((state) => state.setShowAdminModels)
  const mainRef = useRef<HTMLElement | null>(null)

  function handlePointerMove(event: PointerEvent<HTMLElement>) {
    const target = mainRef.current
    if (!target) return
    const rect = target.getBoundingClientRect()
    target.style.setProperty('--mouse-x', `${event.clientX - rect.left}px`)
    target.style.setProperty('--mouse-y', `${event.clientY - rect.top}px`)
  }

  function openAdminConsole() {
    if (window.location.pathname !== '/admin') {
      window.history.pushState(null, '', '/admin')
    }
    setShowAdminModels(true)
  }

  function handleNavigate(view: AppView) {
    if (view === 'local' && !currentUser) {
      openAuthModal('login')
      return
    }
    setAppView(view)
  }

  return (
    <main
      ref={mainRef}
      onPointerMove={handlePointerMove}
      className="relative min-h-screen overflow-hidden bg-[#f7f9fc] text-slate-950 [--mouse-x:50vw] [--mouse-y:42vh] dark:bg-slate-950 dark:text-white"
    >
      <div className="relative z-10 flex min-h-screen flex-col">
        <section className="relative min-h-screen overflow-hidden">
          <LandingHeroBackdrop />
          <ExperienceTopNav
            appView="home"
            currentUser={currentUser}
            onAdmin={openAdminConsole}
            onLogin={() => openAuthModal('login')}
            onNavigate={handleNavigate}
          />

          <div className="relative z-10 mx-auto flex min-h-[calc(100vh-5.5rem)] w-full max-w-5xl flex-col items-center justify-center px-5 pb-24 pt-20 text-center text-white md:pt-10">
            <div className="max-w-4xl">
              <h1 className="text-5xl font-black leading-[1.02] tracking-tight text-white drop-shadow-2xl md:text-7xl xl:text-8xl">
                <span className="block">把一张素材</span>
                <span className="block">变成一组作品</span>
              </h1>

              <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
                {currentUser ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setAppView('local')}
                      className="h-12 rounded-full bg-white px-7 text-sm font-bold text-slate-950 shadow-2xl shadow-slate-950/25 transition hover:-translate-y-0.5 hover:bg-slate-100"
                    >
                      进入创作台
                    </button>
                    <button
                      type="button"
                      onClick={() => setAppView('square')}
                      className="h-12 rounded-full border border-white/24 bg-white/14 px-7 text-sm font-bold text-white shadow-sm backdrop-blur-xl transition hover:bg-white/22"
                    >
                      浏览作品广场
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => openAuthModal('login')}
                      className="h-12 rounded-full bg-white px-7 text-sm font-bold text-slate-950 shadow-2xl shadow-slate-950/25 transition hover:-translate-y-0.5 hover:bg-slate-100"
                    >
                      进入创作台
                    </button>
                    <button
                      type="button"
                      onClick={() => setAppView('square')}
                      className="h-12 rounded-full border border-white/24 bg-white/14 px-7 text-sm font-bold text-white shadow-sm backdrop-blur-xl transition hover:bg-white/22"
                    >
                      浏览作品广场
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
