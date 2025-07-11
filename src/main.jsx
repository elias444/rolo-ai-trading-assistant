// src/main.jsx (or src/index.jsx)
import React from 'react';
import ReactDOM from 'react-dom/client';
import RoloApp from './RoloApp'; // Import your main RoloApp component
import './App.css'; // Import your main CSS file for the app's styling

// This line finds the 'root' div in your public/index.html and tells React to render RoloApp inside it.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RoloApp />
  </React.StrictMode>,
);
