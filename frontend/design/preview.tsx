import React from 'react'
import ReactDOM from 'react-dom/client'
import DPRAnalyzerLanding from './DPRAnalyzerLanding'
import '../src/index.css' // Import global styles/tailwind

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <DPRAnalyzerLanding />
    </React.StrictMode>,
)
