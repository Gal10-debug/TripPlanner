import { StrictMode } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { createRoot } from 'react-dom/client'
import './fonts.css'
import './index.css'
import App from './App.tsx'
import ScenicBackground from './components/ScenicBackground'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter><ScenicBackground /><App /></BrowserRouter>
  </StrictMode>,
)
