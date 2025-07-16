// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './RoloApp.jsx'; // Adjust path if RoloApp.jsx is in a subfolder like ./components/RoloApp.jsx
import './index.css'; // Assuming you have a global CSS file for Tailwind directives

// This is where your React App is mounted to the DOM
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
