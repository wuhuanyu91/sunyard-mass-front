import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* basename 与 vite base 保持一致：统一路径前缀 /maas-web/ */}
    <BrowserRouter basename="/maas-web">
      <App />
    </BrowserRouter>
  </StrictMode>,
)
