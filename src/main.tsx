import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from "react-error-boundary";

import App from './App.tsx'
import { MaintenanceScreen } from './MaintenanceScreen.tsx'
import { ErrorFallback } from './ErrorFallback.tsx'

import "./main.css"
import "./styles/theme.css"
import "./index.css"

const MAINTENANCE_MODE = String(import.meta.env.VITE_MAINTENANCE_MODE || '').toLowerCase() === 'true'
const RootView = MAINTENANCE_MODE ? MaintenanceScreen : App

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary FallbackComponent={ErrorFallback}>
    <RootView />
   </ErrorBoundary>
)
