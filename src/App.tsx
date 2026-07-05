import { useEffect, useRef } from 'react'
import { initStore, startRecycleBinJanitor, useStore } from './store'
import { useGlobalRuntimeErrors } from './hooks/useGlobalRuntimeErrors'
import { resolveAppViewFromPath, resolveAppViewPath, resolveAppViewTitle } from './app/appRoutes'
import { Header } from './app/components'
import FutureFeaturePage from './app/components/FutureFeaturePage'
import { AdminConsole, AnnouncementStrip, AuthModal } from './features/account'
import { ImageContextMenu, TaskGrid } from './features/gallery'
import { InputBar, PromptLibraryDrawer, SearchBar } from './features/input'
import { LandingPage } from './features/landing'
import { SettingsModal } from './features/settings'
import { ShareToSquareModal, SquarePage } from './features/square'
import { DetailModal, ImageEditModal, Lightbox } from './features/viewer'
import { ConfirmDialog, Toast } from './shared/components'
import type { AppView } from './types'

function syncRouteToStore(setAppView: (view: AppView) => void, setShowAdminModels: (show: boolean) => void) {
  const pathname = window.location.pathname
  setShowAdminModels(pathname === '/admin')
  const routeView = resolveAppViewFromPath(pathname)
  if (!routeView) return false

  setAppView(routeView)
  return true
}

export default function App() {
  const appView = useStore((state) => state.appView)
  const themeMode = useStore((state) => state.themeMode)
  const authReady = useStore((state) => state.authReady)
  const currentUser = useStore((state) => state.currentUser)
  const openAuthModal = useStore((state) => state.openAuthModal)
  const setAppView = useStore((state) => state.setAppView)
  const setShowAdminModels = useStore((state) => state.setShowAdminModels)
  const applyingRouteRef = useRef(false)
  useGlobalRuntimeErrors()

  useEffect(() => {
    initStore().finally(() => {
      applyingRouteRef.current = true
      syncRouteToStore(setAppView, setShowAdminModels)
      window.setTimeout(() => {
        applyingRouteRef.current = false
      }, 0)
    })
    const stopRecycleBinJanitor = startRecycleBinJanitor()

    return () => {
      stopRecycleBinJanitor()
    }
  }, [])

  useEffect(() => {
    function syncAppRoute() {
      applyingRouteRef.current = true
      syncRouteToStore(setAppView, setShowAdminModels)
      window.setTimeout(() => {
        applyingRouteRef.current = false
      }, 0)
    }

    syncAppRoute()
    window.addEventListener('popstate', syncAppRoute)
    return () => window.removeEventListener('popstate', syncAppRoute)
  }, [setAppView, setShowAdminModels])

  useEffect(() => {
    if (applyingRouteRef.current || window.location.pathname === '/admin') return
    const nextPath = resolveAppViewPath(appView)
    if (window.location.pathname !== nextPath) {
      window.history.pushState(null, '', nextPath)
    }
  }, [appView])

  useEffect(() => {
    document.title = window.location.pathname === '/admin' ? '运营后台 - 造境 Proxima' : resolveAppViewTitle(appView)
  }, [appView])

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const applyTheme = () => {
      const shouldUseDark = themeMode === 'dark' || (themeMode === 'system' && media.matches)
      document.documentElement.classList.toggle('dark', shouldUseDark)
      document.documentElement.dataset.theme = shouldUseDark ? 'dark' : 'light'
    }

    applyTheme()
    media.addEventListener('change', applyTheme)
    return () => media.removeEventListener('change', applyTheme)
  }, [themeMode])

  useEffect(() => {
    if (authReady && !currentUser && appView === 'local' && window.location.pathname !== '/admin') {
      openAuthModal('login')
    }
  }, [appView, authReady, currentUser, openAuthModal])

  const showLanding =
    (appView === 'home' || (authReady && !currentUser && appView === 'local')) &&
    window.location.pathname !== '/admin'
  const showCreationRail = appView === 'local'

  if (showLanding) {
    return (
      <>
        <LandingPage />
        <AuthModal />
        <ConfirmDialog />
        <Toast />
      </>
    )
  }

  if (appView === 'square' && window.location.pathname !== '/admin') {
    return (
      <>
        <SquarePage />
        <AuthModal />
        <ConfirmDialog />
        <Toast />
      </>
    )
  }

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-gray-50 dark:bg-gray-950">
      <Header />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {showCreationRail && <InputBar />}

        {/* 中间：画廊区 */}
        <main className="relative flex min-w-0 flex-1 flex-col overflow-y-auto pb-28 md:pb-0">
          <div className="max-w-7xl mx-auto w-full px-4 pb-12">
            {appView === 'models' ? (
              <FutureFeaturePage
                eyebrow="模型中心"
                title="把模型能力、价格和可用场景集中管理。"
                description="这里会承载模型广场、模型能力说明、成本策略和可用状态。先把入口做成正式分区，后续接真实模型数据时不需要再调整整体导航。"
                primaryAction="先去创作"
                secondaryAction="查看广场"
                setAppView={setAppView}
                panels={[
                  { title: '模型能力卡', detail: '展示生图、编辑、参考图、文生图质量和速度差异。', status: '规划中' },
                  { title: '价格与积分', detail: '把后台配置的积分消耗同步成用户可理解的价格说明。', status: '可接入' },
                  { title: '推荐策略', detail: '根据尺寸、质量、参考图需求推荐默认模型。', status: '预留' },
                ]}
              />
            ) : appView === 'assets' ? (
              <FutureFeaturePage
                eyebrow="资产库"
                title="为生成图片、云端素材和团队资源留出统一入口。"
                description="资产库会承载云端生成图、R2 文件、收藏素材和团队共享内容。当前先建立产品分区，让后续图片资产表和云存储能力自然落在这里。"
                primaryAction="回到工作台"
                secondaryAction="浏览广场"
                setAppView={setAppView}
                panels={[
                  { title: '生成资产', detail: '展示 GeneratedAsset 独立表中的云端图片记录。', status: '待接入' },
                  { title: '素材分组', detail: '按项目、标签、来源管理参考图和成品图。', status: '规划中' },
                  { title: '云端状态', detail: '显示 R2 同步状态、文件大小和公开访问地址。', status: '预留' },
                ]}
              />
            ) : (
              <>
                <AnnouncementStrip placement="workspace" />
                <SearchBar />
                <TaskGrid />
              </>
            )}
          </div>
        </main>
      </div>

      {/* 右侧：预留面板/抽屉（暂时隐藏，因为设置已经改为抽屉） */}
      {/* <aside className="w-0 md:w-16 lg:w-64 flex-shrink-0 border-l border-gray-200 bg-white dark:border-white/[0.08] dark:bg-gray-900 transition-all duration-300 hidden md:flex flex-col z-20">
        <div className="p-4 text-center text-gray-400 text-sm mt-10">
          <span className="hidden lg:inline">工具面板 (预留)</span>
          <span className="lg:hidden">...</span>
        </div>
      </aside> */}

      <ImageEditModal />
      <DetailModal />
      <Lightbox />
      <PromptLibraryDrawer />
      <SettingsModal />
      <ShareToSquareModal />
      <AuthModal />
      <AdminConsole />
      <ConfirmDialog />
      <Toast />
      <ImageContextMenu />
    </div>
  )
}
