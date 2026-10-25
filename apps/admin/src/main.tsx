import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { PwaPrompt } from './components/PwaPrompt.tsx'
import { initPwa } from './lib/pwa.ts'

initPwa()

createRoot(document.getElementById('root')!).render(
  <>
    <App />
    <PwaPrompt />
  </>
)
