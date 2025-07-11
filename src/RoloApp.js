import React, { useState, useEffect } from 'react';
import './App.css';

function RoloApp() {
  const [activeTab, setActiveTab] = useState('chat');
  const [stockData, setStockData] = useState({});
  const [marketData, setMarketData] = useState({});
  const [optionsData, setOptionsData] = useState({});
  const [chatHistory, setChatHistory] = useState([{ role: 'ai', content: "Hello! I'm Rolo, your AI-powered trading assistant. How can I help you today?" }]);
  const [chatInput, setChatInput] = useState('');
  const [currentTicker, setCurrentTicker] = useState('AAPL');
  const [optionsSymbol, setOptionsSymbol] = useState('GOOG');
  const [optionsExpiration, setOptionsExpiration] = useState('');

  const [isLoadingStock, setIsLoadingStock] = useState(false);
  const [isLoadingMarket, setIsLoadingMarket] = useState(false);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const [error, setError] = useState(null);

  const fetchData = async (url, setter, loadingSetter) => {
    loadingSetter(true);
    setError(null);
    try {
      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data.error || `HTTP Error: ${response.status}`;
        console.error("API Error Response:", data);
        throw new Error(errorMessage);
      }

      if (data.Note || data.message?.includes('limited or delayed')) {
        console.warn("API Note/Warning:", data);
        setter(data);
        setError(data.error || data.Note || data.message || "Data might be limited or delayed.");
      } else {
        setter(data);
      }
    } catch (err) {
      console.error("Fetch operation failed:", err);
      setError(`Failed to fetch data: ${err.message}. Please try again.`);
      setter({});
    } finally {
      loadingSetter(false);
    }
  };

  const fetchStockData = async (symbol) => {
    if (!symbol) {
      setError("Please enter a stock symbol.");
      return;
    }
    await fetchData(
      `/.netlify/functions/enhanced-stock-data?symbol=${symbol}`,
      (data) => setStockData(prev => ({ ...prev, [symbol]: data })),
      setIsLoadingStock
    );
  };

  const fetchMarketData = async () => {
    await fetchData(
      `/.netlify/functions/market-dashboard`,
      setMarketData,
      setIsLoadingMarket
    );
  };

  const fetchOptionsData = async (symbol, expiration) => {
    if (!symbol || !expiration) {
      setError("Please enter both a symbol and an expiration date (YYYY-MM-DD) for options.");
      return;
    }
    const formattedExpiration = expiration;
    await fetchData(
      `/.netlify/functions/options-data?symbol=${symbol}&expiration=${formattedExpiration}`,
      (data) => setOptionsData(prev => ({ ...prev, [`${symbol}-${formattedExpiration}`]: data })),
      setIsLoadingOptions
    );
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;

    const userMessage = { role: 'user', content: chatInput.trim() };
    setChatHistory((prev) => [...prev, userMessage]);
    const currentInput = chatInput.trim();
    setChatInput('');

    setIsLoadingChat(true);
    setError(null);

    try {
      const response = await fetch('/.netlify/functions/enhanced-rolo-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: currentInput }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get response from AI.');
      }

      const aiMessage = { role: 'ai', content: data.response };
      setChatHistory((prev) => [...prev, aiMessage]);
    } catch (err) {
      console.error('AI chat error:', err);
      setError(`AI Chat Error: ${err.message}`);
      setChatHistory((prev) => [...prev, { role: 'ai', content: `Error: ${err.message}. Please check API key.` }]);
    } finally {
      setIsLoadingChat(false);
    }
  };

  const fetchAlertsData = async () => {
    setIsLoadingStock(true);
    setError(null);
    try {
      const response = await fetch('/.netlify/functions/realtime-alerts');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to fetch alerts.');
      if (data.alerts && data.alerts.length > 0) {
        setChatHistory(prev => [...prev, { role: 'ai', content: `**New Alerts:**\n${data.alerts.map(a => `• ${a.title}: ${a.description}`).join('\n')}` }]);
      } else {
        setChatHistory(prev => [...prev, { role: 'ai', content: "No real-time alerts at the moment." }]);
      }
      console.log("Alerts Data:", data);
    } catch (err) {
      setError(`Alerts Error: ${err.message}`);
      setChatHistory(prev => [...prev, { role: 'ai', content: `Alerts Error: ${err.message}. Check Netlify logs.` }]);
      console.error("Alerts Fetch Error:", err);
    } finally {
      setIsLoadingStock(false);
    }
  };

  const fetchPlaysData = async () => {
    setIsLoadingStock(true);
    setError(null);
    try {
      const response = await fetch('/.netlify/functions/smart-plays-generator');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to fetch plays.');
      if (data.plays && data.plays.length > 0) {
        setChatHistory(prev => [...prev, { role: 'ai', content: `**New Smart Plays:**\n${data.plays.map(p => `• ${p.title} (${p.ticker}): ${p.description}`).join('\n')}` }]);
      } else {
        setChatHistory(prev => [...prev, { role: 'ai', content: "No smart trading plays generated yet." }]);
      }
      console.log("Plays Data:", data);
    } catch (err) {
      setError(`Plays Error: ${err.message}`);
      setChatHistory(prev => [...prev, { role: 'ai', content: `Plays Error: ${err.message}. Check Netlify logs.` }]);
      console.error("Plays Fetch Error:", err);
    } finally {
      setIsLoadingStock(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'market') {
      fetchMarketData();
    } else if (activeTab === 'alerts') {
      fetchAlertsData();
    } else if (activeTab === 'plays') {
      fetchPlaysData();
    }
    if (activeTab === 'chat') {
      const chatWindow = document.querySelector('.chat-window');
      if (chatWindow) {
        chatWindow.scrollTop = chatWindow.scrollHeight;
      }
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'ticker' && currentTicker && !stockData[currentTicker]) {
      fetchStockData(currentTicker);
    }
  }, [activeTab, currentTicker, stockData]);

  useEffect(() => {
    const chatWindow = document.querySelector('.chat-window');
    if (chatWindow) {
      chatWindow.scrollTop = chatWindow.scrollHeight;
    }
  }, [chatHistory]);

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
              stockData[currentTicker] && stockData[currentTicker].symbol ? (
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
                </div>
              ) : (
                <p>Enter a symbol to view its data.</p>
              )
            )}
          </div>
        )}

        {activeTab === 'market' && (
          <div className="tab-content">
            <h2>Market Overview</h2>
            {isLoadingMarket ? (
              <p>Loading market data...</p>
            ) : (
              <div className="market-details">
                {marketData.sp500 && <p><strong>S&P 500 (SPY):</strong> ${marketData.sp500.price} ({marketData.sp500.change} / {marketData.sp500.changePercent})</p>}
                {marketData.dowJones && <p><strong>Dow Jones (DIA):</strong> ${marketData.dowJones.price} ({marketData.dowJones.change} / {marketData.dowJones.changePercent})</p>}
                {marketData.nasdaq && <p><strong>NASDAQ (QQQ):</strong> ${marketData.nasdaq.price} ({marketData.nasdaq.change} / {marketData.nasdaq.changePercent})</p>}
                {marketData.wtiOil && <p><strong>WTI Crude Oil:</strong> ${marketData.wtiOil.price} (as of {marketData.wtiOil.date})</p>}
                {marketData.vix && <p><strong>VIX:</strong> {marketData.vix.message}</p>}
                {!marketData.sp500 && !marketData.dowJones && !marketData.nasdaq && !marketData.wtiOil && !isLoadingMarket && <p>No market data available. Click "Market" tab to refresh.</p>}
              </div>
            )}
          </div>
        )}

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
                type="date"
                value={optionsExpiration}
                onChange={(e) => setOptionsExpiration(e.target.value)}
              />
              <button onClick={() => fetchOptionsData(optionsSymbol, optionsExpiration)}>Get Options Data</button>
            </div>
            {isLoadingOptions ? (
              <p>Loading options data...</p>
            ) : (
              optionsData[`${optionsSymbol}-${optionsExpiration}`] && optionsData[`${optionsSymbol}-${optionsExpiration}`].symbol ? (
                <div className="options-details">
                  <h3>Options for {optionsSymbol} (Exp: {optionsExpiration})</h3>
                  <pre>{JSON.stringify(optionsData[`${optionsSymbol}-${optionsExpiration}`], null, 2)}</pre>
                </div>
              ) : (
                <p>Enter a symbol and expiration to view options data.</p>
              )
            )}
          </div>
        )}

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

        {activeTab === 'alerts' && (
          <div className="tab-content">
            <h2>Real-time Alerts</h2>
            <p>Alerts functionality will go here. Data from `realtime-alerts.js` or `smart-alerts.js`.</p>
            <button onClick={fetchAlertsData}>Fetch Sample Alerts Data</button>
            {isLoadingStock && <p>Loading alerts...</p>}
          </div>
        )}

        {activeTab === 'plays' && (
          <div className="tab-content">
            <h2>Smart Plays Generator</h2>
            <p>Generated trading plays will appear here. Data from `smart-plays-generator.js`.</p>
            <button onClick={fetchPlaysData}>Generate Sample Plays</button>
            {isLoadingStock && <p>Generating plays...</p>}
          </div>
        )}
      </main>
    </div>
  );
}

export default RoloApp;
