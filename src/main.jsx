import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { initApi } from './api/backend'
import './index.css'
import App from './App.jsx'

initApi().then(() => {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
