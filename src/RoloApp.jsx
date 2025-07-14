import React, { useState, useEffect, useCallback } from 'react';

const RoloApp = () => {
  const [activeTab, setActiveTab] = useState('ticker');
  const [searchTicker, setSearchTicker] = useState('');
  const [selectedStock, setSelectedStock] = useState('AAPL');
  const [stockData, setStockData] = useState({});
  const [marketData, setMarketData] = useState({});
  const [analysisData, setAnalysisData] = useState(null);
  const [smartPlays, setSmartPlays] = useState([]);
  const [technicalData, setTechnicalData] = useState(null);
  const [economicData, setEconomicData] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [isLoading, setIsLoading] = useState({
    stocks: false,
    analysis: false,
    plays: false,
    market: false,
    alerts: false
  });
  const [marketStatus, setMarketStatus] = useState('Closed');
  const [chatMessages, setChatMessages] = useState([
    { role: 'ai', content: "Hello! I'm Rolo, your AI trading assistant. I only show real market data - no mock or fake information. How can I help you today?" }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [popularStocks] = useState(['AAPL', 'TSLA', 'NVDA', 'SPY', 'QQQ', 'META', 'AMD', 'GOOGL', 'MSFT']);

  // Market status detection
  const checkMarketStatus = useCallback(() => {
    const now = new Date();
    const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
    const est = new Date(utcTime + (-5 * 3600000));
    const hours = est.getHours();
    const minutes = est.getMinutes();
    const day = est.getDay();
    
    if (day === 0 || day === 6) {
      if (day === 0 && hours >= 18) {
        setMarketStatus('Futures Open');
      } else {
        setMarketStatus('Weekend');
      }
      return;
    }
    
    const totalMinutes = hours * 60 + minutes;
    
    if (totalMinutes >= 240 && totalMinutes < 570) {
      setMarketStatus('Pre-Market');
    } else if (totalMinutes >= 570 && totalMinutes < 960) {
      setMarketStatus('Market Open');
    } else if (totalMinutes >= 960 && totalMinutes < 1200) {
      setMarketStatus('After Hours');
    } else {
      setMarketStatus('Futures Open');
    }
  }, []);

  useEffect(() => {
    checkMarketStatus();
    const interval = setInterval(checkMarketStatus, 60000);
    return () => clearInterval(interval);
  }, [checkMarketStatus]);

  // Fetch functions
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
            marketSession: marketStatus
          }
        }));
      }
    } catch (error) {
      console.error('Error fetching stock data:', error);
    } finally {
      setIsLoading(prev => ({ ...prev, stocks: false }));
    }
  }, [marketStatus]);

  const fetchAIAnalysis = useCallback(async (symbol) => {
    if (!symbol) return;
    
    setIsLoading(prev => ({ ...prev, analysis: true }));
    setAnalysisData(null);
    
    try {
      const response = await fetch('/.netlify/functions/ai-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, type: 'analysis' }),
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.analysis && Object.keys(data.analysis).length > 0) {
          setAnalysisData(data.analysis);
        }
      }
    } catch (error) {
      console.error('Error fetching AI analysis:', error);
    } finally {
      setIsLoading(prev => ({ ...prev, analysis: false }));
    }
  }, []);

  const fetchSmartPlays = useCallback(async () => {
    setIsLoading(prev => ({ ...prev, plays: true }));
    setSmartPlays([]);
    
    try {
      const response = await fetch('/.netlify/functions/smart-plays-generator');
      if (response.ok) {
        const data = await response.json();
        if (data.plays && Array.isArray(data.plays) && data.plays.length > 0) {
          setSmartPlays(data.plays);
        }
      }
    } catch (error) {
      console.error('Error fetching smart plays:', error);
    } finally {
      setIsLoading(prev => ({ ...prev, plays: false }));
    }
  }, []);

  const fetchMarketDashboard = useCallback(async () => {
    setIsLoading(prev => ({ ...prev, market: true }));
    try {
      const response = await fetch('/.netlify/functions/market-dashboard');
      if (response.ok) {
        const data = await response.json();
        if (data && Object.keys(data).length > 0) {
          setMarketData(data);
        }
      }
    } catch (error) {
      console.error('Error fetching market data:', error);
    } finally {
      setIsLoading(prev => ({ ...prev, market: false }));
    }
  }, []);

  const fetchEconomicIndicators = useCallback(async () => {
    try {
      const response = await fetch('/.netlify/functions/economic-indicators');
      if (response.ok) {
        const data = await response.json();
        if (data && Object.keys(data).length > 0) {
          setEconomicData(data);
        }
      }
    } catch (error) {
      console.error('Error fetching economic data:', error);
    }
  }, []);

  const fetchAlerts = useCallback(async () => {
    setIsLoading(prev => ({ ...prev, alerts: true }));
    setAlerts([]);
    
    try {
      const response = await fetch('/.netlify/functions/realtime-alerts');
      if (response.ok) {
        const data = await response.json();
        if (data.alerts && Array.isArray(data.alerts) && data.alerts.length > 0) {
          setAlerts(data.alerts);
        }
      }
    } catch (error) {
      console.error('Error fetching alerts:', error);
    } finally {
      setIsLoading(prev => ({ ...prev, alerts: false }));
    }
  }, []);

  // Data loading effects
  useEffect(() => {
    if (selectedStock) {
      fetchStockData(selectedStock);
    }
    
    popularStocks.forEach(symbol => {
      if (!stockData[symbol]) {
        fetchStockData(symbol);
      }
    });
  }, [selectedStock, fetchStockData, popularStocks, stockData]);

  useEffect(() => {
    const loadTabData = async () => {
      switch (activeTab) {
        case 'analysis':
          if (selectedStock) {
            await fetchAIAnalysis(selectedStock);
          }
          break;
        case 'market':
          await fetchMarketDashboard();
          await fetchEconomicIndicators();
          break;
        case 'alerts':
          await fetchAlerts();
          break;
        case 'plays':
          await fetchSmartPlays();
          break;
        default:
          break;
      }
    };

    loadTabData();
  }, [activeTab, selectedStock, fetchAIAnalysis, fetchMarketDashboard, fetchEconomicIndicators, fetchAlerts, fetchSmartPlays]);

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
          message: `${message} (Context: Currently viewing ${selectedStock}, Market is ${marketStatus})`,
          context: { selectedStock, marketStatus }
        }),
      });
      if (response.ok) {
        const data = await response.json();
        setChatMessages(prev => [...prev, { role: 'ai', content: data.response || 'Sorry, I encountered an error.' }]);
      }
    } catch (error) {
      setChatMessages(prev => [...prev, { role: 'ai', content: 'Sorry, I encountered an error. Please try again.' }]);
    }
  }, [chatInput, selectedStock, marketStatus]);

  const getMarketStatusStyle = () => {
    const baseStyle = {
      display: 'inline-flex',
      alignItems: 'center',
      padding: '4px 12px',
      borderRadius: '9999px',
      fontSize: '12px',
      fontWeight: '600'
    };
    
    if (marketStatus === 'Market Open') {
      return { ...baseStyle, backgroundColor: '#064E3B', color: '#10B981' };
    } else if (marketStatus === 'Pre-Market' || marketStatus === 'After Hours' || marketStatus === 'Futures Open') {
      return { ...baseStyle, backgroundColor: '#7C2D12', color: '#F59E0B' };
    }
    return { ...baseStyle, backgroundColor: '#1F2937', color: '#9CA3AF' };
  };

  const getMarketStatusDot = () => {
    const baseStyle = {
      width: '8px',
      height: '8px',
      borderRadius: '50%',
      marginRight: '8px',
      animation: 'pulse 2s infinite'
    };
    
    if (marketStatus === 'Market Open') {
      return { ...baseStyle, backgroundColor: '#10B981' };
    } else if (marketStatus === 'Pre-Market' || marketStatus === 'After Hours' || marketStatus === 'Futures Open') {
      return { ...baseStyle, backgroundColor: '#F59E0B' };
    }
    return { ...baseStyle, backgroundColor: '#9CA3AF' };
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
      {/* Header */}
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
          margin: '0 0 8px 0',
        }}>AI Trading Assistant - Real Data Only</p>
        <div>
          <span style={getMarketStatusStyle()}>
            <span style={getMarketStatusDot()}></span>
            {marketStatus}
          </span>
        </div>
      </div>

      {/* Main Content */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        paddingBottom: '80px',
      }}>
        {activeTab === 'ticker' && (
          <div>
            {/* Search Bar */}
            <div style={{ padding: '20px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
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
              <h2 style={{
                fontSize: '18px',
                fontWeight: '600',
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
              }}>
                <span style={{ marginRight: '8px' }}>📈</span> Popular Stocks
              </h2>
              
              {isLoading.stocks && Object.keys(stockData).length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9CA3AF' }}>
                  <p>🔄 Loading real stock data...</p>
                </div>
              )}

              {!isLoading.stocks && Object.keys(stockData).length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9CA3AF' }}>
                  <p style={{ fontSize: '48px', margin: '0 0 16px 0' }}>📊</p>
                  <p>No real stock data available</p>
                  <p style={{ fontSize: '14px', marginTop: '8px' }}>
                    Check your API configuration
                  </p>
                </div>
              )}

              {Object.keys(stockData).length > 0 && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '12px',
                  marginBottom: '24px'
                }}>
                  {popularStocks.map(symbol => {
                    const data = stockData[symbol];
                    if (!data) return null;
                    
                    const isSelected = selectedStock === symbol;
                    return (
                      <div
                        key={symbol}
                        onClick={() => setSelectedStock(symbol)}
                        style={{
                          backgroundColor: '#1a1a1a',
                          border: `1px solid ${isSelected ? '#3B82F6' : '#374151'}`,
                          borderRadius: '12px',
                          padding: '12px',
                          textAlign: 'center',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}
                      >
                        <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{symbol}</div>
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
                      </div>
                    );
                  })}
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
                        {stockData[selectedStock].marketSession || marketStatus}
                      </p>
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
                      { label: 'HIGH', value: `$${stockData[selectedStock].high}` },
                      { label: 'LOW', value: `$${stockData[selectedStock].low}` },
                      { label: 'OPEN', value: `$${stockData[selectedStock].open}` }
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
              <p style={{ color: '#9CA3AF', margin: 0 }}>AI-Powered Analysis - Real Data Only</p>
            </div>

            {isLoading.analysis && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9CA3AF' }}>
                <p style={{ fontSize: '48px', margin: '0 0 16px 0' }}>🔄</p>
                <p>Analyzing {selectedStock} with real market data...</p>
              </div>
            )}

            {!isLoading.analysis && !analysisData && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9CA3AF' }}>
                <p style={{ fontSize: '48px', margin: '0 0 16px 0' }}>📊</p>
                <p>No real analysis data available</p>
                <p style={{ fontSize: '14px', marginTop: '8px' }}>
                  AI analysis requires real market data
                </p>
              </div>
            )}

            {analysisData && !isLoading.analysis && (
              <>
                {analysisData.summary && (
                  <div style={{
                    backgroundColor: '#1a1a1a',
                    borderRadius: '16px',
                    padding: '20px',
                    marginBottom: '16px',
                    border: '1px solid #374151',
                  }}>
                    <h3 style={{ margin: '0 0 12px 0', color: '#3B82F6' }}>Summary</h3>
                    <p style={{ margin: 0, lineHeight: 1.5 }}>{analysisData.summary}</p>
                  </div>
                )}

                {analysisData.recommendation && (
                  <div style={{
                    backgroundColor: '#1a1a1a',
                    borderRadius: '16px',
                    padding: '20px',
                    marginBottom: '16px',
                    border: '1px solid #374151',
                    background: analysisData.recommendation.action === 'buy' ? 'linear-gradient(135deg, #064E3B, #065F46)' :
                                analysisData.recommendation.action === 'sell' ? 'linear-gradient(135deg, #7F1D1D, #991B1B)' :
                                'linear-gradient(135deg, #374151, #4B5563)'
                  }}>
                    <h3 style={{ margin: '0 0 12px 0', color: '#ffffff' }}>Recommendation</h3>
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center', 
                      marginBottom: '12px',
                      flexWrap: 'wrap',
                      gap: '8px'
                    }}>
                      <p style={{ margin: '0', fontSize: '24px', fontWeight: 'bold', color: '#ffffff' }}>
                        {analysisData.recommendation.action?.toUpperCase()}
                      </p>
                      {analysisData.recommendation.confidence && (
                        <p style={{ margin: '0', fontSize: '18px', color: '#ffffff' }}>
                          {analysisData.recommendation.confidence}% Confidence
                        </p>
                      )}
                    </div>
                    {analysisData.recommendation.strategy && (
                      <p style={{ margin: '0 0 12px 0', color: '#E5E7EB' }}>
                        {analysisData.recommendation.strategy}
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

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
                    maxWidth: '70%',
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
                placeholder="Ask about real market data and analysis..."
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

        {activeTab === 'plays' && (
          <div style={{ padding: '20px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>Smart Plays</h2>
            <p style={{ color: '#9CA3AF', marginBottom: '16px', fontSize: '14px' }}>
              Real market opportunities from Alpha Vantage data only
            </p>
            
            {isLoading.plays && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9CA3AF' }}>
                <p style={{ fontSize: '48px', margin: '0 0 16px 0' }}>🔄</p>
                <p>Analyzing real market data for opportunities...</p>
              </div>
            )}

            {!isLoading.plays && smartPlays.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9CA3AF' }}>
                <p style={{ fontSize: '48px', margin: '0 0 16px 0' }}>🤖</p>
                <p style={{ fontSize: '18px', margin: '0 0 8px 0' }}>No qualifying opportunities</p>
                <p style={{ fontSize: '14px', margin: '0' }}>
                  No significant moves detected in real market data
                </p>
              </div>
            )}

            {smartPlays.map((play, idx) => (
              <div key={idx} style={{
                borderRadius: '16px',
                padding: '20px',
                marginBottom: '16px',
                border: '1px solid #374151',
                background: play.confidence >= 80 ? 'linear-gradient(135deg, #064E3B, #065F46)' :
                           play.confidence >= 60 ? 'linear-gradient(135deg, #1E3A8A, #1E40AF)' :
                           'linear-gradient(135deg, #374151, #4B5563)'
              }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  marginBottom: '12px',
                  flexWrap: 'wrap',
                  gap: '8px'
                }}>
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
                  gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', 
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
                      ${play.targets && play.targets[0]} {play.targets && play.targets[1] && `/ ${play.targets[1]}`}
                    </p>
                  </div>
                </div>

                <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#E5E7EB' }}>
                  {play.reasoning}
                </p>
                
                {play.newsImpact && (
                  <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#F59E0B' }}>
                    📰 {play.newsImpact}
                  </p>
                )}
                
                <div>
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
                    {play.riskLevel?.toUpperCase() || 'MEDIUM'} RISK
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'market' && (
          <div style={{ padding: '20px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '16px' }}>Market Overview</h2>
            
            {isLoading.market && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9CA3AF' }}>
                <p style={{ fontSize: '48px', margin: '0 0 16px 0' }}>🔄</p>
                <p>Loading real market data...</p>
              </div>
            )}

            {!isLoading.market && (!marketData || Object.keys(marketData).length === 0) && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9CA3AF' }}>
                <p style={{ fontSize: '48px', margin: '0 0 16px 0' }}>📊</p>
                <p>No real market data available</p>
                <p style={{ fontSize: '14px', marginTop: '8px' }}>
                  Check your market dashboard API
                </p>
              </div>
            )}

            {marketData && Object.keys(marketData).length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '12px' }}>Major Indices</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {['sp500', 'nasdaq', 'dowJones'].map(index => {
                    const data = marketData[index];
                    if (!data || data.error) return null;
                    
                    return (
                      <div key={index} style={{
                        backgroundColor: '#1a1a1a',
                        borderRadius: '20px',
                        padding: '20px',
                        border: '1px solid #1F2937',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <div>
                          <p style={{ fontWeight: '600', margin: '0', fontSize: '16px' }}>
                            {data.symbol || index.toUpperCase()}
                          </p>
                          <p style={{ fontSize: '12px', color: '#9CA3AF', margin: '4px 0 0 0' }}>
                            {marketStatus}
                          </p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <p style={{ fontSize: '20px', fontWeight: 'bold', margin: '0' }}>
                            {data.price}
                          </p>
                          <p style={{ 
                            fontSize: '14px', 
                            color: data.change && parseFloat(data.change) >= 0 ? '#10B981' : '#EF4444',
                            margin: '4px 0 0 0' 
                          }}>
                            {data.change} ({data.changePercent})
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {economicData && economicData.indicators && Object.keys(economicData.indicators).length > 0 && (
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '12px' }}>Economic Indicators</h3>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
                  gap: '12px' 
                }}>
                  {Object.entries(economicData.indicators).map(([key, value]) => (
                    <div key={key} style={{
                      backgroundColor: '#000000',
                      borderRadius: '12px',
                      padding: '16px',
                    }}>
                      <p style={{
                        color: '#9CA3AF',
                        fontSize: '12px',
                        marginBottom: '4px',
                        textTransform: 'uppercase'
                      }}>
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </p>
                      <p style={{
                        fontSize: '18px',
                        fontWeight: '600',
                        margin: '0'
                      }}>
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
          </div>
        )}

        {activeTab === 'alerts' && (
          <div style={{ padding: '20px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>Real-time Alerts</h2>
            <p style={{ color: '#9CA3AF', marginBottom: '16px', fontSize: '14px' }}>
              Real market movements and volatility changes only
            </p>
            
            {isLoading.alerts && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9CA3AF' }}>
                <p style={{ fontSize: '48px', margin: '0 0 16px 0' }}>🔄</p>
                <p>Scanning real market data for alerts...</p>
              </div>
            )}

            {!isLoading.alerts && alerts.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9CA3AF' }}>
                <p style={{ fontSize: '48px', margin: '0 0 16px 0' }}>🔔</p>
                <p style={{ fontSize: '18px', margin: '0 0 8px 0' }}>No market alerts</p>
                <p style={{ fontSize: '14px', margin: '0' }}>
                  No significant movements detected in real market data
                </p>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {alerts.map((alert, idx) => (
                <div 
                  key={idx} 
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
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    <span style={{ fontSize: '24px', flexShrink: 0 }}>
                      {alert.type === 'price_movement' ? '📈' :
                       alert.type === 'volume_spike' ? '📊' :
                       alert.type === 'market_volatility' ? '🚨' :
                       alert.type === 'market_calm' ? '🧘' : '🔔'}
                    </span>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ fontWeight: '600', margin: '0 0 4px 0', fontSize: '16px' }}>
                        {alert.title}
                      </h3>
                      <p style={{ fontSize: '14px', color: '#D1D5DB', margin: '0 0 8px 0', lineHeight: 1.4 }}>
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
            { id: 'ticker', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', label: 'TICKER' },
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
                transition: 'color 0.1s ease',
                minWidth: '60px',
                userSelect: 'none'
              }}
            >
              <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
              </svg>
              <span style={{
                fontSize: '12px',
                marginTop: '4px',
                fontWeight: activeTab === tab.id ? '600' : '400'
              }}>
                {tab.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Add CSS animations */}
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
