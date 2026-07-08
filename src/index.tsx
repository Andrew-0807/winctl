import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/tailwind.css';
import App from './components/App';

const root = document.getElementById('root');

if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
