import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import './index.css'
import Layout from './components/Layout'
import OverviewPage from './pages/OverviewPage'
import MapPage from './pages/MapPage'
import ResultsPage from './pages/ResultsPage'

// Three sections. Addresses of the earlier pages lead to the section that now holds their content.
const OLD: [string, string][] = [['compare', '/map'], ['parameters', '/'], ['history', '/results'], ['future', '/results'], ['validation', '/results'], ['science', '/']]

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<OverviewPage />} />
          <Route path="map" element={<MapPage />} />
          <Route path="results" element={<ResultsPage />} />
          {OLD.map(([from, to]) => <Route key={from} path={from} element={<Navigate to={to} replace />} />)}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
