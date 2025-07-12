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
        throw new Error(data.error || `HTTP Error: ${response.status}`);
      }
      if (data.Note || data.message?.includes('limited or delayed')) {
        setter(data);
        setError(data.Note || "Data might be limited or delayed.");
      } else {
        setter(data);
      }
    } catch (err) {
      setError(`Failed to fetch data: ${err.message}`);
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
    await fetchData(`/.netlify/functions/enhanced-stock-data?symbol=${symbol}`, (data) => setStockData(prev => ({ ...prev, [symbol]: data })), setIsLoadingStock);
  };

  const fetchMarketData = async () => {
    await fetchData(`/.netlify/functions/market-dashboard`, setMarketData, setIsLoadingMarket);
  };

  const fetchOptionsData = async (symbol, expiration) => {
    if (!symbol || !expiration) {
      setError("Please enter a symbol and expiration date.");
      return;
    }
    await fetchData(`/.netlify/functions/options-data?symbol=${symbol}&expiration=${expiration}`, (data) => setOptionsData(prev => ({ ...prev, [`${symbol}-${expiration}`]: data })), setIsLoadingOptions);
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;
    const userMessage = { role: 'user', content: chatInput.trim() };
    setChatHistory(prev => [...prev, userMessage]);
    setChatInput('');
    setIsLoadingChat(true);
    try {
      const response = await fetch('/.netlify/functions/enhanced-rolo-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: chatInput.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'AI error');
      setChatHistory(prev => [...prev, { role: 'ai', content: data.response }]);
    } catch (err) {
      setError(`Chat error: ${err.message}`);
      setChatHistory(prev => [...prev, { role: 'ai', content: `Error: ${err.message}` }]);
    } finally {
      setIsLoadingChat(false);
    }
  };

  const fetchAlertsData = async () => {
    setIsLoadingStock(true);
    try {
      const response = await fetch('/.netlify/functions/realtime-alerts');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Alerts error');
      if (data.alerts?.length) {
        setChatHistory(prev => [...prev, { role: 'ai', content: `**Alerts:**\n${data.alerts.map(a => `• ${a.title}`).join('\n')}` }]);
      } else {
        setChatHistory(prev => [...prev, { role: 'ai', content: 'No alerts.' }]);
      }
    } catch (err) {
      setError(`Alerts error: ${err.message}`);
      setChatHistory(prev => [...prev, { role: 'ai', content: `Error: ${err.message}` }]);
    } finally {
      setIsLoadingStock(false);
    }
  };

  const fetchPlaysData = async () => {
    setIsLoadingStock(true);
    try {
      const response = await fetch('/.netlify/functions/smart-plays-generator');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Plays error');
      if (data.plays?.length) {
        setChatHistory(prev => [...prev, { role: 'ai', content: `**Plays:**\n${data.plays.map(p => `• ${p.title}`).join('\n')}` }]);
      } else {
        setChatHistory(prev => [...prev, { role: 'ai', content: 'No plays.' }]);
      }
    } catch (err) {
      setError(`Plays error: ${err.message}`);
      setChatHistory(prev => [...prev, { role: 'ai', content: `Error: ${err.message}` }]);
    } finally {
      setIsLoadingStock(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'market') fetchMarketData();
    else if (activeTab === 'alerts') fetchAlertsData();
    else if (activeTab === 'plays') fetchPlaysData();
    else if (activeTab === 'chat') {
      const chatWindow = document.querySelector('.chat-window');
      if (chatWindow) chatWindow.scrollTop = chatWindow.scrollHeight;
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'ticker' && currentTicker && !stockData[currentTicker]) fetchStockData(currentTicker);
  }, [activeTab, currentTicker]);

  useEffect(() => {
    const chatWindow = document.querySelector('.chat-window');
    if (chatWindow) chatWindow.scrollTop = chatWindow.scrollHeight;
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
              <input type="text" placeholder="Enter stock symbol (e.g., AAPL)" value={currentTicker} onChange={(e) => setCurrentTicker(e.target.value.toUpperCase())} onKeyPress={(e) => e.key === 'Enter' && fetchStockData(currentTicker)} />
              <button onClick={() => fetchStockData(currentTicker)}>Get Stock Data</button>
            </div>
            {isLoadingStock ? <p>Loading...</p> : stockData[currentTicker]?.symbol ? (
              <div className="stock-details">
                <h3>{stockData[currentTicker].symbol}</h3>
                <p>Price: ${stockData[currentTicker].price || 'N/A'}</p>
                <p>Change: {stockData[currentTicker].change || 'N/A'} ({stockData[currentTicker].changePercent || 'N/A'})</p>
                <p>Volume: {stockData[currentTicker].volume || 'N/A'}</p>
                <p>High: ${stockData[currentTicker].high || 'N/A'}</p>
                <p>Low: ${stockData[currentTicker].low || 'N/A'}</p>
                <p>Open: ${stockData[currentTicker].open || 'N/A'}</p>
                <p>Previous Close: ${stockData[currentTicker].previousClose || 'N/A'}</p>
                <p>Last Updated: {stockData[currentTicker].lastUpdated || 'N/A'}</p>
              </div>
            ) : <p>Enter a symbol to view data.</p>}
          </div>
        )}
        {activeTab === 'market' && (
          <div className="tab-content">
            <h2>Market Overview</h2>
            {isLoadingMarket ? <p>Loading...</p> : (
              <div className="market-details">
                {marketData.sp500 && <p><strong>S&P 500 (SPY):</strong> ${marketData.sp500.price} ({marketData.sp500.change} / {marketData.sp500.changePercent})</p>}
                {marketData.dowJones && <p><strong>Dow Jones (DIA):</strong> ${marketData.dowJones.price} ({marketData.dowJones.change} / {marketData.dowJones.changePercent})</p>}
                {marketData.nasdaq && <p><strong>NASDAQ (QQQ):</strong> ${marketData.nasdaq.price} ({marketData.nasdaq.change} / {marketData.nasdaq.changePercent})</p>}
                {marketData.wtiOil && <p><strong>WTI Crude Oil:</strong> ${marketData.wtiOil.price} (as of {marketData.wtiOil.date})</p>}
                {marketData.vix && <p><strong>VIX:</strong> {marketData.vix.message}</p>}
                {!marketData.sp500 && !marketData.dowJones && !marketData.nasdaq && !marketData.wtiOil && !isLoadingMarket && <p>No market data. Refresh tab.</p>}
              </div>
            )}
          </div>
        )}
        {activeTab === 'options' && (
          <div className="tab-content">
            <h2>Options Chain</h2>
            <div className="input-group">
              <input type="text" placeholder="Enter stock symbol (e.g., GOOG)" value={optionsSymbol} onChange={(e) => setOptionsSymbol(e.target.value.toUpperCase())} />
              <input type="date" value={optionsExpiration} onChange={(e) => setOptionsExpiration(e.target.value)} />
              <button onClick={() => fetchOptionsData(optionsSymbol, optionsExpiration)}>Get Options Data</button>
            </div>
            {isLoadingOptions ? <p>Loading...</p> : optionsData[`${optionsSymbol}-${optionsExpiration}`]?.symbol ? (
              <div className="options-details">
                <h3>Options for {optionsSymbol} (Exp: {optionsExpiration})</h3>
                <pre>{JSON.stringify(optionsData[`${optionsSymbol}-${optionsExpiration}`], null, 2)}</pre>
              </div>
            ) : <p>Enter symbol and date for options.</p>}
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
              <input type="text" placeholder="Ask Rolo..." value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()} />
              <button onClick={handleSendMessage} disabled={isLoadingChat}>Send</button>
            </div>
          </div>
        )}
        {activeTab === 'alerts' && (
          <div className="tab-content">
            <h2>Real-time Alerts</h2>
            <button onClick={fetchAlertsData}>Fetch Alerts</button>
            {isLoadingStock && <p>Loading...</p>}
          </div>
        )}
        {activeTab === 'plays' && (
          <div className="tab-content">
            <h2>Smart Plays</h2>
            <button onClick={fetchPlaysData}>Generate Plays</button>
            {isLoadingStock && <p>Loading...</p>}
          </div>
        )}
      </main>
    </div>
  );
}

export default RoloApp;
