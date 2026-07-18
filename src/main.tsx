import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from "react-error-boundary";

import App from './App.tsx'
import WorldCupApp from './WorldCupApp.tsx'
import { ErrorFallback } from './ErrorFallback.tsx'

import "./main.css"
import "./styles/theme.css"
import "./index.css"

function Router() {
  const path = typeof window !== 'undefined' ? window.location.pathname : '/'
  if (path === '/world-cup' || path === '/world.cup' || path === '/nfl.season') {
    return <WorldCupApp />
  }
  return <App />
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary FallbackComponent={ErrorFallback}>
    <Router />
   </ErrorBoundary>
)

