import React, { useState, useEffect, useCallback } from 'react';

const INTERVALS = {
  MARKET_OPEN: 30000,
  PRE_MARKET: 60000,
  AFTER_HOURS: 60000,
  FUTURES_OPEN: 120000,
  DEFAULT: 300000,
};

const RoloApp = () => {
  const [activeTab, setActiveTab] = useState('ticker');
  const [searchTicker, setSearchTicker] = useState('');
  const [selectedStock, setSelectedStock] = useState('AAPL');
  const [stockData, setStockData] = useState({});
  const [marketData, setMarketData] = useState({});
  const [analysisData, setAnalysisData] = useState(null);
  const [smartPlays, setSmartPlays] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [isLoading, setIsLoading] = useState({
    stocks: false,
    analysis: false,
    plays: false,
    market: false,
    alerts: false
  });
  const [marketStatus, setMarketStatus] = useState('Loading...');
  const [chatMessages, setChatMessages] = useState([
    { role: 'ai', content: "Hello! I'm Rolo, your 24/7 AI trading assistant with access to real-time market data, futures, pre-market, news, and social sentiment. How can I help you today?" }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [popularStocks, setPopularStocks] = useState(['AAPL', 'TSLA', 'NVDA', 'SPY', 'QQQ', 'META', 'AMD', 'GOOGL', 'MSFT']);
  const [isEditingStocks, setIsEditingStocks] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  // Enhanced market status detection
  const checkMarketStatus = useCallback(() => {
    const now = new Date();
    const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
    const est = new Date(utcTime + (-5 * 3600000));
    const hours = est.getHours();
    const minutes = est.getMinutes();
    const day = est.getDay();
    const totalMinutes = hours * 60 + minutes;
    
    let status = 'Market Closed';
    
    if (day === 0) {
      if (hours >= 18) {
        status = 'Futures Open';
      } else {
        status = 'Weekend';
      }
    } else if (day === 6) {
      status = 'Weekend';
    } else {
      if (totalMinutes >= 240 && totalMinutes < 570) {
        status = 'Pre-Market';
      } else if (totalMinutes >= 570 && totalMinutes < 960) {
        status = 'Market Open';
      } else if (totalMinutes >= 960 && totalMinutes < 1200) {
        status = 'After Hours';
      } else if (totalMinutes >= 1080 || totalMinutes < 240) {
        status = 'Futures Open';
      } else {
        status = 'Market Closed';
      }
    }
    
    setMarketStatus(status);
    setLastUpdate(new Date());
  }, []);

  // Auto-refresh intervals based on market session
  const getRefreshInterval = useCallback(() => {
    switch (marketStatus) {
      case 'Market Open': return INTERVALS.MARKET_OPEN;
      case 'Pre-Market':
      case 'After Hours': return INTERVALS.PRE_MARKET;
      case 'Futures Open': return INTERVALS.FUTURES_OPEN;
      default: return INTERVALS.DEFAULT;
    }
  }, [marketStatus]);

  useEffect(() => {
    checkMarketStatus();
    const statusInterval = setInterval(checkMarketStatus, 60000);
    return () => clearInterval(statusInterval);
  }, [checkMarketStatus]);

  // Enhanced stock data fetching with session awareness
  const fetchStockData = useCallback(async (symbol) => {
    if (!symbol) return;
    
    setIsLoading(prev => ({ ...prev, stocks: true }));
    try {
      const response = await fetch(`/.netlify/functions/enhanced-stock-data?symbol=${symbol}`);
      if (response.ok) {
        const data = await response.json();
        setStockData(prev => ({ 
          ...prev, 
          [symbol]: {
            ...data,
            marketSession: marketStatus,
            lastFetched: new Date().toISOString()
          }
        }));
      } else {
        console.error(`Failed to fetch data for ${symbol}:`, response.status);
      }
    } catch (error) {
      console.error('Error fetching stock data:', error);
    } finally {
      setIsLoading(prev => ({ ...prev, stocks: false }));
    }
  }, [marketStatus]);

  // 24/7 AI Analysis with comprehensive data
  const fetchAIAnalysis = useCallback(async (symbol) => {
    if (!symbol) return;
    
    setIsLoading(prev => ({ ...prev, analysis: true }));
    setAnalysisData(null);
    
    try {
      const response = await fetch('/.netlify/functions/comprehensive-ai-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, type: 'analysis' }),
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.analysis && !data.analysis.fallback) {
          setAnalysisData({
            ...data.analysis,
            dataQuality: data.dataQuality,
            marketSession: data.marketData?.session || marketStatus,
            lastUpdated: data.timestamp
          });
        }
      } else {
        console.error('AI Analysis failed:', response.status);
      }
    } catch (error) {
      console.error('Error fetching AI analysis:', error);
    } finally {
      setIsLoading(prev => ({ ...prev, analysis: false }));
    }
  }, [marketStatus]);

  // Smart plays with real-time market opportunities
  const fetchSmartPlays = useCallback(async () => {
    setIsLoading(prev => ({ ...prev, plays: true }));
    setSmartPlays([]);
    
    try {
      const response = await fetch('/.netlify/functions/comprehensive-ai-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'smartplays' }),
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.analysis && data.analysis.plays && data.analysis.plays.length > 0) {
          setSmartPlays(data.analysis.plays.map(play => ({
            ...play,
            marketSession: data.marketData?.session || marketStatus,
            dataQuality: data.dataQuality,
            lastUpdated: data.timestamp
          })));
        }
      }
    } catch (error) {
      console.error('Error fetching smart plays:', error);
    } finally {
      setIsLoading(prev => ({ ...prev, plays: false }));
    }
  }, [marketStatus]);

  // Enhanced market dashboard with futures and pre-market
  const fetchMarketDashboard = useCallback(async () => {
    setIsLoading(prev => ({ ...prev, market: true }));
    try {
      const response = await fetch('/.netlify/functions/market-dashboard');
      if (response.ok) {
        const data = await response.json();
        if (data && Object.keys(data).length > 0) {
          setMarketData({
            ...data,
            marketSession: marketStatus,
            lastUpdated: new Date().toISOString()
          });
        }
      }
    } catch (error) {
      console.error('Error fetching market data:', error);
    } finally {
      setIsLoading(prev => ({ ...prev, market: false }));
    }
  }, [marketStatus]);

  // Real-time alerts with comprehensive monitoring
  const fetchAlerts = useCallback(async () => {
    setIsLoading(prev => ({ ...prev, alerts: true }));
    setAlerts([]);
    
    try {
      const response = await fetch('/.netlify/functions/comprehensive-ai-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'alerts' }),
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.analysis && data.analysis.alerts && data.analysis.alerts.length > 0) {
          setAlerts(data.analysis.alerts.map(alert => ({
            ...alert,
            marketSession: data.marketData?.session || marketStatus,
            dataQuality: data.dataQuality,
            timestamp: data.timestamp
          })));
        }
      }
    } catch (error) {
      console.error('Error fetching alerts:', error);
    } finally {
      setIsLoading(prev => ({ ...prev, alerts: false }));
    }
  }, [marketStatus]);

  // Auto-refresh system based on market conditions
  useEffect(() => {
    const interval = getRefreshInterval();
    
    const refreshData = () => {
      popularStocks.forEach(symbol => {
        fetchStockData(symbol);
      });
      
      switch (activeTab) {
        case 'analysis':
          if (selectedStock) fetchAIAnalysis(selectedStock);
          break;
        case 'plays':
          fetchSmartPlays();
          break;
        case 'market':
          fetchMarketDashboard();
          break;
        case 'alerts':
          fetchAlerts();
          break;
      }
    };

    refreshData();
    
    const refreshInterval = setInterval(refreshData, interval);
    
    return () => clearInterval(refreshInterval);
  }, [activeTab, selectedStock, popularStocks, getRefreshInterval, fetchStockData, fetchAIAnalysis, fetchSmartPlays, fetchMarketDashboard, fetchAlerts]);

  // Event handlers
  const handleTabChange = useCallback((tabId) => {
    setActiveTab(tabId);
  }, []);

  const handleSearch = useCallback(() => {
    if (searchTicker && searchTicker.trim()) {
      const ticker = searchTicker.toUpperCase().trim();
      setSelectedStock(ticker);
      fetchStockData(ticker);
      setSearchTicker('');
    }
  }, [searchTicker, fetchStockData]);

  const handleSendMessage = useCallback(async () => {
    if (!chatInput.trim()) return;
    
    setChatMessages(prev => [...prev, { role: 'user', content: chatInput }]);
    const message = chatInput;
    setChatInput('');
    
    try {
      const response = await fetch('/.netlify/functions/enhanced-rolo-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: `${message} (Context: Currently viewing ${selectedStock}, Market is ${marketStatus}, Time: ${new Date().toLocaleString()})`,
          context: { selectedStock, marketStatus, activeTab }
        }),
      });
      if (response.ok) {
        const data = await response.json();
        setChatMessages(prev => [...prev, { role: 'ai', content: data.response || 'Sorry, I encountered an error accessing real-time data.' }]);
      }
    } catch (error) {
      setChatMessages(prev => [...prev, { role: 'ai', content: 'Sorry, I encountered an error. Please try again.' }]);
    }
  }, [chatInput, selectedStock, marketStatus, activeTab]);

  const handleEditStocks = useCallback(() => {
    setIsEditingStocks(!isEditingStocks);
  }, [isEditingStocks]);

  const handleStockEdit = useCallback((index, newSymbol) => {
    if (newSymbol && newSymbol.trim()) {
      const updatedStocks = [...popularStocks];
      updatedStocks[index] = newSymbol.toUpperCase().trim();
      setPopularStocks(updatedStocks);
      
      try {
        localStorage.setItem('roloPopularStocks', JSON.stringify(updatedStocks));
      } catch (e) {
        console.warn('Unable to save to localStorage:', e);
      }
    }
  }, [popularStocks]);

  const addStock = useCallback(() => {
    if (popularStocks.length < 12) {
      const newStocks = [...popularStocks, 'NEW'];
      setPopularStocks(newStocks);
    }
  }, [popularStocks]);

  const removeStock = useCallback((index) => {
    if (popularStocks.length > 3) {
      const newStocks = popularStocks.filter((_, i) => i !== index);
      setPopularStocks(newStocks);
      try {
        localStorage.setItem('roloPopularStocks', JSON.stringify(newStocks));
      } catch (e) {
        console.warn('Unable to save to localStorage:', e);
      }
    }
  }, [popularStocks]);

  // Load saved stocks on component mount
  useEffect(() => {
    try {
      const savedStocks = localStorage.getItem('roloPopularStocks');
      if (savedStocks) {
        const parsedStocks = JSON.parse(savedStocks);
        if (Array.isArray(parsedStocks) && parsedStocks.length >= 3) {
          setPopularStocks(parsedStocks);
        }
      }
    } catch (e) {
      console.error('Failed to load saved stocks:', e);
    }
  }, []);

  const getMarketStatusStyle = () => {
    const baseStyle = {
      display: 'inline-flex',
      alignItems: 'center',
      padding: '6px 16px',
      borderRadius: '20px',
      fontSize: '14px',
      fontWeight: '600',
      textTransform: 'uppercase'
    };
    
    switch (marketStatus) {
      case 'Market Open':
        return { ...baseStyle, backgroundColor: '#064E3B', color: '#10B981', border: '1px solid #10B981' };
      case 'Pre-Market':
      case 'After Hours':
        return { ...baseStyle, backgroundColor: '#7C2D12', color: '#F59E0B', border: '1px solid #F59E0B' };
      case 'Futures Open':
        return { ...baseStyle, backgroundColor: '#1E3A8A', color: '#3B82F6', border: '1px solid #3B82F6' };
      case 'Weekend':
        return { ...baseStyle, backgroundColor: '#374151', color: '#9CA3AF', border: '1px solid #9CA3AF' };
      default:
        return { ...baseStyle, backgroundColor: '#1F2937', color: '#9CA3AF', border: '1px solid #9CA3AF' };
    }
  };

  const getMarketStatusDot = () => {
    const baseStyle = {
      width: '10px',
      height: '10px',
      borderRadius: '50%',
      marginRight: '8px',
      animation: marketStatus === 'Market Open' || marketStatus === 'Futures Open' ? 'pulse 2s infinite' : 'none'
    };
    
    switch (marketStatus) {
      case 'Market Open':
        return { ...baseStyle, backgroundColor: '#10B981' };
      case 'Pre-Market':
      case 'After Hours':
        return { ...baseStyle, backgroundColor: '#F59E0B' };
      case 'Futures Open':
        return { ...baseStyle, backgroundColor: '#3B82F6' };
      default:
        return { ...baseStyle, backgroundColor: '#9CA3AF' };
    }
  };

  const getUpdateFrequency = () => {
    switch (marketStatus) {
      case 'Market Open': return 'Updates every 30 seconds';
      case 'Pre-Market':
      case 'After Hours': return 'Updates every 1 minute';
      case 'Futures Open': return 'Updates every 2 minutes';
      default: return 'Updates every 5 minutes';
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#000000',
      color: '#ffffff',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
    }}>
      <div style={{
        background: 'linear-gradient(to bottom, #1a1a1a, #000000)',
        padding: '20px',
        textAlign: 'center',
        borderBottom: '1px solid #374151'
      }}>
        <h1 style={{
          fontSize: '32px',
          fontWeight: 'bold',
          color: '#3B82F6',
          margin: '0 0 8px 0',
        }}>Rolo</h1>
        <p style={{
          color: '#9CA3AF',
          fontSize: '14px',
          margin: '0 0 12px 0',
        }}>24/7 AI Trading Assistant - Real-Time Data</p>
        <div style={{ marginBottom: '8px' }}>
          <span style={getMarketStatusStyle()}>
            <span style={getMarketStatusDot()}></span>
            {marketStatus}
          </span>
        </div>
        <p style={{ fontSize: '12px', color: '#6B7280', margin: '4px 0 0 0' }}>
          {getUpdateFrequency()} • Last: {lastUpdate.toLocaleTimeString()}
        </p>
      </div>

      <div style={{
        flex: 1,
        overflowY: 'auto',
        paddingBottom: '80px',
      }}>
        {activeTab === 'ticker' && (
          <div>
            <div style={{ padding: '20px' }}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <input
                  type="text"
                  value={searchTicker}
                  onChange={(e) => setSearchTicker(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Enter ticker symbol"
                  style={{
                    flex: 1,
                    backgroundColor: '#1a1a1a',
                    border: '1px solid #374151',
                    borderRadius: '12px',
                    padding: '12px 16px',
                    color: '#ffffff',
                    fontSize: '16px',
                    outline: 'none',
                  }}
                />
                <button
                  onClick={handleSearch}
                  aria-label="Search ticker"
                  style={{
                    backgroundColor: '#3B82F6',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '12px 24px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  Search
                </button>
              </div>
            </div>

            {/* ...rest of your component unchanged, except: */}

            {/* Apply fallback wherever you display data, e.g.: */}
            {/* ${data?.price ?? 'N/A'} for price */}
            {/* {metric.value ?? 'N/A'} for metrics */}
            {/* {analysisData.technicalAnalysis?.trend?.toUpperCase() ?? 'N/A'} for analysis */}
            {/* and so on for other fields */}

            {/* Also: For chat input */}
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder={`Ask about ${selectedStock} or market conditions (${marketStatus})...`}
              style={{
                flex: 1,
                backgroundColor: '#1a1a1a',
                border: '1px solid #374151',
                borderRadius: '24px',
                padding: '12px 20px',
                color: '#ffffff',
                fontSize: '16px',
                outline: 'none',
              }}
            />
            <button
              onClick={handleSendMessage}
              aria-label="Send chat message"
              style={{
                backgroundColor: '#3B82F6',
                color: '#ffffff',
                border: 'none',
                borderRadius: '24px',
                padding: '12px 24px',
                cursor: 'pointer',
                fontWeight: '600',
              }}
            >
              Send
            </button>

            {/* ...repeat similar for all other controls and data displays */}
          </div>
        )}

        {/* ...rest of your tabs/components unchanged except for above fixes */}

      </div>

      {/* ...bottom nav and styles unchanged */}

    </div>
  );
};

export default RoloApp;
