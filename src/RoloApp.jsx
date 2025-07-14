import React, { useState, useEffect, useCallback, useRef } from 'react';

// Helper function to format currency
const formatCurrency = (value) => {
  if (value === null || value === undefined) return 'N/A';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
};

// Helper function to format percentage
const formatPercentage = (value) => {
  if (value === null || value === undefined) return 'N/A';
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
};

// Function to detect if running in Canvas preview environment
const isCanvasPreview = () => {
  // Check for common patterns in Canvas preview URLs
  const hostname = window.location.hostname;
  return hostname.includes('scf.usercontent.goog') || hostname.includes('web.dev') || hostname.includes('localhost:8080');
};

// Mock Data for Canvas Preview
const mockStockData = {
  AAPL: { price: 175.00, change: 1.50, percentChange: 0.86, label: 'Real-time', volume: '120M', high: 176.00, low: 173.00, open: 174.00, updatedAt: new Date().toLocaleTimeString() },
  MSFT: { price: 420.50, change: -2.10, percentChange: -0.50, label: 'Pre-Market', volume: '80M', high: 422.00, low: 418.00, open: 421.00, updatedAt: new Date().toLocaleTimeString() },
  GOOGL: { price: 180.25, change: 0.75, percentChange: 0.42, label: 'After Hours', volume: '50M', high: 181.00, low: 179.50, open: 179.75, updatedAt: new Date().toLocaleTimeString() },
  AMZN: { price: 190.10, change: 3.20, percentChange: 1.71, label: 'Real-time', volume: '90M', high: 191.00, low: 188.00, open: 187.00, updatedAt: new Date().toLocaleTimeString() },
  TSLA: { price: 185.70, change: -0.90, percentChange: -0.48, label: 'Futures Open', volume: '150M', high: 187.00, low: 184.50, open: 186.00, updatedAt: new Date().toLocaleTimeString() },
  NVDA: { price: 1200.00, change: 15.00, percentChange: 1.27, label: 'Real-time', volume: '70M', high: 1205.00, low: 1190.00, open: 1195.00, updatedAt: new Date().toLocaleTimeString() },
  META: { price: 500.00, change: 5.00, percentChange: 1.01, label: 'Real-time', volume: '60M', high: 502.00, low: 497.00, open: 498.00, updatedAt: new Date().toLocaleTimeString() },
  NFLX: { price: 650.00, change: -3.00, percentChange: -0.46, label: 'Real-time', volume: '40M', high: 652.00, low: 648.00, open: 651.00, updatedAt: new Date().toLocaleTimeString() },
  AMD: { price: 170.00, change: 2.00, percentChange: 1.19, label: 'Real-time', volume: '100M', high: 171.00, low: 168.00, open: 169.00, updatedAt: new Date().toLocaleTimeString() },
};

const mockMarketOverview = {
  indices: [
    { name: 'S&P 500', value: 5500.25, change: 15.30, percentChange: 0.28 },
    { name: 'Dow Jones', value: 39500.10, change: -50.20, percentChange: -0.13 },
    { name: 'Nasdaq Comp', value: 18000.50, change: 80.70, percentChange: 0.45 },
    { name: 'Russell 2000', value: 2100.30, change: 5.10, percentChange: 0.24 },
    { name: 'VIX', value: 12.50, change: -0.20, percentChange: -1.57 },
  ],
  economicIndicators: [
    { name: '10-Year Yield', value: '4.25%', change: -0.02, percentChange: -0.47 },
    { name: 'Oil (WTI)', value: '$85.20', change: 1.10, percentChange: 1.31 },
    { name: 'Gold', value: '$2350.00', change: -5.00, percentChange: -0.21 },
  ],
  futures: [
    { name: 'ES Futures', value: 5505.00, change: 10.00, percentChange: 0.18 },
    { name: 'NQ Futures', value: 18020.00, change: 40.00, percentChange: 0.22 },
  ]
};

const mockAIAnalysis = {
  title: "Example AI Analysis for AAPL",
  summary: "Apple (AAPL) shows strong momentum driven by upcoming product announcements and robust services growth. Technical indicators suggest a bullish trend, but watch for potential short-term pullbacks.",
  technicalAnalysis: "AAPL is trading above its 50-day and 200-day moving averages, indicating a strong uptrend. RSI is at 65, suggesting it's not yet overbought. MACD shows a bullish crossover. Support at $170, resistance at $180.",
  priceLevels: [
    "Support 1: $170.00",
    "Support 2: $165.00",
    "Resistance 1: $180.00",
    "Resistance 2: $185.00",
    "Target Price: $190.00 (within next 3-6 months)"
  ],
  recommendations: [
    "Buy rating: Strong Buy",
    "Entry Zone: $172 - $175",
    "Stop Loss: $169.50",
    "Take Profit 1: $179.00",
    "Take Profit 2: $184.50"
  ],
  riskFactors: "Potential risks include increased regulatory scrutiny, supply chain disruptions, and a slowdown in consumer spending. Competition in the tech sector remains high.",
  catalysts: ["New product launches (Vision Pro 2, iPhone 17)", "Services revenue growth", "Share buyback program", "Strong earnings reports"],
  sentiment: "Overall sentiment is bullish, with positive news flow from tech media and analyst upgrades. Social media buzz is moderately positive."
};

const mockSmartPlays = [
  {
    title: "NVDA Breakout on AI News + Social Buzz",
    ticker: "NVDA",
    playType: "options",
    entry: {
      strike: 1210,
      expiration: "2025-08-15",
      optionType: "call"
    },
    confidence: 87,
    reasoning: "NVDA breaking $1200 resistance with 3x normal volume, Twitter mentions up 400%, positive AI regulation news. High institutional buying.",
    socialBuzz: "Reddit WSB mentions spiking, Discord channels very bullish, strong positive sentiment on Stocktwits.",
    catalysts: ["technical_breakout", "social_sentiment", "sector_news", "AI_advancements"]
  },
  {
    title: "MSFT Cloud Growth Momentum Play",
    ticker: "MSFT",
    playType: "stock",
    entry: {
      price: 420.00,
      stopLoss: 415.00
    },
    confidence: 82,
    reasoning: "Microsoft Azure reporting strong growth figures. Analysts raising price targets. Low volatility, good for swing trade.",
    socialBuzz: "Consistent positive mentions across financial news and LinkedIn. No significant negative buzz.",
    catalysts: ["earnings_growth", "cloud_expansion", "analyst_upgrades"]
  }
];

const mockAlerts = [
  { type: 'Price Alert', ticker: 'AAPL', message: 'AAPL crossed $175.00. Current price: $175.10', timestamp: Date.now() - 60000 },
  { type: 'Volume Alert', ticker: 'TSLA', message: 'TSLA volume surged by 200% in last hour. Current volume: 1.5M', timestamp: Date.now() - 120000 },
  { type: 'News Alert', ticker: 'GOOGL', message: 'Google announces new AI partnership. Expect volatility.', timestamp: Date.now() - 300000 },
];

const mockChatResponse = (input) => {
  if (input.toLowerCase().includes('apple') || input.toLowerCase().includes('aapl')) {
    return "Apple (AAPL) is a tech giant known for iPhones, Macs, and its services ecosystem. It has strong brand loyalty and consistent innovation. Recent performance has been robust, driven by services growth and anticipation of new products. Key risks include regulatory pressures and supply chain issues.";
  } else if (input.toLowerCase().includes('market')) {
    return "The overall market sentiment is currently mixed, with tech stocks showing resilience while broader indices consolidate. Inflation data and upcoming Fed announcements are key drivers. Keep an eye on the 10-year Treasury yield and commodity prices.";
  } else if (input.toLowerCase().includes('trading')) {
    return "Trading strategies depend on your risk tolerance and goals. Common strategies include swing trading, day trading, and long-term investing. Always consider technical analysis, fundamental analysis, and market sentiment before making a trade.";
  } else {
    return "I am Rolo AI, your personal trading assistant. I can provide stock analysis, market insights, smart plays, and real-time alerts. How can I help you today?";
  }
};


// Main App Component
const App = () => {
  // State for UI
  const [currentTab, setCurrentTab] = useState('watchlist');
  const [marketStatus, setMarketStatus] = useState('Loading...');
  const [marketStatusColor, setMarketStatusColor] = useState('text-gray-500');

  // Stock Watchlist State
  const [popularStocks, setPopularStocks] = useState(['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA', 'META', 'NFLX', 'AMD']);
  const [newStockSymbol, setNewStockSymbol] = useState('');
  const [stockData, setStockData] = useState({}); // Stores fetched data for watchlist stocks
  const [isLoadingStocks, setIsLoadingStocks] = useState(true);

  // Market Tab State
  const [marketOverview, setMarketOverview] = useState(null);
  const [isLoadingMarket, setIsLoadingMarket] = useState(true);

  // Analysis Tab State
  const [analysisTicker, setAnalysisTicker] = useState('AAPL');
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);

  // Smart Plays Tab State
  const [smartPlays, setSmartPlays] = useState([]);
  const [isLoadingPlays, setIsLoadingPlays] = useState(true);

  // Alerts Tab State
  const [alertsData, setAlertsData] = useState([]);
  const [isLoadingAlerts, setIsLoadingAlerts] = useState(true);

  // Chat Tab State
  const [chatHistory, setChatHistory] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatMessagesEndRef = useRef(null);

  const handleAddStock = () => {
    const symbol = newStockSymbol.trim().toUpperCase();
    if (symbol && !popularStocks.includes(symbol)) {
      const updatedStocks = [...popularStocks, symbol];
      setPopularStocks(updatedStocks);
      setNewStockSymbol('');
    }
  };

  const handleRemoveStock = (symbolToRemove) => {
    const updatedStocks = popularStocks.filter(symbol => symbol !== symbolToRemove);
    setPopularStocks(updatedStocks);
  };

  // --- Market Status Calculation ---
  const updateMarketStatus = useCallback(() => {
    const now = new Date();
    const estOffset = -5; // EST is UTC-5
    const localOffset = now.getTimezoneOffset() / 60; // Local timezone offset in hours
    const estTime = new Date(now.getTime() + (estOffset - localOffset) * 3600 * 1000);

    const dayOfWeek = estTime.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const hour = estTime.getHours();
    const minute = estTime.getMinutes();

    let status = 'Market Closed';
    let color = 'text-gray-500';

    if (dayOfWeek === 0) { // Sunday
      if (hour >= 18) { // Sunday 6 PM EST onwards (Futures Open)
        status = 'Futures Open';
        color = 'text-blue-400';
      } else {
        status = 'Weekend';
        color = 'text-gray-500';
      }
    } else if (dayOfWeek === 6) { // Saturday
      status = 'Weekend';
      color = 'text-gray-500';
    } else { // Weekdays (Monday-Friday)
      if (hour >= 4 && (hour < 9 || (hour === 9 && minute < 30))) {
        status = 'Pre-Market';
        color = 'text-yellow-400';
      } else if ((hour === 9 && minute >= 30) || (hour > 9 && hour < 16)) {
        status = 'Market Open';
        color = 'text-green-400';
      } else if (hour >= 16 && hour < 20) {
        status = 'After Hours';
        color = 'text-purple-400';
      } else {
        status = 'Market Closed';
        color = 'text-gray-500';
      }
    }
    setMarketStatus(status);
    setMarketStatusColor(color);
  }, []);

  useEffect(() => {
    updateMarketStatus();
    const interval = setInterval(updateMarketStatus, 60 * 1000); // Update every minute
    return () => clearInterval(interval);
  }, [updateMarketStatus]);

  // --- Data Fetching Functions (via Netlify Functions or Mock Data) ---

  // Fetches stock data for a given symbol
  const fetchStockData = useCallback(async (symbol) => {
    if (isCanvasPreview()) {
      return mockStockData[symbol] || null;
    }
    try {
      const response = await fetch(`${window.location.origin}/.netlify/functions/enhanced-stock-data?symbol=${symbol}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if (data && data.price && data.label) {
        return {
          symbol: symbol,
          price: data.price,
          change: data.change,
          percentChange: data.percentChange,
          label: data.label,
          volume: data.volume,
          high: data.high,
          low: data.low,
          open: data.open,
          updatedAt: new Date().toLocaleTimeString(),
        };
      }
      console.warn(`No valid data for ${symbol} from enhanced-stock-data.`);
      return null;
    } catch (error) {
      console.error(`Error fetching stock data for ${symbol}:`, error);
      return null;
    }
  }, []);

  // Fetches market overview data
  const fetchMarketOverview = useCallback(async () => {
    setIsLoadingMarket(true);
    if (isCanvasPreview()) {
      setMarketOverview(mockMarketOverview);
      setIsLoadingMarket(false);
      return;
    }
    try {
      const response = await fetch(`${window.location.origin}/.netlify/functions/market-dashboard`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if (data) {
        setMarketOverview(data);
      } else {
        setMarketOverview(null); // Explicitly set to null if no data
      }
    } catch (error) {
      console.error('Error fetching market overview:', error);
      setMarketOverview(null); // Explicitly set to null on error
    } finally {
      setIsLoadingMarket(false);
    }
  }, []);

  // Fetches AI analysis for a ticker
  const fetchAIAnalysis = useCallback(async (ticker) => {
    setIsLoadingAnalysis(true);
    setAiAnalysis(null); // Clear previous analysis
    if (isCanvasPreview()) {
      setAiAnalysis(mockAIAnalysis);
      setIsLoadingAnalysis(false);
      return;
    }
    try {
      const response = await fetch(`${window.location.origin}/.netlify/functions/ai-analysis?ticker=${ticker}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if (data && data.analysis) {
        setAiAnalysis(data.analysis); // Assuming data.analysis contains the structured analysis
      } else {
        setAiAnalysis(null);
      }
    } catch (error) {
      console.error(`Error fetching AI analysis for ${ticker}:`, error);
      setAiAnalysis(null);
    } finally {
      setIsLoadingAnalysis(false);
    }
  }, []);

  // Fetches smart plays from AI
  const fetchSmartPlays = useCallback(async () => {
    setIsLoadingPlays(true);
    setSmartPlays([]); // Clear previous plays
    if (isCanvasPreview()) {
      setSmartPlays(mockSmartPlays);
      setIsLoadingPlays(false);
      return;
    }
    try {
      const response = await fetch(`${window.location.origin}/.netlify/functions/ai-smart-plays`); // Assuming a new function for smart plays
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if (data && Array.isArray(data.plays)) {
        setSmartPlays(data.plays);
      } else {
        setSmartPlays([]);
      }
    } catch (error) {
      console.error('Error fetching smart plays:', error);
      setSmartPlays([]);
    } finally {
      setIsLoadingPlays(false);
    }
  }, []);

  // Fetches alerts
  const fetchAlerts = useCallback(async () => {
    setIsLoadingAlerts(true);
    setAlertsData([]); // Clear previous alerts
    if (isCanvasPreview()) {
      setAlertsData(mockAlerts);
      setIsLoadingAlerts(false);
      return;
    }
    try {
      const response = await fetch(`${window.location.origin}/.netlify/functions/realtime-alerts`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if (data && Array.isArray(data.alerts)) {
        setAlertsData(data.alerts);
      } else {
        setAlertsData([]);
      }
    } catch (error) {
      console.error('Error fetching alerts:', error);
      setAlertsData([]);
    } finally {
      setIsLoadingAlerts(false);
    }
  }, []);

  // --- Effect Hooks for Data Refresh ---

  // Fetch stock data for popular stocks
  useEffect(() => {
    const loadStockData = async () => {
      setIsLoadingStocks(true);
      const newStockData = {};
      for (const symbol of popularStocks) {
        const data = await fetchStockData(symbol);
        if (data) {
          newStockData[symbol] = data;
        }
      }
      setStockData(newStockData);
      setIsLoadingStocks(false);
    };

    if (popularStocks.length > 0) {
      loadStockData();
      // Refresh every 30 seconds during market hours, or less frequently otherwise
      const refreshInterval = setInterval(() => {
        loadStockData();
      }, 30 * 1000); // 30 seconds
      return () => clearInterval(refreshInterval);
    } else {
      setStockData({});
      setIsLoadingStocks(false);
    }
  }, [popularStocks, fetchStockData]);


  // Fetch market overview data
  useEffect(() => {
    fetchMarketOverview();
    const interval = setInterval(fetchMarketOverview, 5 * 60 * 1000); // Refresh every 5 minutes
    return () => clearInterval(interval);
  }, [fetchMarketOverview]);

  // Fetch smart plays hourly during market hours
  useEffect(() => {
    let interval;
    const checkAndFetchPlays = () => {
      const now = new Date();
      const estOffset = -5;
      const localOffset = now.getTimezoneOffset() / 60;
      const estTime = new Date(now.getTime() + (estOffset - localOffset) * 3600 * 1000);
      const dayOfWeek = estTime.getDay();
      const hour = estTime.getHours();

      // Fetch smart plays only on weekdays during market hours (e.g., 9 AM - 5 PM EST)
      if (dayOfWeek >= 1 && dayOfWeek <= 5 && hour >= 9 && hour < 17) {
        fetchSmartPlays();
      }
    };

    checkAndFetchPlays(); // Initial fetch
    interval = setInterval(checkAndFetchPlays, 60 * 60 * 1000); // Check every hour
    return () => clearInterval(interval);
  }, [fetchSmartPlays]);

  // Fetch alerts
  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 2 * 60 * 1000); // Refresh every 2 minutes
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  // --- Chat Functionality ---
  useEffect(() => {
    chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMessage = { role: 'user', text: chatInput };
    setChatHistory((prev) => [...prev, userMessage]);
    setChatInput('');
    setIsChatLoading(true);

    if (isCanvasPreview()) {
      setTimeout(() => {
        setChatHistory((prev) => [...prev, { role: 'ai', text: mockChatResponse(userMessage.text) }]);
        setIsChatLoading(false);
      }, 500); // Simulate network delay
      return;
    }

    try {
      const response = await fetch(`${window.location.origin}/.netlify/functions/enhanced-rolo-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatHistory: [...chatHistory, userMessage] }), // Send full history
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data && data.response) {
        setChatHistory((prev) => [...prev, { role: 'ai', text: data.response }]);
      } else {
        setChatHistory((prev) => [...prev, { role: 'ai', text: 'Sorry, I could not get a response.' }]);
      }
    } catch (error) {
      console.error('Error fetching chat response:', error);
      setChatHistory((prev) => [...prev, { role: 'ai', text: 'Error: Could not connect to AI. Please try again.' }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // --- Render Functions for Tabs ---

  const renderWatchlist = () => (
    <div className="p-4 space-y-4">
      <div className="bg-gray-800 p-4 rounded-xl shadow-lg">
        <h2 className="text-xl font-semibold text-white mb-3">Manage Watchlist</h2>
        <div className="flex space-x-2 mb-4">
          <input
            type="text"
            className="flex-grow p-2 rounded-lg bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Add stock symbol (e.g., AAPL)"
            value={newStockSymbol}
            onChange={(e) => setNewStockSymbol(e.target.value)}
            onKeyPress={(e) => { if (e.key === 'Enter') handleAddStock(); }}
          />
          <button
            onClick={handleAddStock}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition duration-200"
          >
            Add
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {popularStocks.map((symbol) => (
            <div key={symbol} className="bg-blue-700 text-white px-3 py-1 rounded-full flex items-center space-x-1">
              <span>{symbol}</span>
              <button onClick={() => handleRemoveStock(symbol)} className="ml-1 text-sm font-bold opacity-75 hover:opacity-100">
                &times;
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-gray-800 p-4 rounded-xl shadow-lg">
        <h2 className="text-xl font-semibold text-white mb-3">Popular Stocks</h2>
        {isLoadingStocks ? (
          <div className="text-center text-gray-400">Loading stock data...</div>
        ) : popularStocks.length === 0 ? (
          <div className="text-center text-gray-400">Your watchlist is empty. Add some stocks!</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {popularStocks.map((symbol) => {
              const data = stockData[symbol];
              const isPositive = data && data.percentChange >= 0;
              const changeColor = isPositive ? 'text-green-400' : 'text-red-400';

              return (
                <div key={symbol} className="bg-gray-700 p-4 rounded-xl shadow-md flex flex-col justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-white">{symbol}</h3>
                    <p className="text-2xl font-bold text-white mt-1">
                      {data ? formatCurrency(data.price) : 'N/A'}
                    </p>
                    <p className={`text-sm ${changeColor}`}>
                      {data ? `${formatCurrency(data.change)} (${formatPercentage(data.percentChange)})` : 'N/A'}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {data ? `Session: ${data.label}` : 'N/A'}
                    </p>
                  </div>
                  <p className="text-xs text-gray-500 mt-2 text-right">
                    {data ? `Updated: ${data.updatedAt}` : ''}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  const renderMarket = () => (
    <div className="p-4 space-y-4">
      <div className="bg-gray-800 p-4 rounded-xl shadow-lg">
        <h2 className="text-xl font-semibold text-white mb-3">Market Overview</h2>
        {isLoadingMarket ? (
          <div className="text-center text-gray-400">Loading market data...</div>
        ) : !marketOverview ? (
          <div className="text-center text-gray-400">No market data available.</div>
        ) : (
          <div className="space-y-4">
            {/* Major Indices */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">Major Indices</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {marketOverview.indices && marketOverview.indices.length > 0 ? (
                  marketOverview.indices.map((index, i) => (
                    <div key={i} className="bg-gray-700 p-3 rounded-lg shadow-sm">
                      <p className="text-md font-bold text-white">{index.name}</p>
                      <p className="text-lg text-white">{formatCurrency(index.value)}</p>
                      <p className={`${index.change >= 0 ? 'text-green-400' : 'text-red-400'} text-sm`}>
                        {formatCurrency(index.change)} ({formatPercentage(index.percentChange)})
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-400">No index data available.</p>
                )}
              </div>
            </div>

            {/* Economic Indicators */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">Economic Indicators</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {marketOverview.economicIndicators && marketOverview.economicIndicators.length > 0 ? (
                  marketOverview.economicIndicators.map((indicator, i) => (
                    <div key={i} className="bg-gray-700 p-3 rounded-lg shadow-sm">
                      <p className="text-md font-bold text-white">{indicator.name}</p>
                      <p className="text-lg text-white">{indicator.value}</p>
                      {indicator.change && (
                        <p className={`${indicator.change >= 0 ? 'text-green-400' : 'text-red-400'} text-sm`}>
                          {indicator.change} ({formatPercentage(indicator.percentChange)})
                        </p>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-gray-400">No economic indicator data available.</p>
                )}
              </div>
            </div>

            {/* Futures */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">Futures</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {marketOverview.futures && marketOverview.futures.length > 0 ? (
                  marketOverview.futures.map((future, i) => (
                    <div key={i} className="bg-gray-700 p-3 rounded-lg shadow-sm">
                      <p className="text-md font-bold text-white">{future.name}</p>
                      <p className="text-lg text-white">{formatCurrency(future.value)}</p>
                      <p className={`${future.change >= 0 ? 'text-green-400' : 'text-red-400'} text-sm`}>
                        {formatCurrency(future.change)} ({formatPercentage(future.percentChange)})
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-400">No futures data available.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderAnalysis = () => (
    <div className="p-4 space-y-4">
      <div className="bg-gray-800 p-4 rounded-xl shadow-lg">
        <h2 className="text-xl font-semibold text-white mb-3">AI Stock Analysis</h2>
        <div className="flex space-x-2 mb-4">
          <input
            type="text"
            className="flex-grow p-2 rounded-lg bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter stock ticker (e.g., AAPL)"
            value={analysisTicker}
            onChange={(e) => setAnalysisTicker(e.target.value.toUpperCase())}
            onKeyPress={(e) => { if (e.key === 'Enter') fetchAIAnalysis(analysisTicker); }}
          />
          <button
            onClick={() => fetchAIAnalysis(analysisTicker)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition duration-200"
            disabled={isLoadingAnalysis}
          >
            {isLoadingAnalysis ? 'Analyzing...' : 'Analyze'}
          </button>
        </div>

        {isLoadingAnalysis ? (
          <div className="text-center text-gray-400">Generating in-depth analysis...</div>
        ) : !aiAnalysis ? (
          <div className="text-center text-gray-400">Enter a ticker to get AI analysis.</div>
        ) : (
          <div className="space-y-4 text-gray-200">
            <h3 className="text-lg font-semibold text-white">{aiAnalysis.title || 'Stock Analysis'}</h3>
            {aiAnalysis.summary && (
              <div>
                <p className="font-semibold text-white">Summary:</p>
                <p>{aiAnalysis.summary}</p>
              </div>
            )}
            {aiAnalysis.technicalAnalysis && (
              <div>
                <p className="font-semibold text-white">Technical Analysis:</p>
                <p>{aiAnalysis.technicalAnalysis}</p>
              </div>
            )}
            {aiAnalysis.priceLevels && (
              <div>
                <p className="font-semibold text-white">Key Price Levels:</p>
                <ul className="list-disc list-inside ml-4">
                  {aiAnalysis.priceLevels.map((level, i) => (
                    <li key={i}>{level}</li>
                  ))}
                </ul>
              </div>
            )}
            {aiAnalysis.recommendations && (
              <div>
                <p className="font-semibold text-white">Recommendations:</p>
                <ul className="list-disc list-inside ml-4">
                  {aiAnalysis.recommendations.map((rec, i) => (
                    <li key={i}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}
            {aiAnalysis.riskFactors && (
              <div>
                <p className="font-semibold text-white">Risk Factors:</p>
                <p>{aiAnalysis.riskFactors}</p>
              </div>
            )}
             {aiAnalysis.catalysts && (
              <div>
                <p className="font-semibold text-white">Catalysts:</p>
                <ul className="list-disc list-inside ml-4">
                  {aiAnalysis.catalysts.map((cat, i) => (
                    <li key={i}>{cat}</li>
                  ))}
                </ul>
              </div>
            )}
             {aiAnalysis.sentiment && (
              <div>
                <p className="font-semibold text-white">Sentiment:</p>
                <p>{aiAnalysis.sentiment}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const renderPlays = () => (
    <div className="p-4 space-y-4">
      <div className="bg-gray-800 p-4 rounded-xl shadow-lg">
        <h2 className="text-xl font-semibold text-white mb-3">AI Smart Plays (Hourly)</h2>
        {isLoadingPlays ? (
          <div className="text-center text-gray-400">Generating smart plays...</div>
        ) : smartPlays.length === 0 ? (
          <div className="text-center text-gray-400">No smart plays available at this time.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {smartPlays.map((play, i) => (
              <div key={i} className="bg-gray-700 p-4 rounded-xl shadow-md space-y-2">
                <h3 className="text-lg font-bold text-white">{play.title} ({play.ticker})</h3>
                <p className="text-sm text-gray-300">Type: {play.playType}</p>
                {play.entry && (
                  <p className="text-sm text-gray-300">
                    Entry: Strike {play.entry.strike}, Exp: {play.entry.expiration}, Type: {play.entry.optionType}
                  </p>
                )}
                <p className="text-sm text-gray-300">Confidence: <span className="font-bold text-blue-400">{play.confidence}%</span></p>
                <p className="text-sm text-gray-300">Reasoning: {play.reasoning}</p>
                {play.socialBuzz && <p className="text-sm text-gray-300">Social Buzz: {play.socialBuzz}</p>}
                {play.catalysts && <p className="text-sm text-gray-300">Catalysts: {play.catalysts.join(', ')}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderAlerts = () => (
    <div className="p-4 space-y-4">
      <div className="bg-gray-800 p-4 rounded-xl shadow-lg">
        <h2 className="text-xl font-semibold text-white mb-3">Real-time Alerts</h2>
        {isLoadingAlerts ? (
          <div className="text-center text-gray-400">Loading alerts...</div>
        ) : alertsData.length === 0 ? (
          <div className="text-center text-gray-400">No new alerts at this time.</div>
        ) : (
          <div className="space-y-3">
            {alertsData.map((alert, i) => (
              <div key={i} className="bg-gray-700 p-3 rounded-xl shadow-sm">
                <p className="text-md font-bold text-white">{alert.type}: {alert.ticker}</p>
                <p className="text-sm text-gray-300">{alert.message}</p>
                <p className="text-xs text-gray-500 mt-1">{new Date(alert.timestamp).toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderChat = () => (
    <div className="flex flex-col h-full p-4">
      <div className="flex-grow overflow-y-auto space-y-4 p-2 bg-gray-800 rounded-xl shadow-lg mb-4">
        {chatHistory.length === 0 && (
          <div className="text-center text-gray-400 mt-10">
            Start a conversation with Rolo AI!
          </div>
        )}
        {chatHistory.map((msg, index) => (
          <div
            key={index}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[70%] p-3 rounded-lg shadow-md ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-none'
                  : 'bg-gray-700 text-gray-100 rounded-bl-none'
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
        {isChatLoading && (
          <div className="flex justify-start">
            <div className="max-w-[70%] p-3 rounded-lg shadow-md bg-gray-700 text-gray-100 rounded-bl-none animate-pulse">
              Rolo AI is typing...
            </div>
          </div>
        )}
        <div ref={chatMessagesEndRef} />
      </div>
      <form onSubmit={handleChatSubmit} className="flex space-x-2">
        <input
          type="text"
          className="flex-grow p-3 rounded-lg bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Ask Rolo AI about stocks, markets, or anything..."
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          disabled={isChatLoading}
        />
        <button
          type="submit"
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-5 rounded-lg transition duration-200"
          disabled={isChatLoading}
        >
          Send
        </button>
      </form>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col text-white font-inter">
      {/* Integrated CSS Styles */}
      <style>{`
        /* General styles for iOS-like feel */
        body {
          margin: 0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
            'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
            sans-serif;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          background-color: #1a202c; /* Dark background */
          color: #e2e8f0; /* Light text for contrast */
        }

        /* Ensure full height for the app container */
        #root {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }

        /* Tailwind CSS (loaded via CDN in index.html) will handle most of the styling.
           This CSS is for custom animations or overrides not easily done with Tailwind. */

        /* Pulsing animation for market status */
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }

        .animate-pulse {
          animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }

        /* Custom scrollbar for chat */
        .overflow-y-auto::-webkit-scrollbar {
          width: 8px;
        }

        .overflow-y-auto::-webkit-scrollbar-track {
          background: #2d3748; /* gray-800 */
          border-radius: 10px;
        }

        .overflow-y-auto::-webkit-scrollbar-thumb {
          background: #4a5568; /* gray-700 */
          border-radius: 10px;
        }

        .overflow-y-auto::-webkit-scrollbar-thumb:hover {
          background: #64748b; /* gray-600 */
        }

        /* Smooth transitions for interactive elements */
        button, input, .rounded-xl, .rounded-lg, .rounded-full {
          transition: all 0.2s ease-in-out;
        }

        /* Prevent text selection on mobile for a more native feel */
        * {
          -webkit-touch-callout: none; /* iOS Safari */
          -webkit-user-select: none;   /* Safari */
          -khtml-user-select: none;    /* Konqueror HTML */
          -moz-user-select: none;      /* Old versions of Firefox */
          -ms-user-select: none;       /* Internet Explorer/Edge */
          user-select: none;           /* Non-prefixed version, currently supported by Chrome, Edge, Opera and Firefox */
        }

        /* Allow text selection specifically for input fields */
        input, textarea {
          -webkit-user-select: text;
          -moz-user-select: text;
          -ms-user-select: text;
          user-select: text;
        }

        /* Ensure images and SVGs are responsive if added */
        img, svg {
          max-width: 100%;
          height: auto;
        }
      `}</style>

      {/* Header */}
      <header className="bg-gradient-to-r from-gray-800 to-gray-700 p-4 shadow-lg flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">Rolo AI</h1>
        <div className="flex items-center space-x-2">
          <span className={`text-sm font-semibold ${marketStatusColor} animate-pulse`}>
            {marketStatus}
          </span>
          {/* Removed User ID display as Firebase is not used */}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow overflow-y-auto pb-20"> {/* Add padding-bottom for nav */}
        {currentTab === 'watchlist' && renderWatchlist()}
        {currentTab === 'market' && renderMarket()}
        {currentTab === 'analysis' && renderAnalysis()}
        {currentTab === 'plays' && renderPlays()}
        {currentTab === 'alerts' && renderAlerts()}
        {currentTab === 'chat' && renderChat()}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 shadow-xl z-50">
        <div className="flex justify-around py-3">
          <TabButton icon="📈" label="Watchlist" isActive={currentTab === 'watchlist'} onClick={() => setCurrentTab('watchlist')} />
          <TabButton icon="📊" label="Market" isActive={currentTab === 'market'} onClick={() => setCurrentTab('market')} />
          <TabButton icon="🧠" label="Analysis" isActive={currentTab === 'analysis'} onClick={() => setCurrentTab('analysis')} />
          <TabButton icon="🎯" label="Plays" isActive={currentTab === 'plays'} onClick={() => setCurrentTab('plays')} />
          <TabButton icon="🔔" label="Alerts" isActive={currentTab === 'alerts'} onClick={() => setCurrentTab('alerts')} />
          <TabButton icon="💬" label="Chat" isActive={currentTab === 'chat'} onClick={() => setCurrentTab('chat')} />
        </div>
      </nav>
    </div>
  );
};

// Reusable Tab Button Component
const TabButton = ({ icon, label, isActive, onClick }) => (
  <button
    className={`flex flex-col items-center text-sm font-medium px-2 py-1 rounded-lg transition-colors duration-200
      ${isActive ? 'text-blue-400 bg-gray-700' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
    onClick={onClick}
  >
    <span className="text-xl mb-1">{icon}</span>
    <span>{label}</span>
  </button>
);

export default App;

