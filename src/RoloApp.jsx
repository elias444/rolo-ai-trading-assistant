import React, { useState, useEffect, useCallback } from 'react';

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
  const [debugInfo, setDebugInfo] = useState({}); // Add debug info state
  const [marketStatus, setMarketStatus] = useState('Loading...');
  const [chatMessages, setChatMessages] = useState([
    { role: 'ai', content: "Hello! I'm Rolo, your 24/7 AI trading assistant. I'm checking my data connections..." }
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
    
    if (day === 0) { // Sunday
      if (hours >= 18) {
        status = 'Futures Open';
      } else {
        status = 'Weekend';
      }
    } else if (day === 6) { // Saturday
      status = 'Weekend';
    } else { // Monday-Friday
      if (totalMinutes >= 240 && totalMinutes < 570) { // 4:00 AM - 9:30 AM
        status = 'Pre-Market';
      } else if (totalMinutes >= 570 && totalMinutes < 960) { // 9:30 AM - 4:00 PM
        status = 'Market Open';
      } else if (totalMinutes >= 960 && totalMinutes < 1200) { // 4:00 PM - 8:00 PM
        status = 'After Hours';
      } else if (totalMinutes >= 1080 || totalMinutes < 240) { // 6:00 PM - 4:00 AM
        status = 'Futures Open';
      } else {
        status = 'Market Closed';
      }
    }
    
    setMarketStatus(status);
    setLastUpdate(new Date());
  }, []);

  // Test function availability
  const testFunctions = useCallback(async () => {
    console.log('[RoloApp] Testing function availability...');
    const functions = [
      'market-dashboard',
      'comprehensive-ai-analysis', 
      'enhanced-stock-data',
      'smart-plays-generator',
      'realtime-alerts',
      'enhanced-rolo-chat'
    ];
    
    const results = {};
    
    for (const funcName of functions) {
      try {
        const response = await fetch(`/.netlify/functions/${funcName}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });
        
        results[funcName] = {
          exists: true,
          status: response.status,
          ok: response.ok
        };
        
        if (!response.ok) {
          const errorText = await response.text();
          results[funcName].error = errorText.substring(0, 200);
        }
      } catch (error) {
        results[funcName] = {
          exists: false,
          error: error.message
        };
      }
    }
    
    setDebugInfo(results);
    console.log('[RoloApp] Function test results:', results);
  }, []);

  // Enhanced stock data fetching with better error handling
  const fetchStockData = useCallback(async (symbol) => {
    if (!symbol) return;
    
    setIsLoading(prev => ({ ...prev, stocks: true }));
    try {
      console.log(`[RoloApp] Fetching stock data for ${symbol}...`);
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
        console.log(`[RoloApp] ✅ Got stock data for ${symbol}:`, data);
      } else {
        const errorText = await response.text();
        console.error(`[RoloApp] Stock data error for ${symbol}:`, response.status, errorText);
      }
    } catch (error) {
      console.error('[RoloApp] Stock data fetch error:', error);
    } finally {
      setIsLoading(prev => ({ ...prev, stocks: false }));
    }
  }, [marketStatus]);

  // Enhanced market dashboard fetching
  const fetchMarketDashboard = useCallback(async () => {
    setIsLoading(prev => ({ ...prev, market: true }));
    try {
      console.log('[RoloApp] Fetching market dashboard...');
      const response = await fetch('/.netlify/functions/market-dashboard');
      
      if (response.ok) {
        const data = await response.json();
        setMarketData({
          ...data,
          marketSession: marketStatus,
          lastUpdated: new Date().toISOString()
        });
        console.log('[RoloApp] ✅ Got market data:', data);
      } else {
        const errorText = await response.text();
        console.error('[RoloApp] Market dashboard error:', response.status, errorText);
        setMarketData({ error: `API Error: ${response.status}`, details: errorText.substring(0, 200) });
      }
    } catch (error) {
      console.error('[RoloApp] Market dashboard fetch error:', error);
      setMarketData({ error: 'Network Error', details: error.message });
    } finally {
      setIsLoading(prev => ({ ...prev, market: false }));
    }
  }, [marketStatus]);

  // Enhanced AI Analysis with better error handling
  const fetchAIAnalysis = useCallback(async (symbol) => {
    if (!symbol) return;
    
    setIsLoading(prev => ({ ...prev, analysis: true }));
    setAnalysisData(null);
    
    try {
      console.log(`[RoloApp] Fetching AI analysis for ${symbol}...`);
      const response = await fetch('/.netlify/functions/comprehensive-ai-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, type: 'analysis' }),
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.analysis) {
          setAnalysisData({
            ...data.analysis,
            dataQuality: data.dataQuality,
            marketSession: data.marketData?.session || marketStatus,
            lastUpdated: data.timestamp
          });
          console.log('[RoloApp] ✅ Got AI analysis:', data);
        } else {
          console.warn('[RoloApp] No analysis data returned:', data);
          setAnalysisData({ error: 'No analysis available', details: data.error || 'Unknown error' });
        }
      } else {
        const errorText = await response.text();
        console.error('[RoloApp] AI analysis error:', response.status, errorText);
        setAnalysisData({ error: `API Error: ${response.status}`, details: errorText.substring(0, 200) });
      }
    } catch (error) {
      console.error('[RoloApp] AI analysis fetch error:', error);
      setAnalysisData({ error: 'Network Error', details: error.message });
    } finally {
      setIsLoading(prev => ({ ...prev, analysis: false }));
    }
  }, [marketStatus]);

  // Enhanced Smart Plays fetching
  const fetchSmartPlays = useCallback(async () => {
    setIsLoading(prev => ({ ...prev, plays: true }));
    setSmartPlays([]);
    
    try {
      console.log('[RoloApp] Fetching smart plays...');
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
          console.log('[RoloApp] ✅ Got smart plays:', data.analysis.plays);
        } else {
          console.log('[RoloApp] No smart plays available:', data);
        }
      } else {
        const errorText = await response.text();
        console.error('[RoloApp] Smart plays error:', response.status, errorText);
      }
    } catch (error) {
      console.error('[RoloApp] Smart plays fetch error:', error);
    } finally {
      setIsLoading(prev => ({ ...prev, plays: false }));
    }
  }, [marketStatus]);

  // Enhanced Alerts fetching
  const fetchAlerts = useCallback(async () => {
    setIsLoading(prev => ({ ...prev, alerts: true }));
    setAlerts([]);
    
    try {
      console.log('[RoloApp] Fetching alerts...');
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
          console.log('[RoloApp] ✅ Got alerts:', data.analysis.alerts);
        } else {
          console.log('[RoloApp] No alerts available:', data);
        }
      } else {
        const errorText = await response.text();
        console.error('[RoloApp] Alerts error:', response.status, errorText);
      }
    } catch (error) {
      console.error('[RoloApp] Alerts fetch error:', error);
    } finally {
      setIsLoading(prev => ({ ...prev, alerts: false }));
    }
  }, [marketStatus]);

  // Initialize everything
  useEffect(() => {
    checkMarketStatus();
    testFunctions(); // Test function availability on load
    
    // Set up status checking
    const statusInterval = setInterval(checkMarketStatus, 60000);
    
    return () => clearInterval(statusInterval);
  }, [checkMarketStatus, testFunctions]);

  // Auto-refresh based on active tab
  useEffect(() => {
    const refreshData = () => {
      // Always refresh popular stocks
      popularStocks.forEach(symbol => {
        fetchStockData(symbol);
      });
      
      // Refresh current tab data
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
        default:
          break;
      }
    };

    // Initial load
    refreshData();
    
    // Set up auto-refresh every 2 minutes for testing
    const refreshInterval = setInterval(refreshData, 120000);
    
    return () => clearInterval(refreshInterval);
  }, [activeTab, selectedStock, popularStocks, fetchStockData, fetchAIAnalysis, fetchSmartPlays, fetchMarketDashboard, fetchAlerts]);

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
      } else {
        setChatMessages(prev => [...prev, { role: 'ai', content: 'Sorry, I encountered an error. Please try again.' }]);
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
      
      // Save to localStorage for persistence
      localStorage.setItem('roloPopularStocks', JSON.stringify(updatedStocks));
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
      localStorage.setItem('roloPopularStocks', JSON.stringify(newStocks));
    }
  }, [popularStocks]);

  // Load saved stocks on component mount
  useEffect(() => {
    const savedStocks = localStorage.getItem('roloPopularStocks');
    if (savedStocks) {
      try {
        const parsedStocks = JSON.parse(savedStocks);
        if (Array.isArray(parsedStocks) && parsedStocks.length >= 3) {
          setPopularStocks(parsedStocks);
        }
      } catch (e) {
        console.error('Failed to load saved stocks:', e);
      }
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
      {/* Enhanced Header */}
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
        
        {/* Debug Info */}
        {Object.keys(debugInfo).length > 0 && (
          <details style={{ marginTop: '10px', fontSize: '12px', color: '#9CA3AF' }}>
            <summary style={{ cursor: 'pointer' }}>🔧 Function Status (Click to expand)</summary>
            <div style={{ marginTop: '8px', textAlign: 'left', backgroundColor: '#1a1a1a', padding: '10px', borderRadius: '8px' }}>
              {Object.entries(debugInfo).map(([funcName, info]) => (
                <div key={funcName} style={{ marginBottom: '4px' }}>
                  <span style={{ color: info.exists && info.ok ? '#10B981' : '#EF4444' }}>
                    {funcName}: {info.exists ? (info.ok ? '✅ OK' : `❌ Error ${info.status}`) : '❌ Missing'}
                  </span>
                  {info.error && <div style={{ fontSize: '10px', color: '#6B7280', marginLeft: '10px' }}>{info.error}</div>}
                </div>
              ))}
            </div>
          </details>
        )}
      </div>

      {/* Main Content */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        paddingBottom: '80px',
      }}>
        {/* Ticker Tab */}
        {activeTab === 'ticker' && (
          <div>
            {/* Search Bar */}
            <div style={{ padding: '20px' }}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <input
                  type="text"
                  value={searchTicker}
                  onChange={(e) => setSearchTicker(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
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

            {/* Popular Stocks */}
            <div style={{ padding: '0 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h2 style={{
                  fontSize: '18px',
                  fontWeight: '600',
                  margin: 0,
                  display: 'flex',
                  alignItems: 'center',
                }}>
                  <span style={{ marginRight: '8px' }}>📈</span> 
                  Popular Stocks
                  <span style={{ fontSize: '12px', color: '#6B7280', marginLeft: '8px' }}>
                    ({marketStatus})
                  </span>
                </h2>
                <button
                  onClick={handleEditStocks}
                  style={{
                    backgroundColor: isEditingStocks ? '#059669' : '#374151',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '6px 12px',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  {isEditingStocks ? 'Done' : 'Edit'}
                </button>
              </div>
              
              {isLoading.stocks && Object.keys(stockData).length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9CA3AF' }}>
                  <p style={{ fontSize: '48px', margin: '0 0 16px 0' }}>🔄</p>
                  <p>Loading real-time {marketStatus.toLowerCase()} data...</p>
                </div>
              )}

              {Object.keys(stockData).length > 0 && (
                <div>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                    gap: '12px',
                    marginBottom: '24px'
                  }}>
                    {popularStocks.map((symbol, index) => {
                      const data = stockData[symbol];
                      const isSelected = selectedStock === symbol;
                      
                      return (
                        <div
                          key={`${symbol}-${index}`}
                          onClick={() => !isEditingStocks && setSelectedStock(symbol)}
                          style={{
                            backgroundColor: '#1a1a1a',
                            border: `1px solid ${isSelected ? '#3B82F6' : '#374151'}`,
                            borderRadius: '12px',
                            padding: '12px',
                            textAlign: 'center',
                            cursor: isEditingStocks ? 'default' : 'pointer',
                            transition: 'all 0.2s',
                            position: 'relative'
                          }}
                        >
                          {isEditingStocks ? (
                            <div>
                              <input
                                type="text"
                                value={symbol}
                                onChange={(e) => handleStockEdit(index, e.target.value)}
                                onBlur={(e) => handleStockEdit(index, e.target.value)}
                                style={{
                                  backgroundColor: 'transparent',
                                  border: '1px solid #374151',
                                  borderRadius: '4px',
                                  padding: '4px',
                                  color: '#ffffff',
                                  fontSize: '12px',
                                  textAlign: 'center',
                                  width: '60px'
                                }}
                              />
                              {popularStocks.length > 3 && (
                                <button
                                  onClick={() => removeStock(index)}
                                  style={{
                                    position: 'absolute',
                                    top: '4px',
                                    right: '4px',
                                    backgroundColor: '#EF4444',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '50%',
                                    width: '16px',
                                    height: '16px',
                                    fontSize: '10px',
                                    cursor: 'pointer'
                                  }}
                                >
                                  ×
                                </button>
                              )}
                            </div>
                          ) : (
                            <>
                              <div style={{ fontWeight: 'bold', marginBottom: '4px', fontSize: '14px' }}>
                                {symbol}
                              </div>
                              {data ? (
                                <>
                                  <div style={{ fontSize: '14px', color: '#9CA3AF', marginBottom: '2px' }}>
                                    ${data.price}
                                  </div>
                                  <div style={{
                                    fontSize: '12px',
                                    color: parseFloat(data.change) >= 0 ? '#10B981' : '#EF4444'
                                  }}>
                                    {data.changePercent}
                                  </div>
                                  <div style={{ fontSize: '10px', color: '#6B7280', marginTop: '2px' }}>
                                    {data.marketSession || marketStatus}
                                  </div>
                                </>
                              ) : (
                                <div style={{ fontSize: '12px', color: '#6B7280' }}>Loading...</div>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}
                    
                    {isEditingStocks && popularStocks.length < 12 && (
                      <button
                        onClick={addStock}
                        style={{
                          backgroundColor: '#374151',
                          border: '1px dashed #6B7280',
                          borderRadius: '12px',
                          padding: '12px',
                          color: '#9CA3AF',
                          cursor: 'pointer',
                          fontSize: '24px'
                        }}
                      >
                        +
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Selected Stock Details */}
              {selectedStock && stockData[selectedStock] && (
                <div style={{
                  backgroundColor: '#1a1a1a',
                  borderRadius: '20px',
                  padding: '24px',
                  border: '1px solid #1F2937',
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '16px',
                  }}>
                    <div>
                      <h2 style={{ fontSize: '32px', fontWeight: 'bold', margin: '0' }}>
                        {selectedStock}
                      </h2>
                      <p style={{ color: '#9CA3AF', fontSize: '14px', margin: '4px 0 0 0' }}>
                        {stockData[selectedStock].marketSession || marketStatus} • {stockData[selectedStock].dataSource || 'Real-time'}
                      </p>
                      {stockData[selectedStock].lastFetched && (
                        <p style={{ color: '#6B7280', fontSize: '12px', margin: '2px 0 0 0' }}>
                          Updated: {new Date(stockData[selectedStock].lastFetched).toLocaleTimeString()}
                        </p>
                      )}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{
                        fontSize: '32px',
                        fontWeight: 'bold',
                        color: parseFloat(stockData[selectedStock].change) >= 0 ? '#10B981' : '#EF4444',
                        margin: '0',
                      }}>
                        ${stockData[selectedStock].price}
                      </div>
                      <div style={{
                        fontSize: '14px',
                        marginTop: '4px',
                        color: parseFloat(stockData[selectedStock].change) >= 0 ? '#10B981' : '#EF4444'
                      }}>
                        {stockData[selectedStock].change} ({stockData[selectedStock].changePercent})
                      </div>
                    </div>
                  </div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '16px',
                    marginTop: '24px',
                  }}>
                    {[
                      { label: 'VOLUME', value: stockData[selectedStock].volume },
                      { label: 'HIGH', value: `${stockData[selectedStock].high}` },
                      { label: 'LOW', value: `${stockData[selectedStock].low}` },
                      { label: 'OPEN', value: `${stockData[selectedStock].open}` }
                    ].map(metric => (
                      <div key={metric.label} style={{
                        backgroundColor: '#000000',
                        borderRadius: '12px',
                        padding: '16px',
                      }}>
                        <p style={{
                          color: '#9CA3AF',
                          fontSize: '14px',
                          marginBottom: '4px',
                        }}>{metric.label}</p>
                        <p style={{
                          fontSize: '20px',
                          fontWeight: '600',
                          margin: '0'
                        }}>{metric.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Analysis Tab */}
        {activeTab === 'analysis' && (
          <div style={{ padding: '20px' }}>
            <div style={{
              background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)',
              borderRadius: '20px',
              padding: '24px',
              marginBottom: '16px'
            }}>
              <h2 style={{ fontSize: '24px', fontWeight: 'bold', margin: '0 0 8px 0' }}>
                {selectedStock} Analysis
              </h2>
              <p style={{ color: '#9CA3AF', margin: '0 0 8px 0' }}>
                24/7 AI-Powered Analysis - {marketStatus}
              </p>
              {analysisData && analysisData.lastUpdated && (
                <p style={{ color: '#6B7280', fontSize: '12px', margin: 0 }}>
                  Last Updated: {new Date(analysisData.lastUpdated).toLocaleString()}
                </p>
              )}
            </div>

            {isLoading.analysis && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9CA3AF' }}>
                <p style={{ fontSize: '48px', margin: '0 0 16px 0' }}>🔄</p>
                <p>Analyzing {selectedStock} with comprehensive real-time data...</p>
                <p style={{ fontSize: '14px', marginTop: '8px' }}>
                  Including futures, pre-market, news, social sentiment, and economic indicators
                </p>
              </div>
            )}

            {!isLoading.analysis && analysisData && analysisData.error && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9CA3AF' }}>
                <p style={{ fontSize: '48px', margin: '0 0 16px 0' }}>⚠️</p>
                <p style={{ fontSize: '18px', margin: '0 0 8px 0' }}>Analysis Error</p>
                <p style={{ fontSize: '14px', margin: '0', color: '#EF4444' }}>
                  {analysisData.error}
                </p>
                {analysisData.details && (
                  <p style={{ fontSize: '12px', marginTop: '8px', color: '#6B7280' }}>
                    {analysisData.details}
                  </p>
                )}
              </div>
            )}

            {!isLoading.analysis && !analysisData && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9CA3AF' }}>
                <p style={{ fontSize: '48px', margin: '0 0 16px 0' }}>📊</p>
                <p>No comprehensive analysis available</p>
                <p style={{ fontSize: '14px', marginTop: '8px' }}>
                  AI analysis requires real market data access
                </p>
              </div>
            )}

            {analysisData && !analysisData.error && !isLoading.analysis && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{
                  backgroundColor: '#1a1a1a',
                  borderRadius: '16px',
                  padding: '20px',
                  border: '1px solid #374151',
                }}>
                  <h3 style={{ margin: '0 0 12px 0', color: '#3B82F6', fontSize: '18px' }}>
                    📋 AI Analysis Results
                  </h3>
                  <pre style={{ 
                    margin: 0, 
                    lineHeight: 1.6, 
                    fontSize: '14px',
                    whiteSpace: 'pre-wrap',
                    color: '#E5E7EB'
                  }}>
                    {JSON.stringify(analysisData, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Market Tab */}
        {activeTab === 'market' && (
          <div style={{ padding: '20px' }}>
            <div style={{ marginBottom: '16px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>
                Market Overview • {marketStatus}
              </h2>
              <p style={{ color: '#9CA3AF', marginBottom: '8px', fontSize: '14px' }}>
                Real-time indices, futures, pre-market, and economic indicators
              </p>
              {marketData.lastUpdated && (
                <p style={{ color: '#6B7280', fontSize: '12px', margin: 0 }}>
                  Last Updated: {new Date(marketData.lastUpdated).toLocaleString()}
                </p>
              )}
            </div>

            {isLoading.market && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9CA3AF' }}>
                <p style={{ fontSize: '48px', margin: '0 0 16px 0' }}>🔄</p>
                <p>Loading comprehensive 24/7 market data...</p>
                <p style={{ fontSize: '14px', marginTop: '8px' }}>
                  Including {marketStatus.toLowerCase()} session data, futures, and economic indicators
                </p>
              </div>
            )}

            {!isLoading.market && marketData.error && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9CA3AF' }}>
                <p style={{ fontSize: '48px', margin: '0 0 16px 0' }}>⚠️</p>
                <p style={{ fontSize: '18px', margin: '0 0 8px 0' }}>Market Data Error</p>
                <p style={{ fontSize: '14px', margin: '0', color: '#EF4444' }}>
                  {marketData.error}
                </p>
                {marketData.details && (
                  <p style={{ fontSize: '12px', marginTop: '8px', color: '#6B7280' }}>
                    {marketData.details}
                  </p>
                )}
              </div>
            )}

            {!isLoading.market && !marketData.error && Object.keys(marketData).length > 3 && (
              <div style={{
                backgroundColor: '#1a1a1a',
                borderRadius: '16px',
                padding: '20px',
                border: '1px solid #374151',
              }}>
                <h3 style={{ margin: '0 0 12px 0', color: '#3B82F6', fontSize: '18px' }}>
                  📊 Market Data Results
                </h3>
                <pre style={{ 
                  margin: 0, 
                  lineHeight: 1.6, 
                  fontSize: '14px',
                  whiteSpace: 'pre-wrap',
                  color: '#E5E7EB'
                }}>
                  {JSON.stringify(marketData, null, 2)}
                </pre>
              </div>
            )}

            {!isLoading.market && !marketData.error && Object.keys(marketData).length <= 3 && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9CA3AF' }}>
                <p style={{ fontSize: '48px', margin: '0 0 16px 0' }}>📊</p>
                <p>No real market data available</p>
                <p style={{ fontSize: '14px', marginTop: '8px' }}>
                  Check your market dashboard API configuration
                </p>
              </div>
            )}
          </div>
        )}

        {/* Smart Plays Tab */}
        {activeTab === 'plays' && (
          <div style={{ padding: '20px' }}>
            <div style={{ marginBottom: '16px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>
                Smart Plays • {marketStatus}
              </h2>
              <p style={{ color: '#9CA3AF', marginBottom: '8px', fontSize: '14px' }}>
                Real-time opportunities from comprehensive market analysis
              </p>
            </div>
            
            {isLoading.plays && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9CA3AF' }}>
                <p style={{ fontSize: '48px', margin: '0 0 16px 0' }}>🔄</p>
                <p>Analyzing comprehensive market data for opportunities...</p>
              </div>
            )}

            {!isLoading.plays && smartPlays.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9CA3AF' }}>
                <p style={{ fontSize: '48px', margin: '0 0 16px 0' }}>🤖</p>
                <p style={{ fontSize: '18px', margin: '0 0 8px 0' }}>No qualifying opportunities</p>
                <p style={{ fontSize: '14px', margin: '0' }}>
                  No significant moves detected in current {marketStatus.toLowerCase()} conditions
                </p>
              </div>
            )}

            {smartPlays.length > 0 && (
              <div>
                {smartPlays.map((play, idx) => (
                  <div key={`${play.id}-${idx}`} style={{
                    borderRadius: '16px',
                    padding: '20px',
                    marginBottom: '16px',
                    border: '1px solid #374151',
                    backgroundColor: '#1a1a1a'
                  }}>
                    <pre style={{ 
                      margin: 0, 
                      lineHeight: 1.6, 
                      fontSize: '14px',
                      whiteSpace: 'pre-wrap',
                      color: '#E5E7EB'
                    }}>
                      {JSON.stringify(play, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Alerts Tab */}
        {activeTab === 'alerts' && (
          <div style={{ padding: '20px' }}>
            <div style={{ marginBottom: '16px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>
                Real-time Alerts • {marketStatus}
              </h2>
              <p style={{ color: '#9CA3AF', marginBottom: '8px', fontSize: '14px' }}>
                Comprehensive market monitoring with AI analysis
              </p>
            </div>
            
            {isLoading.alerts && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9CA3AF' }}>
                <p style={{ fontSize: '48px', margin: '0 0 16px 0' }}>🔄</p>
                <p>Scanning comprehensive market data for alerts...</p>
              </div>
            )}

            {!isLoading.alerts && alerts.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9CA3AF' }}>
                <p style={{ fontSize: '48px', margin: '0 0 16px 0' }}>🔔</p>
                <p style={{ fontSize: '18px', margin: '0 0 8px 0' }}>No active alerts</p>
                <p style={{ fontSize: '14px', margin: '0' }}>
                  No significant movements detected in current {marketStatus.toLowerCase()} conditions
                </p>
              </div>
            )}

            {alerts.length > 0 && (
              <div>
                {alerts.map((alert, idx) => (
                  <div key={`${alert.id}-${idx}`} style={{
                    borderRadius: '16px',
                    padding: '20px',
                    marginBottom: '16px',
                    border: '1px solid #374151',
                    backgroundColor: '#1a1a1a'
                  }}>
                    <pre style={{ 
                      margin: 0, 
                      lineHeight: 1.6, 
                      fontSize: '14px',
                      whiteSpace: 'pre-wrap',
                      color: '#E5E7EB'
                    }}>
                      {JSON.stringify(alert, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Chat Tab */}
        {activeTab === 'chat' && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: 'calc(100vh - 200px)',
            padding: '20px',
          }}>
            <div style={{
              flex: 1,
              overflowY: 'auto',
              marginBottom: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}>
              {chatMessages.map((msg, idx) => (
                <div
                  key={idx}
                  style={{
                    maxWidth: '85%',
                    padding: '12px 16px',
                    borderRadius: '18px',
                    wordWrap: 'break-word',
                    backgroundColor: msg.role === 'user' ? '#3B82F6' : '#374151',
                    color: msg.role === 'user' ? '#ffffff' : '#E5E7EB',
                    alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    marginLeft: msg.role === 'user' ? 'auto' : '0',
                    marginRight: msg.role === 'user' ? '0' : 'auto',
                  }}
                >
                  {msg.content}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
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
            </div>
          </div>
        )}
      </div>

      {/* Enhanced Bottom Navigation */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#1a1a1a',
        borderTop: '1px solid #374151',
        padding: '8px 0',
        paddingBottom: 'env(safe-area-inset-bottom, 8px)',
        zIndex: 1000
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
        }}>
          {[
            { id: 'chat', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z', label: 'CHAT' },
            { id: 'ticker', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', label: 'STOCKS' },
            { id: 'analysis', icon: 'M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z', label: 'ANALYSIS' },
            { id: 'plays', icon: 'M13 10V3L4 14h7v7l9-11h-7z', label: 'PLAYS' },
            { id: 'market', icon: 'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z', label: 'MARKET' },
            { id: 'alerts', icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9', label: 'ALERTS' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px 12px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: activeTab === tab.id ? '#3B82F6' : '#9CA3AF',
                transition: 'color 0.2s ease',
                minWidth: '60px',
                userSelect: 'none'
              }}
            >
              <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
              </svg>
              <span style={{
                fontSize: '11px',
                marginTop: '4px',
                fontWeight: activeTab === tab.id ? '600' : '400'
              }}>
                {tab.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* CSS animations */}
      <style>
        {`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}
      </style>
    </div>
  );
};

export default RoloApp;
