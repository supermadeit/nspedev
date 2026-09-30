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
import MlbChartsPage from './pages/MlbChartsPage.tsx'
import NbaChartsPage from './pages/NbaChartsPage.tsx'
import NhlChartsPage from './pages/NhlChartsPage.tsx'
import PlayerProfilePage from './pages/PlayerProfilePage.tsx'
import SportSeasonPage from './pages/SportSeasonPage.tsx'

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
          {/* One page per sport (not a unified hub with a sport switcher) —
              each a thin wrapper around the shared SportSeasonPage, per the
              route/label naming the user chose directly: mlb.playoffs (the
              MLB season is in its playoff stretch right now), nba.season and
              nhl.season (both just starting their regular seasons). */}
          <Route path="/mlb.playoffs" element={<SportSeasonPage sport="mlb" label="mlb.playoffs" />} />
          <Route path="/nba.season" element={<SportSeasonPage sport="nba" label="nba.season" />} />
          <Route path="/nhl.season" element={<SportSeasonPage sport="nhl" label="nhl.season" />} />

          <Route path="/calculator" element={<CalculatorRoute />} />
          <Route path="/charts" element={<QbChartsPage />} />
          {/* NBA/MLB/NHL's own {chart} pages — uniform to NFL's format (see
              SortableStatChart.tsx), route-named to match each sport's own
              "{sport}.feature" convention rather than NFL's bare "/charts"
              (which predates the other three existing at all). */}
          <Route path="/mlb.charts" element={<MlbChartsPage />} />
          <Route path="/nba.charts" element={<NbaChartsPage />} />
          <Route path="/nhl.charts" element={<NhlChartsPage />} />
          {/* Every profiled player shares the same qb-profiles/*.json section
              shape (verified across all 36 files), so this is a real dynamic
              route now — PlayerProfilePage looks the slug up in the same
              profile glob the search index uses. Not linked from static nav;
              reached via player search or a direct /database/{slug} URL. */}
          <Route path="/database/:slug" element={<PlayerProfilePage />} />

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
          {/* Shared pocket link — same App, which reads :id and replays the saved
              snapshot in the normal results panel. */}
          <Route path="/p/:id" element={<App />} />
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

