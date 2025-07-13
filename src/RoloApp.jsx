import React, { useState, useEffect } from 'react';

const RoloApp = () => {
  const [activeTab, setActiveTab] = useState('ticker');
  const [searchTicker, setSearchTicker] = useState('');
  const [selectedStock, setSelectedStock] = useState('AAPL');
  const [stockData, setStockData] = useState({});
  const [marketData, setMarketData] = useState({});
  const [analysisData, setAnalysisData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [marketStatus, setMarketStatus] = useState('closed');
  const [chatMessages, setChatMessages] = useState([
    { role: 'ai', content: "Hello! I'm Rolo, your AI trading assistant. How can I help you today?" }
  ]);
  const [chatInput, setChatInput] = useState('');

  const popularStocks = ['AAPL', 'TSLA', 'NVDA', 'SPY', 'QQQ', 'META', 'AMD', 'GOOGL', 'MSFT'];

  // Check market status
  useEffect(() => {
    const checkMarketStatus = () => {
      const now = new Date();
      const hours = now.getUTCHours() - 5; // EST
      const minutes = now.getMinutes();
      const day = now.getDay();
      
      if (day === 0 || day === 6) {
        setMarketStatus('Weekend');
      } else if (hours >= 4 && hours < 9.5) {
        setMarketStatus('Pre-Market');
      } else if (hours >= 9.5 && hours < 16) {
        setMarketStatus('Market Open');
      } else if (hours >= 16 && hours < 20) {
        setMarketStatus('After Hours');
      } else {
        setMarketStatus('Market Closed');
      }
    };
    
    checkMarketStatus();
    const interval = setInterval(checkMarketStatus, 60000);
    return () => clearInterval(interval);
  }, []);

  // Fetch stock data
  const fetchStockData = async (symbol) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/.netlify/functions/enhanced-stock-data?symbol=${symbol}`);
      const data = await response.json();
      if (response.ok) {
        setStockData(prev => ({ ...prev, [symbol]: data }));
        // Generate mock analysis data
        generateAnalysis(symbol, data);
      }
    } catch (error) {
      console.error('Error fetching stock data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Generate analysis (mock for now)
  const generateAnalysis = (symbol, data) => {
    const price = parseFloat(data.price);
    const technicalScore = Math.floor(Math.random() * 30) + 70;
    const rsi = Math.floor(Math.random() * 40) + 30;
    
    setAnalysisData({
      symbol,
      technicalScore,
      rsi,
      support: (price * 0.95).toFixed(2),
      resistance: (price * 1.05).toFixed(2),
      recommendation: technicalScore > 80 ? 'Strong Buy' : 'Buy on dips',
      strategy: 'Butterfly Spread',
      riskLevel: 'Medium'
    });
  };

  // Load initial data
  useEffect(() => {
    if (selectedStock) {
      fetchStockData(selectedStock);
    }
    // Fetch data for popular stocks
    popularStocks.forEach(symbol => {
      if (!stockData[symbol]) {
        fetchStockData(symbol);
      }
    });
  }, [selectedStock]);

  const handleSearch = () => {
    if (searchTicker) {
      setSelectedStock(searchTicker.toUpperCase());
      fetchStockData(searchTicker.toUpperCase());
    }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;
    
    setChatMessages(prev => [...prev, { role: 'user', content: chatInput }]);
    const message = chatInput;
    setChatInput('');
    
    try {
      const response = await fetch('/.netlify/functions/enhanced-rolo-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      const data = await response.json();
      setChatMessages(prev => [...prev, { role: 'ai', content: data.response || 'Sorry, I encountered an error.' }]);
    } catch (error) {
      setChatMessages(prev => [...prev, { role: 'ai', content: 'Sorry, I encountered an error. Please try again.' }]);
    }
  };

  const TabIcon = ({ name, label, isActive }) => {
    const icons = {
      chat: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      ),
      ticker: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      analysis: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
        </svg>
      ),
      plays: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      market: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      alerts: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      )
    };

    return (
      <button
        onClick={() => setActiveTab(name)}
        className={`flex flex-col items-center justify-center py-2 px-3 ${
          isActive ? 'text-blue-500' : 'text-gray-400'
        }`}
      >
        {icons[name]}
        <span className="text-xs mt-1">{label}</span>
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-b from-gray-900 to-black p-4 text-center">
        <h1 className="text-3xl font-bold text-blue-400">Rolo AI</h1>
        <p className="text-gray-400 text-sm">Professional Trading Assistant</p>
        <div className="mt-2 text-xs">
          <span className={`inline-flex items-center px-2 py-1 rounded-full ${
            marketStatus === 'Market Open' ? 'bg-green-900 text-green-300' :
            marketStatus === 'Pre-Market' || marketStatus === 'After Hours' ? 'bg-yellow-900 text-yellow-300' :
            'bg-gray-800 text-gray-400'
          }`}>
            <span className="w-2 h-2 bg-current rounded-full mr-2 animate-pulse"></span>
            {marketStatus}
          </span>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto pb-20">
        {activeTab === 'ticker' && (
          <div className="p-4">
            {/* Search Bar */}
            <div className="mb-6">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchTicker}
                  onChange={(e) => setSearchTicker(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Enter ticker symbol"
                  className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={handleSearch}
                  className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-xl font-semibold transition-colors"
                >
                  Search
                </button>
              </div>
            </div>

            {/* Popular Stocks Grid */}
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-3 flex items-center">
                <span className="mr-2">📈</span> Popular Stocks
              </h2>
              <div className="grid grid-cols-3 gap-3">
                {popularStocks.map(symbol => {
                  const data = stockData[symbol];
                  return (
                    <button
                      key={symbol}
                      onClick={() => setSelectedStock(symbol)}
                      className={`bg-gray-900 border ${
                        selectedStock === symbol ? 'border-blue-500' : 'border-gray-700'
                      } rounded-xl p-3 text-center hover:border-gray-600 transition-all`}
                    >
                      <div className="font-bold">{symbol}</div>
                      {data && (
                        <>
                          <div className="text-sm text-gray-400">${data.price}</div>
                          <div className={`text-xs ${
                            parseFloat(data.change) >= 0 ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {data.changePercent}
                          </div>
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected Stock Details */}
            {selectedStock && stockData[selectedStock] && (
              <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="text-3xl font-bold">{selectedStock}</h2>
                    <p className="text-gray-400 text-sm">{marketStatus}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-green-400">
                      ${stockData[selectedStock].price}
                    </div>
                    <div className={`text-sm ${
                      parseFloat(stockData[selectedStock].change) >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {stockData[selectedStock].change} ({stockData[selectedStock].changePercent})
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-6">
                  <div className="bg-black rounded-xl p-4">
                    <p className="text-gray-400 text-sm">VOLUME</p>
                    <p className="text-xl font-semibold">{stockData[selectedStock].volume}</p>
                  </div>
                  <div className="bg-black rounded-xl p-4">
                    <p className="text-gray-400 text-sm">HIGH</p>
                    <p className="text-xl font-semibold">${stockData[selectedStock].high}</p>
                  </div>
                  <div className="bg-black rounded-xl p-4">
                    <p className="text-gray-400 text-sm">LOW</p>
                    <p className="text-xl font-semibold">${stockData[selectedStock].low}</p>
                  </div>
                  <div className="bg-black rounded-xl p-4">
                    <p className="text-gray-400 text-sm">OPEN</p>
                    <p className="text-xl font-semibold">${stockData[selectedStock].open}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'analysis' && analysisData && (
          <div className="p-4">
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-6 mb-4">
              <h2 className="text-2xl font-bold mb-2">{analysisData.symbol} Analysis</h2>
              <p className="text-gray-400">Technical & Fundamental Overview</p>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-gray-900 rounded-xl p-4 text-center">
                <p className="text-3xl font-bold text-green-400">{analysisData.technicalScore}</p>
                <p className="text-gray-400 text-sm">Technical Score</p>
              </div>
              <div className="bg-gray-900 rounded-xl p-4 text-center">
                <p className="text-3xl font-bold">{analysisData.rsi}</p>
                <p className="text-gray-400 text-sm">RSI</p>
              </div>
              <div className="bg-gray-900 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold">${analysisData.support}</p>
                <p className="text-gray-400 text-sm">Support</p>
              </div>
              <div className="bg-gray-900 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold">${analysisData.resistance}</p>
                <p className="text-gray-400 text-sm">Resistance</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-gray-900 rounded-xl p-4">
                <p className="text-gray-400 text-sm mb-1">Options Strategy</p>
                <p className="text-lg font-semibold">{analysisData.strategy}</p>
              </div>
              <div className="bg-gray-900 rounded-xl p-4">
                <p className="text-gray-400 text-sm mb-1">Risk Level</p>
                <p className="text-lg font-semibold">{analysisData.riskLevel}</p>
              </div>
              <div className="bg-gray-900 rounded-xl p-4">
                <p className="text-gray-400 text-sm mb-1">Recommendation</p>
                <p className="text-lg font-semibold text-green-400">{analysisData.recommendation}</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'chat' && (
          <div className="flex flex-col h-full p-4">
            <div className="flex-1 overflow-y-auto mb-4 space-y-3">
              {chatMessages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-xs px-4 py-3 rounded-2xl ${
                    msg.role === 'user' 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-800 text-gray-200'
                  }`}>
                    {msg.content}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Ask Rolo anything..."
                className="flex-1 bg-gray-900 border border-gray-700 rounded-full px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={handleSendMessage}
                className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-full transition-colors"
              >
                Send
              </button>
            </div>
          </div>
        )}

        {activeTab === 'plays' && (
          <div className="p-4">
            <h2 className="text-2xl font-bold mb-4">Smart Plays</h2>
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-green-900 to-green-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-semibold">🚀 Momentum Play</h3>
                  <span className="bg-green-700 px-2 py-1 rounded text-xs">85% Confidence</span>
                </div>
                <p className="text-sm text-gray-300">NVDA showing strong breakout pattern</p>
                <p className="text-xs text-gray-400 mt-2">Entry: $890 | Target: $920 | Stop: $875</p>
              </div>
              <div className="bg-gradient-to-r from-blue-900 to-blue-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-semibold">💎 Value Pick</h3>
                  <span className="bg-blue-700 px-2 py-1 rounded text-xs">72% Confidence</span>
                </div>
                <p className="text-sm text-gray-300">AAPL oversold on daily timeframe</p>
                <p className="text-xs text-gray-400 mt-2">Entry: $209 | Target: $220 | Stop: $205</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'market' && (
          <div className="p-4">
            <h2 className="text-2xl font-bold mb-4">Market Overview</h2>
            <div className="space-y-3">
              <div className="bg-gray-900 rounded-xl p-4 flex justify-between items-center">
                <div>
                  <p className="font-semibold">S&P 500</p>
                  <p className="text-sm text-gray-400">SPY</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold">$502.34</p>
                  <p className="text-sm text-green-400">+0.82%</p>
                </div>
              </div>
              <div className="bg-gray-900 rounded-xl p-4 flex justify-between items-center">
                <div>
                  <p className="font-semibold">NASDAQ</p>
                  <p className="text-sm text-gray-400">QQQ</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold">$420.15</p>
                  <p className="text-sm text-green-400">+1.24%</p>
                </div>
              </div>
              <div className="bg-gray-900 rounded-xl p-4 flex justify-between items-center">
                <div>
                  <p className="font-semibold">VIX</p>
                  <p className="text-sm text-gray-400">Volatility</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold">16.42</p>
                  <p className="text-sm text-red-400">-2.15%</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'alerts' && (
          <div className="p-4">
            <h2 className="text-2xl font-bold mb-4">Real-time Alerts</h2>
            <div className="space-y-3">
              <div className="bg-yellow-900 bg-opacity-30 border border-yellow-700 rounded-xl p-4">
                <div className="flex items-start">
                  <span className="text-2xl mr-3">⚡</span>
                  <div>
                    <h3 className="font-semibold">Volume Spike Alert</h3>
                    <p className="text-sm text-gray-300">TSLA showing 2x average volume</p>
                    <p className="text-xs text-gray-500 mt-1">2 minutes ago</p>
                  </div>
                </div>
              </div>
              <div className="bg-green-900 bg-opacity-30 border border-green-700 rounded-xl p-4">
                <div className="flex items-start">
                  <span className="text-2xl mr-3">📈</span>
                  <div>
                    <h3 className="font-semibold">Breakout Alert</h3>
                    <p className="text-sm text-gray-300">SPY breaking above resistance at $502</p>
                    <p className="text-xs text-gray-500 mt-1">15 minutes ago</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800">
        <div className="flex justify-around items-center">
          <TabIcon name="chat" label="CHAT" isActive={activeTab === 'chat'} />
          <TabIcon name="ticker" label="TICKER" isActive={activeTab === 'ticker'} />
          <TabIcon name="analysis" label="ANALYSIS" isActive={activeTab === 'analysis'} />
          <TabIcon name="plays" label="PLAYS" isActive={activeTab === 'plays'} />
          <TabIcon name="market" label="MARKET" isActive={activeTab === 'market'} />
          <TabIcon name="alerts" label="ALERTS" isActive={activeTab === 'alerts'} />
        </div>
      </div>
    </div>
  );
};

export default RoloApp;
