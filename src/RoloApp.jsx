import React, { useState, useEffect, useCallback } from 'react';

const RoloApp = () => {
  // === STATE MANAGEMENT ===
  const [activeTab, setActiveTab] = useState('stocks');
  const [searchTicker, setSearchTicker] = useState('');
  const [selectedStock, setSelectedStock] = useState('SPY');
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
  const [popularStocks, setPopularStocks] = useState(['SPY', 'QQQ', 'AAPL', 'TSLA', 'NVDA', 'MSFT', 'GOOGL', 'AMZN', 'META']);

  // === UTILITY FUNCTIONS ===
  const formatPrice = (price) => {
    if (!price || price === 'N/A') return 'N/A';
    return typeof price === 'number' ? `$${price.toFixed(2)}` : price;
  };

  const getPriceChangeColor = (change) => {
    if (!change) return '#9CA3AF';
    const numChange = typeof change === 'string' ? parseFloat(change.replace(/[^-\d.]/g, '')) : change;
    return numChange >= 0 ? '#10B981' : '#EF4444';
  };

  const getMarketSession = () => {
    const now = new Date();
    const day = now.getDay();
    const time = now.getHours() * 60 + now.getMinutes();
    
    if (day === 0 || day === 6) return 'Weekend';
    if (time >= 930 && time < 1600) return 'Market Open';
    if (time >= 400 && time < 930) return 'Pre-Market';
    if (time >= 1600 && time < 2000) return 'After Hours';
    return 'Futures Open';
  };

  // === API FUNCTIONS ===
  const fetchStockData = useCallback(async () => {
    setLoading(prev => ({ ...prev, stocks: true }));
    setErrors(prev => ({ ...prev, stocks: null }));
    
    try {
      const promises = popularStocks.map(async (symbol) => {
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
        if (result && result.data && !result.data.error) {
          newStockData[result.symbol] = {
            price: result.data.price || 'N/A',
            change: result.data.change || '0',
            changePercent: result.data.changePercent || '0%',
            volume: result.data.volume || 'N/A',
            marketSession: result.data.marketSession || getMarketSession(),
            lastUpdated: new Date().toLocaleTimeString()
          };
        }
      });

      setStockData(newStockData);
      
    } catch (error) {
      console.error('Error in fetchStockData:', error);
      setErrors(prev => ({ ...prev, stocks: error.message }));
    } finally {
      setLoading(prev => ({ ...prev, stocks: false }));
    }
  }, [popularStocks]);

  const fetchAIAnalysis = useCallback(async () => {
    if (!selectedStock) return;
    
    setLoading(prev => ({ ...prev, analysis: true }));
    setErrors(prev => ({ ...prev, analysis: null }));
    setAnalysisData(null);
    
    try {
      const response = await fetch(`/.netlify/functions/comprehensive-ai-analysis?symbol=${selectedStock}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      if (data.analysis) {
        setAnalysisData({
          symbol: selectedStock,
          analysis: data.analysis.analysis || 'Analysis not available',
          recommendation: data.analysis.recommendation || 'Hold',
          priceTarget: data.analysis.priceTarget || 'N/A',
          riskLevel: data.analysis.riskLevel || 'Medium',
          confidence: data.analysis.confidence || 50,
          technicalData: data.analysis.technicalData || {},
          marketData: data.analysis.marketData || {},
          lastUpdated: new Date().toLocaleTimeString()
        });
      }
      
    } catch (error) {
      console.error('Error in fetchAIAnalysis:', error);
      setErrors(prev => ({ ...prev, analysis: error.message }));
    } finally {
      setLoading(prev => ({ ...prev, analysis: false }));
    }
  }, [selectedStock]);

  const fetchSmartPlays = useCallback(async () => {
    setLoading(prev => ({ ...prev, plays: true }));
    setErrors(prev => ({ ...prev, plays: null }));
    
    try {
      const response = await fetch('/.netlify/functions/smart-plays-generator');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      if (data.plays && Array.isArray(data.plays)) {
        setSmartPlays(data.plays);
      } else {
        setSmartPlays([]);
      }
      
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
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      if (data.alerts && Array.isArray(data.alerts)) {
        setAlerts(data.alerts);
      } else {
        setAlerts([]);
      }
      
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
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      setMarketData({
        indices: data.indices || {},
        economic: data.economic || {},
        sectors: data.sectors || {},
        vix: data.vix || null,
        marketMood: data.marketMood || 'Unknown',
        session: data.session || getMarketSession(),
        lastUpdated: new Date().toLocaleTimeString()
      });
      
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
        stockData: stockData[selectedStock] || {},
        marketData,
        recentAlerts: alerts.slice(0, 3)
      };
      
      const response = await fetch('/.netlify/functions/enhanced-rolo-chat', {
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
        content: 'Sorry, I encountered an error processing your message. Please try again.',
        timestamp: new Date().toLocaleTimeString()
      };
      setChatHistory(prev => [...prev, errorMessage]);
    } finally {
      setLoading(prev => ({ ...prev, chat: false }));
    }
  }, [selectedStock, stockData, marketData, alerts]);

  // === EFFECTS ===
  useEffect(() => {
    setMarketStatus(getMarketSession());
    fetchStockData();
  }, [fetchStockData]);

  useEffect(() => {
    if (activeTab === 'analysis') {
      fetchAIAnalysis();
    } else if (activeTab === 'plays') {
      fetchSmartPlays();
    } else if (activeTab === 'alerts') {
      fetchAlerts();
    } else if (activeTab === 'market') {
      fetchMarketData();
    }
  }, [activeTab, fetchAIAnalysis, fetchSmartPlays, fetchAlerts, fetchMarketData]);

  // Auto-refresh
  useEffect(() => {
    const interval = setInterval(() => {
      setMarketStatus(getMarketSession());
      if (activeTab === 'stocks') fetchStockData();
      if (activeTab === 'analysis') fetchAIAnalysis();
      if (activeTab === 'plays') fetchSmartPlays();
      if (activeTab === 'alerts') fetchAlerts();
      if (activeTab === 'market') fetchMarketData();
    }, 60000); // 1 minute
    
    return () => clearInterval(interval);
  }, [activeTab, fetchStockData, fetchAIAnalysis, fetchSmartPlays, fetchAlerts, fetchMarketData]);

  // === RENDER FUNCTIONS ===
  const renderStocksTab = () => (
    <div style={{ padding: '24px' }}>
      {/* Market Status */}
      <div style={{
        backgroundColor: '#1a1a1a',
        borderRadius: '16px',
        padding: '16px',
        marginBottom: '24px',
        border: '1px solid #1F2937'
      }}>
        <h2 style={{ margin: '0 0 8px 0', color: '#E5E7EB', fontSize: '18px' }}>
          Market Status: {marketStatus}
        </h2>
        <div style={{ color: '#9CA3AF', fontSize: '14px' }}>
          Selected Stock: {selectedStock}
        </div>
      </div>

      {/* Stock Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '12px',
        marginBottom: '24px'
      }}>
        {popularStocks.map((symbol, index) => (
          <div
            key={index}
            onClick={() => setSelectedStock(symbol)}
            style={{
              backgroundColor: selectedStock === symbol ? '#1F2937' : '#111111',
              borderRadius: '12px',
              padding: '12px',
              border: selectedStock === symbol ? '2px solid #10B981' : '1px solid #1F2937',
              cursor: 'pointer'
            }}
          >
            <div style={{ color: '#E5E7EB', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>
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
              </>
            ) : (
              <div style={{ fontSize: '12px', color: '#6B7280' }}>No data</div>
            )}
          </div>
        ))}
      </div>

      {/* Search */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <input
          type="text"
          value={searchTicker}
          onChange={(e) => setSearchTicker(e.target.value.toUpperCase())}
          placeholder="Enter symbol (e.g., AAPL)"
          style={{
            flex: 1,
            backgroundColor: '#374151',
            border: '1px solid #6B7280',
            borderRadius: '8px',
            padding: '8px 12px',
            color: '#E5E7EB',
            fontSize: '14px'
          }}
        />
        <button
          onClick={() => {
            if (searchTicker.trim()) {
              setSelectedStock(searchTicker.trim());
              setSearchTicker('');
            }
          }}
          style={{
            backgroundColor: '#10B981',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            padding: '8px 16px',
            fontSize: '14px',
            cursor: 'pointer'
          }}
        >
          Search
        </button>
      </div>

      {errors.stocks && (
        <div style={{
          backgroundColor: '#FEF2F2',
          border: '1px solid #FECACA',
          borderRadius: '8px',
          padding: '12px',
          color: '#DC2626',
          fontSize: '14px'
        }}>
          Error: {errors.stocks}
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
          AI Analysis - {selectedStock}
        </h2>
        
        {loading.analysis ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px'
          }}>
            <div style={{ color: '#9CA3AF' }}>Analyzing {selectedStock}...</div>
          </div>
        ) : errors.analysis ? (
          <div style={{
            backgroundColor: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: '8px',
            padding: '16px',
            color: '#DC2626',
            fontSize: '14px'
          }}>
            Error loading analysis: {errors.analysis}
          </div>
        ) : analysisData ? (
          <div>
            <div style={{ marginBottom: '20px' }}>
              <div style={{
                color: '#D1D5DB',
                fontSize: '14px',
                lineHeight: '1.6',
                marginBottom: '16px'
              }}>
                {analysisData.analysis}
              </div>
            </div>
            
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '16px'
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
                  Confidence
                </div>
                <div style={{ color: '#E5E7EB', fontSize: '14px', fontWeight: '500' }}>
                  {analysisData.confidence}%
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
            No analysis data available. Select a stock to get AI analysis.
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
        <h2 style={{
          margin: '0 0 20px 0',
          color: '#E5E7EB',
          fontSize: '20px',
          fontWeight: '600'
        }}>
          Smart Plays
        </h2>

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
            padding: '16px',
            color: '#DC2626',
            fontSize: '14px'
          }}>
            Error loading smart plays: {errors.plays}
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
            No trading opportunities available at this time
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
        <h2 style={{
          margin: '0 0 20px 0',
          color: '#E5E7EB',
          fontSize: '20px',
          fontWeight: '600'
        }}>
          Real-time Alerts
        </h2>

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
            padding: '16px',
            color: '#DC2626',
            fontSize: '14px'
          }}>
            Error loading alerts: {errors.alerts}
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
                  lineHeight: '1.4'
                }}>
                  {alert.message || 'No message available'}
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
        <h2 style={{
          margin: '0 0 20px 0',
          color: '#E5E7EB',
          fontSize: '20px',
          fontWeight: '600'
        }}>
          Market Overview
        </h2>

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
            padding: '16px',
            color: '#DC2626',
            fontSize: '14px'
          }}>
            Error loading market data: {errors.market}
          </div>
        ) : (
          <div>
            {/* Market Session */}
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{
                color: '#E5E7EB',
                fontSize: '16px',
                fontWeight: '600',
                marginBottom: '8px'
              }}>
                Session: {marketData.session || marketStatus}
              </h3>
              <div style={{ color: '#9CA3AF', fontSize: '12px' }}>
                Last Updated: {marketData.lastUpdated}
              </div>
            </div>

            {/* Major Indices */}
            {marketData.indices && Object.keys(marketData.indices).length > 0 ? (
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
                  {Object.entries(marketData.indices).map(([index, data]) => (
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
            ) : (
              <div style={{
                textAlign: 'center',
                padding: '20px',
                color: '#9CA3AF',
                fontSize: '14px'
              }}>
                No index data available
              </div>
            )}

            {/* VIX & Market Mood */}
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
                      color: marketData.marketMood === 'Fear' || marketData.marketMood === 'Extreme Fear' ? '#EF4444' :
                            marketData.marketMood === 'Complacent' || marketData.marketMood === 'Low Volatility' ? '#10B981' : '#F59E0B',
                      fontSize: '14px',
                      fontWeight: '600'
                    }}>
                      {marketData.marketMood}
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
                  {Object.entries(marketData.economic).map(([indicator, data]) => (
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
                        {typeof data === 'object' ? data.value || 'N/A' : data || 'N/A'}
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
              color: '#10B981',
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
