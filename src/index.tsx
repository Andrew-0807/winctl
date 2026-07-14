import React from 'react';
import ReactDOM from 'react-dom/client';
import { MotionConfig } from 'framer-motion';
import './styles/tailwind.css';
import App from './components/App';

const root = document.getElementById('root');

if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      {/* reducedMotion="user" makes every framer animation honor prefers-reduced-motion
          (CSS @media can't reach framer's JS-driven transforms). */}
      <MotionConfig reducedMotion="user">
        <App />
      </MotionConfig>
    </React.StrictMode>
  );
}
