// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './RoloApp.jsx'; // Path to your main App component

// Render the React application into the DOM
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
