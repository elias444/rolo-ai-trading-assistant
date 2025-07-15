import React, { useState, useEffect, useCallback } from 'react';

const RoloTradingApp = () => {
  // All state declarations first
  const [activeTab, setActiveTab] = useState('market');
  const [marketData, setMarketData] = useState({});
  const [smartPlays, setSmartPlays] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [analysisData, setAnalysisData] = useState({});
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [stocks, setStocks] = useState(['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'AMZN', 'NVDA', 'META', 'NFLX', 'SPY']);
  const [editingStocks, setEditingStocks] = useState(false);
  const [newStock, setNewStock] = useState('');
  const [stockData, setStockData] = useState({});
  const [selectedStock, setSelectedStock] = useState(null);
  const [isLoading, setIsLoading] = useState({
    market: false,
    plays: false,
    alerts: false,
    analysis: false,
    chat: false,
    stocks: false
  });

  // Market status detection
  const getMarketStatus = useCallback(() => {
    const now = new Date();
    const estTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
    const hour = estTime.getHours();
    const minute = estTime.getMinutes();
    const day = estTime.getDay(); // 0 = Sunday, 6 = Saturday
    
    if (day >= 1 && day <= 5) { // Monday-Friday
      if (hour >= 4 && hour < 9 || (hour === 9 && minute < 30)) {
        return { status: 'Pre-Market', color: '#3B82F6', isActive: true };
      } else if (hour >= 9 && hour < 16 || (hour === 9 && minute >= 30)) {
        return { status: 'Market Open', color: '#10B981', isActive: true };
      } else if (hour >= 16 && hour <= 20) {
        return { status: 'After Hours', color: '#F59E0B', isActive: true };
      } else {
        return { status: 'Futures Open', color: '#8B5CF6', isActive: true };
      }
    } else if (day === 0 && hour >= 18) { // Sunday evening
      return { status: 'Futures Open', color: '#8B5CF6', isActive: true };
    } else {
      return { status: 'Market Closed', color: '#6B7280', isActive: false };
    }
  }, []);

  const marketStatus = getMarketStatus();

  // API functions
  const fetchStockData = useCallback(async () => {
    setIsLoading(prev => ({ ...prev, stocks: true }));
    try {
      const stockPromises = stocks.map(async (symbol) => {
        const response = await fetch(`/.netlify/functions/enhanced-stock-data?symbol=${symbol}`);
        if (response.ok) {
          const data = await response.json();
          return { symbol, ...data };
        }
        return { symbol, error: 'Failed to fetch' };
      });
      
      const results = await Promise.all(stockPromises);
      const stockDataObject = {};
      results.forEach(result => {
        stockDataObject[result.symbol] = result;
      });
      setStockData(stockDataObject);
    } catch (error) {
      console.error('Stock data fetch error:', error);
    } finally {
      setIsLoading(prev => ({ ...prev, stocks: false }));
    }
  }, [stocks]);

  const fetchMarketData = useCallback(async () => {
    setIsLoading(prev => ({ ...prev, market: true }));
    try {
      const response = await fetch('/.netlify/functions/market-dashboard');
      if (response.ok) {
        const data = await response.json();
        setMarketData(data);
      }
    } catch (error) {
      console.error('Market data fetch error:', error);
    } finally {
      setIsLoading(prev => ({ ...prev, market: false }));
    }
  }, []);

  const fetchSmartPlays = useCallback(async () => {
    setIsLoading(prev => ({ ...prev, plays: true }));
    try {
      const response = await fetch('/.netlify/functions/smart-plays-generator');
      if (response.ok) {
        const data = await response.json();
        setSmartPlays(data.plays || []);
      }
    } catch (error) {
      console.error('Smart plays fetch error:', error);
    } finally {
      setIsLoading(prev => ({ ...prev, plays: false }));
    }
  }, []);

  const fetchAlerts = useCallback(async () => {
    setIsLoading(prev => ({ ...prev, alerts: true }));
    try {
      const response = await fetch('/.netlify/functions/realtime-alerts');
      if (response.ok) {
        const data = await response.json();
        setAlerts(data.alerts || []);
      }
    } catch (error) {
      console.error('Alerts fetch error:', error);
    } finally {
      setIsLoading(prev => ({ ...prev, alerts: false }));
    }
  }, []);

  const fetchAnalysis = useCallback(async () => {
    setIsLoading(prev => ({ ...prev, analysis: true }));
    try {
      const response = await fetch('/.netlify/functions/comprehensive-ai-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'analysis' })
      });
      if (response.ok) {
        const data = await response.json();
        setAnalysisData(data);
      }
    } catch (error) {
      console.error('Analysis fetch error:', error);
    } finally {
      setIsLoading(prev => ({ ...prev, analysis: false }));
    }
  }, []);

  const sendChatMessage = useCallback(async () => {
    if (!newMessage.trim()) return;
    
    const userMessage = { role: 'user', content: newMessage };
    setChatMessages(prev => [...prev, userMessage]);
    setNewMessage('');
    setIsLoading(prev => ({ ...prev, chat: true }));

    try {
      const response = await fetch('/.netlify/functions/enhanced-rolo-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: newMessage })
      });
      
      if (response.ok) {
        const data = await response.json();
        const aiMessage = { role: 'assistant', content: data.response };
        setChatMessages(prev => [...prev, aiMessage]);
      }
    } catch (error) {
      console.error('Chat error:', error);
    } finally {
      setIsLoading(prev => ({ ...prev, chat: false }));
    }
  }, [newMessage]);

  // Stock editing functions
  const addStock = useCallback(() => {
    if (newStock.trim() && !stocks.includes(newStock.toUpperCase()) && stocks.length < 12) {
      setStocks(prev => [...prev, newStock.toUpperCase()]);
      setNewStock('');
    }
  }, [newStock, stocks]);

  const removeStock = useCallback((stockToRemove) => {
    if (stocks.length > 3) {
      setStocks(prev => prev.filter(stock => stock !== stockToRemove));
    }
  }, [stocks]);

  // Effects
  useEffect(() => {
    const refreshInterval = marketStatus.isActive ? 
      (marketStatus.status === 'Market Open' ? 30000 : 60000) : 300000;

    fetchStockData();
    const interval = setInterval(fetchStockData, refreshInterval);
    return () => clearInterval(interval);
  }, [stocks, marketStatus.isActive, marketStatus.status]);

  useEffect(() => {
    if (activeTab === 'market') fetchMarketData();
    if (activeTab === 'plays') fetchSmartPlays();
    if (activeTab === 'alerts') fetchAlerts();
    if (activeTab === 'analysis') fetchAnalysis();
  }, [activeTab]);

  // Render functions
  const renderPopularStocks = () => (
    <div className="bg-gray-900 rounded-xl p-4 mb-6">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="text-white text-lg font-semibold">Popular Stocks</h3>
          <p className="text-gray-400 text-sm">{marketStatus.status} • Updates every {marketStatus.isActive ? (marketStatus.status === 'Market Open' ? '30s' : '1min') : '5min'}</p>
        </div>
        <button
          onClick={() => setEditingStocks(!editingStocks)}
          className="px-3 py-1 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
        >
          {editingStocks ? 'Done' : 'Edit'}
        </button>
      </div>

      {editingStocks && (
        <div className="mb-4 flex gap-2">
          <input
            type="text"
            placeholder="Add stock symbol"
            value={newStock}
            onChange={(e) => setNewStock(e.target.value.toUpperCase())}
            className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400"
          />
          <button
            onClick={addStock}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Add
          </button>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        {stocks.map((symbol) => {
          const stock = stockData[symbol] || {};
          const stocksLoading = isLoading.stocks;
          
          return (
            <div
              key={symbol}
              onClick={() => setSelectedStock(stock)}
              className="bg-gray-800 rounded-lg p-3 cursor-pointer hover:bg-gray-700 transition-colors relative"
            >
              {editingStocks && stocks.length > 3 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeStock(symbol);
                  }}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 text-white rounded-full text-xs flex items-center justify-center"
                >
                  ×
                </button>
              )}
              
              <div className="text-white font-medium text-sm mb-1">{symbol}</div>
              
              {stocksLoading ? (
                <div className="animate-pulse">
                  <div className="h-3 bg-gray-600 rounded mb-1"></div>
                  <div className="h-2 bg-gray-600 rounded w-2/3"></div>
                </div>
              ) : stock.price ? (
                <>
                  <div className="text-white font-semibold text-sm">${stock.price.toFixed(2)}</div>
                  <div className={`text-xs ${stock.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {stock.change >= 0 ? '+' : ''}{stock.change?.toFixed(2)} ({stock.changePercent?.toFixed(2)}%)
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {stock.session || marketStatus.status}
                  </div>
                </>
              ) : (
                <div className="text-gray-400 text-xs">Loading...</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderMarketTab = () => (
    <div className="space-y-4">
      <div className="bg-gray-900 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-white text-xl font-bold">Market Overview</h2>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full`} style={{ backgroundColor: marketStatus.color }}></div>
              <span style={{ color: marketStatus.color }} className="text-sm font-medium">
                {marketStatus.status}
              </span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-gray-400 text-sm">
              {new Date().toLocaleTimeString()}
            </div>
          </div>
        </div>
      </div>

      {isLoading.market ? (
        <div className="bg-gray-900 rounded-xl p-4">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-gray-700 rounded w-1/3"></div>
            {[1,2,3,4].map(i => (
              <div key={i} className="h-16 bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-gray-900 rounded-xl p-4">
          <h3 className="text-white text-lg font-semibold mb-4">Major Indices</h3>
          <div className="grid grid-cols-1 gap-3">
            {marketData.indices && Object.entries(marketData.indices).map(([symbol, data]) => (
              <div key={symbol} className="bg-gray-800 rounded-lg p-3 flex justify-between items-center">
                <div>
                  <div className="text-white font-medium">{symbol}</div>
                  <div className="text-gray-400 text-xs">{data.session || marketStatus.status}</div>
                </div>
                <div className="text-right">
                  <div className="text-white font-semibold">${data.price?.toFixed(2) || 'N/A'}</div>
                  <div className={`text-sm ${data.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {data.change >= 0 ? '+' : ''}{data.change?.toFixed(2)} ({data.changePercent?.toFixed(2)}%)
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {marketData.economic && (
        <div className="bg-gray-900 rounded-xl p-4">
          <h3 className="text-white text-lg font-semibold mb-4">Economic Indicators</h3>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(marketData.economic).map(([key, value]) => (
              <div key={key} className="bg-gray-800 rounded-lg p-3">
                <div className="text-gray-400 text-xs capitalize">{key.replace(/([A-Z])/g, ' $1')}</div>
                <div className="text-white font-medium">{value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(marketStatus.status === 'Futures Open' || marketStatus.status === 'Market Closed') && marketData.futures && (
        <div className="bg-gray-900 rounded-xl p-4">
          <h3 className="text-white text-lg font-semibold mb-4">Futures</h3>
          <div className="grid grid-cols-1 gap-3">
            {Object.entries(marketData.futures).map(([symbol, data]) => (
              <div key={symbol} className="bg-gray-800 rounded-lg p-3 flex justify-between items-center">
                <div>
                  <div className="text-white font-medium">{symbol}</div>
                  <div className="text-purple-400 text-xs">Futures</div>
                </div>
                <div className="text-right">
                  <div className="text-white font-semibold">${data.price?.toFixed(2) || 'N/A'}</div>
                  <div className={`text-sm ${data.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {data.change >= 0 ? '+' : ''}{data.change?.toFixed(2)} ({data.changePercent?.toFixed(2)}%)
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderPlaysTab = () => (
    <div className="space-y-4">
      <div className="bg-gray-900 rounded-xl p-4">
        <h2 className="text-white text-xl font-bold">Smart Plays</h2>
        <p className="text-gray-400 text-sm">Real-time opportunities • {marketStatus.status}</p>
      </div>

      {isLoading.plays ? (
        <div className="bg-gray-900 rounded-xl p-4">
          <div className="animate-pulse space-y-4">
            {[1,2,3].map(i => (
              <div key={i} className="h-24 bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      ) : smartPlays.length > 0 ? (
        <div className="space-y-3">
          {smartPlays.map((play, index) => (
            <div key={index} className="bg-gray-900 rounded-xl p-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h4 className="text-white font-semibold">{play.ticker}</h4>
                  <p className="text-gray-400 text-sm">{play.strategy}</p>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  play.confidence >= 75 ? 'bg-green-900 text-green-200' :
                  play.confidence >= 60 ? 'bg-yellow-900 text-yellow-200' :
                  'bg-red-900 text-red-200'
                }`}>
                  {play.confidence}% Confidence
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="bg-blue-900 rounded p-2 text-center">
                  <p className="text-blue-200 text-xs">Entry</p>
                  <p className="text-white font-semibold">${play.entry}</p>
                </div>
                <div className="bg-red-900 rounded p-2 text-center">
                  <p className="text-red-200 text-xs">Stop Loss</p>
                  <p className="text-white font-semibold">${play.stopLoss}</p>
                </div>
                <div className="bg-green-900 rounded p-2 text-center">
                  <p className="text-green-200 text-xs">Target</p>
                  <p className="text-white font-semibold">${play.target}</p>
                </div>
              </div>

              <div className="bg-gray-800 rounded p-3">
                <p className="text-gray-300 text-sm">{play.reasoning}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-gray-900 rounded-xl p-6 text-center">
          <p className="text-gray-400">No qualifying opportunities available</p>
          <p className="text-gray-500 text-sm mt-2">Based on current {marketStatus.status.toLowerCase()} conditions</p>
        </div>
      )}
    </div>
  );

  const renderAlertsTab = () => (
    <div className="space-y-4">
      <div className="bg-gray-900 rounded-xl p-4">
        <h2 className="text-white text-xl font-bold">Real-Time Alerts</h2>
        <p className="text-gray-400 text-sm">Market monitoring • {marketStatus.status}</p>
      </div>

      {isLoading.alerts ? (
        <div className="bg-gray-900 rounded-xl p-4">
          <div className="animate-pulse space-y-4">
            {[1,2,3].map(i => (
              <div key={i} className="h-20 bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      ) : alerts.length > 0 ? (
        <div className="space-y-3">
          {alerts.map((alert, index) => (
            <div key={index} className="bg-gray-900 rounded-xl p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h4 className="text-white font-semibold">{alert.ticker}</h4>
                  <p className="text-gray-400 text-sm">{alert.type}</p>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  alert.priority === 'HIGH' ? 'bg-red-900 text-red-200' :
                  alert.priority === 'MEDIUM' ? 'bg-yellow-900 text-yellow-200' :
                  'bg-blue-900 text-blue-200'
                }`}>
                  {alert.priority}
                </span>
              </div>
              
              <p className="text-gray-300 text-sm mb-3">{alert.message}</p>
              
              {alert.action && (
                <div className="bg-blue-900 rounded p-2">
                  <p className="text-blue-200 text-sm font-medium">Suggested Action:</p>
                  <p className="text-blue-100 text-sm">{alert.action}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-gray-900 rounded-xl p-6 text-center">
          <p className="text-gray-400">No active alerts</p>
          <p className="text-gray-500 text-sm mt-2">Monitoring {marketStatus.status.toLowerCase()} conditions</p>
        </div>
      )}
    </div>
  );

  const renderAnalysisTab = () => (
    <div className="space-y-4">
      <div className="bg-gray-900 rounded-xl p-4">
        <h2 className="text-white text-xl font-bold">AI Market Analysis</h2>
        <p className="text-gray-400 text-sm">Comprehensive analysis • Available 24/7</p>
      </div>

      {isLoading.analysis ? (
        <div className="bg-gray-900 rounded-xl p-4">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-gray-700 rounded w-1/2"></div>
            <div className="h-20 bg-gray-700 rounded"></div>
            <div className="h-6 bg-gray-700 rounded w-1/3"></div>
            <div className="h-16 bg-gray-700 rounded"></div>
          </div>
        </div>
      ) : analysisData.analysis ? (
        <div className="space-y-4">
          {analysisData.analysis.executiveSummary && (
            <div className="bg-gray-900 rounded-xl p-4">
              <h3 className="text-white font-semibold mb-2 flex items-center">
                📋 Executive Summary
              </h3>
              <p className="text-gray-300 text-sm leading-relaxed">
                {analysisData.analysis.executiveSummary}
              </p>
            </div>
          )}

          {analysisData.analysis.marketEnvironment && (
            <div className="bg-gray-900 rounded-xl p-4">
              <h3 className="text-white font-semibold mb-3 flex items-center">
                🌍 Market Environment
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-800 rounded p-3">
                  <p className="text-gray-400 text-xs">Session</p>
                  <p className="text-white font-medium">{analysisData.analysis.marketEnvironment.session}</p>
                </div>
                <div className="bg-gray-800 rounded p-3">
                  <p className="text-gray-400 text-xs">Volatility</p>
                  <p className="text-white font-medium">{analysisData.analysis.marketEnvironment.volatility}</p>
                </div>
                <div className="bg-gray-800 rounded p-3">
                  <p className="text-gray-400 text-xs">Sentiment</p>
                  <p className="text-white font-medium">{analysisData.analysis.marketEnvironment.sentiment}</p>
                </div>
                <div className="bg-gray-800 rounded p-3">
                  <p className="text-gray-400 text-xs">Key Drivers</p>
                  <p className="text-white font-medium">{analysisData.analysis.marketEnvironment.keyDrivers}</p>
                </div>
              </div>
            </div>
          )}

          {analysisData.analysis.technicalAnalysis && (
            <div className="bg-gray-900 rounded-xl p-4">
              <h3 className="text-white font-semibold mb-3 flex items-center">
                📈 Technical Analysis
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-400">Trend:</span>
                  <span className="text-white font-medium">{analysisData.analysis.technicalAnalysis.trend}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Strength:</span>
                  <span className="text-white font-medium">{analysisData.analysis.technicalAnalysis.strength}</span>
                </div>
                {analysisData.analysis.technicalAnalysis.keyLevels && (
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div className="bg-gray-800 rounded p-3">
                      <p className="text-gray-400 text-xs">Support Levels</p>
                      <p className="text-green-400 font-medium">
                        {analysisData.analysis.technicalAnalysis.keyLevels.support?.join(', ') || 'N/A'}
                      </p>
                    </div>
                    <div className="bg-gray-800 rounded p-3">
                      <p className="text-gray-400 text-xs">Resistance Levels</p>
                      <p className="text-red-400 font-medium">
                        {analysisData.analysis.technicalAnalysis.keyLevels.resistance?.join(', ') || 'N/A'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {analysisData.analysis.recommendation && (
            <div className="bg-gray-900 rounded-xl p-4">
              <h3 className="text-white font-semibold mb-3 flex items-center">
                💡 AI Recommendation
              </h3>
              <div className="bg-blue-900 rounded p-3 mb-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-blue-200 font-medium text-lg">
                    {analysisData.analysis.recommendation.action}
                  </span>
                  <span className="text-blue-100 text-sm font-medium">
                    {analysisData.analysis.recommendation.confidence}% Confidence
                  </span>
                </div>
                {analysisData.analysis.recommendation.strategy && (
                  <p className="text-blue-100 text-sm">
                    {analysisData.analysis.recommendation.strategy}
                  </p>
                )}
              </div>
              
              {analysisData.analysis.recommendation.entryPoints && (
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {analysisData.analysis.recommendation.entryPoints.map((entry, idx) => (
                    <div key={idx} className="bg-gray-800 rounded p-2 text-center">
                      <p className="text-gray-400 text-xs">Entry {idx + 1}</p>
                      <p className="text-white font-semibold">${entry}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 gap-3">
                {analysisData.analysis.recommendation.catalysts && (
                  <div className="bg-green-900 rounded p-3">
                    <p className="text-green-200 text-sm font-medium mb-1">Key Catalysts:</p>
                    <p className="text-green-100 text-sm">{analysisData.analysis.recommendation.catalysts}</p>
                  </div>
                )}
                {analysisData.analysis.recommendation.risks && (
                  <div className="bg-red-900 rounded p-3">
                    <p className="text-red-200 text-sm font-medium mb-1">Risk Factors:</p>
                    <p className="text-red-100 text-sm">{analysisData.analysis.recommendation.risks}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {analysisData.analysis.marketContext && (
            <div className="bg-gray-900 rounded-xl p-4">
              <h3 className="text-white font-semibold mb-3 flex items-center">
                📊 Market Context
              </h3>
              <div className="space-y-3">
                {analysisData.analysis.marketContext.sectorComparison && (
                  <div>
                    <p className="text-gray-400 text-sm mb-2">Sector Performance:</p>
                    <p className="text-gray-300 text-sm">{analysisData.analysis.marketContext.sectorComparison}</p>
                  </div>
                )}
                {analysisData.analysis.marketContext.volumeAnalysis && (
                  <div>
                    <p className="text-gray-400 text-sm mb-2">Volume Analysis:</p>
                    <p className="text-gray-300 text-sm">{analysisData.analysis.marketContext.volumeAnalysis}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-gray-900 rounded-xl p-6 text-center">
          <p className="text-gray-400">No comprehensive analysis available</p>
          <button 
            onClick={fetchAnalysis}
            className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Generate Analysis
          </button>
        </div>
      )}
    </div>
  );

  const renderChatTab = () => (
    <div className="flex flex-col h-[calc(100vh-140px)]">
      <div className="bg-gray-900 rounded-xl p-4 mb-4">
        <h2 className="text-white text-xl font-bold">Rolo AI Chat</h2>
        <p className="text-gray-400 text-sm">Ask about markets, analysis, or trading strategies</p>
      </div>

      <div className="flex-1 bg-gray-900 rounded-xl p-4 overflow-y-auto mb-4">
        {chatMessages.length === 0 ? (
          <div className="text-center text-gray-400 mt-8">
            <p className="text-lg">👋 Hi! I'm Rolo AI</p>
            <p className="text-sm mt-2">Ask me about market analysis, trading strategies, or any stock questions!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {chatMessages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] p-3 rounded-2xl ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-200'
                  }`}
                >
                  <p className="text-sm leading-relaxed">{msg.content}</p>
                </div>
              </div>
            ))}
            {isLoading.chat && (
              <div className="flex justify-start">
                <div className="bg-gray-800 text-gray-200 p-3 rounded-2xl">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="bg-gray-900 rounded-xl p-4">
        <div className="flex gap-3">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
            placeholder="Ask Rolo AI anything..."
            className="flex-1 px-4 py-3 bg-gray-800 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
          />
          <button
            onClick={sendChatMessage}
            disabled={!newMessage.trim() || isLoading.chat}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );

  const StockDetailModal = () => {
    if (!selectedStock) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-gray-900 rounded-xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-white text-xl font-bold">{selectedStock.symbol}</h3>
              <p className="text-gray-400 text-sm">{selectedStock.session || marketStatus.status}</p>
            </div>
            <button
              onClick={() => setSelectedStock(null)}
              className="text-gray-400 hover:text-white text-2xl"
            >
              ×
            </button>
          </div>

          {selectedStock.price ? (
            <div className="space-y-4">
              <div className="text-center">
                <div className="text-white text-3xl font-bold">${selectedStock.price.toFixed(2)}</div>
                <div className={`text-lg ${selectedStock.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {selectedStock.change >= 0 ? '+' : ''}{selectedStock.change?.toFixed(2)} ({selectedStock.changePercent?.toFixed(2)}%)
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-800 rounded p-3">
                  <p className="text-gray-400 text-xs">Open</p>
                  <p className="text-white font-medium">${selectedStock.open?.toFixed(2) || 'N/A'}</p>
                </div>
                <div className="bg-gray-800 rounded p-3">
                  <p className="text-gray-400 text-xs">High</p>
                  <p className="text-white font-medium">${selectedStock.high?.toFixed(2) || 'N/A'}</p>
                </div>
                <div className="bg-gray-800 rounded p-3">
                  <p className="text-gray-400 text-xs">Low</p>
                  <p className="text-white font-medium">${selectedStock.low?.toFixed(2) || 'N/A'}</p>
                </div>
                <div className="bg-gray-800 rounded p-3">
                  <p className="text-gray-400 text-xs">Volume</p>
                  <p className="text-white font-medium">{selectedStock.volume?.toLocaleString() || 'N/A'}</p>
                </div>
              </div>

              {selectedStock.technicalAnalysis && (
                <div className="bg-gray-800 rounded p-3">
                  <p className="text-white font-medium mb-2">Technical Analysis</p>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-400 text-sm">RSI:</span>
                      <span className="text-white text-sm">{selectedStock.technicalAnalysis.rsi}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400 text-sm">MACD:</span>
                      <span className="text-white text-sm">{selectedStock.technicalAnalysis.macd}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-gray-400 py-8">
              <p>No data available for {selectedStock.symbol}</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-700 p-4 sticky top-0 z-40">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-white">Rolo AI</h1>
          <div className="text-right">
            <div className="flex items-center gap-2">
              <div 
                className="w-2 h-2 rounded-full animate-pulse"
                style={{ backgroundColor: marketStatus.color }}
              ></div>
              <span style={{ color: marketStatus.color }} className="text-sm font-medium">
                {marketStatus.status}
              </span>
            </div>
            <div className="text-gray-400 text-xs">
              {new Date().toLocaleTimeString()}
            </div>
          </div>
        </div>
      </div>

      {/* Popular Stocks Section (always visible) */}
      <div className="p-4">
        {renderPopularStocks()}
      </div>

      {/* Tab Content */}
      <div className="px-4 pb-20">
        {activeTab === 'market' && renderMarketTab()}
        {activeTab === 'plays' && renderPlaysTab()}
        {activeTab === 'alerts' && renderAlertsTab()}
        {activeTab === 'analysis' && renderAnalysisTab()}
        {activeTab === 'chat' && renderChatTab()}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-700 z-50">
        <div className="flex justify-around py-2">
          {[
            { id: 'market', label: 'Market', icon: '📊' },
            { id: 'plays', label: 'Plays', icon: '⚡' },
            { id: 'alerts', label: 'Alerts', icon: '🔔' },
            { id: 'analysis', label: 'Analysis', icon: '🤖' },
            { id: 'chat', label: 'Chat', icon: '💬' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center px-3 py-2 rounded-lg transition-all duration-200 ${
                activeTab === tab.id 
                  ? 'bg-blue-600 text-white transform scale-105' 
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <span className="text-lg mb-1">{tab.icon}</span>
              <span className="text-xs font-medium">{tab.label}</span>
              {isLoading[tab.id] && (
                <div className="w-1 h-1 bg-blue-400 rounded-full animate-pulse mt-1"></div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Stock Detail Modal */}
      <StockDetailModal />
    </div>
  );
};

export default RoloTradingApp;
