import { useState, useEffect, useCallback, useMemo } from 'react';

export default function RoloApp() {
  // --- STATE MANAGEMENT ---
  const [activeTab, setActiveTab] = useState('stocks');
  const [selectedStock, setSelectedStock] = useState('AAPL');
  const [stockData, setStockData] = useState({});
  const [analysisData, setAnalysisData] = useState(null);
  const [smartPlaysData, setSmartPlaysData] = useState([]);
  const [alertsData, setAlertsData] = useState([]);
  const [marketData, setMarketData] = useState({});
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [watchlist, setWatchlist] = useState(['AAPL', 'TSLA', 'NVDA', 'MSFT', 'GOOGL', 'AMZN']);
  const [isLoading, setIsLoading] = useState({
    stocks: false,
    analysis: false,
    plays: false,
    alerts: false,
    market: false,
    chat: false
  });
  const [errors, setErrors] = useState({});
  const [marketStatus, setMarketStatus] = useState('Loading...');
  const [marketMood, setMarketMood] = useState('Neutral');
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);

  // --- ADVANCED FEATURES ---
  const [sectorData, setSectorData] = useState([]);
  const [economicData, setEconomicData] = useState({});
  const [breadthData, setBreadthData] = useState({});
  const [optionsFlowData, setOptionsFlowData] = useState([]);
  const [newsData, setNewsData] = useState([]);
  const [socialSentiment, setSocialSentiment] = useState({});
  const [technicalIndicators, setTechnicalIndicators] = useState({});
  const [tradingPlan, setTradingPlan] = useState(null);

  // --- UTILITY FUNCTIONS ---
  const formatPrice = useCallback((price) => {
    if (!price) return '$--';
    const num = parseFloat(price);
    return `$${num.toFixed(2)}`;
  }, []);

  const formatPercentage = useCallback((change) => {
    if (!change) return '0.00%';
    const num = parseFloat(change);
    const sign = num >= 0 ? '+' : '';
    return `${sign}${num.toFixed(2)}%`;
  }, []);

  const getChangeColor = useCallback((change) => {
    if (!change) return '#9CA3AF';
    const num = parseFloat(change);
    return num >= 0 ? '#10B981' : '#EF4444';
  }, []);

  // --- MARKET SESSION DETECTION ---
  const getMarketSession = useCallback(() => {
    const now = new Date();
    const currentTime = now.getHours() * 100 + now.getMinutes();
    const day = now.getDay();
    
    if (day === 0 || day === 6) return 'Weekend';
    if (currentTime >= 400 && currentTime < 930) return 'Pre-Market';
    if (currentTime >= 930 && currentTime < 1600) return 'Market Open';
    if (currentTime >= 1600 && currentTime < 2000) return 'After Hours';
    return 'Futures Trading';
  }, []);

  // --- LOCAL STORAGE FUNCTIONS ---
  const saveWatchlist = useCallback((newWatchlist) => {
    try {
      localStorage.setItem('roloWatchlist', JSON.stringify(newWatchlist));
      setWatchlist(newWatchlist);
    } catch (error) {
      console.error('Failed to save watchlist:', error);
    }
  }, []);

  const loadWatchlist = useCallback(() => {
    try {
      const saved = localStorage.getItem('roloWatchlist');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setWatchlist(parsed);
        }
      }
    } catch (error) {
      console.error('Failed to load watchlist:', error);
    }
  }, []);

  // --- API FETCH FUNCTIONS ---
  const fetchStockData = useCallback(async () => {
    if (watchlist.length === 0) return;
    
    setIsLoading(prev => ({ ...prev, stocks: true }));
    setErrors(prev => ({ ...prev, stocks: null }));
    
    try {
      const promises = watchlist.map(async (symbol) => {
        const response = await fetch(`/.netlify/functions/enhanced-stock-data?symbol=${symbol}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        return { symbol, ...data };
      });
      
      const results = await Promise.allSettled(promises);
      const stockDataMap = {};
      
      results.forEach((result, index) => {
        const symbol = watchlist[index];
        if (result.status === 'fulfilled' && result.value && !result.value.error) {
          stockDataMap[symbol] = result.value;
        } else {
          stockDataMap[symbol] = { 
            symbol, 
            error: result.reason?.message || 'Failed to fetch data',
            price: '--',
            change: '0',
            changePercent: '0'
          };
        }
      });
      
      setStockData(stockDataMap);
    } catch (error) {
      setErrors(prev => ({ ...prev, stocks: error.message }));
      console.error('Error fetching stock data:', error);
    } finally {
      setIsLoading(prev => ({ ...prev, stocks: false }));
    }
  }, [watchlist]);

  const fetchAnalysisData = useCallback(async () => {
    setIsLoading(prev => ({ ...prev, analysis: true }));
    setErrors(prev => ({ ...prev, analysis: null }));
    
    try {
      const response = await fetch(`/.netlify/functions/comprehensive-ai-analysis?symbol=${selectedStock}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      setAnalysisData(data);
      
      // Extract additional data from comprehensive analysis
      if (data.technicalIndicators) setTechnicalIndicators(data.technicalIndicators);
      if (data.tradingPlan) setTradingPlan(data.tradingPlan);
      if (data.socialSentiment) setSocialSentiment(data.socialSentiment);
      if (data.newsAnalysis) setNewsData(data.newsAnalysis);
      
    } catch (error) {
      setErrors(prev => ({ ...prev, analysis: error.message }));
      setAnalysisData(null);
      console.error('Error fetching analysis:', error);
    } finally {
      setIsLoading(prev => ({ ...prev, analysis: false }));
    }
  }, [selectedStock]);

  const fetchSmartPlays = useCallback(async () => {
    setIsLoading(prev => ({ ...prev, plays: true }));
    setErrors(prev => ({ ...prev, plays: null }));
    
    try {
      const response = await fetch('/.netlify/functions/smart-plays-generator');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      setSmartPlaysData(Array.isArray(data.plays) ? data.plays : []);
    } catch (error) {
      setErrors(prev => ({ ...prev, plays: error.message }));
      setSmartPlaysData([]);
      console.error('Error fetching smart plays:', error);
    } finally {
      setIsLoading(prev => ({ ...prev, plays: false }));
    }
  }, []);

  const fetchAlerts = useCallback(async () => {
    setIsLoading(prev => ({ ...prev, alerts: true }));
    setErrors(prev => ({ ...prev, alerts: null }));
    
    try {
      const response = await fetch('/.netlify/functions/realtime-alerts');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      setAlertsData(Array.isArray(data.alerts) ? data.alerts : []);
    } catch (error) {
      setErrors(prev => ({ ...prev, alerts: error.message }));
      setAlertsData([]);
      console.error('Error fetching alerts:', error);
    } finally {
      setIsLoading(prev => ({ ...prev, alerts: false }));
    }
  }, []);

  const fetchMarketData = useCallback(async () => {
    setIsLoading(prev => ({ ...prev, market: true }));
    setErrors(prev => ({ ...prev, market: null }));
    
    try {
      const response = await fetch('/.netlify/functions/market-dashboard');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      setMarketData(data);
      
      // Extract additional market data
      if (data.sectors) setSectorData(data.sectors);
      if (data.economic) setEconomicData(data.economic);
      if (data.breadth) setBreadthData(data.breadth);
      if (data.optionsFlow) setOptionsFlowData(data.optionsFlow);
      if (data.marketMood) setMarketMood(data.marketMood);
      
    } catch (error) {
      setErrors(prev => ({ ...prev, market: error.message }));
      setMarketData({});
      console.error('Error fetching market data:', error);
    } finally {
      setIsLoading(prev => ({ ...prev, market: false }));
    }
  }, []);

  const sendChatMessage = useCallback(async () => {
    if (!chatInput.trim()) return;
    
    const userMessage = { role: 'user', content: chatInput, timestamp: new Date() };
    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setIsLoading(prev => ({ ...prev, chat: true }));
    
    try {
      const context = {
        selectedStock,
        watchlist,
        marketStatus,
        marketMood,
        currentTab: activeTab
      };
      
      const response = await fetch('/.netlify/functions/enhanced-rolo-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: chatInput,
          context,
          chatHistory: chatMessages.slice(-10)
        })
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      const aiMessage = {
        role: 'assistant',
        content: data.response || 'Sorry, I encountered an issue processing your request.',
        timestamp: new Date()
      };
      
      setChatMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      const errorMessage = {
        role: 'assistant',
        content: 'I apologize, but I\'m having trouble connecting to the AI service right now. Please try again later.',
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, errorMessage]);
      console.error('Error sending chat message:', error);
    } finally {
      setIsLoading(prev => ({ ...prev, chat: false }));
    }
  }, [chatInput, selectedStock, watchlist, marketStatus, marketMood, activeTab, chatMessages]);

  // --- STOCK SEARCH FUNCTIONALITY ---
  const searchStock = useCallback(async (symbol) => {
    if (!symbol || symbol.length < 1) return;
    
    const upperSymbol = symbol.toUpperCase();
    if (watchlist.includes(upperSymbol)) {
      alert(`${upperSymbol} is already in your watchlist`);
      return;
    }
    
    if (watchlist.length >= 12) {
      alert('Maximum 12 stocks allowed in watchlist');
      return;
    }
    
    try {
      const response = await fetch(`/.netlify/functions/enhanced-stock-data?symbol=${upperSymbol}`);
      if (!response.ok) throw new Error('Stock not found');
      
      const data = await response.json();
      if (data.error) throw new Error('Invalid stock symbol');
      
      const newWatchlist = [...watchlist, upperSymbol];
      saveWatchlist(newWatchlist);
      setSearchInput('');
      
    } catch (error) {
      alert(`Could not add ${upperSymbol}: ${error.message}`);
    }
  }, [watchlist, saveWatchlist]);

  const removeFromWatchlist = useCallback((symbol) => {
    if (watchlist.length <= 3) {
      alert('Minimum 3 stocks required in watchlist');
      return;
    }
    
    const newWatchlist = watchlist.filter(s => s !== symbol);
    saveWatchlist(newWatchlist);
    
    if (selectedStock === symbol) {
      setSelectedStock(newWatchlist[0]);
    }
  }, [watchlist, selectedStock, saveWatchlist]);

  // --- AUTO REFRESH LOGIC ---
  const getRefreshInterval = useCallback(() => {
    const session = getMarketSession();
    switch (session) {
      case 'Market Open': return 15000;
      case 'Pre-Market':
      case 'After Hours': return 30000;
      case 'Futures Trading': return 60000;
      case 'Weekend': return 300000;
      default: return 60000;
    }
  }, [getMarketSession]);

  // --- EFFECTS ---
  useEffect(() => {
    loadWatchlist();
  }, [loadWatchlist]);

  useEffect(() => {
    setMarketStatus(getMarketSession());
    const statusInterval = setInterval(() => {
      setMarketStatus(getMarketSession());
    }, 60000);
    
    return () => clearInterval(statusInterval);
  }, [getMarketSession]);

  useEffect(() => {
    if (activeTab === 'stocks') {
      fetchStockData();
    } else if (activeTab === 'analysis') {
      fetchAnalysisData();
    } else if (activeTab === 'plays') {
      fetchSmartPlays();
    } else if (activeTab === 'alerts') {
      fetchAlerts();
    } else if (activeTab === 'market') {
      fetchMarketData();
    }
  }, [activeTab, fetchStockData, fetchAnalysisData, fetchSmartPlays, fetchAlerts, fetchMarketData]);

  // Auto-refresh effect
  useEffect(() => {
    if (!autoRefreshEnabled) return;
    
    const interval = setInterval(() => {
      if (activeTab === 'stocks') {
        fetchStockData();
      } else if (activeTab === 'analysis') {
        fetchAnalysisData();
      } else if (activeTab === 'market') {
        fetchMarketData();
      }
      setLastRefresh(new Date());
    }, getRefreshInterval());
    
    return () => clearInterval(interval);
  }, [activeTab, autoRefreshEnabled, getRefreshInterval, fetchStockData, fetchAnalysisData, fetchMarketData]);

  // --- MEMOIZED VALUES ---
  const priorityAlerts = useMemo(() => {
    return alertsData
      .filter(alert => alert.priority === 'HIGH')
      .slice(0, 5);
  }, [alertsData]);

  const topSectorPerformers = useMemo(() => {
    return sectorData
      .sort((a, b) => parseFloat(b.change || 0) - parseFloat(a.change || 0))
      .slice(0, 3);
  }, [sectorData]);

  // --- TAB CONTENT COMPONENTS ---
  const StocksTab = () => (
    <div style={{ padding: '20px' }}>
      <div style={{
        background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)',
        borderRadius: '20px',
        padding: '24px',
        marginBottom: '16px',
        border: '1px solid #374151'
      }}>
        <h2 style={{ fontSize: '24px', fontWeight: 'bold', margin: '0 0 8px 0' }}>
          Portfolio • {marketStatus}
        </h2>
        <p style={{ color: '#9CA3AF', margin: '0 0 8px 0' }}>
          Live market data with real-time updates
        </p>
        <p style={{ color: '#6B7280', fontSize: '12px', margin: 0 }}>
          Last Updated: {lastRefresh.toLocaleTimeString()}
        </p>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            placeholder="Add stock symbol (e.g., AAPL)"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value.toUpperCase())}
            onKeyPress={(e) => e.key === 'Enter' && searchStock(searchInput)}
            style={{
              flex: 1,
              padding: '12px 16px',
              backgroundColor: '#1a1a1a',
              border: '1px solid #374151',
              borderRadius: '12px',
              color: 'white',
              fontSize: '16px'
            }}
          />
          <button
            onClick={() => searchStock(searchInput)}
            style={{
              padding: '12px 20px',
              background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)',
              border: 'none',
              borderRadius: '12px',
              color: 'white',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Add
          </button>
        </div>
      </div>

      {isLoading.stocks && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9CA3AF' }}>
          <p style={{ fontSize: '48px', margin: '0 0 16px 0' }}>🔄</p>
          <p>Loading portfolio data...</p>
        </div>
      )}

      {errors.stocks && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9CA3AF' }}>
          <p style={{ fontSize: '48px', margin: '0 0 16px 0' }}>⚠️</p>
          <p>Failed to load portfolio data</p>
          <p style={{ fontSize: '14px', marginTop: '8px' }}>{errors.stocks}</p>
        </div>
      )}

      {!isLoading.stocks && Object.keys(stockData).length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '16px'
        }}>
          {watchlist.map((symbol) => {
            const stock = stockData[symbol];
            if (!stock) return null;
            
            return (
              <div
                key={symbol}
                onClick={() => setSelectedStock(symbol)}
                style={{
                  backgroundColor: selectedStock === symbol ? '#1a1a1a' : '#0f0f0f',
                  borderRadius: '16px',
                  padding: '20px',
                  border: selectedStock === symbol ? '2px solid #3B82F6' : '1px solid #1F2937',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  position: 'relative'
                }}
              >
                {watchlist.length > 3 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFromWatchlist(symbol);
                    }}
                    style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                      background: '#EF4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: '50%',
                      width: '24px',
                      height: '24px',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    ×
                  </button>
                )}
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <h3 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0 }}>{symbol}</h3>
                  <span style={{
                    backgroundColor: stock.error ? '#DC2626' : getChangeColor(stock.changePercent),
                    color: 'white',
                    padding: '4px 8px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: '600'
                  }}>
                    {stock.error ? 'ERROR' : marketStatus}
                  </span>
                </div>
                
                <div style={{ marginBottom: '8px' }}>
                  <p style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>
                    {formatPrice(stock.price)}
                  </p>
                  <p style={{ 
                    fontSize: '14px', 
                    color: getChangeColor(stock.changePercent),
                    margin: '4px 0 0 0',
                    fontWeight: '600'
                  }}>
                    {formatPercentage(stock.changePercent)} ({formatPrice(stock.change)})
                  </p>
                </div>
                
                {stock.error && (
                  <p style={{ color: '#EF4444', fontSize: '12px', margin: 0 }}>
                    {stock.error}
                  </p>
                )}
                
                {!stock.error && stock.volume && (
                  <p style={{ color: '#9CA3AF', fontSize: '12px', margin: 0 }}>
                    Volume: {parseInt(stock.volume).toLocaleString()}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!isLoading.stocks && Object.keys(stockData).length === 0 && !errors.stocks && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9CA3AF' }}>
          <p style={{ fontSize: '48px', margin: '0 0 16px 0' }}>📊</p>
          <p>No stock data available</p>
          <p style={{ fontSize: '14px', marginTop: '8px' }}>
            Check your API configuration
          </p>
        </div>
      )}
    </div>
  );

  // --- MAIN RENDER ---
  return (
    <div style={{
      backgroundColor: '#000000',
      color: 'white',
      minHeight: '100vh',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        background: 'linear-gradient(135deg, #000000 0%, #1a1a1a 100%)',
        borderBottom: '1px solid #1F2937',
        padding: '16px 20px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: 'bold', margin: '0 0 4px 0' }}>Rolo</h1>
            <p style={{ fontSize: '14px', color: '#9CA3AF', margin: 0 }}>
              {marketStatus} • {selectedStock}
            </p>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
              style={{
                backgroundColor: autoRefreshEnabled ? '#10B981' : '#374151',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 12px',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              {autoRefreshEnabled ? '🔄 Auto' : '⏸️ Manual'}
            </button>
            
            <div style={{
              backgroundColor: marketStatus === 'Market Open' ? '#10B981' : 
                             marketStatus === 'Pre-Market' || marketStatus === 'After Hours' ? '#F59E0B' : '#6B7280',
              color: 'white',
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: '600'
            }}>
              {marketStatus}
            </div>
          </div>
        </div>
      </div>

      <div style={{ paddingBottom: '100px' }}>
        {activeTab === 'stocks' && <StocksTab />}
        {activeTab === 'analysis' && (
          <div style={{ padding: '20px' }}>
            <div style={{
              background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)',
              borderRadius: '20px',
              padding: '24px',
              marginBottom: '16px',
              border: '1px solid #374151'
            }}>
              <h2 style={{ fontSize: '24px', fontWeight: 'bold', margin: '0 0 8px 0' }}>
                {selectedStock} Analysis
              </h2>
              <p style={{ color: '#9CA3AF', margin: '0 0 8px 0' }}>
                24/7 AI-Powered Analysis • {marketStatus}
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

            {errors.analysis && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9CA3AF' }}>
                <p style={{ fontSize: '48px', margin: '0 0 16px 0' }}>⚠️</p>
                <p>Failed to load comprehensive analysis</p>
                <p style={{ fontSize: '14px', marginTop: '8px' }}>{errors.analysis}</p>
              </div>
            )}

            {!isLoading.analysis && !analysisData && !errors.analysis && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9CA3AF' }}>
                <p style={{ fontSize: '48px', margin: '0 0 16px 0' }}>📊</p>
                <p>No comprehensive analysis available</p>
                <p style={{ fontSize: '14px', marginTop: '8px' }}>
                  AI analysis requires real market data access
                </p>
              </div>
            )}

            {analysisData && !isLoading.analysis && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {analysisData.summary && (
                  <div style={{
                    backgroundColor: '#1a1a1a',
                    borderRadius: '16px',
                    padding: '20px',
                    border: '1px solid #1F2937'
                  }}>
                    <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '12px', color: '#3B82F6' }}>
                      🤖 AI Summary
                    </h3>
                    <p style={{ lineHeight: '1.6', margin: 0, color: '#E5E7EB' }}>
                      {analysisData.summary}
                    </p>
                  </div>
                )}

                {technicalIndicators && Object.keys(technicalIndicators).length > 0 && (
                  <div style={{
                    backgroundColor: '#1a1a1a',
                    borderRadius: '16px',
                    padding: '20px',
                    border: '1px solid #1F2937'
                  }}>
                    <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '12px', color: '#10B981' }}>
                      📈 Technical Indicators
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                      {Object.entries(technicalIndicators).map(([key, value]) => (
                        <div key={key} style={{
                          backgroundColor: '#0f0f0f',
                          padding: '12px',
                          borderRadius: '8px',
                          border: '1px solid #374151'
                        }}>
                          <p style={{ fontSize: '12px', color: '#9CA3AF', margin: '0 0 4px 0', textTransform: 'uppercase' }}>
                            {key.replace(/([A-Z])/g, ' $1').trim()}
                          </p>
                          <p style={{ fontSize: '16px', fontWeight: '600', margin: 0, color: '#E5E7EB' }}>
                            {typeof value === 'number' ? value.toFixed(2) : value}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {tradingPlan && (
                  <div style={{
                    backgroundColor: '#1a1a1a',
                    borderRadius: '16px',
                    padding: '20px',
                    border: '1px solid #1F2937'
                  }}>
                    <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '12px', color: '#F59E0B' }}>
                      🎯 Trading Plan
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {tradingPlan.recommendation && (
                        <div style={{
                          backgroundColor: tradingPlan.recommendation === 'BUY' ? '#065F46' : 
                                         tradingPlan.recommendation === 'SELL' ? '#7F1D1D' : '#374151',
                          padding: '12px',
                          borderRadius: '8px'
                        }}>
                          <p style={{ fontSize: '14px', fontWeight: '600', margin: 0, color: 'white' }}>
                            Recommendation: {tradingPlan.recommendation}
                          </p>
                        </div>
                      )}
                      
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px' }}>
                        {tradingPlan.entryPrice && (
                          <div style={{ backgroundColor: '#0f0f0f', padding: '8px', borderRadius: '6px' }}>
                            <p style={{ fontSize: '12px', color: '#9CA3AF', margin: 0 }}>Entry Price</p>
                            <p style={{ fontSize: '16px', fontWeight: '600', margin: 0, color: '#10B981' }}>
                              {formatPrice(tradingPlan.entryPrice)}
                            </p>
                          </div>
                        )}
                        
                        {tradingPlan.stopLoss && (
                          <div style={{ backgroundColor: '#0f0f0f', padding: '8px', borderRadius: '6px' }}>
                            <p style={{ fontSize: '12px', color: '#9CA3AF', margin: 0 }}>Stop Loss</p>
                            <p style={{ fontSize: '16px', fontWeight: '600', margin: 0, color: '#EF4444' }}>
                              {formatPrice(tradingPlan.stopLoss)}
                            </p>
                          </div>
                        )}
                        
                        {tradingPlan.targetPrice && (
                          <div style={{ backgroundColor: '#0f0f0f', padding: '8px', borderRadius: '6px' }}>
                            <p style={{ fontSize: '12px', color: '#9CA3AF', margin: 0 }}>Target Price</p>
                            <p style={{ fontSize: '16px', fontWeight: '600', margin: 0, color: '#3B82F6' }}>
                              {formatPrice(tradingPlan.targetPrice)}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        {activeTab === 'plays' && (
          <div style={{ padding: '20px' }}>
            <div style={{
              background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)',
              borderRadius: '20px',
              padding: '24px',
              marginBottom: '16px',
              border: '1px solid #374151'
            }}>
              <h2 style={{ fontSize: '24px', fontWeight: 'bold', margin: '0 0 8px 0' }}>
                Smart Plays • {marketStatus}
              </h2>
              <p style={{ color: '#9CA3AF', margin: '0 0 8px 0' }}>
                AI-generated trading opportunities based on real-time market analysis
              </p>
              {smartPlaysData.length > 0 && smartPlaysData[0].lastUpdated && (
                <p style={{ color: '#6B7280', fontSize: '12px', margin: 0 }}>
                  Last Updated: {new Date(smartPlaysData[0].lastUpdated).toLocaleString()}
                </p>
              )}
            </div>

            {isLoading.plays && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9CA3AF' }}>
                <p style={{ fontSize: '48px', margin: '0 0 16px 0' }}>🔄</p>
                <p>Generating smart trading plays...</p>
                <p style={{ fontSize: '14px', marginTop: '8px' }}>
                  Analyzing market movers, volume spikes, and social sentiment
                </p>
              </div>
            )}

            {errors.plays && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9CA3AF' }}>
                <p style={{ fontSize: '48px', margin: '0 0 16px 0' }}>⚠️</p>
                <p>Failed to generate smart plays</p>
                <p style={{ fontSize: '14px', marginTop: '8px' }}>{errors.plays}</p>
              </div>
            )}

            {!isLoading.plays && smartPlaysData.length === 0 && !errors.plays && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9CA3AF' }}>
                <p style={{ fontSize: '48px', margin: '0 0 16px 0' }}>🎯</p>
                <p>No smart plays available</p>
                <p style={{ fontSize: '14px', marginTop: '8px' }}>
                  AI requires real market data to generate trading opportunities
                </p>
              </div>
            )}

            {!isLoading.plays && smartPlaysData.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {smartPlaysData.map((play, index) => (
                  <div key={index} style={{
                    backgroundColor: '#1a1a1a',
                    borderRadius: '16px',
                    padding: '20px',
                    border: '1px solid #1F2937'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                      <div>
                        <h3 style={{ fontSize: '20px', fontWeight: 'bold', margin: '0 0 4px 0' }}>
                          {play.symbol || 'Unknown Symbol'}
                        </h3>
                        <p style={{ fontSize: '14px', color: '#9CA3AF', margin: 0 }}>
                          {play.strategy || 'Trading Opportunity'}
                        </p>
                      </div>
                      
                      <div style={{ textAlign: 'right' }}>
                        {play.confidence && (
                          <div style={{
                            backgroundColor: play.confidence >= 80 ? '#065F46' : 
                                           play.confidence >= 60 ? '#92400E' : '#374151',
                            color: 'white',
                            padding: '6px 12px',
                            borderRadius: '8px',
                            fontSize: '12px',
                            fontWeight: '600',
                            marginBottom: '4px'
                          }}>
                            {play.confidence}% Confidence
                          </div>
                        )}
                        
                        {play.timeframe && (
                          <p style={{ fontSize: '12px', color: '#9CA3AF', margin: 0 }}>
                            {play.timeframe}
                          </p>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                      {play.entryPrice && (
                        <div style={{ backgroundColor: '#0f0f0f', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                          <p style={{ fontSize: '12px', color: '#9CA3AF', margin: '0 0 4px 0' }}>Entry</p>
                          <p style={{ fontSize: '16px', fontWeight: '600', margin: 0, color: '#10B981' }}>
                            {formatPrice(play.entryPrice)}
                          </p>
                        </div>
                      )}
                      
                      {play.stopLoss && (
                        <div style={{ backgroundColor: '#0f0f0f', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                          <p style={{ fontSize: '12px', color: '#9CA3AF', margin: '0 0 4px 0' }}>Stop Loss</p>
                          <p style={{ fontSize: '16px', fontWeight: '600', margin: 0, color: '#EF4444' }}>
                            {formatPrice(play.stopLoss)}
                          </p>
                        </div>
                      )}
                      
                      {play.targetPrice && (
                        <div style={{ backgroundColor: '#0f0f0f', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                          <p style={{ fontSize: '12px', color: '#9CA3AF', margin: '0 0 4px 0' }}>Target</p>
                          <p style={{ fontSize: '16px', fontWeight: '600', margin: 0, color: '#3B82F6' }}>
                            {formatPrice(play.targetPrice)}
                          </p>
                        </div>
                      )}
                      
                      {play.potentialReturn && (
                        <div style={{ backgroundColor: '#0f0f0f', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                          <p style={{ fontSize: '12px', color: '#9CA3AF', margin: '0 0 4px 0' }}>Potential Return</p>
                          <p style={{ fontSize: '16px', fontWeight: '600', margin: 0, color: '#F59E0B' }}>
                            {play.potentialReturn}
                          </p>
                        </div>
                      )}
                    </div>

                    {play.reasoning && (
                      <div style={{
                        backgroundColor: '#0f0f0f',
                        padding: '16px',
                        borderRadius: '8px',
                        border: '1px solid #374151'
                      }}>
                        <h4 style={{ fontSize: '14px', fontWeight: '600', margin: '0 0 8px 0', color: '#3B82F6' }}>
                          Analysis & Reasoning
                        </h4>
                        <p style={{ fontSize: '14px', lineHeight: '1.5', margin: 0, color: '#D1D5DB' }}>
                          {play.reasoning}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {activeTab === 'alerts' && (
          <div style={{ padding: '20px' }}>
            <div style={{
              background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)',
              borderRadius: '20px',
              padding: '24px',
              marginBottom: '16px',
              border: '1px solid #374151'
            }}>
              <h2 style={{ fontSize: '24px', fontWeight: 'bold', margin: '0 0 8px 0' }}>
                Market Alerts • {marketStatus}
              </h2>
              <p style={{ color: '#9CA3AF', margin: '0 0 8px 0' }}>
                Real-time breakouts, volume spikes, and market events
              </p>
              {alertsData.length > 0 && alertsData[0].lastUpdated && (
                <p style={{ color: '#6B7280', fontSize: '12px', margin: 0 }}>
                  Last Updated: {new Date(alertsData[0].lastUpdated).toLocaleString()}
                </p>
              )}
            </div>

            {isLoading.alerts && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9CA3AF' }}>
                <p style={{ fontSize: '48px', margin: '0 0 16px 0' }}>🔄</p>
                <p>Scanning for market alerts...</p>
                <p style={{ fontSize: '14px', marginTop: '8px' }}>
                  Monitoring breakouts, volume spikes, and price movements
                </p>
              </div>
            )}

            {errors.alerts && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9CA3AF' }}>
                <p style={{ fontSize: '48px', margin: '0 0 16px 0' }}>⚠️</p>
                <p>Failed to load market alerts</p>
                <p style={{ fontSize: '14px', marginTop: '8px' }}>{errors.alerts}</p>
              </div>
            )}

            {!isLoading.alerts && alertsData.length === 0 && !errors.alerts && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9CA3AF' }}>
                <p style={{ fontSize: '48px', margin: '0 0 16px 0' }}>🔔</p>
                <p>No alerts available</p>
                <p style={{ fontSize: '14px', marginTop: '8px' }}>
                  Real-time alerts require market data access
                </p>
              </div>
            )}

            {priorityAlerts.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '12px', color: '#DC2626' }}>
                  🚨 Priority Alerts
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {priorityAlerts.map((alert, index) => (
                    <div key={index} style={{
                      backgroundColor: '#7F1D1D',
                      borderRadius: '12px',
                      padding: '16px',
                      border: '2px solid #DC2626'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <h4 style={{ fontSize: '16px', fontWeight: '600', margin: 0, color: 'white' }}>
                          {alert.symbol} - {alert.type}
                        </h4>
                        <span style={{
                          backgroundColor: '#DC2626',
                          color: 'white',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '600'
                        }}>
                          HIGH
                        </span>
                      </div>
                      <p style={{ fontSize: '14px', margin: '0 0 8px 0', color: 'rgba(255,255,255,0.9)' }}>
                        {alert.description || alert.message}
                      </p>
                      {alert.action && (
                        <p style={{ fontSize: '12px', margin: 0, color: 'rgba(255,255,255,0.8)', fontStyle: 'italic' }}>
                          Suggested Action: {alert.action}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!isLoading.alerts && alertsData.length > 0 && (
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '12px', color: '#3B82F6' }}>
                  📊 All Market Alerts
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {alertsData.map((alert, index) => (
                    <div key={index} style={{
                      backgroundColor: '#1a1a1a',
                      borderRadius: '12px',
                      padding: '16px',
                      border: '1px solid #1F2937'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <div>
                          <h4 style={{ fontSize: '16px', fontWeight: '600', margin: '0 0 4px 0', color: '#E5E7EB' }}>
                            {alert.symbol} - {alert.type}
                          </h4>
                          {alert.timestamp && (
                            <p style={{ fontSize: '12px', color: '#9CA3AF', margin: 0 }}>
                              {new Date(alert.timestamp).toLocaleString()}
                            </p>
                          )}
                        </div>
                        
                        <span style={{
                          backgroundColor: alert.priority === 'HIGH' ? '#DC2626' : 
                                         alert.priority === 'MEDIUM' ? '#F59E0B' : '#10B981',
                          color: 'white',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '600'
                        }}>
                          {alert.priority || 'NORMAL'}
                        </span>
                      </div>
                      
                      <p style={{ fontSize: '14px', margin: '0 0 8px 0', color: '#D1D5DB', lineHeight: '1.4' }}>
                        {alert.description || alert.message}
                      </p>
                      
                      {alert.currentPrice && (
                        <div style={{ display: 'flex', gap: '16px', marginBottom: '8px' }}>
                          <span style={{ fontSize: '12px', color: '#9CA3AF' }}>
                            Current Price: <strong style={{ color: '#E5E7EB' }}>{formatPrice(alert.currentPrice)}</strong>
                          </span>
                          {alert.changePercent && (
                            <span style={{ fontSize: '12px', color: getChangeColor(alert.changePercent) }}>
                              {formatPercentage(alert.changePercent)}
                            </span>
                          )}
                        </div>
                      )}
                      
                      {alert.action && (
                        <div style={{
                          backgroundColor: '#0f0f0f',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          border: '1px solid #374151'
                        }}>
                          <p style={{ fontSize: '12px', margin: 0, color: '#3B82F6', fontWeight: '600' }}>
                            💡 Suggested Action: {alert.action}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        {activeTab === 'market' && (
          <div style={{ padding: '20px', textAlign: 'center', color: '#9CA3AF' }}>
            <p style={{ fontSize: '48px', margin: '0 0 16px 0' }}>📊</p>
            <p>No real market data available</p>
            <p style={{ fontSize: '14px', marginTop: '8px' }}>
              Check your market-dashboard function configuration
            </p>
          </div>
        )}
        {activeTab === 'chat' && (
          <div style={{ padding: '20px', textAlign: 'center', color: '#9CA3AF' }}>
            <p style={{ fontSize: '48px', margin: '0 0 16px 0' }}>🤖</p>
            <p>Hi! I'm Rolo, your AI trading assistant.</p>
            <p style={{ fontSize: '14px', marginTop: '8px' }}>
              Ask me about market conditions, stock analysis, or trading strategies!
            </p>
          </div>
        )}
      </div>

      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'linear-gradient(135deg, #1a1a1a 0%, #000000 100%)',
        borderTop: '1px solid #1F2937',
        padding: '12px 0',
        zIndex: 100
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-around',
          maxWidth: '600px',
          margin: '0 auto'
        }}>
          {[
            { id: 'stocks', label: 'Stocks', icon: '📊' },
            { id: 'analysis', label: 'Analysis', icon: '🔍' },
            { id: 'plays', label: 'Plays', icon: '🎯' },
            { id: 'alerts', label: 'Alerts', icon: '🔔' },
            { id: 'market', label: 'Market', icon: '📈' },
            { id: 'chat', label: 'Chat', icon: '💬' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                color: activeTab === tab.id ? '#3B82F6' : '#9CA3AF',
                padding: '8px 12px',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
                fontSize: '12px',
                fontWeight: '600',
                transition: 'all 0.3s ease',
                minWidth: '60px'
              }}
            >
              <span style={{ fontSize: '20px' }}>{tab.icon}</span>
              <span>{tab.label}</span>
              {activeTab === tab.id && (
                <div style={{
                  width: '40px',
                  height: '2px',
                  backgroundColor: '#3B82F6',
                  borderRadius: '1px',
                  marginTop: '2px'
                }} />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
