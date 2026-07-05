import { Component, type ErrorInfo, type ReactNode } from 'react'
import AppErrorFallback from './AppErrorFallback'

interface AppErrorBoundaryProps {
  children: ReactNode
}

interface AppErrorBoundaryState {
  error: Error | null
}

export default class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = {
    error: null,
  }

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[app-error-boundary]', error, errorInfo)
  }

  private handleReload = () => {
    window.location.reload()
  }

  private handleReset = () => {
    window.history.replaceState(null, '', import.meta.env.BASE_URL)
    this.setState({ error: null })
  }

  render() {
    const { error } = this.state

    if (error) {
      return (
        <AppErrorFallback
          error={error}
          onReload={this.handleReload}
          onReset={this.handleReset}
        />
      )
    }

    return this.props.children
  }
}
