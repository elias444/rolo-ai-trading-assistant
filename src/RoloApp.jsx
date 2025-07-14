import React, { useState, useEffect, useRef, useCallback } from 'react';

// Helper function to format currency
const formatCurrency = (value) => {
  if (value === null || value === undefined) return 'N/A';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
};

// Helper function to format percentage
const formatPercentage = (value) => {
  if (value === null || value === undefined) return 'N/A';
  const numValue = parseFloat(value);
  if (isNaN(numValue)) return 'N/A';
  return `${numValue >= 0 ? '+' : ''}${numValue.toFixed(2)}%`;
};

// Main App Component
const App = () => {
  const [activeTab, setActiveTab] = useState('watchlist');
  const [searchTicker, setSearchTicker] = useState('');
  const [selectedStock, setSelectedStock] = useState('AAPL');
  const [stockData, setStockData] = useState({}); // Stores fetched data for watchlist stocks
  const [marketData, setMarketData] = useState({}); // Stores market overview data
  const [analysisData, setAnalysisData] = useState(null); // Stores AI analysis data
  const [smartPlays, setSmartPlays] = useState([]); // Stores smart plays data
  const [newsData, setNewsData] = useState({ articles: [], sentiment: {} }); // Stores news data
  const [technicalData, setTechnicalData] = useState(null); // Stores technical indicators
  const [economicData, setEconomicData] = useState(null); // Stores economic indicators
  const [alerts, setAlerts] = useState([]); // Stores real-time alerts
  const [isLoading, setIsLoading] = useState(false); // General loading state
  const [marketStatus, setMarketStatus] = useState('closed');
  const [marketStatusColor, setMarketStatusColor] = useState('text-gray-500'); // For Tailwind color classes
  const [chatMessages, setChatMessages] = useState([
    { role: 'ai', content: "Hello! I'm Rolo, your AI trading assistant with access to real-time market data, news, and technical analysis. How can I help you today?!" }
  ]);
  const [chatInput, setChatInput] = useState('');
  const smartPlaysIntervalRef = useRef(null);
  const chatMessagesEndRef = useRef(null);

  const popularStocks = ['AAPL', 'TSLA', 'NVDA', 'SPY', 'QQQ', 'META', 'AMD', 'GOOGL', 'MSFT'];

  // --- Market Status Calculation ---
  const updateMarketStatus = useCallback(() => {
    const now = new Date();
    // Adjust to EST (UTC-5). GetUTCHours() gives UTC hour, subtract 5 for EST.
    // Note: This simple calculation doesn't account for Daylight Saving Time.
    // For production, a more robust timezone library would be needed.
    const estHours = now.getUTCHours() - 5;
    const estMinutes = now.getUTCMinutes();
    const dayOfWeek = now.getUTCDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

    let status = 'Market Closed';
    let color = 'text-gray-500'; // Default gray

    // Weekends
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      status = 'Weekend';
      color = 'text-gray-500';
    }
    // Weekdays
    else {
      // Pre-Market: 4:00 AM - 9:30 AM EST
      if (estHours >= 4 && (estHours < 9 || (estHours === 9 && estMinutes < 30))) {
        status = 'Pre-Market';
        color = 'text-yellow-400';
      }
      // Market Open: 9:30 AM - 4:00 PM EST
      else if ((estHours === 9 && estMinutes >= 30) || (estHours > 9 && estHours < 16)) {
        status = 'Market Open';
        color = 'text-green-400';
      }
      // After Hours: 4:00 PM - 8:00 PM EST
      else if (estHours >= 16 && estHours < 20) {
        status = 'After Hours';
        color = 'text-purple-400';
      }
      // Market Closed (outside pre/open/after hours on weekdays)
      else {
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


  // --- Data Fetching Functions ---

  // Fetches stock data for a given symbol
  const fetchStockData = useCallback(async (symbol) => {
    setIsLoading(true);
    try {
      // Ensure absolute URL for Netlify functions
      const response = await fetch(`${window.location.origin}/.netlify/functions/enhanced-stock-data?symbol=${symbol}`);
      const data = await response.json();
      if (response.ok && data) {
        setStockData(prev => ({ ...prev, [symbol]: data }));
      } else {
        console.warn(`No valid data for ${symbol} from enhanced-stock-data.`);
        setStockData(prev => ({ ...prev, [symbol]: null })); // Set to null on no valid data
      }
    } catch (error) {
      console.error(`Error fetching stock data for ${symbol}:`, error);
      setStockData(prev => ({ ...prev, [symbol]: null })); // Set to null on error
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch AI Analysis
  const fetchAIAnalysis = useCallback(async (symbol) => {
    setIsLoading(true);
    try {
      const response = await fetch(`${window.location.origin}/.netlify/functions/ai-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, type: 'analysis' }),
      });
      const data = await response.json();
      if (response.ok && data.analysis) {
        setAnalysisData(data.analysis);
      } else {
        setAnalysisData(null); // Clear analysis on no data
      }
    } catch (error) {
      console.error('Error fetching AI analysis:', error);
      setAnalysisData(null); // Clear analysis on error
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch Smart Plays
  const fetchSmartPlays = useCallback(async () => {
    setIsLoading(true); // Indicate loading for smart plays
    try {
      const response = await fetch(`${window.location.origin}/.netlify/functions/ai-smart-plays`); // Assuming a dedicated function for smart plays
      const data = await response.json();
      if (response.ok && data && Array.isArray(data.plays)) {
        setSmartPlays(data.plays);
      } else {
        setSmartPlays([]); // Clear plays on no data
      }
    } catch (error) {
      console.error('Error fetching smart plays:', error);
      setSmartPlays([]); // Clear plays on error
    } finally {
      setIsLoading(false); // End loading for smart plays
    }
  }, []);

  // Fetch News Data
  const fetchNewsData = useCallback(async (symbol = null) => {
    try {
      const url = `${window.location.origin}/.netlify/functions/news-data${symbol ? `?symbol=${symbol}` : ''}`;
      const response = await fetch(url);
      const data = await response.json();
      if (response.ok && data) {
        setNewsData(data);
      } else {
        setNewsData({ articles: [], sentiment: {} }); // Clear news on no data
      }
    } catch (error) {
      console.error('Error fetching news:', error);
      setNewsData({ articles: [], sentiment: {} }); // Clear news on error
    }
  }, []);

  // Fetch Technical Indicators
  const fetchTechnicalIndicators = useCallback(async (symbol) => {
    try {
      const response = await fetch(`${window.location.origin}/.netlify/functions/technical-indicators?symbol=${symbol}`);
      const data = await response.json();
      if (response.ok && data) {
        setTechnicalData(data);
      } else {
        setTechnicalData(null); // Clear technicals on no data
      }
    } catch (error) {
      console.error('Error fetching technicals:', error);
      setTechnicalData(null); // Clear technicals on error
    }
  }, []);

  // Fetch Market Dashboard
  const fetchMarketDashboard = useCallback(async () => {
    setIsLoading(true); // Indicate loading for market dashboard
    try {
      const response = await fetch(`${window.location.origin}/.netlify/functions/market-dashboard`);
      const data = await response.json();
      if (response.ok && data) {
        setMarketData(data);
      } else {
        setMarketData({}); // Clear market data on no data
      }
    } catch (error) {
      console.error('Error fetching market data:', error);
      setMarketData({}); // Clear market data on error
    } finally {
      setIsLoading(false); // End loading for market dashboard
    }
  }, []);

  // Fetch Economic Indicators
  const fetchEconomicIndicators = useCallback(async () => {
    try {
      const response = await fetch(`${window.location.origin}/.netlify/functions/economic-indicators`);
      const data = await response.json();
      if (response.ok && data) {
        setEconomicData(data);
      } else {
        setEconomicData(null); // Clear economic data on no data
      }
    } catch (error) {
      console.error('Error fetching economic data:', error);
      setEconomicData(null); // Clear economic data on error
    }
  }, []);

  // Fetch Real-time Alerts
  const fetchAlerts = useCallback(async () => {
    setIsLoading(true); // Indicate loading for alerts
    try {
      const response = await fetch(`${window.location.origin}/.netlify/functions/realtime-alerts`);
      const data = await response.json();
      if (response.ok && data && Array.isArray(data.alerts)) {
        setAlerts(data.alerts);
      } else {
        setAlerts([]); // Clear alerts on no data
      }
    } catch (error) {
      console.error('Error fetching alerts:', error);
      setAlerts([]); // Clear alerts on error
    } finally {
      setIsLoading(false); // End loading for alerts
    }
  }, []);

  // --- Effect Hooks for Data Refresh ---

  // Load initial data for selected stock and watchlist
  useEffect(() => {
    if (selectedStock) {
      fetchStockData(selectedStock);
      fetchAIAnalysis(selectedStock); // Fetch analysis for selected stock
      fetchTechnicalIndicators(selectedStock);
      fetchNewsData(selectedStock);
    }

    // Fetch data for all popular stocks in the watchlist
    popularStocks.forEach(symbol => {
      fetchStockData(symbol);
    });

    // Set up auto-refresh for watchlist stocks (e.g., every 30 seconds)
    const watchlistRefreshInterval = setInterval(() => {
      popularStocks.forEach(symbol => {
        fetchStockData(symbol);
      });
    }, 30000); // 30 seconds

    return () => clearInterval(watchlistRefreshInterval);
  }, [selectedStock, popularStocks, fetchStockData, fetchAIAnalysis, fetchTechnicalIndicators, fetchNewsData]);


  // Fetch data based on active tab
  useEffect(() => {
    if (activeTab === 'market') {
      fetchMarketDashboard();
      fetchEconomicIndicators();
      // Refresh market data every 5 minutes
      const marketRefreshInterval = setInterval(() => {
        fetchMarketDashboard();
        fetchEconomicIndicators();
      }, 5 * 60 * 1000);
      return () => clearInterval(marketRefreshInterval);
    } else if (activeTab === 'alerts') {
      fetchAlerts();
      // Refresh alerts every 30 seconds
      const alertsRefreshInterval = setInterval(fetchAlerts, 30000);
      return () => clearInterval(alertsRefreshInterval);
    } else if (activeTab === 'plays') {
      fetchSmartPlays();
      // Set up smart plays interval during market hours (hourly check)
      const checkAndFetchPlays = () => {
        const now = new Date();
        const estHours = now.getUTCHours() - 5;
        const dayOfWeek = now.getUTCDay();
        if (dayOfWeek >= 1 && dayOfWeek <= 5 && estHours >= 9 && estHours < 17) { // Weekdays, 9 AM - 5 PM EST
          fetchSmartPlays();
        }
      };
      checkAndFetchPlays(); // Initial fetch
      smartPlaysIntervalRef.current = setInterval(checkAndFetchPlays, 60 * 60 * 1000); // Check every hour
      return () => {
        if (smartPlaysIntervalRef.current) {
          clearInterval(smartPlaysIntervalRef.current);
        }
      };
    }
  }, [activeTab, fetchMarketDashboard, fetchEconomicIndicators, fetchAlerts, fetchSmartPlays]);


  // Scroll chat to bottom
  useEffect(() => {
    chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleAddStock = () => {
    const symbol = newStockSymbol.trim().toUpperCase();
    if (symbol && !popularStocks.includes(symbol)) {
      setPopularStocks(prev => [...prev, symbol]);
      setNewStockSymbol('');
      fetchStockData(symbol); // Immediately fetch data for the newly added stock
    }
  };

  const handleRemoveStock = (symbolToRemove) => {
    setPopularStocks(prev => prev.filter(symbol => symbol !== symbolToRemove));
    setStockData(prev => {
      const newStockData = { ...prev };
      delete newStockData[symbolToRemove];
      return newStockData;
    });
  };

  const handleSearch = () => {
    if (searchTicker) {
      setSelectedStock(searchTicker.toUpperCase());
      fetchStockData(searchTicker.toUpperCase());
      fetchAIAnalysis(searchTicker.toUpperCase());
      fetchTechnicalIndicators(searchTicker.toUpperCase());
      fetchNewsData(searchTicker.toUpperCase());
    }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;

    const userMessage = { role: 'user', content: chatInput };
    setChatMessages(prev => [...prev, userMessage]);
    const message = chatInput;
    setChatInput('');
    setIsLoading(true); // Indicate chat loading

    try {
      // Enhanced chat that includes context about selected stock and market conditions
      const enhancedMessage = `${message} (Context: Currently viewing ${selectedStock}, Market is ${marketStatus})`;
      const response = await fetch(`${window.location.origin}/.netlify/functions/enhanced-rolo-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: enhancedMessage,
          context: {
            selectedStock,
            marketStatus,
            hasNews: newsData.articles.length > 0,
            hasTechnicals: !!technicalData
          }
        }),
      });
      const data = await response.json();
      if (response.ok && data.response) {
        setChatMessages(prev => [...prev, { role: 'ai', content: data.response }]);
      } else {
        setChatMessages(prev => [...prev, { role: 'ai', content: 'Sorry, I encountered an error or no response.' }]);
      }
    } catch (error) {
      console.error('Error fetching chat response:', error);
      setChatMessages(prev => [...prev, { role: 'ai', content: 'Sorry, I encountered an error. Please try again.' }]);
    } finally {
      setIsLoading(false); // End chat loading
    }
  };


  // --- Render Functions for Tabs ---
  // Inlining renderWatchlist content directly into the main return.
  const renderMarket = () => (
    <div className="p-4 space-y-4">
      <div className="bg-gray-800 p-4 rounded-xl shadow-lg">
        <h2 className="text-xl font-semibold text-white mb-3">Market Overview</h2>
        {isLoading && Object.keys(marketData).length === 0 ? (
          <div className="text-center text-gray-400">Loading market data...</div>
        ) : !marketData || Object.keys(marketData).length === 0 ? (
          <div className="text-center text-gray-400">No market data available.</div>
        ) : (
          <div className="space-y-4">
            {/* Major Indices */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">Major Indices</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {marketData.indices && marketData.indices.length > 0 ? (
                  marketData.indices.map((index, i) => (
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
                {economicData && economicData.length > 0 ? (
                  economicData.map((indicator, i) => (
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
                {marketData.futures && marketData.futures.length > 0 ? (
                  marketData.futures.map((future, i) => (
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
        <h2 className="text-xl font-semibold text-white mb-3">AI Stock Analysis for {selectedStock}</h2>
        <div className="flex space-x-2 mb-4">
          <input
            type="text"
            className="flex-grow p-2 rounded-lg bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter stock ticker (e.g., AAPL)"
            value={searchTicker}
            onChange={(e) => setSearchTicker(e.target.value.toUpperCase())}
            onKeyPress={(e) => { if (e.key === 'Enter') handleSearch(); }}
          />
          <button
            onClick={handleSearch}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition duration-200"
            disabled={isLoading}
          >
            {isLoading ? 'Analyzing...' : 'Analyze'}
          </button>
        </div>

        {isLoading && !analysisData ? (
          <div className="text-center text-gray-400">Generating in-depth analysis...</div>
        ) : !analysisData ? (
          <div className="text-center text-gray-400">No AI analysis available for {selectedStock}.</div>
        ) : (
          <div className="space-y-4 text-gray-200">
            <h3 className="text-lg font-semibold text-white">{analysisData.title || 'Stock Analysis'}</h3>
            {analysisData.summary && (
              <div>
                <p className="font-semibold text-white">Summary:</p>
                <p>{analysisData.summary}</p>
              </div>
            )}
            {analysisData.technicalAnalysis && (
              <div>
                <p className="font-semibold text-white">Technical Analysis:</p>
                <p>{analysisData.technicalAnalysis}</p>
              </div>
            )}
            {analysisData.priceLevels && analysisData.priceLevels.length > 0 && (
              <div>
                <p className="font-semibold text-white">Key Price Levels:</p>
                <ul className="list-disc list-inside ml-4">
                  {analysisData.priceLevels.map((level, i) => (
                    <li key={i}>{level}</li>
                  ))}
                </ul>
              </div>
            )}
            {analysisData.recommendations && analysisData.recommendations.length > 0 && (
              <div>
                <p className="font-semibold text-white">Recommendations:</p>
                <ul className="list-disc list-inside ml-4">
                  {analysisData.recommendations.map((rec, i) => (
                    <li key={i}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}
            {analysisData.riskFactors && (
              <div>
                <p className="font-semibold text-white">Risk Factors:</p>
                <p>{analysisData.riskFactors}</p>
              </div>
            )}
             {analysisData.catalysts && analysisData.catalysts.length > 0 && (
              <div>
                <p className="font-semibold text-white">Catalysts:</p>
                <ul className="list-disc list-inside ml-4">
                  {analysisData.catalysts.map((cat, i) => (
                    <li key={i}>{cat}</li>
                  ))}
                </ul>
              </div>
            )}
             {analysisData.sentiment && (
              <div>
                <p className="font-semibold text-white">Sentiment:</p>
                <p>{analysisData.sentiment}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Technical Indicators Section */}
      <div className="bg-gray-800 p-4 rounded-xl shadow-lg">
        <h2 className="text-xl font-semibold text-white mb-3">Technical Indicators for {selectedStock}</h2>
        {isLoading && !technicalData ? (
          <div className="text-center text-gray-400">Loading technical indicators...</div>
        ) : !technicalData ? (
          <div className="text-center text-gray-400">No technical indicators available for {selectedStock}.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Object.entries(technicalData).map(([key, value]) => (
              <div key={key} className="bg-gray-700 p-3 rounded-lg shadow-sm">
                <p className="text-md font-bold text-white break-words">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                <p className="text-lg text-white">{typeof value === 'number' ? value.toFixed(2) : value}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* News Data Section */}
      <div className="bg-gray-800 p-4 rounded-xl shadow-lg">
        <h2 className="text-xl font-semibold text-white mb-3">Latest News for {selectedStock}</h2>
        {isLoading && newsData.articles.length === 0 ? (
          <div className="text-center text-gray-400">Loading news...</div>
        ) : newsData.articles.length === 0 ? (
          <div className="text-center text-gray-400">No news available for {selectedStock}.</div>
        ) : (
          <div className="space-y-3">
            {newsData.articles.map((article, i) => (
              <a key={i} href={article.url} target="_blank" rel="noopener noreferrer" className="block bg-gray-700 p-3 rounded-xl shadow-sm hover:bg-gray-600 transition-colors duration-200">
                <p className="text-md font-bold text-white">{article.title}</p>
                <p className="text-sm text-gray-300 mt-1">{article.summary}</p>
                <p className="text-xs text-gray-500 mt-2">{article.source} - {new Date(article.publishedAt).toLocaleDateString()}</p>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderPlays = () => (
    <div className="p-4 space-y-4">
      <div className="bg-gray-800 p-4 rounded-xl shadow-lg">
        <h2 className="text-xl font-semibold text-white mb-3">AI Smart Plays (Hourly)</h2>
        {isLoading && smartPlays.length === 0 ? (
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
        {isLoading && alerts.length === 0 ? (
          <div className="text-center text-gray-400">Loading alerts...</div>
        ) : alerts.length === 0 ? (
          <div className="text-center text-gray-400">No new alerts at this time.</div>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert, i) => (
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
        {chatMessages.length === 0 && (
          <div className="text-center text-gray-400 mt-10">
            Start a conversation with Rolo AI!
          </div>
        )}
        {chatMessages.map((msg, index) => (
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
              {msg.content} {/* Use msg.content as per your original structure */}
            </div>
          </div>
        ))}
        {isLoading && ( // Use general isLoading for chat loading
          <div className="flex justify-start">
            <div className="max-w-[70%] p-3 rounded-lg shadow-md bg-gray-700 text-gray-100 rounded-bl-none animate-pulse">
              Rolo AI is typing...
            </div>
          </div>
        )}
        <div ref={chatMessagesEndRef} />
      </div>
      <form onSubmit={handleSendMessage} className="flex space-x-2"> {/* Changed to handleSendMessage */}
        <input
          type="text"
          className="flex-grow p-3 rounded-lg bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Ask Rolo AI about stocks, markets, or anything..."
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          disabled={isLoading} // Disable input while loading
        />
        <button
          type="submit"
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-5 rounded-lg transition duration-200"
          disabled={isLoading} // Disable button while loading
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
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow overflow-y-auto pb-20"> {/* Add padding-bottom for nav */}
        {activeTab === 'watchlist' && (
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
              {isLoading && Object.keys(stockData).length === 0 ? (
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
                      <div key={symbol}
                           className={`bg-gray-700 p-4 rounded-xl shadow-md flex flex-col justify-between cursor-pointer ${selectedStock === symbol ? 'border-2 border-blue-500' : ''}`}
                           onClick={() => setSelectedStock(symbol)}>
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

            {selectedStock && stockData[selectedStock] && (
              <div className="bg-gray-800 p-4 rounded-xl shadow-lg">
                <h2 className="text-xl font-semibold text-white mb-3">Details for {selectedStock}</h2>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <p className="text-3xl font-bold text-white">{formatCurrency(stockData[selectedStock].price)}</p>
                    <p className={`${stockData[selectedStock].percentChange >= 0 ? 'text-green-400' : 'text-red-400'} text-lg font-semibold`}>
                      {formatCurrency(stockData[selectedStock].change)} ({formatPercentage(stockData[selectedStock].percentChange)})
                    </p>
                  </div>
                  <p className="text-sm text-gray-400">Volume: {new Intl.NumberFormat().format(stockData[selectedStock].volume)}</p>
                  <div className="grid grid-cols-2 gap-2 text-sm text-gray-300">
                    <p>Open: {formatCurrency(stockData[selectedStock].open)}</p>
                    <p>High: {formatCurrency(stockData[selectedStock].high)}</p>
                    <p>Low: {formatCurrency(stockData[selectedStock].low)}</p>
                    <p>Updated: {stockData[selectedStock].updatedAt}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        {activeTab === 'market' && renderMarket()}
        {activeTab === 'analysis' && renderAnalysis()}
        {activeTab === 'plays' && renderPlays()}
        {activeTab === 'alerts' && renderAlerts()}
        {activeTab === 'chat' && renderChat()}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 shadow-xl z-50">
        <div className="flex justify-around py-3">
          <TabButton icon="📈" label="Watchlist" isActive={activeTab === 'watchlist'} onClick={() => setActiveTab('watchlist')} />
          <TabButton icon="📊" label="Market" isActive={activeTab === 'market'} onClick={() => setActiveTab('market')} />
          <TabButton icon="🧠" label="Analysis" isActive={activeTab === 'analysis'} onClick={() => setActiveTab('analysis')} />
          <TabButton icon="🎯" label="Plays" isActive={activeTab === 'plays'} onClick={() => setActiveTab('plays')} />
          <TabButton icon="🔔" label="Alerts" isActive={activeTab === 'alerts'} onClick={() => setActiveTab('alerts')} />
          <TabButton icon="💬" label="Chat" isActive={activeTab === 'chat'} onClick={() => setActiveTab('chat')} />
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
