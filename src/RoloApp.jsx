import React, { useState, useEffect, useCallback, useMemo } from 'react';

const RoloTradingApp = () => {
  // State management
  const [activeTab, setActiveTab] = useState('market');
  const [marketData, setMarketData] = useState(null);
  const [smartPlays, setSmartPlays] = useState(null);
  const [alerts, setAlerts] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState({
    market: false,
    plays: false,
    alerts: false,
    analysis: false
  });

  // Optimized loading state updates
  const updateLoading = useCallback((tab, isLoading) => {
    setLoading(prev => ({ ...prev, [tab]: isLoading }));
  }, []);

  // Market session detection
  const getCurrentMarketSession = useCallback(() => {
    const now = new Date();
    const estTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
    const hour = estTime.getHours();
    const dayOfWeek = estTime.getDay();
    
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      if (hour >= 4 && hour < 9 || (hour === 9 && estTime.getMinutes() < 30)) {
        return { session: 'PRE_MARKET', color: 'text-blue-400', label: 'Pre-Market' };
      } else if (hour >= 9 && hour < 16 || (hour === 9 && estTime.getMinutes() >= 30)) {
        return { session: 'MARKET_OPEN', color: 'text-green-400', label: 'Market Open' };
      } else if (hour >= 16 && hour <= 20) {
        return { session: 'AFTER_HOURS', color: 'text-orange-400', label: 'After Hours' };
      } else {
        return { session: 'FUTURES_OPEN', color: 'text-purple-400', label: 'Futures Open' };
      }
    } else if (dayOfWeek === 0 && hour >= 18) {
      return { session: 'FUTURES_OPEN', color: 'text-purple-400', label: 'Futures Open' };
    }
    return { session: 'CLOSED', color: 'text-gray-400', label: 'Market Closed' };
  }, []);

  const marketSession = useMemo(() => getCurrentMarketSession(), [getCurrentMarketSession]);

  // API call functions with proper error handling
  const fetchMarketData = useCallback(async () => {
    updateLoading('market', true);
    try {
      const response = await fetch('/.netlify/functions/market-dashboard');
      if (response.ok) {
        const data = await response.json();
        setMarketData(data);
      }
    } catch (error) {
      console.error('Market data fetch error:', error);
    } finally {
      updateLoading('market', false);
    }
  }, [updateLoading]);

  const fetchSmartPlays = useCallback(async () => {
    updateLoading('plays', true);
    try {
      const response = await fetch('/.netlify/functions/smart-plays-generator');
      if (response.ok) {
        const data = await response.json();
        setSmartPlays(data);
      }
    } catch (error) {
      console.error('Smart plays fetch error:', error);
    } finally {
      updateLoading('plays', false);
    }
  }, [updateLoading]);

  const fetchAlerts = useCallback(async () => {
    updateLoading('alerts', true);
    try {
      const response = await fetch('/.netlify/functions/realtime-alerts');
      if (response.ok) {
        const data = await response.json();
        setAlerts(data);
      }
    } catch (error) {
      console.error('Alerts fetch error:', error);
    } finally {
      updateLoading('alerts', false);
    }
  }, [updateLoading]);

  const fetchAnalysis = useCallback(async () => {
    updateLoading('analysis', true);
    try {
      const response = await fetch('/.netlify/functions/comprehensive-ai-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'analysis' })
      });
      if (response.ok) {
        const data = await response.json();
        setAnalysis(data);
      }
    } catch (error) {
      console.error('Analysis fetch error:', error);
    } finally {
      updateLoading('analysis', false);
    }
  }, [updateLoading]);

  // Auto-refresh based on market session
  useEffect(() => {
    const refreshInterval = marketSession.session === 'MARKET_OPEN' ? 60000 : 300000; // 1min or 5min
    
    // Initial fetch
    fetchMarketData();
    fetchSmartPlays();
    fetchAlerts();
    
    // Set up auto-refresh
    const interval = setInterval(() => {
      if (activeTab === 'market') fetchMarketData();
      if (activeTab === 'plays') fetchSmartPlays();
      if (activeTab === 'alerts') fetchAlerts();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [activeTab, marketSession.session, fetchMarketData, fetchSmartPlays, fetchAlerts]);

  // Tab change handler
  const handleTabChange = useCallback((tab) => {
    setActiveTab(tab);
    // Fetch data for new tab if not already loaded
    if (tab === 'market' && !marketData) fetchMarketData();
    if (tab === 'plays' && !smartPlays) fetchSmartPlays();
    if (tab === 'alerts' && !alerts) fetchAlerts();
    if (tab === 'analysis' && !analysis) fetchAnalysis();
  }, [marketData, smartPlays, alerts, analysis, fetchMarketData, fetchSmartPlays, fetchAlerts, fetchAnalysis]);

  // Render Market Tab
  const renderMarketTab = () => (
    <div className="space-y-4">
      {/* Market Status Header */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold text-white">Market Status</h3>
            <p className={`text-sm ${marketSession.color}`}>{marketSession.label}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400">Updates every {marketSession.session === 'MARKET_OPEN' ? '1 min' : '5 min'}</p>
            <p className="text-xs text-gray-500">{new Date().toLocaleTimeString()}</p>
          </div>
        </div>
      </div>

      {/* Major Indices */}
      {loading.market ? (
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-600 rounded w-1/3 mb-4"></div>
            <div className="grid grid-cols-1 gap-4">
              {[1,2,3].map(i => (
                <div key={i} className="h-16 bg-gray-600 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      ) : marketData?.indices ? (
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4">Major Indices</h3>
          <div className="grid grid-cols-1 gap-3">
            {Object.entries(marketData.indices).map(([symbol, data]) => (
              <div key={symbol} className="bg-gray-700 rounded-lg p-3 flex justify-between items-center">
                <div>
                  <p className="text-white font-medium">{symbol}</p>
                  <p className="text-xs text-gray-400">{data.timestamp || 'Live'}</p>
                </div>
                <div className="text-right">
                  <p className="text-white font-semibold">${data.price?.toFixed(2) || 'N/A'}</p>
                  <p className={`text-sm ${data.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {data.change >= 0 ? '+' : ''}{data.change?.toFixed(2)} ({data.changePercent?.toFixed(2)}%)
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 text-center">
          <p className="text-gray-400">No real-time market data available</p>
          <button 
            onClick={fetchMarketData}
            className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );

  // Render Smart Plays Tab
  const renderPlaysTab = () => (
    <div className="space-y-4">
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-white">Smart Plays</h3>
          <div className="text-right">
            <p className={`text-sm ${marketSession.color}`}>{marketSession.label}</p>
            <p className="text-xs text-gray-400">Real-time opportunities</p>
          </div>
        </div>
      </div>

      {loading.plays ? (
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="animate-pulse space-y-4">
            {[1,2,3].map(i => (
              <div key={i} className="h-24 bg-gray-600 rounded"></div>
            ))}
          </div>
        </div>
      ) : smartPlays?.plays?.length > 0 ? (
        <div className="space-y-3">
          {smartPlays.plays.map((play) => (
            <div key={play.id} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h4 className="text-white font-semibold">{play.ticker}</h4>
                  <p className="text-sm text-gray-400">{play.strategy}</p>
                  <p className="text-xs text-blue-400">{play.marketSession}</p>
                </div>
                <div className="text-right">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    play.confidence >= 75 ? 'bg-green-900 text-green-200' :
                    play.confidence >= 60 ? 'bg-yellow-900 text-yellow-200' :
                    'bg-red-900 text-red-200'
                  }`}>
                    {play.confidence}% Confidence
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="bg-blue-900 rounded p-2 text-center">
                  <p className="text-xs text-blue-200">Entry</p>
                  <p className="text-white font-semibold">${play.entry}</p>
                </div>
                <div className="bg-red-900 rounded p-2 text-center">
                  <p className="text-xs text-red-200">Stop Loss</p>
                  <p className="text-white font-semibold">${play.stopLoss}</p>
                </div>
                <div className="bg-green-900 rounded p-2 text-center">
                  <p className="text-xs text-green-200">Target</p>
                  <p className="text-white font-semibold">${play.target}</p>
                </div>
              </div>

              <div className="bg-gray-700 rounded p-3">
                <p className="text-sm text-gray-300 mb-2">{play.reasoning}</p>
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Volume: {(play.volume/1000000).toFixed(1)}M ({play.volumeRatio}x avg)</span>
                  <span>R/R: {play.riskReward}</span>
                  <span>{play.changePercent > 0 ? '+' : ''}{play.changePercent.toFixed(1)}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 text-center">
          <p className="text-gray-400">No qualifying real-time opportunities available</p>
          <p className="text-sm text-gray-500 mt-2">
            {smartPlays?.marketSession ? `During ${smartPlays.marketSession} session` : 'Waiting for market data'}
          </p>
          <button 
            onClick={fetchSmartPlays}
            className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
          >
            Refresh
          </button>
        </div>
      )}
    </div>
  );

  // Render Alerts Tab
  const renderAlertsTab = () => (
    <div className="space-y-4">
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <h3 className="text-lg font-semibold text-white">Real-Time Alerts</h3>
        <p className="text-sm text-gray-400">Live market monitoring</p>
      </div>

      {loading.alerts ? (
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="animate-pulse space-y-4">
            {[1,2,3].map(i => (
              <div key={i} className="h-20 bg-gray-600 rounded"></div>
            ))}
          </div>
        </div>
      ) : alerts?.alerts?.length > 0 ? (
        <div className="space-y-3">
          {alerts.alerts.map((alert, index) => (
            <div key={index} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h4 className="text-white font-semibold">{alert.ticker}</h4>
                  <p className="text-sm text-gray-400">{alert.type}</p>
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
              
              <div className="flex justify-between text-xs text-gray-500 mt-2">
                <span>Confidence: {alert.confidence}%</span>
                <span>{new Date(alert.timestamp).toLocaleTimeString()}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 text-center">
          <p className="text-gray-400">No active real-time alerts</p>
          <p className="text-sm text-gray-500 mt-2">Monitoring market conditions...</p>
          <button 
            onClick={fetchAlerts}
            className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
          >
            Refresh
          </button>
        </div>
      )}
    </div>
  );

  // Render Analysis Tab
  const renderAnalysisTab = () => (
    <div className="space-y-4">
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <h3 className="text-lg font-semibold text-white">AI Market Analysis</h3>
        <p className="text-sm text-gray-400">Comprehensive real-time analysis</p>
      </div>

      {loading.analysis ? (
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-gray-600 rounded w-1/2"></div>
            <div className="h-20 bg-gray-600 rounded"></div>
            <div className="h-6 bg-gray-600 rounded w-1/3"></div>
            <div className="h-16 bg-gray-600 rounded"></div>
          </div>
        </div>
      ) : analysis?.analysis ? (
        <div className="space-y-4">
          {analysis.analysis.executiveSummary && (
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h4 className="text-white font-semibold mb-2">📋 Executive Summary</h4>
              <p className="text-gray-300 text-sm">{analysis.analysis.executiveSummary}</p>
            </div>
          )}
          
          {analysis.analysis.marketEnvironment && (
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h4 className="text-white font-semibold mb-3">🌍 Market Environment</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-700 rounded p-3">
                  <p className="text-xs text-gray-400">Session</p>
                  <p className="text-white font-medium">{analysis.analysis.marketEnvironment.session || 'Unknown'}</p>
                </div>
                <div className="bg-gray-700 rounded p-3">
                  <p className="text-xs text-gray-400">Volatility</p>
                  <p className="text-white font-medium">{analysis.analysis.marketEnvironment.volatility || 'Unknown'}</p>
                </div>
              </div>
            </div>
          )}
          
          {analysis.analysis.technicalAnalysis && (
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h4 className="text-white font-semibold mb-3">📈 Technical Analysis</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-400">Trend:</span>
                  <span className="text-white">{analysis.analysis.technicalAnalysis.trend || 'Unknown'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Strength:</span>
                  <span className="text-white">{analysis.analysis.technicalAnalysis.strength || 'Unknown'}</span>
                </div>
              </div>
            </div>
          )}
          
          {analysis.analysis.recommendation && (
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h4 className="text-white font-semibold mb-3">💡 AI Recommendation</h4>
              <div className="bg-blue-900 rounded p-3 mb-3">
                <div className="flex justify-between items-center">
                  <span className="text-blue-200 font-medium">{analysis.analysis.recommendation.action || 'No Action'}</span>
                  <span className="text-blue-100 text-sm">{analysis.analysis.recommendation.confidence}% Confidence</span>
                </div>
              </div>
              {analysis.analysis.recommendation.strategy && (
                <p className="text-gray-300 text-sm">{analysis.analysis.recommendation.strategy}</p>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 text-center">
          <p className="text-gray-400">No comprehensive analysis available</p>
          <button 
            onClick={fetchAnalysis}
            className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
          >
            Generate Analysis
          </button>
        </div>
      )}
    </div>
  );

  // Main render
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-700 p-4">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-bold">Rolo AI</h1>
          <div className="text-right">
            <p className={`text-sm ${marketSession.color}`}>{marketSession.label}</p>
            <p className="text-xs text-gray-400">{new Date().toLocaleTimeString()}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 pb-20">
        {activeTab === 'market' && renderMarketTab()}
        {activeTab === 'plays' && renderPlaysTab()}
        {activeTab === 'alerts' && renderAlertsTab()}
        {activeTab === 'analysis' && renderAnalysisTab()}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-700">
        <div className="flex justify-around py-2">
          {[
            { id: 'market', label: 'Market', icon: '📊' },
            { id: 'plays', label: 'Plays', icon: '⚡' },
            { id: 'alerts', label: 'Alerts', icon: '🔔' },
            { id: 'analysis', label: 'Analysis', icon: '🤖' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex flex-col items-center px-3 py-2 rounded-lg transition-colors ${
                activeTab === tab.id 
                  ? 'bg-blue-600 text-white' 
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <span className="text-lg mb-1">{tab.icon}</span>
              <span className="text-xs font-medium">{tab.label}</span>
              {loading[tab.id] && (
                <div className="w-1 h-1 bg-blue-400 rounded-full animate-pulse mt-1"></div>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RoloTradingApp;
