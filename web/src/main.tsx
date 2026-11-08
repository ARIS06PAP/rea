import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './index.css'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import MapPage from './pages/MapPage'
import ParamsPage from './pages/ParamsPage'
import HistoryPage from './pages/HistoryPage'
import FuturePage from './pages/FuturePage'
import ValidationPage from './pages/ValidationPage'
import SciencePage from './pages/SciencePage'
import ComparePage from './pages/ComparePage'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="map" element={<MapPage />} />
          <Route path="compare" element={<ComparePage />} />
          <Route path="parameters" element={<ParamsPage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="future" element={<FuturePage />} />
          <Route path="validation" element={<ValidationPage />} />
          <Route path="science" element={<SciencePage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
