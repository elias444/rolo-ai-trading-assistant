// src/RoloApp.js
import React, { useState, useEffect } from 'react';
// Assuming your App.css is in src, adjust path if different
// import './App.css'; 

function RoloApp() {
  // --- State Management ---
  const [activeTab, setActiveTab] = useState('chat'); // Default to 'chat' tab
  const [stockData, setStockData] = useState({}); // Stores stock data by symbol
  const [marketData, setMarketData] = useState({}); // Stores overall market data
  const [optionsData, setOptionsData] = useState({}); // Stores options data by symbol+expiration
  const [chatHistory, setChatHistory] = useState([]); // Stores AI chat messages
  const [chatInput, setChatInput] = useState(''); // Input for AI chat
  const [currentTicker, setCurrentTicker] = useState('AAPL'); // Input for Ticker tab
  const [optionsSymbol, setOptionsSymbol] = useState('GOOG'); // Input for Options symbol
  const [optionsExpiration, setOptionsExpiration] = useState(''); // Input for Options expiration

  // Loading states for various API calls
  const [isLoadingStock, setIsLoadingStock] = useState(false);
  const [isLoadingMarket, setIsLoadingMarket] = useState(false);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const [error, setError] = useState(null); // General error message

  // --- Utility Function for API Calls ---
  // Helper to handle fetch responses and errors
  const fetchData = async (url, setter, loadingSetter) => {
    loadingSetter(true);
    setError(null); // Clear previous errors
    try {
      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        // If the server responded with an error status (4xx, 5xx)
        const errorMessage = data.error || `HTTP Error: ${response.status}`;
        console.error("API Error Response:", data);
        throw new Error(errorMessage);
      }

      if (data.error || data.message?.includes('limited or delayed')) {
        // Alpha Vantage specific errors or notes
        console.warn("Alpha Vantage API Note/Warning:", data);
        setter(data); // Still set data, but display a warning
        setError(data.error || data.message || "Data might be limited or delayed.");
      } else {
        setter(data); // Set the received data
      }
    } catch (err) {
      console.error("Fetch operation failed:", err);
      setError(`Failed to fetch data: ${err.message}. Please try again.`);
      setter({}); // Clear data on critical error
    } finally {
      loadingSetter(false);
    }
  };

  // --- Fetch Functions for Netlify Endpoints ---

  // Fetches detailed stock data for a single symbol
  const fetchStockData = async (symbol) => {
    if (!symbol) {
      setError("Please enter a stock symbol.");
      return;
    }
    // Using enhanced-stock-data for richer info
    await fetchData(
      `/.netlify/functions/enhanced-stock-data?symbol=${symbol}`,
      (data) => setStockData(prev => ({ ...prev, [symbol]: data })),
      setIsLoadingStock
    );
  };

  // Fetches overall market dashboard data
  const fetchMarketData = async () => {
    await fetchData(
      `/.netlify/functions/market-dashboard`,
      setMarketData,
      setIsLoadingMarket
    );
  };

  // Fetches options data for a symbol and expiration
  const fetchOptionsData = async (symbol, expiration) => {
    if (!symbol || !expiration) {
      setError("Please enter both a symbol and an expiration date for options.");
      return;
    }
    // Expected format: YYYY-MM-DD
    const formattedExpiration = expiration; 
    await fetchData(
      `/.netlify/functions/options-data?symbol=${symbol}&expiration=${formattedExpiration}`,
      (data) => setOptionsData(prev => ({ ...prev, [`${symbol}-${formattedExpiration}`]: data })),
      setIsLoadingOptions
    );
  };

  // Handles sending messages to the AI chat
  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;

    const userMessage = { role: 'user', content: chatInput.trim() };
    setChatHistory((prev) => [...prev, userMessage]);
    setChatInput(''); // Clear input immediately

    setIsLoadingChat(true);
    setError(null);

    try {
      const response = await fetch('/.netlify/functions/enhanced-rolo-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: chatInput.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get response from AI.');
      }

      const aiMessage = { role: 'ai', content: data.reply };
      setChatHistory((prev) => [...prev, aiMessage]);
    } catch (err) {
      console.error('AI chat error:', err);
      setError(`AI Chat Error: ${err.message}`);
      setChatHistory((prev) => [...prev, { role: 'system', content: `Error: ${err.message}` }]);
    } finally {
      setIsLoadingChat(false);
    }
  };

  // Placeholder for Alerts - you would integrate actual API calls here
  const fetchAlertsData = async () => {
    setIsLoadingStock(true); // Using stock loading for simplicity, create a new one if needed
    setError(null);
    try {
      // Example call, replace with actual /.netlify/functions/realtime-alerts or smart-alerts
      const response = await fetch('/.netlify/functions/realtime-alerts'); 
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to fetch alerts.');
      // Process and set alerts data
      setError("Alerts functionality is placeholder. Check logs.");
      console.log("Alerts Data:", data);
    } catch (err) {
      setError(`Alerts Error: ${err.message}`);
      console.error("Alerts Fetch Error:", err);
    } finally {
      setIsLoadingStock(false);
    }
  };

  // Placeholder for Plays - you would integrate actual API calls here
  const fetchPlaysData = async () => {
    setIsLoadingStock(true); // Using stock loading for simplicity
    setError(null);
    try {
      // Example call, replace with actual /.netlify/functions/smart-plays-generator
      const response = await fetch('/.netlify/functions/smart-plays-generator'); 
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to fetch plays.');
      // Process and set plays data
      setError("Plays functionality is placeholder. Check logs.");
      console.log("Plays Data:", data);
    } catch (err) {
      setError(`Plays Error: ${err.message}`);
      console.error("Plays Fetch Error:", err);
    } finally {
      setIsLoadingStock(false);
    }
  };


  // --- useEffect Hooks for Initial Data Loading or Tab Changes ---

  // Fetch market data when the component mounts or when 'market' tab is active
  useEffect(() => {
    if (activeTab === 'market') {
      fetchMarketData();
    } else if (activeTab === 'alerts') {
      fetchAlertsData(); // Fetch alerts when alerts tab is active
    } else if (activeTab === 'plays') {
      fetchPlaysData(); // Fetch plays when plays tab is active
    }
  }, [activeTab]); // Dependency array: re-run when activeTab changes

  // Fetch default stock data on initial load of the Ticker tab
  useEffect(() => {
    if (activeTab === 'ticker' && currentTicker && !stockData[currentTicker]) {
        fetchStockData(currentTicker);
    }
  }, [activeTab, currentTicker, stockData]);


  // --- Render Method (JSX) ---
  return (
    <div className="App">
      <header className="app-header">
        <h1>Rolo AI Trading Assistant</h1>
        <nav className="nav-tabs">
          <button onClick={() => setActiveTab('ticker')} className={activeTab === 'ticker' ? 'active' : ''}>Ticker</button>
          <button onClick={() => setActiveTab('market')} className={activeTab === 'market' ? 'active' : ''}>Market</button>
          <button onClick={() => setActiveTab('options')} className={activeTab === 'options' ? 'active' : ''}>Options</button>
          <button onClick={() => setActiveTab('chat')} className={activeTab === 'chat' ? 'active' : ''}>AI Chat</button>
          <button onClick={() => setActiveTab('alerts')} className={activeTab === 'alerts' ? 'active' : ''}>Alerts</button>
          <button onClick={() => setActiveTab('plays')} className={activeTab === 'plays' ? 'active' : ''}>Plays</button>
        </nav>
      </header>

      <main className="app-content">
        {error && <div className="error-message">{error}</div>}

        {/* Ticker Tab */}
        {activeTab === 'ticker' && (
          <div className="tab-content">
            <h2>Stock Ticker</h2>
            <div className="input-group">
              <input
                type="text"
                placeholder="Enter stock symbol (e.g., AAPL)"
                value={currentTicker}
                onChange={(e) => setCurrentTicker(e.target.value.toUpperCase())}
                onKeyPress={(e) => { if (e.key === 'Enter') fetchStockData(currentTicker); }}
              />
              <button onClick={() => fetchStockData(currentTicker)}>Get Stock Data</button>
            </div>
            {isLoadingStock ? (
              <p>Loading stock data...</p>
            ) : (
              stockData[currentTicker] && (
                <div className="stock-details">
                  <h3>{stockData[currentTicker].symbol}</h3>
                  <p>Price: ${stockData[currentTicker].price}</p>
                  <p>Change: {stockData[currentTicker].change} ({stockData[currentTicker].changePercent})</p>
                  <p>Volume: {stockData[currentTicker].volume}</p>
                  <p>High: ${stockData[currentTicker].high}</p>
                  <p>Low: ${stockData[currentTicker].low}</p>
                  <p>Open: ${stockData[currentTicker].open}</p>
                  <p>Previous Close: ${stockData[currentTicker].previousClose}</p>
                  <p>Last Updated: {stockData[currentTicker].lastUpdated}</p>
                  {/* Display fullRawData for debugging if needed */}
                  {/* <pre>{JSON.stringify(stockData[currentTicker].fullRawData, null, 2)}</pre> */}
                </div>
              )
            )}
            {!stockData[currentTicker] && !isLoadingStock && !error && <p>Enter a symbol to view its data.</p>}
          </div>
        )}

        {/* Market Tab */}
        {activeTab === 'market' && (
          <div className="tab-content">
            <h2>Market Overview</h2>
            {isLoadingMarket ? (
              <p>Loading market data...</p>
            ) : (
              <div className="market-details">
                {marketData.sp500 && (
                  <p><strong>S&P 500 (SPY):</strong> ${marketData.sp500.price} ({marketData.sp500.change} / {marketData.sp500.changePercent})</p>
                )}
                {marketData.dowJones && (
                  <p><strong>Dow Jones (DIA):</strong> ${marketData.dowJones.price} ({marketData.dowJones.change} / {marketData.dowJones.changePercent})</p>
                )}
                {marketData.nasdaq && (
                  <p><strong>NASDAQ (QQQ):</strong> ${marketData.nasdaq.price} ({marketData.nasdaq.change} / {marketData.nasdaq.changePercent})</p>
                )}
                {marketData.wtiOil && (
                  <p><strong>WTI Crude Oil:</strong> ${marketData.wtiOil.price} (as of {marketData.wtiOil.date})</p>
                )}
                 {marketData.vix && (
                  <p><strong>VIX:</strong> {marketData.vix.message}</p>
                )}
                {!marketData.sp500 && !marketData.dowJones && !marketData.nasdaq && !isLoadingMarket && <p>No market data available.</p>}
              </div>
            )}
          </div>
        )}

        {/* Options Tab */}
        {activeTab === 'options' && (
          <div className="tab-content">
            <h2>Options Chain</h2>
            <div className="input-group">
              <input
                type="text"
                placeholder="Enter stock symbol (e.g., GOOG)"
                value={optionsSymbol}
                onChange={(e) => setOptionsSymbol(e.target.value.toUpperCase())}
              />
              <input
                type="date" // HTML5 date picker
                value={optionsExpiration}
                onChange={(e) => setOptionsExpiration(e.target.value)}
              />
              <button onClick={() => fetchOptionsData(optionsSymbol, optionsExpiration)}>Get Options Data</button>
            </div>
            {isLoadingOptions ? (
              <p>Loading options data...</p>
            ) : (
              optionsData[`${optionsSymbol}-${optionsExpiration}`] ? (
                <div className="options-details">
                  <h3>Options for {optionsSymbol} (Exp: {optionsExpiration})</h3>
                  <pre>{JSON.stringify(optionsData[`${optionsSymbol}-${optionsExpiration}`], null, 2)}</pre>
                  {/* You would parse and display calls/puts in a table here */}
                </div>
              ) : (
                <p>Enter a symbol and expiration to view options data.</p>
              )
            )}
          </div>
        )}

        {/* AI Chat Tab */}
        {activeTab === 'chat' && (
          <div className="tab-content chat-tab">
            <h2>AI Assistant</h2>
            <div className="chat-window">
              {chatHistory.map((msg, index) => (
                <div key={index} className={`chat-message ${msg.role}`}>
                  <strong>{msg.role === 'user' ? 'You:' : 'Rolo:'}</strong> {msg.content}
                </div>
              ))}
              {isLoadingChat && <div className="chat-message ai"><strong>Rolo:</strong> Typing...</div>}
            </div>
            <div className="chat-input-group">
              <input
                type="text"
                placeholder="Ask Rolo a question..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={(e) => { if (e.key === 'Enter') handleSendMessage(); }}
              />
              <button onClick={handleSendMessage} disabled={isLoadingChat}>Send</button>
            </div>
          </div>
        )}

        {/* Alerts Tab (Placeholder) */}
        {activeTab === 'alerts' && (
          <div className="tab-content">
            <h2>Real-time Alerts</h2>
            <p>Alerts functionality will go here. Data from `realtime-alerts.js` or `smart-alerts.js`.</p>
            <button onClick={fetchAlertsData}>Fetch Sample Alerts Data</button> {/* For testing the function call */}
            {isLoadingStock && <p>Loading alerts...</p>}
            {/* Display alerts data */}
          </div>
        )}

        {/* Plays Tab (Placeholder) */}
        {activeTab === 'plays' && (
          <div className="tab-content">
            <h2>Smart Plays Generator</h2>
            <p>Generated trading plays will appear here. Data from `smart-plays-generator.js`.</p>
            <button onClick={fetchPlaysData}>Generate Sample Plays</button> {/* For testing the function call */}
            {isLoadingStock && <p>Generating plays...</p>}
            {/* Display plays data */}
          </div>
        )}
      </main>
    </div>
  );
}

export default RoloApp;
