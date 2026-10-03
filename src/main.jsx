import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { LanguageProvider } from './i18n/LanguageContext.jsx';
import './index.css';
import './App.css';
// Imported LAST, on purpose. It styles only the elements that state a fact
// the app used to leave blank (size, price, "no local alternative"), and it
// lives outside App.css/index.css so the visual-system rewrite happening in
// those two files cannot collide with it. See src/styles/completeness.css.
import './styles/completeness.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </React.StrictMode>
);
