import React, { useState, useEffect, useRef } from 'react';

// Main App component
const App = () => {
  // State variables for managing application data and UI
  const [selectedTab, setSelectedTab] = useState('home'); // Controls which tab is active
  const [stockData, setStockData] = useState(null); // Stores data for the currently selected stock
  const [marketStatus, setMarketStatus] = useState('Loading...'); // Displays current market session (e.g., Market Open, Pre-Market)
  const [analysisData, setAnalysisData] = useState(null); // Stores AI analysis results
  const [smartPlays, setSmartPlays] = useState([]); // Stores AI-generated smart plays
  const [marketOverview, setMarketOverview] = useState(null); // Stores major market indices data
  const [economicIndicators, setEconomicIndicators] = useState(null); // Stores economic data
  const [technicalIndicators, setTechnicalIndicators] = useState(null); // Stores technical indicator data
  const [alerts, setAlerts] = useState([]); // Stores real-time alerts
  const [chatHistory, setChatHistory] = useState([]); // Stores conversation history with the AI
  const [chatInput, setChatInput] = useState(''); // Input field for AI chat
  const [loading, setLoading] = useState(false); // General loading indicator
  const [error, setError] = useState(null); // Stores any error messages
  const [favoriteStocks, setFavoriteStocks] = useState(['AAPL', 'MSFT', 'GOOGL']); // User's favorite stocks
  const [newFavoriteTicker, setNewFavoriteTicker] = useState(''); // Input for adding new favorites
  const chatContainerRef = useRef(null); // Ref for auto-scrolling chat

  // Popular stocks for initial display
  const popularStocks = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA', 'META', 'NFLX', 'AMD'];

  // --- Utility Functions ---

  // Function to determine market session based on time
  const getMarketSession = () => {
    const now = new Date();
    const estOffset = -5 * 60; // EST is UTC-5
    const utc = now.getTime() + (now.getTimezoneOffset() * 60 * 1000);
    const est = new Date(utc + (estOffset * 60 * 1000));

    const dayOfWeek = est.getDay(); // 0 for Sunday, 6 for Saturday
    const hour = est.getHours();
    const minute = est.getMinutes();

    // Weekend
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      if (dayOfWeek === 0 && hour >= 18) { // Sunday 6 PM EST onwards, futures might be open
        return 'Futures Open';
      }
      return 'Weekend';
    }

    // Pre-Market: 4:00 AM - 9:30 AM EST
    if (hour > 4 || (hour === 4 && minute >= 0)) {
      if (hour < 9 || (hour === 9 && minute < 30)) {
        return 'Pre-Market';
      }
    }

    // Market Open: 9:30 AM - 4:00 PM EST
    if ((hour > 9 || (hour === 9 && minute >= 30)) && (hour < 16 || (hour === 16 && minute === 0))) {
      return 'Market Open';
    }

    // After Hours: 4:00 PM - 8:00 PM EST
    if ((hour > 16 || (hour === 16 && minute > 0)) && (hour < 20 || (hour === 20 && minute === 0))) {
      return 'After Hours';
    }

    // Default to Market Closed if outside defined hours
    return 'Market Closed';
  };

  // --- Data Fetching Functions ---

  // Fetches stock data (real-time, pre-market, after-hours)
  const fetchStockData = async (symbol) => {
    setLoading(true);
    setError(null);
    try {
      const url = `${window.location.origin}/.netlify/functions/enhanced-stock-data?symbol=${symbol}`;
      console.log('Fetching stock data from:', url); // Log the URL
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if (data && data.price && data.change) { // Ensure essential data exists
        setStockData({ ...data, symbol });
      } else {
        setStockData(null); // Clear data if incomplete
        setError(`No live stock data available for ${symbol}.`);
      }
    } catch (err) {
      console.error(`Error fetching stock data for ${symbol}:`, err);
      setError(`Failed to fetch stock data for ${symbol}. Please ensure your Netlify function 'enhanced-stock-data' is deployed and accessible.`);
      setStockData(null);
    } finally {
      setLoading(false);
    }
  };

  // Fetches AI analysis for a given stock
  const fetchAIAnalysis = async (symbol) => {
    setLoading(true);
    setError(null);
    try {
      const url = `${window.location.origin}/.netlify/functions/ai-analysis?symbol=${symbol}`;
      console.log('Fetching AI analysis from:', url); // Log the URL
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if (data && data.analysis) { // Ensure analysis content exists
        setAnalysisData(data.analysis);
      } else {
        setAnalysisData(null);
        setError(`No AI analysis available for ${symbol}.`);
      }
    } catch (err) {
      console.error(`Error fetching AI analysis for ${symbol}:`, err);
      setError(`Failed to fetch AI analysis for ${symbol}. Please ensure your Netlify function 'ai-analysis' is deployed and accessible.`);
      setAnalysisData(null);
    } finally {
      setLoading(false);
    }
  };

  // Fetches smart plays from AI
  const fetchSmartPlays = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = `${window.location.origin}/.netlify/functions/ai-analysis?type=smartPlays`; // Assuming ai-analysis can also give smart plays
      console.log('Fetching smart plays from:', url); // Log the URL
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if (data && data.smartPlays && Array.isArray(data.smartPlays) && data.smartPlays.length > 0) {
        setSmartPlays(data.smartPlays);
      } else {
        setSmartPlays([]);
        setError(`No smart plays available.`);
      }
    } catch (err) {
      console.error("Error fetching smart plays:", err);
      setError("Failed to fetch smart plays. Please ensure your Netlify function 'ai-analysis' is deployed and accessible.");
      setSmartPlays([]);
    } finally {
      setLoading(false);
    }
  };


  // Fetches market overview data (indices, futures)
  const fetchMarketOverview = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = `${window.location.origin}/.netlify/functions/market-dashboard`;
      console.log('Fetching market overview from:', url); // Log the URL
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if (data && data.majorIndices && data.futures) {
        setMarketOverview(data);
      } else {
        setMarketOverview(null);
        setError(`No market overview data available.`);
      }
    } catch (err) {
      console.error("Error fetching market overview:", err);
      setError("Failed to fetch market overview. Please ensure your Netlify function 'market-dashboard' is deployed and accessible.");
      setMarketOverview(null);
    } finally {
      setLoading(false);
    }
  };

  // Fetches economic indicators
  const fetchEconomicIndicators = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = `${window.location.origin}/.netlify/functions/economic-indicators`;
      console.log('Fetching economic indicators from:', url); // Log the URL
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if (data && data.indicators && Array.isArray(data.indicators) && data.indicators.length > 0) {
        setEconomicIndicators(data.indicators);
      } else {
        setEconomicIndicators(null);
        setError(`No economic indicators available.`);
      }
    } catch (err) {
      console.error("Error fetching economic indicators:", err);
      setError("Failed to fetch economic indicators. Please ensure your Netlify function 'economic-indicators' is deployed and accessible.");
      setEconomicIndicators(null);
    } finally {
      setLoading(false);
    }
  };

  // Fetches technical indicators for a symbol
  const fetchTechnicalIndicators = async (symbol) => {
    setLoading(true);
    setError(null);
    try {
      const url = `${window.location.origin}/.netlify/functions/technical-indicators?symbol=${symbol}`;
      console.log('Fetching technical indicators from:', url); // Log the URL
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if (data && data.technicalScore && data.rsi) { // Check for essential indicators
        setTechnicalIndicators(data);
      } else {
        setTechnicalIndicators(null);
        setError(`No technical indicators available for ${symbol}.`);
      }
    } catch (err) {
      console.error(`Error fetching technical indicators for ${symbol}:`, err);
      setError(`Failed to fetch technical indicators for ${symbol}. Please ensure your Netlify function 'technical-indicators' is deployed and accessible.`);
      setTechnicalIndicators(null);
    } finally {
      setLoading(false);
    }
  };

  // Fetches real-time alerts
  const fetchAlerts = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = `${window.location.origin}/.netlify/functions/realtime-alerts`;
      console.log('Fetching alerts from:', url); // Log the URL
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if (data && Array.isArray(data.alerts) && data.alerts.length > 0) {
        setAlerts(data.alerts);
      } else {
        setAlerts([]);
        setError(`No real-time alerts available.`);
      }
    } catch (err) {
      console.error("Error fetching alerts:", err);
      setError("Failed to fetch alerts. Please ensure your Netlify function 'realtime-alerts' is deployed and accessible.");
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  };

  // Sends a message to the AI chat
  const sendChatMessage = async (message) => {
    if (!message.trim()) return;

    const newChatHistory = [...chatHistory, { role: 'user', text: message }];
    setChatHistory(newChatHistory);
    setChatInput('');
    setLoading(true);

    try {
      const url = `${window.location.origin}/.netlify/functions/enhanced-rolo-chat`;
      console.log('Sending chat message to:', url); // Log the URL
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatHistory: newChatHistory }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data && data.response) {
        setChatHistory(prev => [...prev, { role: 'ai', text: data.response }]);
      } else {
        setChatHistory(prev => [...prev, { role: 'ai', text: "Sorry, I couldn't get a response from the AI." }]);
      }
    } catch (err) {
      console.error("Error sending chat message:", err);
      setChatHistory(prev => [...prev, { role: 'ai', text: "Failed to connect to the AI. Please try again later." }]);
      setError("Failed to send chat message. Please ensure your Netlify function 'enhanced-rolo-chat' is deployed and accessible.");
    } finally {
      setLoading(false);
    }
  };

  // --- Effects ---

  // Initial data fetch and interval setup
  useEffect(() => {
    // Set initial market status
    setMarketStatus(getMarketSession());

    // Fetch initial data for Home and Market tabs
    fetchStockData('AAPL'); // Default stock to display on Home
    fetchMarketOverview();
    fetchEconomicIndicators();
    fetchSmartPlays(); // Fetch smart plays for the Plays tab
    fetchAlerts(); // Fetch alerts for the Alerts section

    // Set up interval to update market status and refresh data
    const marketStatusInterval = setInterval(() => {
      setMarketStatus(getMarketSession());
    }, 60 * 1000); // Every minute

    const refreshDataInterval = setInterval(() => {
      // Refresh data based on active tab or importance
      if (selectedTab === 'home' && stockData?.symbol) {
        fetchStockData(stockData.symbol);
      }
      if (selectedTab === 'market') {
        fetchMarketOverview();
        fetchEconomicIndicators();
      }
      if (selectedTab === 'plays') {
        fetchSmartPlays();
      }
      // Always refresh alerts
      fetchAlerts();
    }, 5 * 60 * 1000); // Every 5 minutes for general data refresh

    return () => {
      clearInterval(marketStatusInterval);
      clearInterval(refreshDataInterval);
    };
  }, [selectedTab, stockData?.symbol]); // Re-run effect if selectedTab or current stock symbol changes

  // Effect to fetch AI analysis and technical indicators when a stock is selected for analysis
  useEffect(() => {
    if (selectedTab === 'analysis' && stockData?.symbol) {
      fetchAIAnalysis(stockData.symbol);
      fetchTechnicalIndicators(stockData.symbol);
    }
  }, [selectedTab, stockData?.symbol]);

  // Effect for auto-scrolling chat
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory]);

  // --- Event Handlers ---

  const handleStockSelect = (symbol) => {
    fetchStockData(symbol);
    // If on analysis tab, also fetch analysis for new symbol
    if (selectedTab === 'analysis') {
      fetchAIAnalysis(symbol);
      fetchTechnicalIndicators(symbol);
    }
  };

  const handleAddFavorite = () => {
    const ticker = newFavoriteTicker.trim().toUpperCase();
    if (ticker && !favoriteStocks.includes(ticker)) {
      setFavoriteStocks([...favoriteStocks, ticker]);
      setNewFavoriteTicker('');
    }
  };

  // --- Render Functions for Tabs ---

  const renderHomeTab = () => (
    <div className="p-4 space-y-6">
      {/* Header with Market Status */}
      <div className="flex items-center justify-between bg-zinc-800 p-3 rounded-xl shadow-lg">
        <h2 className="text-xl font-bold text-white">Market Status</h2>
        <div className={`px-4 py-2 rounded-full font-semibold text-sm ${
          marketStatus.includes('Open') ? 'bg-green-600 text-white animate-pulse' :
          marketStatus.includes('Pre-Market') || marketStatus.includes('After Hours') || marketStatus.includes('Futures') ? 'bg-yellow-600 text-white' :
          'bg-red-600 text-white'
        }`}>
          {marketStatus}
        </div>
      </div>

      {/* Current Stock Details */}
      <div className="bg-zinc-800 p-4 rounded-xl shadow-lg">
        {loading && !stockData ? (
          <p className="text-center text-zinc-400">Loading stock data...</p>
        ) : error && !stockData ? (
          <p className="text-center text-red-400">{error}</p>
        ) : stockData ? (
          <>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-3xl font-bold text-white">{stockData.symbol}</h3>
              <span className="text-zinc-400 text-sm">{stockData.session || 'Real-Time'}</span>
            </div>
            <div className="flex items-baseline mb-4">
              <span className="text-5xl font-extrabold text-white mr-2">
                ${parseFloat(stockData.price).toFixed(2)}
              </span>
              <span className={`text-xl font-semibold ${stockData.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {stockData.change >= 0 ? '+' : ''}{parseFloat(stockData.change).toFixed(2)} ({parseFloat(stockData.percentChange).toFixed(2)}%)
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-zinc-300 text-sm">
              <div className="flex justify-between"><span>High:</span><span className="font-medium">${parseFloat(stockData.high).toFixed(2)}</span></div>
              <div className="flex justify-between"><span>Low:</span><span className="font-medium">${parseFloat(stockData.low).toFixed(2)}</span></div>
              <div className="flex justify-between"><span>Open:</span><span className="font-medium">${parseFloat(stockData.open).toFixed(2)}</span></div>
              <div className="flex justify-between"><span>Volume:</span><span className="font-medium">{parseInt(stockData.volume).toLocaleString()}</span></div>
            </div>
          </>
        ) : (
          <p className="text-center text-zinc-400">Select a stock or check API connection.</p>
        )}
      </div>

      {/* Popular Stocks */}
      <div className="bg-zinc-800 p-4 rounded-xl shadow-lg">
        <h3 className="text-xl font-bold text-white mb-4">Popular Stocks</h3>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
          {popularStocks.map(symbol => (
            <button
              key={symbol}
              onClick={() => handleStockSelect(symbol)}
              className="bg-zinc-700 hover:bg-zinc-600 active:bg-zinc-500 text-white py-2 px-3 rounded-lg text-sm font-medium transition-all duration-200 shadow-md"
            >
              {symbol}
            </button>
          ))}
        </div>
      </div>

      {/* Favorite Stocks */}
      <div className="bg-zinc-800 p-4 rounded-xl shadow-lg">
        <h3 className="text-xl font-bold text-white mb-4">Your Watchlist</h3>
        <div className="flex mb-4 space-x-2">
          <input
            type="text"
            placeholder="Add Ticker (e.g., AAPL)"
            className="flex-grow p-2 rounded-lg bg-zinc-700 text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={newFavoriteTicker}
            onChange={(e) => setNewFavoriteTicker(e.target.value)}
            onKeyPress={(e) => { if (e.key === 'Enter') handleAddFavorite(); }}
          />
          <button
            onClick={handleAddFavorite}
            className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white py-2 px-4 rounded-lg font-semibold transition-all duration-200 shadow-md"
          >
            Add
          </button>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
          {favoriteStocks.length > 0 ? (
            favoriteStocks.map(symbol => (
              <button
                key={symbol}
                onClick={() => handleStockSelect(symbol)}
                className="bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white py-2 px-3 rounded-lg text-sm font-medium transition-all duration-200 shadow-md"
              >
                {symbol}
              </button>
            ))
          ) : (
            <p className="col-span-full text-center text-zinc-400">No stocks in your watchlist. Add some!</p>
          )}
        </div>
      </div>

      {/* Alerts Section */}
      <div className="bg-zinc-800 p-4 rounded-xl shadow-lg">
        <h3 className="text-xl font-bold text-white mb-4">Real-time Alerts</h3>
        {loading && !alerts.length ? (
          <p className="text-center text-zinc-400">Loading alerts...</p>
        ) : error && !alerts.length ? (
          <p className="text-center text-red-400">{error}</p>
        ) : alerts.length > 0 ? (
          <div className="space-y-3">
            {alerts.map((alert, index) => (
              <div key={index} className="bg-zinc-700 p-3 rounded-lg flex items-center space-x-3">
                <span className="text-yellow-400 text-xl">💡</span>
                <p className="text-zinc-200 text-sm">{alert.message}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-zinc-400">No new alerts at the moment.</p>
        )}
      </div>
    </div>
  );

  const renderAnalysisTab = () => (
    <div className="p-4 space-y-6">
      <h2 className="text-2xl font-bold text-white mb-4">AI Analysis & Technicals</h2>

      {stockData?.symbol ? (
        <h3 className="text-xl font-semibold text-white mb-4">Analysis for {stockData.symbol}</h3>
      ) : (
        <p className="text-center text-zinc-400">Select a stock from the Home tab to view analysis.</p>
      )}

      {/* AI Analysis */}
      <div className="bg-zinc-800 p-4 rounded-xl shadow-lg">
        <h3 className="text-xl font-bold text-white mb-4">AI In-depth Analysis</h3>
        {loading && !analysisData ? (
          <p className="text-center text-zinc-400">Generating AI analysis...</p>
        ) : error && !analysisData ? (
          <p className="text-center text-red-400">{error}</p>
        ) : analysisData ? (
          <div className="space-y-4 text-zinc-200">
            {Object.entries(analysisData).map(([key, value]) => (
              <div key={key}>
                <h4 className="font-semibold text-lg text-blue-400 mb-1">{key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</h4>
                <p className="text-sm leading-relaxed">{value}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-zinc-400">No AI analysis available for {stockData?.symbol || 'the selected stock'}.</p>
        )}
      </div>

      {/* Technical Indicators */}
      <div className="bg-zinc-800 p-4 rounded-xl shadow-lg">
        <h3 className="text-xl font-bold text-white mb-4">Technical Indicators</h3>
        {loading && !technicalIndicators ? (
          <p className="text-center text-zinc-400">Loading technical indicators...</p>
        ) : error && !technicalIndicators ? (
          <p className="text-center text-red-400">{error}</p>
        ) : technicalIndicators ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-zinc-200">
            <div className="bg-zinc-700 p-3 rounded-lg text-center">
              <p className="text-xs text-zinc-400">Technical Score</p>
              <p className="text-2xl font-bold text-green-400">{technicalIndicators.technicalScore || 'N/A'}</p>
            </div>
            <div className="bg-zinc-700 p-3 rounded-lg text-center">
              <p className="text-xs text-zinc-400">RSI</p>
              <p className="text-2xl font-bold text-blue-400">{parseFloat(technicalIndicators.rsi).toFixed(2) || 'N/A'}</p>
            </div>
            <div className="bg-zinc-700 p-3 rounded-lg text-center">
              <p className="text-xs text-zinc-400">MACD</p>
              <p className="text-2xl font-bold text-yellow-400">{technicalIndicators.macd || 'N/A'}</p>
            </div>
            <div className="bg-zinc-700 p-3 rounded-lg text-center">
              <p className="text-xs text-zinc-400">SMA (20)</p>
              <p className="text-2xl font-bold text-purple-400">{parseFloat(technicalIndicators.sma20).toFixed(2) || 'N/A'}</p>
            </div>
            <div className="bg-zinc-700 p-3 rounded-lg text-center">
              <p className="text-xs text-zinc-400">SMA (50)</p>
              <p className="text-2xl font-bold text-orange-400">{parseFloat(technicalIndicators.sma50).toFixed(2) || 'N/A'}</p>
            </div>
            <div className="bg-zinc-700 p-3 rounded-lg text-center">
              <p className="text-xs text-zinc-400">Bollinger Bands</p>
              <p className="text-sm font-bold text-teal-400">{technicalIndicators.bollingerBands || 'N/A'}</p>
            </div>
          </div>
        ) : (
          <p className="text-center text-zinc-400">No technical indicators available for {stockData?.symbol || 'the selected stock'}.</p>
        )}
      </div>
    </div>
  );

  const renderPlaysTab = () => (
    <div className="p-4 space-y-6">
      <h2 className="text-2xl font-bold text-white mb-4">AI Smart Plays</h2>
      <div className="bg-zinc-800 p-4 rounded-xl shadow-lg">
        {loading && !smartPlays.length ? (
          <p className="text-center text-zinc-400">Generating smart plays...</p>
        ) : error && !smartPlays.length ? (
          <p className="text-center text-red-400">{error}</p>
        ) : smartPlays.length > 0 ? (
          <div className="space-y-4">
            {smartPlays.map((play, index) => (
              <div key={index} className="bg-zinc-700 p-4 rounded-lg shadow-md">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-xl font-bold text-white">{play.title}</h3>
                  <span className={`text-sm font-semibold px-3 py-1 rounded-full ${
                    play.confidence >= 80 ? 'bg-green-600' : play.confidence >= 60 ? 'bg-yellow-600' : 'bg-red-600'
                  }`}>
                    Confidence: {play.confidence}%
                  </span>
                </div>
                <p className="text-zinc-300 mb-2">Ticker: <span className="font-semibold text-white">{play.ticker}</span></p>
                <p className="text-zinc-300 mb-2">Play Type: <span className="font-semibold text-white">{play.playType}</span></p>
                {play.entry && (
                  <div className="text-zinc-300 text-sm mb-2">
                    <p>Entry: {play.entry.strike ? `Strike $${play.entry.strike}` : ''} {play.entry.expiration ? `Exp: ${play.entry.expiration}` : ''} {play.entry.optionType ? `Type: ${play.entry.optionType}` : ''}</p>
                  </div>
                )}
                <p className="text-zinc-300 text-sm mb-2">Reasoning: {play.reasoning}</p>
                {play.socialBuzz && <p className="text-zinc-300 text-sm mb-2">Social Buzz: {play.socialBuzz}</p>}
                {play.catalysts && <p className="text-zinc-300 text-sm">Catalysts: {play.catalysts.join(', ')}</p>}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-zinc-400">No smart plays available at the moment.</p>
        )}
      </div>
    </div>
  );

  const renderMarketTab = () => (
    <div className="p-4 space-y-6">
      <h2 className="text-2xl font-bold text-white mb-4">Market Overview</h2>

      {/* Major Indices */}
      <div className="bg-zinc-800 p-4 rounded-xl shadow-lg">
        <h3 className="text-xl font-bold text-white mb-4">Major Indices</h3>
        {loading && !marketOverview ? (
          <p className="text-center text-zinc-400">Loading market data...</p>
        ) : error && !marketOverview ? (
          <p className="text-center text-red-400">{error}</p>
        ) : marketOverview?.majorIndices ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {marketOverview.majorIndices.map((index, i) => (
              <div key={i} className="bg-zinc-700 p-3 rounded-lg shadow-sm">
                <p className="font-semibold text-white text-lg">{index.name}</p>
                <p className="text-zinc-300">Price: <span className="font-medium">${parseFloat(index.price).toFixed(2)}</span></p>
                <p className={`font-medium ${index.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {index.change >= 0 ? '+' : ''}{parseFloat(index.change).toFixed(2)} ({parseFloat(index.percentChange).toFixed(2)}%)
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-zinc-400">No major indices data available.</p>
        )}
      </div>

      {/* Futures */}
      <div className="bg-zinc-800 p-4 rounded-xl shadow-lg">
        <h3 className="text-xl font-bold text-white mb-4">Futures</h3>
        {loading && !marketOverview ? (
          <p className="text-center text-zinc-400">Loading futures data...</p>
        ) : error && !marketOverview ? (
          <p className="text-center text-red-400">{error}</p>
        ) : marketOverview?.futures ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {marketOverview.futures.map((future, i) => (
              <div key={i} className="bg-zinc-700 p-3 rounded-lg shadow-sm">
                <p className="font-semibold text-white text-lg">{future.name}</p>
                <p className="text-zinc-300">Price: <span className="font-medium">${parseFloat(future.price).toFixed(2)}</span></p>
                <p className={`font-medium ${future.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {future.change >= 0 ? '+' : ''}{parseFloat(future.change).toFixed(2)} ({parseFloat(future.percentChange).toFixed(2)}%)
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-zinc-400">No futures data available.</p>
        )}
      </div>

      {/* Economic Indicators */}
      <div className="bg-zinc-800 p-4 rounded-xl shadow-lg">
        <h3 className="text-xl font-bold text-white mb-4">Economic Indicators</h3>
        {loading && !economicIndicators ? (
          <p className="text-center text-zinc-400">Loading economic indicators...</p>
        ) : error && !economicIndicators ? (
          <p className="text-center text-red-400">{error}</p>
        ) : economicIndicators?.length > 0 ? (
          <div className="space-y-3">
            {economicIndicators.map((indicator, i) => (
              <div key={i} className="bg-zinc-700 p-3 rounded-lg flex justify-between items-center">
                <div>
                  <p className="font-semibold text-white">{indicator.name}</p>
                  <p className="text-zinc-300 text-sm">{indicator.date}</p>
                </div>
                <p className="text-zinc-200 font-medium">{indicator.value}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-zinc-400">No economic indicators available.</p>
        )}
      </div>
    </div>
  );

  const renderChatTab = () => (
    <div className="flex flex-col h-full p-4">
      <h2 className="text-2xl font-bold text-white mb-4">Chat with Rolo AI</h2>
      <div ref={chatContainerRef} className="flex-grow overflow-y-auto space-y-4 p-3 bg-zinc-800 rounded-xl shadow-lg mb-4">
        {chatHistory.length === 0 ? (
          <p className="text-center text-zinc-400">Start a conversation with Rolo AI!</p>
        ) : (
          chatHistory.map((msg, index) => (
            <div
              key={index}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] p-3 rounded-xl ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-none'
                    : 'bg-zinc-700 text-zinc-100 rounded-bl-none'
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))
        )}
        {loading && (
          <div className="flex justify-start">
            <div className="max-w-[80%] p-3 rounded-xl bg-zinc-700 text-zinc-100 rounded-bl-none">
              <span className="animate-pulse">Typing...</span>
            </div>
          </div>
        )}
      </div>
      <div className="flex space-x-2">
        <input
          type="text"
          placeholder="Ask Rolo AI anything..."
          className="flex-grow p-3 rounded-xl bg-zinc-700 text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === 'Enter' && !loading) {
              sendChatMessage(chatInput);
            }
          }}
          disabled={loading}
        />
        <button
          onClick={() => sendChatMessage(chatInput)}
          className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white p-3 rounded-xl font-semibold transition-all duration-200 shadow-md"
          disabled={loading}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
          </svg>
        </button>
      </div>
    </div>
  );

  // --- Main App Render ---
  return (
    <div className="min-h-screen bg-black text-white flex flex-col font-inter">
      {/* Header */}
      <header className="bg-gradient-to-r from-zinc-900 to-zinc-800 p-4 shadow-lg flex justify-center items-center">
        <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">Rolo AI</h1>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow overflow-y-auto pb-20"> {/* pb-20 to prevent content from being hidden by bottom nav */}
        {selectedTab === 'home' && renderHomeTab()}
        {selectedTab === 'analysis' && renderAnalysisTab()}
        {selectedTab === 'plays' && renderPlaysTab()}
        {selectedTab === 'market' && renderMarketTab()}
        {selectedTab === 'chat' && renderChatTab()}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-zinc-900 border-t border-zinc-700 shadow-xl z-50">
        <div className="flex justify-around items-center h-16">
          <button
            className={`flex flex-col items-center text-xs font-medium transition-colors duration-200 ${selectedTab === 'home' ? 'text-blue-500' : 'text-zinc-400 hover:text-zinc-200'}`}
            onClick={() => setSelectedTab('home')}
          >
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>
            Home
          </button>
          <button
            className={`flex flex-col items-center text-xs font-medium transition-colors duration-200 ${selectedTab === 'analysis' ? 'text-blue-500' : 'text-zinc-400 hover:text-zinc-200'}`}
            onClick={() => setSelectedTab('analysis')}
          >
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0h.01M9 19l3-3m0 0l3 3m-3-3v6m0-6h.01M12 10a2 2 0 012-2h2a2 2 0 012 2v6a2 2 0 01-2 2h-2a2 2 0 01-2-2zm0 0h.01"></path></svg>
            Analysis
          </button>
          <button
            className={`flex flex-col items-center text-xs font-medium transition-colors duration-200 ${selectedTab === 'plays' ? 'text-blue-500' : 'text-zinc-400 hover:text-zinc-200'}`}
            onClick={() => setSelectedTab('plays')}
          >
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
            Plays
          </button>
          <button
            className={`flex flex-col items-center text-xs font-medium transition-colors duration-200 ${selectedTab === 'market' ? 'text-blue-500' : 'text-zinc-400 hover:text-zinc-200'}`}
            onClick={() => setSelectedTab('market')}
          >
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 12l3-3 3 3 4-4M18 14v4a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2h4"></path></svg>
            Market
          </button>
          <button
            className={`flex flex-col items-center text-xs font-medium transition-colors duration-200 ${selectedTab === 'chat' ? 'text-blue-500' : 'text-zinc-400 hover:text-zinc-200'}`}
            onClick={() => setSelectedTab('chat')}
          >
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path></svg>
            Chat
          </button>
        </div>
      </nav>
    </div>
  );
};

export default App;
