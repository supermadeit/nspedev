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

import "./main.css"
import "./styles/theme.css"
import "./index.css"

// Hooks can't be called conditionally inside route config directly, so the
// mobile/desktop split at the catch-all route lives in this tiny wrapper.
// Mobile users automatically get the calculator-style UI — this isn't a URL
// anyone navigates to on purpose.
function RootRoute() {
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

          <Route path="*" element={<RootRoute />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </ErrorBoundary>
)

