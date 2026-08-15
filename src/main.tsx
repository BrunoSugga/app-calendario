import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { applyWebCsp } from './lib/security'
import { isCapacitor } from './lib/platform'
import './index.css'

applyWebCsp()

if (isCapacitor()) {
  void import('@capacitor/keyboard')
    .then(({ Keyboard, KeyboardResize }) => Keyboard.setResizeMode({ mode: KeyboardResize.Body }))
    .catch(() => undefined)
  void import('@capacitor/status-bar')
    .then(({ StatusBar, Style }) =>
      Promise.all([
        StatusBar.setStyle({ style: Style.Dark }),
        StatusBar.setBackgroundColor({ color: '#1e2430' }),
      ]),
    )
    .catch(() => undefined)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
