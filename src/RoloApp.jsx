import React, { useState, useEffect, useCallback } from 'react';

const RoloApp = () => {
  // === COMPREHENSIVE STATE MANAGEMENT ===
  const [activeTab, setActiveTab] = useState('stocks');
  const [searchTicker, setSearchTicker] = useState('');
  const [selectedStock, setSelectedStock] = useState(null);
  const [stockData, setStockData] = useState({});
  const [analysisData, setAnalysisData] = useState(null);
  const [smartPlays, setSmartPlays] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [marketData, setMarketData] = useState({});
  const [chatHistory, setChatHistory] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [loading, setLoading] = useState({
    stocks: false,
    analysis: false,
    plays: false,
    alerts: false,
    market: false,
    chat: false
  });
  const [errors, setErrors] = useState({});
  const [marketStatus, setMarketStatus] = useState('Loading...');
  const [refreshInterval, setRefreshInterval] = useState(null);
  const [lastRefresh, setLastRefresh] = useState({});
  
  // === ADVANCED WATCHLIST STATE ===
  const [popularStocks, setPopularStocks] = useState(['SPY', 'QQQ', 'AAPL', 'TSLA', 'NVDA', 'MSFT', 'GOOGL', 'AMZN', 'META']);
  const [isEditingStocks, setIsEditingStocks] = useState(false);
  const [editingIndex, setEditingIndex] = useState(-1);
  const [editValue, setEditValue] = useState('');
  const [watchlistExpanded, setWatchlistExpanded] = useState(false);

  // === UTILITY FUNCTIONS ===
  const formatPrice = (price) => {
    if (!price) return 'N/A';
    return typeof price === 'number' ? `$${price.toFixed(2)}` : price;
  };

  const getPriceChangeColor = (change) => {
    if (!change) return '#9CA3AF';
    const numChange = typeof change === 'string' ? parseFloat(change.replace(/[^-\d.]/g, '')) : change;
    return numChange >= 0 ? '#10B981' : '#EF4444';
  };

  const getMarketSessionInfo = () => {
    const now = new Date();
    const day = now.getDay();
    const time = now.getHours() * 60 + now.getMinutes();
    
    if (day === 0 || day === 6) return { session: 'Weekend', color: '#6B7280', interval: 300000 };
    if (time >= 930 && time < 1600) return { session: 'Market Open', color: '#10B981', interval: 60000 };
    if (time >= 400 && time < 930) return { session: 'Pre-Market', color: '#F59E0B', interval: 300000 };
    if (time >= 1600 && time < 2000) return { session: 'After Hours', color: '#F59E0B', interval: 300000 };
    if (time >= 1800 || time < 500) return { session: 'Futures Open', color: '#8B5CF6', interval: 300000 };
    return { session: 'Market Closed', color: '#6B7280', interval: 600000 };
  };

  // === LOCALSTORAGE FUNCTIONS ===
  const saveWatchlist = (stocks) => {
    try {
      localStorage.setItem('roloWatchlist', JSON.stringify(stocks));
      setPopularStocks(stocks);
    } catch (error) {
      console.error('Failed to save watchlist:', error);
    }
  };

  const loadWatchlist = () => {
    try {
      const saved = localStorage.getItem('roloWatchlist');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setPopularStocks(parsed);
        }
      }
    } catch (error) {
      console.error('Failed to load watchlist:', error);
    }
  };

  // === COMPREHENSIVE API FUNCTIONS ===
  const fetchStockData = useCallback(async (symbols = popularStocks) => {
    if (!symbols || symbols.length === 0) return;
    
    setLoading(prev => ({ ...prev, stocks: true }));
    setErrors(prev => ({ ...prev, stocks: null }));
    
    try {
      const promises = symbols.map(async (symbol) => {
        if (!symbol || symbol === 'NEW') return null;
        
        try {
          const response = await fetch(`/.netlify/functions/enhanced-stock-data?symbol=${symbol}`);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const data = await response.json();
          return { symbol, data };
        } catch (error) {
          console.error(`Error fetching ${symbol}:`, error);
          return { symbol, data: null };
        }
      });

      const results = await Promise.all(promises);
      const newStockData = {};
      
      results.forEach(result => {
        if (result && result.data) {
          newStockData[result.symbol] = {
            price: result.data.price || 'N/A',
            change: result.data.change || 'N/A',
            changePercent: result.data.changePercent || 'N/A',
            marketSession: result.data.marketSession || getMarketSessionInfo().session,
            volume: result.data.volume || 'N/A',
            lastUpdated: new Date().toLocaleTimeString()
          };
        }
      });

      setStockData(prev => ({ ...prev, ...newStockData }));
      setLastRefresh(prev => ({ ...prev, stocks: new Date().toLocaleTimeString() }));
      
    } catch (error) {
      console.error('Error in fetchStockData:', error);
      setErrors(prev => ({ ...prev, stocks: error.message }));
    } finally {
      setLoading(prev => ({ ...prev, stocks: false }));
    }
  }, [popularStocks]);

  const fetchAIAnalysis = useCallback(async (symbol = selectedStock || popularStocks[0]) => {
    if (!symbol) return;
    
    setLoading(prev => ({ ...prev, analysis: true }));
    setErrors(prev => ({ ...prev, analysis: null }));
    
    try {
      const response = await fetch(`/.netlify/functions/comprehensive-ai-analysis?symbol=${symbol}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      
      setAnalysisData({
        symbol: symbol,
        analysis: data.analysis || 'Analysis not available',
        technicals: data.technicals || {},
        recommendation: data.recommendation || 'Hold',
        priceTarget: data.priceTarget || 'N/A',
        riskLevel: data.riskLevel || 'Medium',
        lastUpdated: new Date().toLocaleTimeString()
      });
      
      setLastRefresh(prev => ({ ...prev, analysis: new Date().toLocaleTimeString() }));
      
    } catch (error) {
      console.error('Error in fetchAIAnalysis:', error);
      setErrors(prev => ({ ...prev, analysis: error.message }));
      setAnalysisData(null);
    } finally {
      setLoading(prev => ({ ...prev, analysis: false }));
    }
  }, [selectedStock, popularStocks]);

  const fetchSmartPlays = useCallback(async () => {
    setLoading(prev => ({ ...prev, plays: true }));
    setErrors(prev => ({ ...prev, plays: null }));
    
    try {
      const sessionInfo = getMarketSessionInfo();
      const response = await fetch(`/.netlify/functions/smart-plays-generator?session=${sessionInfo.session}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      
      if (data.plays && Array.isArray(data.plays)) {
        setSmartPlays(data.plays.map(play => ({
          ...play,
          id: Math.random().toString(36).substr(2, 9),
          lastUpdated: new Date().toLocaleTimeString()
        })));
      } else {
        setSmartPlays([]);
      }
      
      setLastRefresh(prev => ({ ...prev, plays: new Date().toLocaleTimeString() }));
      
    } catch (error) {
      console.error('Error in fetchSmartPlays:', error);
      setErrors(prev => ({ ...prev, plays: error.message }));
      setSmartPlays([]);
    } finally {
      setLoading(prev => ({ ...prev, plays: false }));
    }
  }, []);

  const fetchAlerts = useCallback(async () => {
    setLoading(prev => ({ ...prev, alerts: true }));
    setErrors(prev => ({ ...prev, alerts: null }));
    
    try {
      const response = await fetch('/.netlify/functions/realtime-alerts');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      
      if (data.alerts && Array.isArray(data.alerts)) {
        setAlerts(data.alerts.map(alert => ({
          ...alert,
          id: Math.random().toString(36).substr(2, 9),
          timestamp: new Date().toLocaleTimeString()
        })));
      } else {
        setAlerts([]);
      }
      
      setLastRefresh(prev => ({ ...prev, alerts: new Date().toLocaleTimeString() }));
      
    } catch (error) {
      console.error('Error in fetchAlerts:', error);
      setErrors(prev => ({ ...prev, alerts: error.message }));
      setAlerts([]);
    } finally {
      setLoading(prev => ({ ...prev, alerts: false }));
    }
  }, []);

  const fetchMarketData = useCallback(async () => {
    setLoading(prev => ({ ...prev, market: true }));
    setErrors(prev => ({ ...prev, market: null }));
    
    try {
      const response = await fetch('/.netlify/functions/market-dashboard');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      
      setMarketData({
        indices: data.indices || {},
        economic: data.economic || {},
        sectors: data.sectors || {},
        vix: data.vix || 'N/A',
        marketMood: data.marketMood || 'Neutral',
        lastUpdated: new Date().toLocaleTimeString()
      });
      
      setLastRefresh(prev => ({ ...prev, market: new Date().toLocaleTimeString() }));
      
    } catch (error) {
      console.error('Error in fetchMarketData:', error);
      setErrors(prev => ({ ...prev, market: error.message }));
    } finally {
      setLoading(prev => ({ ...prev, market: false }));
    }
  }, []);

  const sendChatMessage = useCallback(async (message) => {
    if (!message.trim()) return;
    
    setLoading(prev => ({ ...prev, chat: true }));
    
    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: message,
      timestamp: new Date().toLocaleTimeString()
    };
    
    setChatHistory(prev => [...prev, userMessage]);
    setChatInput('');
    
    try {
      const context = {
        selectedStock,
        marketData,
        stockData,
        recentAlerts: alerts.slice(0, 3)
      };
      
      const response = await fetch('/.netlify/functions/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, context })
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      
      const botMessage = {
        id: Date.now() + 1,
        type: 'bot',
        content: data.response || 'Sorry, I could not process your request.',
        timestamp: new Date().toLocaleTimeString()
      };
      
      setChatHistory(prev => [...prev, botMessage]);
      
    } catch (error) {
      console.error('Error in sendChatMessage:', error);
      const errorMessage = {
        id: Date.now() + 1,
        type: 'bot',
        content: 'Sorry, I encountered an error processing your message.',
        timestamp: new Date().toLocaleTimeString()
      };
      setChatHistory(prev => [...prev, errorMessage]);
    } finally {
      setLoading(prev => ({ ...prev, chat: false }));
    }
  }, [selectedStock, marketData, stockData, alerts]);

  // === WATCHLIST MANAGEMENT ===
  const handleEditStock = (index) => {
    setEditingIndex(index);
    setEditValue(popularStocks[index] || '');
  };

  const handleSaveStock = () => {
    const newValue = editValue.toUpperCase().trim();
    if (newValue && newValue !== 'NEW') {
      const newStocks = [...popularStocks];
      newStocks[editingIndex] = newValue;
      saveWatchlist(newStocks);
    }
    setEditingIndex(-1);
    setEditValue('');
  };

  const handleDeleteStock = (index) => {
    if (popularStocks.length > 3) {
      const newStocks = popularStocks.filter((_, i) => i !== index);
      saveWatchlist(newStocks);
    }
  };

  // === EFFECTS ===
  useEffect(() => {
    loadWatchlist();
    const sessionInfo = getMarketSessionInfo();
    setMarketStatus(sessionInfo.session);
  }, []);

  useEffect(() => {
    if (popularStocks.length > 0) {
      fetchStockData();
    }
  }, [fetchStockData, popularStocks]);

  useEffect(() => {
    const sessionInfo = getMarketSessionInfo();
    setMarketStatus(sessionInfo.session);
    
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }
    
    const interval = setInterval(() => {
      const currentSession = getMarketSessionInfo();
      setMarketStatus(currentSession.session);
      
      if (activeTab === 'stocks') fetchStockData();
      if (activeTab === 'analysis' && selectedStock) fetchAIAnalysis();
      if (activeTab === 'plays') fetchSmartPlays();
      if (activeTab === 'alerts') fetchAlerts();
      if (activeTab === 'market') fetchMarketData();
    }, sessionInfo.interval);
    
    setRefreshInterval(interval);
    
    return () => clearInterval(interval);
  }, [activeTab, selectedStock, fetchStockData, fetchAIAnalysis, fetchSmartPlays, fetchAlerts, fetchMarketData]);

  useEffect(() => {
    if (activeTab === 'analysis' && selectedStock) {
      fetchAIAnalysis();
    } else if (activeTab === 'plays') {
      fetchSmartPlays();
    } else if (activeTab === 'alerts') {
      fetchAlerts();
    } else if (activeTab === 'market') {
      fetchMarketData();
    }
  }, [activeTab, selectedStock, fetchAIAnalysis, fetchSmartPlays, fetchAlerts, fetchMarketData]);

  // === RENDER FUNCTIONS ===
  const renderStocksTab = () => (
    <div style={{ padding: '24px' }}>
      {/* Market Status Header */}
      <div style={{
        backgroundColor: '#1a1a1a',
        borderRadius: '16px',
        padding: '16px',
        marginBottom: '24px',
        border: '1px solid #1F2937',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <div style={{ color: '#E5E7EB', fontSize: '16px', fontWeight: '600' }}>
            Market Status
          </div>
          <div style={{ 
            color: getMarketSessionInfo().color, 
            fontSize: '14px',
            marginTop: '4px'
          }}>
            {marketStatus}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: '#9CA3AF', fontSize: '12px' }}>
            Last Update: {lastRefresh.stocks || 'Never'}
          </div>
          <button
            onClick={() => setIsEditingStocks(!isEditingStocks)}
            style={{
              backgroundColor: isEditingStocks ? '#10B981' : '#374151',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '6px 12px',
              fontSize: '12px',
              cursor: 'pointer',
              marginTop: '4px'
            }}
          >
            {isEditingStocks ? 'Done' : 'Edit'}
          </button>
        </div>
      </div>

      {/* Watchlist Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '12px',
        marginBottom: '24px'
      }}>
        {popularStocks.map((symbol, index) => {
          if (symbol === 'NEW') return null;
          
          return (
            <div
              key={index}
              onClick={() => !isEditingStocks && setSelectedStock(symbol)}
              style={{
                backgroundColor: selectedStock === symbol ? '#1F2937' : '#111111',
                borderRadius: '12px',
                padding: '12px',
                border: selectedStock === symbol ? '2px solid #10B981' : '1px solid #1F2937',
                cursor: 'pointer',
                position: 'relative',
                minHeight: '80px'
              }}
            >
              {isEditingStocks && (
                <div style={{
                  position: 'absolute',
                  top: '4px',
                  right: '4px',
                  display: 'flex',
                  gap: '4px'
                }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditStock(index);
                    }}
                    style={{
                      backgroundColor: '#374151',
                      color: '#9CA3AF',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '2px 6px',
                      fontSize: '10px',
                      cursor: 'pointer'
                    }}
                  >
                    ✏️
                  </button>
                  {popularStocks.length > 3 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteStock(index);
                      }}
                      style={{
                        backgroundColor: '#EF4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '2px 6px',
                        fontSize: '10px',
                        cursor: 'pointer'
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              )}

              {editingIndex === index ? (
                <div style={{ marginTop: '16px' }}>
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    style={{
                      backgroundColor: '#374151',
                      border: '1px solid #6B7280',
                      borderRadius: '4px',
                      padding: '4px 8px',
                      color: '#E5E7EB',
                      fontSize: '12px',
                      width: '100%',
                      marginBottom: '8px'
                    }}
                    placeholder="Symbol"
                    autoFocus
                  />
                  <button
                    onClick={handleSaveStock}
                    style={{
                      backgroundColor: '#10B981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '4px 8px',
                      fontSize: '10px',
                      cursor: 'pointer',
                      width: '100%'
                    }}
                  >
                    Save
                  </button>
                </div>
              ) : (
                <>
                  <div style={{
                    color: '#E5E7EB',
                    fontSize: '14px',
                    fontWeight: '600',
                    marginBottom: '8px'
                  }}>
                    {symbol}
                  </div>
                  
                  {loading.stocks ? (
                    <div style={{ fontSize: '12px', color: '#6B7280' }}>Loading...</div>
                  ) : stockData[symbol] ? (
                    <>
                      <div style={{ fontSize: '14px', color: '#9CA3AF', marginBottom: '2px' }}>
                        {formatPrice(stockData[symbol].price)}
                      </div>
                      <div style={{
                        fontSize: '12px',
                        color: getPriceChangeColor(stockData[symbol].change)
                      }}>
                        {stockData[symbol].changePercent}
                      </div>
                      <div style={{ fontSize: '10px', color: '#6B7280', marginTop: '2px' }}>
                        {stockData[symbol].marketSession || marketStatus}
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize: '12px', color: '#6B7280' }}>No data</div>
                  )}
                </>
              )}
            </div>
          );
        })}
        
        {isEditingStocks && popularStocks.length < 12 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              const newStocks = [...popularStocks, 'NEW'];
              saveWatchlist(newStocks);
              handleEditStock(newStocks.length - 1);
            }}
            style={{
              backgroundColor: '#374151',
              border: '1px dashed #6B7280',
              borderRadius: '12px',
              padding: '12px',
              color: '#9CA3AF',
              cursor: 'pointer',
              fontSize: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '80px'
            }}
          >
            +
          </button>
        )}
      </div>

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
              <h3 style={{
                margin: '0 0 4px 0',
                color: '#E5E7EB',
                fontSize: '20px',
                fontWeight: '600'
              }}>
                {selectedStock}
              </h3>
              <div style={{
                fontSize: '24px',
                color: '#E5E7EB',
                fontWeight: '700',
                marginBottom: '8px'
              }}>
                {formatPrice(stockData[selectedStock].price)}
              </div>
              <div style={{
                fontSize: '14px',
                color: getPriceChangeColor(stockData[selectedStock].change),
                fontWeight: '500'
              }}>
                {stockData[selectedStock].changePercent}
              </div>
            </div>
          </div>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '16px',
            marginTop: '20px'
          }}>
            <div>
              <div style={{ color: '#9CA3AF', fontSize: '12px', marginBottom: '4px' }}>
                Volume
              </div>
              <div style={{ color: '#E5E7EB', fontSize: '14px', fontWeight: '500' }}>
                {stockData[selectedStock].volume || 'N/A'}
              </div>
            </div>
            <div>
              <div style={{ color: '#9CA3AF', fontSize: '12px', marginBottom: '4px' }}>
                Session
              </div>
              <div style={{ color: '#E5E7EB', fontSize: '14px', fontWeight: '500' }}>
                {stockData[selectedStock].marketSession || marketStatus}
              </div>
            </div>
          </div>
        </div>
      )}

      {errors.stocks && (
        <div style={{
          backgroundColor: '#FEF2F2',
          border: '1px solid #FECACA',
          borderRadius: '8px',
          padding: '12px',
          marginTop: '16px'
        }}>
          <div style={{ color: '#DC2626', fontSize: '14px' }}>
            Error loading stock data: {errors.stocks}
          </div>
        </div>
      )}
    </div>
  );

  const renderAnalysisTab = () => (
    <div style={{ padding: '24px' }}>
      <div style={{
        backgroundColor: '#1a1a1a',
        borderRadius: '20px',
        padding: '24px',
        border: '1px solid #1F2937'
      }}>
        <h2 style={{
          margin: '0 0 16px 0',
          color: '#E5E7EB',
          fontSize: '20px',
          fontWeight: '600'
        }}>
          AI Analysis {selectedStock ? `- ${selectedStock}` : ''}
        </h2>
        
        {loading.analysis ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px'
          }}>
            <div style={{ color: '#9CA3AF' }}>Analyzing market data...</div>
          </div>
        ) : errors.analysis ? (
          <div style={{
            backgroundColor: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: '8px',
            padding: '16px'
          }}>
            <div style={{ color: '#DC2626', fontSize: '14px' }}>
              Error loading analysis: {errors.analysis}
            </div>
          </div>
        ) : analysisData ? (
          <div>
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{
                color: '#E5E7EB',
                fontSize: '16px',
                fontWeight: '600',
                marginBottom: '8px'
              }}>
                Market Analysis
              </h3>
              <div style={{
                color: '#D1D5DB',
                fontSize: '14px',
                lineHeight: '1.6'
              }}>
                {analysisData.analysis}
              </div>
            </div>
            
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '16px',
              marginTop: '20px'
            }}>
              <div>
                <div style={{ color: '#9CA3AF', fontSize: '12px', marginBottom: '4px' }}>
                  Recommendation
                </div>
                <div style={{
                  color: analysisData.recommendation === 'Buy' ? '#10B981' : 
                        analysisData.recommendation === 'Sell' ? '#EF4444' : '#F59E0B',
                  fontSize: '14px',
                  fontWeight: '600'
                }}>
                  {analysisData.recommendation}
                </div>
              </div>
              <div>
                <div style={{ color: '#9CA3AF', fontSize: '12px', marginBottom: '4px' }}>
                  Price Target
                </div>
                <div style={{ color: '#E5E7EB', fontSize: '14px', fontWeight: '500' }}>
                  {analysisData.priceTarget}
                </div>
              </div>
              <div>
                <div style={{ color: '#9CA3AF', fontSize: '12px', marginBottom: '4px' }}>
                  Risk Level
                </div>
                <div style={{
                  color: analysisData.riskLevel === 'Low' ? '#10B981' :
                        analysisData.riskLevel === 'High' ? '#EF4444' : '#F59E0B',
                  fontSize: '14px',
                  fontWeight: '500'
                }}>
                  {analysisData.riskLevel}
                </div>
              </div>
              <div>
                <div style={{ color: '#9CA3AF', fontSize: '12px', marginBottom: '4px' }}>
                  Last Updated
                </div>
                <div style={{ color: '#E5E7EB', fontSize: '14px', fontWeight: '500' }}>
                  {analysisData.lastUpdated}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{
            textAlign: 'center',
            padding: '40px',
            color: '#9CA3AF'
          }}>
            Select a stock from the Stocks tab to see AI analysis
          </div>
        )}
      </div>
    </div>
  );

  const renderSmartPlaysTab = () => (
    <div style={{ padding: '24px' }}>
      <div style={{
        backgroundColor: '#1a1a1a',
        borderRadius: '20px',
        padding: '24px',
        border: '1px solid #1F2937'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px'
        }}>
          <h2 style={{
            margin: '0',
            color: '#E5E7EB',
            fontSize: '20px',
            fontWeight: '600'
          }}>
            Smart Plays
          </h2>
          <div style={{ color: '#9CA3AF', fontSize: '12px' }}>
            {lastRefresh.plays && `Updated: ${lastRefresh.plays}`}
          </div>
        </div>

        {loading.plays ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px'
          }}>
            <div style={{ color: '#9CA3AF' }}>Finding trading opportunities...</div>
          </div>
        ) : errors.plays ? (
          <div style={{
            backgroundColor: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: '8px',
            padding: '16px'
          }}>
            <div style={{ color: '#DC2626', fontSize: '14px' }}>
              Error loading smart plays: {errors.plays}
            </div>
          </div>
        ) : smartPlays.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {smartPlays.map((play, index) => (
              <div
                key={play.id || index}
                style={{
                  backgroundColor: '#111111',
                  borderRadius: '12px',
                  padding: '20px',
                  border: '1px solid #1F2937'
                }}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '12px'
                }}>
                  <div>
                    <h3 style={{
                      margin: '0 0 4px 0',
                      color: '#E5E7EB',
                      fontSize: '16px',
                      fontWeight: '600'
                    }}>
                      {play.symbol || 'Unknown'}
                    </h3>
                    <div style={{
                      color: play.direction === 'LONG' ? '#10B981' : '#EF4444',
                      fontSize: '14px',
                      fontWeight: '500'
                    }}>
                      {play.direction || 'N/A'} • {play.timeframe || 'N/A'}
                    </div>
                  </div>
                  <div style={{
                    backgroundColor: play.confidence >= 80 ? '#10B981' : 
                                   play.confidence >= 60 ? '#F59E0B' : '#6B7280',
                    color: 'white',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: '600'
                  }}>
                    {play.confidence || 'N/A'}%
                  </div>
                </div>

                <div style={{
                  color: '#D1D5DB',
                  fontSize: '14px',
                  lineHeight: '1.5',
                  marginBottom: '16px'
                }}>
                  {play.reasoning || 'No reasoning provided'}
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '12px'
                }}>
                  <div>
                    <div style={{ color: '#9CA3AF', fontSize: '12px', marginBottom: '4px' }}>
                      Entry
                    </div>
                    <div style={{ color: '#E5E7EB', fontSize: '14px', fontWeight: '500' }}>
                      {formatPrice(play.entryPrice)}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: '#9CA3AF', fontSize: '12px', marginBottom: '4px' }}>
                      Stop Loss
                    </div>
                    <div style={{ color: '#EF4444', fontSize: '14px', fontWeight: '500' }}>
                      {formatPrice(play.stopLoss)}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: '#9CA3AF', fontSize: '12px', marginBottom: '4px' }}>
                      Target
                    </div>
                    <div style={{ color: '#10B981', fontSize: '14px', fontWeight: '500' }}>
                      {formatPrice(play.targetPrice)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{
            textAlign: 'center',
            padding: '40px',
            color: '#9CA3AF'
          }}>
            {getMarketSessionInfo().session === 'Weekend' || getMarketSessionInfo().session === 'Market Closed' 
              ? 'No active trading opportunities during market closure'
              : 'No trading opportunities found at this time'
            }
          </div>
        )}
      </div>
    </div>
  );

  const renderAlertsTab = () => (
    <div style={{ padding: '24px' }}>
      <div style={{
        backgroundColor: '#1a1a1a',
        borderRadius: '20px',
        padding: '24px',
        border: '1px solid #1F2937'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px'
        }}>
          <h2 style={{
            margin: '0',
            color: '#E5E7EB',
            fontSize: '20px',
            fontWeight: '600'
          }}>
            Real-time Alerts
          </h2>
          <div style={{ color: '#9CA3AF', fontSize: '12px' }}>
            {lastRefresh.alerts && `Updated: ${lastRefresh.alerts}`}
          </div>
        </div>

        {loading.alerts ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px'
          }}>
            <div style={{ color: '#9CA3AF' }}>Scanning for market alerts...</div>
          </div>
        ) : errors.alerts ? (
          <div style={{
            backgroundColor: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: '8px',
            padding: '16px'
          }}>
            <div style={{ color: '#DC2626', fontSize: '14px' }}>
              Error loading alerts: {errors.alerts}
            </div>
          </div>
        ) : alerts.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {alerts.map((alert, index) => (
              <div
                key={alert.id || index}
                style={{
                  backgroundColor: '#111111',
                  borderRadius: '12px',
                  padding: '16px',
                  border: `1px solid ${
                    alert.priority === 'HIGH' ? '#EF4444' :
                    alert.priority === 'MEDIUM' ? '#F59E0B' : '#1F2937'
                  }`
                }}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '8px'
                }}>
                  <div>
                    <h3 style={{
                      margin: '0 0 4px 0',
                      color: '#E5E7EB',
                      fontSize: '14px',
                      fontWeight: '600'
                    }}>
                      {alert.symbol || 'Market Alert'}
                    </h3>
                    <div style={{
                      color: alert.priority === 'HIGH' ? '#EF4444' :
                            alert.priority === 'MEDIUM' ? '#F59E0B' : '#10B981',
                      fontSize: '12px',
                      fontWeight: '500'
                    }}>
                      {alert.type || 'Alert'} • {alert.priority || 'NORMAL'}
                    </div>
                  </div>
                  <div style={{ color: '#9CA3AF', fontSize: '11px' }}>
                    {alert.timestamp}
                  </div>
                </div>

                <div style={{
                  color: '#D1D5DB',
                  fontSize: '13px',
                  lineHeight: '1.4',
                  marginBottom: '8px'
                }}>
                  {alert.message || 'No message available'}
                </div>

                {alert.action && (
                  <div style={{
                    backgroundColor: '#374151',
                    borderRadius: '6px',
                    padding: '8px',
                    marginTop: '8px'
                  }}>
                    <div style={{ color: '#9CA3AF', fontSize: '11px', marginBottom: '2px' }}>
                      Suggested Action:
                    </div>
                    <div style={{ color: '#E5E7EB', fontSize: '12px' }}>
                      {alert.action}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div style={{
            textAlign: 'center',
            padding: '40px',
            color: '#9CA3AF'
          }}>
            No active alerts at this time
          </div>
        )}
      </div>
    </div>
  );

  const renderMarketTab = () => (
    <div style={{ padding: '24px' }}>
      <div style={{
        backgroundColor: '#1a1a1a',
        borderRadius: '20px',
        padding: '24px',
        border: '1px solid #1F2937'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px'
        }}>
          <h2 style={{
            margin: '0',
            color: '#E5E7EB',
            fontSize: '20px',
            fontWeight: '600'
          }}>
            Market Overview
          </h2>
          <div style={{ color: '#9CA3AF', fontSize: '12px' }}>
            {lastRefresh.market && `Updated: ${lastRefresh.market}`}
          </div>
        </div>

        {loading.market ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px'
          }}>
            <div style={{ color: '#9CA3AF' }}>Loading market data...</div>
          </div>
        ) : errors.market ? (
          <div style={{
            backgroundColor: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: '8px',
            padding: '16px'
          }}>
            <div style={{ color: '#DC2626', fontSize: '14px' }}>
              Error loading market data: {errors.market}
            </div>
          </div>
        ) : (
          <div>
            {/* Market Indices */}
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{
                color: '#E5E7EB',
                fontSize: '16px',
                fontWeight: '600',
                marginBottom: '12px'
              }}>
                Major Indices
              </h3>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '12px'
              }}>
                {Object.entries(marketData.indices || {}).map(([index, data]) => (
                  <div
                    key={index}
                    style={{
                      backgroundColor: '#111111',
                      borderRadius: '8px',
                      padding: '16px',
                      border: '1px solid #1F2937'
                    }}
                  >
                    <div style={{
                      color: '#E5E7EB',
                      fontSize: '14px',
                      fontWeight: '600',
                      marginBottom: '4px'
                    }}>
                      {index}
                    </div>
                    <div style={{
                      color: '#D1D5DB',
                      fontSize: '16px',
                      fontWeight: '500',
                      marginBottom: '4px'
                    }}>
                      {formatPrice(data.price)}
                    </div>
                    <div style={{
                      color: getPriceChangeColor(data.change),
                      fontSize: '12px'
                    }}>
                      {data.changePercent || 'N/A'}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Market Mood */}
            {marketData.vix && (
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{
                  color: '#E5E7EB',
                  fontSize: '16px',
                  fontWeight: '600',
                  marginBottom: '12px'
                }}>
                  Market Sentiment
                </h3>
                <div style={{
                  backgroundColor: '#111111',
                  borderRadius: '8px',
                  padding: '16px',
                  border: '1px solid #1F2937'
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <div style={{
                        color: '#E5E7EB',
                        fontSize: '14px',
                        fontWeight: '600'
                      }}>
                        VIX Fear & Greed
                      </div>
                      <div style={{
                        color: '#D1D5DB',
                        fontSize: '16px',
                        fontWeight: '500'
                      }}>
                        {marketData.vix}
                      </div>
                    </div>
                    <div style={{
                      color: marketData.marketMood === 'Fearful' ? '#EF4444' :
                            marketData.marketMood === 'Greedy' ? '#10B981' : '#F59E0B',
                      fontSize: '14px',
                      fontWeight: '600'
                    }}>
                      {marketData.marketMood || 'Neutral'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Economic Indicators */}
            {marketData.economic && Object.keys(marketData.economic).length > 0 && (
              <div>
                <h3 style={{
                  color: '#E5E7EB',
                  fontSize: '16px',
                  fontWeight: '600',
                  marginBottom: '12px'
                }}>
                  Economic Indicators
                </h3>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '12px'
                }}>
                  {Object.entries(marketData.economic).map(([indicator, value]) => (
                    <div
                      key={indicator}
                      style={{
                        backgroundColor: '#111111',
                        borderRadius: '8px',
                        padding: '16px',
                        border: '1px solid #1F2937'
                      }}
                    >
                      <div style={{
                        color: '#E5E7EB',
                        fontSize: '12px',
                        fontWeight: '600',
                        marginBottom: '4px'
                      }}>
                        {indicator.replace(/([A-Z])/g, ' $1').trim()}
                      </div>
                      <div style={{
                        color: '#D1D5DB',
                        fontSize: '14px',
                        fontWeight: '500'
                      }}>
                        {value || 'N/A'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const renderChatTab = () => (
    <div style={{ padding: '24px', height: 'calc(100vh - 200px)', display: 'flex', flexDirection: 'column' }}>
      {/* Chat Header */}
      <div style={{
        backgroundColor: '#1a1a1a',
        borderRadius: '16px 16px 0 0',
        padding: '16px',
        border: '1px solid #1F2937',
        borderBottom: 'none'
      }}>
        <h2 style={{
          margin: '0',
          color: '#E5E7EB',
          fontSize: '18px',
          fontWeight: '600'
        }}>
          Chat with Rolo AI
        </h2>
        <div style={{ color: '#9CA3AF', fontSize: '12px', marginTop: '4px' }}>
          Ask questions about stocks, market conditions, or trading strategies
        </div>
      </div>

      {/* Chat Messages */}
      <div style={{
        flex: 1,
        backgroundColor: '#1a1a1a',
        padding: '16px',
        border: '1px solid #1F2937',
        borderTop: 'none',
        borderBottom: 'none',
        overflowY: 'auto',
        maxHeight: '400px'
      }}>
        {chatHistory.length === 0 ? (
          <div style={{
            textAlign: 'center',
            color: '#9CA3AF',
            fontSize: '14px',
            padding: '40px'
          }}>
            Start a conversation with Rolo AI. Ask about any stock or market condition.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {chatHistory.map((message) => (
              <div
                key={message.id}
                style={{
                  display: 'flex',
                  justifyContent: message.type === 'user' ? 'flex-end' : 'flex-start'
                }}
              >
                <div style={{
                  backgroundColor: message.type === 'user' ? '#10B981' : '#374151',
                  color: 'white',
                  padding: '12px 16px',
                  borderRadius: message.type === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  maxWidth: '80%',
                  fontSize: '14px',
                  lineHeight: '1.4'
                }}>
                  <div>{message.content}</div>
                  <div style={{
                    fontSize: '11px',
                    opacity: 0.7,
                    marginTop: '4px'
                  }}>
                    {message.timestamp}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Chat Input */}
      <div style={{
        backgroundColor: '#1a1a1a',
        borderRadius: '0 0 16px 16px',
        padding: '16px',
        border: '1px solid #1F2937',
        borderTop: 'none'
      }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !loading.chat && sendChatMessage(chatInput)}
            placeholder="Ask Rolo about stocks, markets, or trading..."
            disabled={loading.chat}
            style={{
              flex: 1,
              backgroundColor: '#374151',
              border: '1px solid #6B7280',
              borderRadius: '12px',
              padding: '12px 16px',
              color: '#E5E7EB',
              fontSize: '14px',
              outline: 'none'
            }}
          />
          <button
            onClick={() => sendChatMessage(chatInput)}
            disabled={loading.chat || !chatInput.trim()}
            style={{
              backgroundColor: loading.chat || !chatInput.trim() ? '#6B7280' : '#10B981',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              padding: '12px 20px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: loading.chat || !chatInput.trim() ? 'not-allowed' : 'pointer'
            }}
          >
            {loading.chat ? '...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );

  // === MAIN COMPONENT RENDER ===
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#000000',
      color: '#E5E7EB',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)',
        padding: '16px 24px',
        borderBottom: '1px solid #1F2937',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h1 style={{
              margin: '0',
              fontSize: '24px',
              fontWeight: '700',
              background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              Rolo
            </h1>
            <div style={{
              fontSize: '12px',
              color: getMarketSessionInfo().color,
              fontWeight: '500',
              marginTop: '2px'
            }}>
              {marketStatus}
            </div>
          </div>
          <div style={{
            backgroundColor: '#374151',
            borderRadius: '12px',
            padding: '8px 12px',
            fontSize: '12px',
            color: '#9CA3AF'
          }}>
            Live Trading Assistant
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div style={{ paddingBottom: '100px' }}>
        {activeTab === 'stocks' && renderStocksTab()}
        {activeTab === 'analysis' && renderAnalysisTab()}
        {activeTab === 'plays' && renderSmartPlaysTab()}
        {activeTab === 'alerts' && renderAlertsTab()}
        {activeTab === 'market' && renderMarketTab()}
        {activeTab === 'chat' && renderChatTab()}
      </div>

      {/* Bottom Navigation */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#1a1a1a',
        borderTop: '1px solid #1F2937',
        padding: '12px 0',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center'
      }}>
        {[
          { id: 'stocks', label: 'Stocks', icon: '📈' },
          { id: 'analysis', label: 'Analysis', icon: '🧠' },
          { id: 'plays', label: 'Plays', icon: '🎯' },
          { id: 'alerts', label: 'Alerts', icon: '🚨' },
          { id: 'market', label: 'Market', icon: '🌍' },
          { id: 'chat', label: 'Chat', icon: '💬' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              background: 'none',
              border: 'none',
              color: activeTab === tab.id ? '#10B981' : '#9CA3AF',
              fontSize: '12px',
              fontWeight: '500',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              padding: '8px 12px',
              borderRadius: '8px',
              transition: 'all 0.2s ease'
            }}
          >
            <span style={{ fontSize: '18px' }}>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default RoloApp;
