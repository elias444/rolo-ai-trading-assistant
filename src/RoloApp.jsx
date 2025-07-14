import React, { useState, useEffect, useRef } from 'react';

const RoloApp = () => {
  const [activeTab, setActiveTab] = useState('ticker');
  const [searchTicker, setSearchTicker] = useState('');
  const [selectedStock, setSelectedStock] = useState('AAPL');
  const [stockData, setStockData] = useState({});
  const [marketData, setMarketData] = useState({});
  const [analysisData, setAnalysisData] = useState(null);
  const [smartPlays, setSmartPlays] = useState([]);
  const [newsData, setNewsData] = useState({ articles: [], sentiment: {} });
  const [technicalData, setTechnicalData] = useState(null);
  const [economicData, setEconomicData] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [marketStatus, setMarketStatus] = useState('closed');
  const [chatMessages, setChatMessages] = useState(JSON.parse(localStorage.getItem('chatHistory')) || [
    { role: 'ai', content: "Hello! I'm Rolo, your AI trading assistant with access to real-time market data, news, and technical analysis. How can I help you today?" }
  ]);
  const [chatInput, setChatInput] = useState('');
  const smartPlaysIntervalRef = useRef(null);
  const popularStocks = ['AAPL', 'TSLA', 'NVDA', 'SPY', 'QQQ', 'META', 'AMD', 'GOOGL', 'MSFT'];
  const [favorites, setFavorites] = useState(JSON.parse(localStorage.getItem('favorites')) || []);
  const [settings, setSettings] = useState(JSON.parse(localStorage.getItem('settings')) || { alerts: true, autoRefresh: true, notifications: true });

  // Styles - Added wrap and scroll to technicalGrid for mobile fix
  const styles = {
    app: {
      minHeight: '100vh',
      backgroundColor: '#000000',
      color: '#ffffff',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", sans-serif',
    },
    header: {
      background: 'linear-gradient(to bottom, #1a1a1a, #000000)',
      padding: '20px',
      textAlign: 'center',
    },
    title: {
      fontSize: '32px',
      fontWeight: 'bold',
      color: '#3B82F6',
      margin: '0 0 8px 0',
    },
    subtitle: {
      color: '#9CA3AF',
      fontSize: '14px',
      margin: '0',
    },
    marketStatus: {
      marginTop: '8px',
      fontSize: '12px',
    },
    marketStatusBadge: {
      display: 'inline-flex',
      alignItems: 'center',
      padding: '4px 12px',
      borderRadius: '9999px',
      fontSize: '12px',
    },
    marketStatusDot: {
      width: '8px',
      height: '8px',
      borderRadius: '50%',
      marginRight: '8px',
      animation: 'pulse 2s infinite',
    },
    content: {
      flex: 1,
      overflowY: 'auto',
      paddingBottom: '80px',
    },
    searchContainer: {
      padding: '20px',
    },
    searchBar: {
      display: 'flex',
      gap: '8px',
    },
    searchInput: {
      flex: 1,
      backgroundColor: '#1a1a1a',
      border: '1px solid #374151',
      borderRadius: '12px',
      padding: '12px 16px',
      color: '#ffffff',
      fontSize: '16px',
      outline: 'none',
    },
    searchButton: {
      backgroundColor: '#3B82F6',
      color: '#ffffff',
      border: 'none',
      borderRadius: '12px',
      padding: '12px 24px',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'background-color 0.2s',
    },
    stocksSection: {
      marginBottom: '24px',
    },
    sectionTitle: {
      fontSize: '18px',
      fontWeight: '600',
      marginBottom: '12px',
      display: 'flex',
      alignItems: 'center',
    },
    stockGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: '12px',
    },
    stockCard: {
      backgroundColor: '#1a1a1a',
      border: '1px solid #374151',
      borderRadius: '12px',
      padding: '12px',
      textAlign: 'center',
      cursor: 'pointer',
      transition: 'all 0.2s',
    },
    stockCardActive: {
      backgroundColor: '#1a1a1a',
      border: '1px solid #3B82F6',
      borderRadius: '12px',
      padding: '12px',
      textAlign: 'center',
      cursor: 'pointer',
    },
    stockSymbol: {
      fontWeight: 'bold',
      marginBottom: '4px',
    },
    stockPrice: {
      fontSize: '14px',
      color: '#9CA3AF',
      marginBottom: '2px',
    },
    stockChange: {
      fontSize: '12px',
    },
    stockDetails: {
      backgroundColor: '#1a1a1a',
      borderRadius: '20px',
      padding: '24px',
      border: '1px solid #1F2937',
    },
    stockDetailsHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: '16px',
    },
    stockDetailsTitle: {
      fontSize: '32px',
      fontWeight: 'bold',
      margin: '0',
    },
    stockDetailsStatus: {
      color: '#9CA3AF',
      fontSize: '14px',
      margin: '4px 0 0 0',
    },
    stockDetailsPrice: {
      textAlign: 'right',
    },
    stockDetailsPriceValue: {
      fontSize: '32px',
      fontWeight: 'bold',
      color: '#10B981',
      margin: '0',
    },
    stockDetailsChange: {
      fontSize: '14px',
      marginTop: '4px',
    },
    metricsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: '16px',
      marginTop: '24px',
    },
    metricCard: {
      backgroundColor: '#000000',
      borderRadius: '12px',
      padding: '16px',
    },
    metricLabel: {
      color: '#9CA3AF',
      fontSize: '14px',
      marginBottom: '4px',
    },
    metricValue: {
      fontSize: '20px',
      fontWeight: '600',
    },
    bottomNav: {
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: '#1a1a1a',
      borderTop: '1px solid #374151',
      padding: '8px 0',
      paddingBottom: 'env(safe-area-inset-bottom, 8px)',
    },
    navContainer: {
      display: 'flex',
      justifyContent: 'space-around',
      alignItems: 'center',
    },
    navButton: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '8px 12px',
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      color: '#9CA3AF',
    },
    navButtonActive: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '8px 12px',
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      color: '#3B82F6',
    },
    navLabel: {
      fontSize: '12px',
      marginTop: '4px',
    },
    chatContainer: {
      display: 'flex',
      flexDirection: 'column',
      height: 'calc(100vh - 200px)',
      padding: '20px',
    },
    chatWindow: {
      flex: 1,
      overflowY: 'auto',
      marginBottom: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
    },
    chatMessage: {
      maxWidth: '70%',
      padding: '12px 16px',
      borderRadius: '18px',
      wordWrap: 'break-word',
    },
    chatMessageUser: {
      backgroundColor: '#3B82F6',
      color: '#ffffff',
      alignSelf: 'flex-end',
      marginLeft: 'auto',
    },
    chatMessageAI: {
      backgroundColor: '#374151',
      color: '#E5E7EB',
      alignSelf: 'flex-start',
      marginRight: 'auto',
    },
    chatInputContainer: {
      display: 'flex',
      gap: '8px',
    },
    chatInput: {
      flex: 1,
      backgroundColor: '#1a1a1a',
      border: '1px solid #374151',
      borderRadius: '24px',
      padding: '12px 20px',
      color: '#ffffff',
      fontSize: '16px',
      outline: 'none',
    },
    chatSendButton: {
      backgroundColor: '#3B82F6',
      color: '#ffffff',
      border: 'none',
      borderRadius: '24px',
      padding: '12px 24px',
      cursor: 'pointer',
      fontWeight: '600',
    },
    loadingSpinner: {
      textAlign: 'center',
      padding: '20px',
      color: '#9CA3AF',
    },
    analysisCard: {
      backgroundColor: '#1a1a1a',
      borderRadius: '16px',
      padding: '20px',
      marginBottom: '16px',
      border: '1px solid #374151',
    },
    priceLevel: {
      display: 'flex',
      justifyContent: 'space-between',
      padding: '8px 0',
      borderBottom: '1px solid #374151',
    },
    newsItem: {
      backgroundColor: '#1a1a1a',
      borderRadius: '12px',
      padding: '16px',
      marginBottom: '12px',
      border: '1px solid #374151',
    },
    playCard: {
      borderRadius: '16px',
      padding: '20px',
      marginBottom: '16px',
      border: '1px solid #374151',
    },
  };

  // Add keyframes for animations
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
      @keyframes slideIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .animate-slide-in {
        animation: slideIn 0.3s ease-out;
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  // Check market status
  useEffect(() => {
    const checkMarketStatus = () => {
      const now = new Date();
      const hours = now.getUTCHours() - 5; // EST
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
      }
    } catch (error) {
      console.error('Error fetching stock data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch AI Analysis
  const fetchAIAnalysis = async (symbol) => {
    setIsLoading(true);
    try {
      const response = await fetch('/.netlify/functions/ai-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, type: 'analysis' }),
      });
      const data = await response.json();
      if (response.ok && data.analysis) {
        setAnalysisData(data.analysis);
      }
    } catch (error) {
      console.error('Error fetching AI analysis:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch Smart Plays
  const fetchSmartPlays = async () => {
    try {
      const response = await fetch('/.netlify/functions/ai-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'smartplays' }),
      });
      const data = await response.json();
      if (response.ok && data.analysis && data.analysis.plays) {
        setSmartPlays(data.analysis.plays);
      }
    } catch (error) {
      console.error('Error fetching smart plays:', error);
    }
  };

  // Fetch News Data
  const fetchNewsData = async (symbol = null) => {
    try {
      const url = `/.netlify/functions/news-data${symbol ? `?symbol=${symbol}` : ''}`;
      const response = await fetch(url);
      const data = await response.json();
      if (response.ok) {
        setNewsData(data);
      }
    } catch (error) {
      console.error('Error fetching news:', error);
    }
  };

  // Fetch Technical Indicators
  const fetchTechnicalIndicators = async (symbol) => {
    try {
      const response = await fetch(`/.netlify/functions/technical-indicators?symbol=${symbol}`);
      const data = await response.json();
      if (response.ok) {
        setTechnicalData(data);
      }
    } catch (error) {
      console.error('Error fetching technicals:', error);
    }
  };

  // Fetch Market Dashboard
  const fetchMarketDashboard = async () => {
    try {
      const response = await fetch('/.netlify/functions/market-dashboard');
      const data = await response.json();
      if (response.ok) {
        setMarketData(data);
      }
    } catch (error) {
      console.error('Error fetching market data:', error);
    }
  };

  // Fetch Economic Indicators
  const fetchEconomicIndicators = async () => {
    try {
      const response = await fetch('/.netlify/functions/economic-indicators');
      const data = await response.json();
      if (response.ok) {
        setEconomicData(data);
      }
    } catch (error) {
      console.error('Error fetching economic data:', error);
    }
  };

  // Fetch Real-time Alerts
  const fetchAlerts = async () => {
    try {
      const response = await fetch('/.netlify/functions/realtime-alerts');
      const data = await response.json();
      if (response.ok && data.alerts) {
        setAlerts(data.alerts);
      }
    } catch (error) {
      console.error('Error fetching alerts:', error);
    }
  };

  // Setup smart plays interval during market hours
  useEffect(() => {
    if (marketStatus === 'Market Open') {
      // Fetch immediately
      fetchSmartPlays();
      
      // Then fetch every hour
      smartPlaysIntervalRef.current = setInterval(() => {
        fetchSmartPlays();
      }, 3600000); // 1 hour
    } else {
      // Clear interval when market is closed
      if (smartPlaysIntervalRef.current) {
        clearInterval(smartPlaysIntervalRef.current);
      }
    }
    
    return () => {
      if (smartPlaysIntervalRef.current) {
        clearInterval(smartPlaysIntervalRef.current);
      }
    };
  }, [marketStatus]);

  // Load initial data
  useEffect(() => {
    if (selectedStock) {
      fetchStockData(selectedStock);
      if (activeTab === 'analysis') {
        fetchAIAnalysis(selectedStock);
        fetchTechnicalIndicators(selectedStock);
        fetchNewsData(selectedStock);
      }
    }
    
    // Fetch data for popular stocks
    popularStocks.forEach(symbol => {
      if (!stockData[symbol]) {
        fetchStockData(symbol);
      }
    });
  }, [selectedStock, activeTab]);

  // Fetch data based on active tab
  useEffect(() => {
    if (activeTab === 'market') {
      fetchMarketDashboard();
      fetchEconomicIndicators();
    } else if (activeTab === 'alerts') {
      fetchAlerts();
      // Refresh alerts every 30 seconds
      const interval = setInterval(fetchAlerts, 30000);
      return () => clearInterval(interval);
    } else if (activeTab === 'plays') {
      fetchSmartPlays();
    }
  }, [activeTab]);

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
      // Enhanced chat that includes context about selected stock and market conditions
      const enhancedMessage = `${message} (Context: Currently viewing ${selectedStock}, Market is ${marketStatus})`;
      
      const response = await fetch('/.netlify/functions/enhanced-rolo-chat', {
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
      setChatMessages(prev => [...prev, { role: 'ai', content: data.response || 'Sorry, I encountered an error.' }]);
    } catch (error) {
      setChatMessages(prev => [...prev, { role: 'ai', content: 'Sorry, I encountered an error. Please try again.' }]);
    }
  };

  const getMarketStatusStyle = () => {
    const baseStyle = { ...styles.marketStatusBadge };
    if (marketStatus === 'Market Open') {
      return { ...baseStyle, backgroundColor: '#064E3B', color: '#10B981' };
    } else if (marketStatus === 'Pre-Market' || marketStatus === 'After Hours') {
      return { ...baseStyle, backgroundColor: '#7C2D12', color: '#F59E0B' };
    }
    return { ...baseStyle, backgroundColor: '#1F2937', color: '#9CA3AF' };
  };

  const getMarketStatusDotStyle = () => {
    const baseStyle = { ...styles.marketStatusDot };
    if (marketStatus === 'Market Open') {
      return { ...baseStyle, backgroundColor: '#10B981' };
    } else if (marketStatus === 'Pre-Market' || marketStatus === 'After Hours') {
      return { ...baseStyle, backgroundColor: '#F59E0B' };
    }
    return { ...baseStyle, backgroundColor: '#9CA3AF' };
  };

  const getPlayCardStyle = (confidence) => {
    if (confidence >= 80) {
      return { ...styles.playCard, background: 'linear-gradient(135deg, #064E3B, #065F46)' };
    } else if (confidence >= 60) {
      return { ...styles.playCard, background: 'linear-gradient(135deg, #1E3A8A, #1E40AF)' };
    }
    return { ...styles.playCard, background: 'linear-gradient(135deg, #374151, #4B5563)' };
  };

  return (
    <div style={styles.app}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>Rolo</h1>
        <p style={styles.subtitle}>
          AI Trading Assistant
        </p>
        <div style={styles.marketStatus}>
          <span style={getMarketStatusStyle()}>
            <span style={getMarketStatusDotStyle()}></span>
            {marketStatus}
          </span>
        </div>
      </div>

      {/* Main Content */}
      <div style={styles.content}>
        {activeTab === 'ticker' && (
          <div>
            {/* Search Bar */}
            <div style={styles.searchContainer}>
              <div style={styles.searchBar}>
                <input
                  type="text"
                  value={searchTicker}
                  onChange={(e) => setSearchTicker(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Enter ticker symbol"
                  style={styles.searchInput}
                />
                <button
                  onClick={handleSearch}
                  style={styles.searchButton}
                  onMouseOver={(e) => e.target.style.backgroundColor = '#2563EB'}
                  onMouseOut={(e) => e.target.style.backgroundColor = '#3B82F6'}
                >
                  Search
                </button>
              </div>
            </div>

            {/* Popular Stocks */}
            <div style={{ padding: '0 20px' }}>
              <div style={styles.stocksSection}>
                <h2 style={styles.sectionTitle}>
                  <span style={{ marginRight: '8px' }}>📈</span> Popular Stocks
                </h2>
                <div style={styles.stockGrid}>
                  {popularStocks.map(symbol => {
                    const data = stockData[symbol];
                    return (
                      <div
                        key={symbol}
                        onClick={() => setSelectedStock(symbol)}
                        style={selectedStock === symbol ? styles.stockCardActive : styles.stockCard}
                        onMouseOver={(e) => {
                          if (selectedStock !== symbol) {
                            e.currentTarget.style.borderColor = '#4B5563';
                          }
                        }}
                        onMouseOut={(e) => {
                          if (selectedStock !== symbol) {
                            e.currentTarget.style.borderColor = '#374151';
                          }
                        }}
                      >
                        <div style={styles.stockSymbol}>{symbol}</div>
                        {data && (
                          <>
                            <div style={styles.stockPrice}>${data.price}</div>
                            <div style={{
                              ...styles.stockChange,
                              color: parseFloat(data.change) >= 0 ? '#10B981' : '#EF4444'
                            }}>
                              {data.changePercent}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Selected Stock Details */}
              {selectedStock && stockData[selectedStock] && (
                <div style={styles.stockDetails} className="animate-slide-in">
                  <div style={styles.stockDetailsHeader}>
                    <div>
                      <h2 style={styles.stockDetailsTitle}>{selectedStock}</h2>
                      <p style={styles.stockDetailsStatus}>{marketStatus}</p>
                    </div>
                    <div style={styles.stockDetailsPrice}>
                      <div style={styles.stockDetailsPriceValue}>
                        ${stockData[selectedStock].price}
                      </div>
                      <div style={{
                        ...styles.stockDetailsChange,
                        color: parseFloat(stockData[selectedStock].change) >= 0 ? '#10B981' : '#EF4444'
                      }}>
                        {stockData[selectedStock].change} ({stockData[selectedStock].changePercent})
                      </div>
                    </div>
                  </div>

                  <div style={styles.metricsGrid}>
                    <div style={styles.metricCard}>
                      <p style={styles.metricLabel}>VOLUME</p>
                      <p style={styles.metricValue}>{stockData[selectedStock].volume}</p>
                    </div>
                    <div style={styles.metricCard}>
                      <p style={styles.metricLabel}>HIGH</p>
                      <p style={styles.metricValue}>${stockData[selectedStock].high}</p>
                    </div>
                    <div style={styles.metricCard}>
                      <p style={styles.metricLabel}>LOW</p>
                      <p style={styles.metricValue}>${stockData[selectedStock].low}</p>
                    </div>
                    <div style={styles.metricCard}>
                      <p style={styles.metricLabel}>OPEN</p>
                      <p style={styles.metricValue}>${stockData[selectedStock].open}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

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
              <p style={{ color: '#9CA3AF', margin: 0 }}>AI-Powered Technical & Fundamental Analysis</p>
            </div>

            {isLoading && (
              <div style={styles.loadingSpinner}>
                <p>🔄 Analyzing {selectedStock} with AI...</p>
              </div>
            )}

            {analysisData && !isLoading && (
              <>
                {/* Summary */}
                <div style={styles.analysisCard}>
                  <h3 style={{ margin: '0 0 12px 0', color: '#3B82F6' }}>Summary</h3>
                  <p style={{ margin: 0 }}>{analysisData.summary}</p>
                </div>

                {/* Technical Analysis */}
                <div style={styles.analysisCard}>
                  <h3 style={{ margin: '0 0 12px 0', color: '#3B82F6' }}>Technical Analysis</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                    <div>
                      <p style={styles.metricLabel}>Trend</p>
                      <p style={{ 
                        fontWeight: 'bold',
                        color: analysisData.technicalAnalysis?.trend === 'bullish' ? '#10B981' :
                               analysisData.technicalAnalysis?.trend === 'bearish' ? '#EF4444' : '#9CA3AF'
                      }}>
                        {analysisData.technicalAnalysis?.trend?.toUpperCase()}
                      </p>
                    </div>
                    <div>
                      <p style={styles.metricLabel}>RSI</p>
                      <p style={{ fontWeight: 'bold' }}>
                        {analysisData.technicalAnalysis?.rsi} - {analysisData.technicalAnalysis?.rsiSignal}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Price Levels */}
                <div style={styles.analysisCard}>
                  <h3 style={{ margin: '0 0 12px 0', color: '#3B82F6' }}>Price Levels</h3>
                  
                  <div style={{ marginBottom: '16px' }}>
                    <p style={{ ...styles.metricLabel, marginBottom: '8px' }}>Support Levels</p>
                    {analysisData.levels?.support?.map((price, idx) => (
                      <div key={idx} style={styles.priceLevel}>
                        <span>S{idx + 1}</span>
                        <span style={{ color: '#10B981', fontWeight: 'bold' }}>${price}</span>
                      </div>
                    ))}
                  </div>

                  <div>
                    <p style={{ ...styles.metricLabel, marginBottom: '8px' }}>Resistance Levels</p>
                    {analysisData.levels?.resistance?.map((price, idx) => (
                      <div key={idx} style={styles.priceLevel}>
                        <span>R{idx + 1}</span>
                        <span style={{ color: '#EF4444', fontWeight: 'bold' }}>${price}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Trading Plan */}
                <div style={styles.analysisCard}>
                  <h3 style={{ margin: '0 0 12px 0', color: '#3B82F6' }}>Trading Plan</h3>
                  
                  <div style={{ marginBottom: '16px' }}>
                    <p style={styles.metricLabel}>Entry Points</p>
                    {analysisData.tradingPlan?.entries?.map((entry, idx) => (
                      <div key={idx} style={{ marginBottom: '8px' }}>
                        <p style={{ margin: '0', fontWeight: 'bold' }}>${entry.price}</p>
                        <p style={{ margin: '0', fontSize: '12px', color: '#9CA3AF' }}>{entry.reason}</p>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                    <div>
                      <p style={styles.metricLabel}>Stop Loss</p>
                      <p style={{ margin: '0', fontWeight: 'bold', color: '#EF4444' }}>
                        ${analysisData.tradingPlan?.stopLoss}
                      </p>
                    </div>
                    <div>
                      <p style={styles.metricLabel}>Risk/Reward</p>
                      <p style={styles.metricValue}>
                        {analysisData.tradingPlan?.riskReward}
                      </p>
                    </div>
                  </div>

                  <div style={{ marginTop: '16px' }}>
                    <p style={styles.metricLabel}>Price Targets</p>
                    <div style={{ marginBottom: '8px' }}>
                      <p style={{ margin: '0', fontSize: '14px', color: '#9CA3AF' }}>Short Term ({analysisData.tradingPlan?.targets?.shortTerm?.timeframe})</p>
                      <p style={{ margin: '0', fontWeight: 'bold', color: '#10B981' }}>
                        ${analysisData.tradingPlan?.targets?.shortTerm?.price}
                      </p>
                    </div>
                    <div>
                      <p style={{ margin: '0', fontSize: '14px', color: '#9CA3AF' }}>Long Term ({analysisData.tradingPlan?.targets?.longTerm?.timeframe})</p>
                      <p style={{ margin: '0', fontWeight: 'bold', color: '#10B981' }}>
                        ${analysisData.tradingPlan?.targets?.longTerm?.price}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Recommendation */}
                <div style={{
                  ...styles.analysisCard,
                  background: analysisData.recommendation?.action === 'buy' ? 'linear-gradient(135deg, #064E3B, #065F46)' :
                              analysisData.recommendation?.action === 'sell' ? 'linear-gradient(135deg, #7F1D1D, #991B1B)' :
                              'linear-gradient(135deg, #374151, #4B5563)'
                }}>
                  <h3 style={{ margin: '0 0 12px 0', color: '#ffffff' }}>Recommendation</h3>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <p style={{ margin: '0', fontSize: '24px', fontWeight: 'bold', color: '#ffffff' }}>
                      {analysisData.recommendation?.action?.toUpperCase()}
                    </p>
                    <p style={{ margin: '0', fontSize: '18px', color: '#ffffff' }}>
                      {analysisData.recommendation?.confidence}% Confidence
                    </p>
                  </div>
                  <p style={{ margin: '0 0 12px 0', color: '#E5E7EB' }}>
                    {analysisData.recommendation?.strategy}
                  </p>
                  {analysisData.recommendation?.risks && (
                    <div>
                      <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#F59E0B' }}>⚠️ Risks:</p>
                      {analysisData.recommendation.risks.map((risk, idx) => (
                        <p key={idx} style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#E5E7EB' }}>• {risk}</p>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Technical Indicators */}
            {technicalData && (
              <div style={styles.analysisCard}>
                <h3 style={{ margin: '0 0 12px 0', color: '#3B82F6' }}>Technical Indicators</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                  {Object.entries(technicalData.indicators).map(([key, value]) => (
                    <div key={key}>
                      <p style={styles.metricLabel}>{key.toUpperCase()}</p>
                      <p style={{ margin: '0', fontWeight: 'bold' }}>
                        {typeof value === 'object' ? JSON.stringify(value.value || value) : value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'chat' && (
          <div style={styles.chatContainer}>
            <div style={styles.chatWindow}>
              {chatMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className="animate-slide-in"
                  style={{
                    ...styles.chatMessage,
                    ...(msg.role === 'user' ? styles.chatMessageUser : styles.chatMessageAI)
                  }}
                >
                  {msg.content}
                </div>
              ))}
            </div>
            <div style={styles.chatInputContainer}>
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Ask about stocks, analysis, or trading strategies..."
                style={styles.chatInput}
              />
              <button
                onClick={handleSendMessage}
                style={styles.chatSendButton}
              >
                Send
              </button>
            </div>
          </div>
        )}

        {activeTab === 'plays' && (
          <div style={{ padding: '20px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>Smart Plays</h2>
            <p style={{ color: '#9CA3AF', marginBottom: '16px', fontSize: '14px' }}>
              AI-generated trading opportunities • Updated {marketStatus === 'Market Open' ? 'hourly' : 'at market open'}
            </p>
            
            {smartPlays.length === 0 && (
              <div style={styles.loadingSpinner}>
                <p>🤖 Generating smart plays...</p>
              </div>
            )}

            {smartPlays.map((play, idx) => (
              <div key={idx} style={getPlayCardStyle(play.confidence)} className="animate-slide-in">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: '600', margin: 0, color: '#ffffff' }}>
                    {play.emoji} {play.title}
                  </h3>
                  <span style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                    padding: '4px 12px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    color: '#ffffff'
                  }}>
                    {play.confidence}% Confidence
                  </span>
                </div>
                
                <div style={{ marginBottom: '12px' }}>
                  <p style={{ margin: '0 0 4px 0', fontSize: '20px', fontWeight: 'bold', color: '#ffffff' }}>
                    {play.ticker}
                  </p>
                  <p style={{ margin: '0', fontSize: '14px', color: '#E5E7EB' }}>
                    Strategy: {play.strategy} • {play.timeframe}
                  </p>
                </div>

                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(3, 1fr)', 
                  gap: '12px',
                  marginBottom: '12px',
                  backgroundColor: 'rgba(0, 0, 0, 0.3)',
                  padding: '12px',
                  borderRadius: '8px'
                }}>
                  <div>
                    <p style={{ margin: '0', fontSize: '12px', color: '#9CA3AF' }}>Entry</p>
                    <p style={{ margin: '0', fontWeight: 'bold', color: '#10B981' }}>${play.entry}</p>
                  </div>
                  <div>
                    <p style={{ margin: '0', fontSize: '12px', color: '#9CA3AF' }}>Stop Loss</p>
                    <p style={{ margin: '0', fontWeight: 'bold', color: '#EF4444' }}>${play.stopLoss}</p>
                  </div>
                  <div>
                    <p style={{ margin: '0', fontSize: '12px', color: '#9CA3AF' }}>Target</p>
                    <p style={{ margin: '0', fontWeight: 'bold', color: '#10B981' }}>
                      ${play.targets?.[0]} {play.targets?.[1] && `/ $${play.targets[1]}`}
                    </p>
                  </div>
                </div>

                <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#E5E7EB' }}>
                  {play.reasoning}
                </p>
                
                {play.newsImpact && (
                  <p style={{ margin: '0', fontSize: '12px', color: '#F59E0B' }}>
                    📰 {play.newsImpact}
                  </p>
                )}
                
                <div style={{ marginTop: '8px' }}>
                  <span style={{
                    fontSize: '12px',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    backgroundColor: play.riskLevel === 'high' ? 'rgba(239, 68, 68, 0.2)' :
                                    play.riskLevel === 'medium' ? 'rgba(245, 158, 11, 0.2)' :
                                    'rgba(16, 185, 129, 0.2)',
                    color: play.riskLevel === 'high' ? '#EF4444' :
                           play.riskLevel === 'medium' ? '#F59E0B' : '#10B981'
                  }}>
                    {play.riskLevel?.toUpperCase()} RISK
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'market' && (
          <div style={{ padding: '20px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '16px' }}>Market Overview</h2>
            
            {/* Major Indices */}
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '12px' }}>Major Indices</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {marketData.sp500 && (
                  <div style={{
                    ...styles.stockDetails,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <p style={{ fontWeight: '600', margin: '0' }}>{marketData.sp500.symbol}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: '18px', fontWeight: 'bold', margin: '0' }}>${marketData.sp500.price}</p>
                      <p style={{ 
                        fontSize: '14px', 
                        color: parseFloat(marketData.sp500.change) >= 0 ? '#10B981' : '#EF4444',
                        margin: '4px 0 0 0' 
                      }}>
                        {marketData.sp500.change} ({marketData.sp500.changePercent})
                      </p>
                    </div>
                  </div>
                )}
                
                {marketData.nasdaq && (
                  <div style={{
                    ...styles.stockDetails,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <p style={{ fontWeight: '600', margin: '0' }}>{marketData.nasdaq.symbol}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: '18px', fontWeight: 'bold', margin: '0' }}>${marketData.nasdaq.price}</p>
                      <p style={{ 
                        fontSize: '14px', 
                        color: parseFloat(marketData.nasdaq.change) >= 0 ? '#10B981' : '#EF4444',
                        margin: '4px 0 0 0' 
                      }}>
                        {marketData.nasdaq.change} ({marketData.nasdaq.changePercent})
                      </p>
                    </div>
                  </div>
                )}

                {marketData.dowJones && (
                  <div style={{
                    ...styles.stockDetails,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <p style={{ fontWeight: '600', margin: '0' }}>{marketData.dowJones.symbol}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: '18px', fontWeight: 'bold', margin: '0' }}>${marketData.dowJones.price}</p>
                      <p style={{ 
                        fontSize: '14px', 
                        color: parseFloat(marketData.dowJones.change) >= 0 ? '#10B981' : '#EF4444',
                        margin: '4px 0 0 0' 
                      }}>
                        {marketData.dowJones.change} ({marketData.dowJones.changePercent})
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Economic Indicators */}
            {economicData && (
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '12px' }}>Economic Indicators</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                  {economicData.indicators && Object.entries(economicData.indicators).map(([key, value]) => (
                    <div key={key} style={styles.metricCard}>
                      <p style={styles.metricLabel}>{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                      <p style={styles.metricValue}>
                        {value.value}{value.unit === '%' ? '%' : ''} 
                      </p>
                      <p style={{ fontSize: '10px', color: '#6B7280', margin: '4px 0 0 0' }}>
                        {value.date}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Commodities */}
            {economicData && economicData.commodities && (
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '12px' }}>Commodities</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                  {Object.entries(economicData.commodities).map(([key, value]) => (
                    <div key={key} style={styles.metricCard}>
                      <p style={styles.metricLabel}>{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                      <p style={styles.metricValue}>${value.value}</p>
                      <p style={{ fontSize: '10px', color: '#6B7280', margin: '4px 0 0 0' }}>
                        {value.unit}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'alerts' && (
          <div style={{ padding: '20px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '16px' }}>Real-time Alerts</h2>
            
            {alerts.length === 0 && (
              <div style={styles.loadingSpinner}>
                <p>🔍 Scanning for alerts...</p>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {alerts.map((alert, idx) => (
                <div 
                  key={idx} 
                  className="animate-slide-in"
                  style={{
                    backgroundColor: alert.priority === 'high' ? 'rgba(239, 68, 68, 0.1)' :
                                    alert.priority === 'medium' ? 'rgba(245, 158, 11, 0.1)' :
                                    'rgba(16, 185, 129, 0.1)',
                    border: `1px solid ${alert.priority === 'high' ? '#EF4444' :
                                         alert.priority === 'medium' ? '#F59E0B' : '#10B981'}`,
                    borderRadius: '12px',
                    padding: '16px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '24px', marginRight: '12px' }}>
                      {alert.type === 'price_movement' ? '📈' :
                       alert.type === 'volume_spike' ? '📊' :
                       alert.type === 'market_volatility' ? '🚨' :
                       alert.type === 'market_calm' ? '🧘' : '🔔'}
                    </span>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ fontWeight: '600', margin: '0 0 4px 0' }}>{alert.title}</h3>
                      <p style={{ fontSize: '14px', color: '#D1D5DB', margin: '0 0 8px 0' }}>
                        {alert.description}
                      </p>
                      {alert.action && (
                        <p style={{ fontSize: '12px', color: '#9CA3AF', margin: '0 0 4px 0' }}>
                          💡 {alert.action}
                        </p>
                      )}
                      <p style={{ fontSize: '12px', color: '#6B7280', margin: 0 }}>
                        {new Date(alert.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <div style={styles.bottomNav}>
        <div style={styles.navContainer}>
          <button
            onClick={() => setActiveTab('chat')}
            style={activeTab === 'chat' ? styles.navButtonActive : styles.navButton}
          >
            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span style={styles.navLabel}>CHAT</span>
          </button>
          <button
            onClick={() => setActiveTab('ticker')}
            style={activeTab === 'ticker' ? styles.navButtonActive : styles.navButton}
          >
            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span style={styles.navLabel}>TICKER</span>
          </button>
          <button
            onClick={() => setActiveTab('analysis')}
            style={activeTab === 'analysis' ? styles.navButtonActive : styles.navButton}
          >
            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
            </svg>
            <span style={styles.navLabel}>ANALYSIS</span>
          </button>
          <button
            onClick={() => setActiveTab('plays')}
            style={activeTab === 'plays' ? styles.navButtonActive : styles.navButton}
          >
            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span style={styles.navLabel}>PLAYS</span>
          </button>
          <button
            onClick={() => setActiveTab('market')}
            style={activeTab === 'market' ? styles.navButtonActive : styles.navButton}
          >
            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span style={styles.navLabel}>MARKET</span>
          </button>
          <button
            onClick={() => setActiveTab('alerts')}
            style={activeTab === 'alerts' ? styles.navButtonActive : styles.navButton}
          >
            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <span style={styles.navLabel}>ALERTS</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default RoloApp;
