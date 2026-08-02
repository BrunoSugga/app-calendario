import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { applyWebCsp } from './lib/security'
import './index.css'

applyWebCsp()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
