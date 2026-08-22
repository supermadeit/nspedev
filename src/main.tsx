import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from "react-error-boundary";
import { BrowserRouter, Routes, Route } from 'react-router-dom'

import App from './App.tsx'
import WorldCupApp from './WorldCupApp.tsx'
import { MobileCalculatorApp } from './mobile-calculator/MobileCalculatorApp.tsx'
import { useIsMobile } from './hooks/use-mobile.ts'
import { ErrorFallback } from './ErrorFallback.tsx'
import { AuthProvider } from './context/AuthContext.tsx'
import { ProtectedRoute } from './pages/ProtectedRoute.tsx'
import LoginPage from './pages/LoginPage.tsx'
import SignupPage from './pages/SignupPage.tsx'
import RefillPage from './pages/RefillPage.tsx'
import CheckoutPage from './pages/CheckoutPage.tsx'
import SuccessPage from './pages/SuccessPage.tsx'
import AccountPage from './pages/AccountPage.tsx'
import QbChartsPage from './pages/QbChartsPage.tsx'
import PlayerProfilePage from './pages/PlayerProfilePage.tsx'

import "./main.css"
import "./styles/theme.css"
import "./index.css"

// The calculator-style UI lives at its own URL (/calculator) now, reached
// via a {calculator} button on the homepage rather than being shown
// automatically — mobile visitors land on the same App homepage desktop
// gets (App.tsx already has its own isMobile-aware layout for that). Only
// mobile viewports actually get the calculator at /calculator; a desktop
// viewport hitting that URL directly falls back to the homepage, since the
// calculator's layout is purpose-built for narrow screens.
function CalculatorRoute() {
  const isMobile = useIsMobile()
  return isMobile ? <MobileCalculatorApp /> : <App />
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary FallbackComponent={ErrorFallback}>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/world-cup" element={<WorldCupApp />} />
          <Route path="/world.cup" element={<WorldCupApp />} />
          <Route path="/nfl.season" element={<WorldCupApp />} />

          <Route path="/calculator" element={<CalculatorRoute />} />
          <Route path="/charts" element={<QbChartsPage />} />
          {/* Prototype only — hardcoded to the one sample player payload we
              have. No live per-player endpoint exists yet, so this isn't a
              real dynamic /database/:slug route (nor linked from anywhere)
              until that exists. */}
          <Route path="/database/dak-prescott" element={<PlayerProfilePage />} />

          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/refill" element={<RefillPage />} />
          <Route
            path="/checkout"
            element={
              <ProtectedRoute>
                <CheckoutPage />
              </ProtectedRoute>
            }
          />
          <Route path="/success" element={<SuccessPage />} />
          <Route
            path="/account"
            element={
              <ProtectedRoute>
                <AccountPage />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<App />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </ErrorBoundary>
)

