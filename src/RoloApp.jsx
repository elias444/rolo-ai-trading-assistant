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
      fontSize: '16px',
      fontWeight: '600',
    },
    stockChange: {
      fontSize: '14px',
    },
    stockSession: {
      fontSize: '12px',
      color: '#9CA3AF',
      marginTop: '4px',
    },
    stockDetails: {
      padding: '0 20px 20px',
    },
    stockDetailsCard: {
      backgroundColor: '#1a1a1a',
      border: '1px solid #374151',
      borderRadius: '12px',
      padding: '16px',
      marginBottom: '16px',
    },
    stockDetailsPrice: {
      fontSize: '48px',
      fontWeight: 'bold',
      textAlign: 'center',
      margin: '0 0 8px 0',
    },
    stockDetailsChange: {
      fontSize: '18px',
      fontWeight: '600',
      textAlign: 'center',
      marginBottom: '16px',
    },
    stockDetailsSession: {
      fontSize: '14px',
      color: '#9CA3AF',
      textAlign: 'center',
      marginBottom: '24px',
    },
    stockDetailsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: '12px',
    },
    stockDetailItem: {
      backgroundColor: '#111827',
      borderRadius: '8px',
      padding: '12px',
      textAlign: 'center',
    },
    stockDetailLabel: {
      fontSize: '12px',
      color: '#9CA3AF',
      marginBottom: '4px',
    },
    stockDetailValue: {
      fontSize: '16px',
      fontWeight: '600',
    },
    analysisSection: {
      padding: '20px',
    },
    analysisCard: {
      backgroundColor: '#1a1a1a',
      border: '1px solid #374151',
      borderRadius: '12px',
      padding: '16px',
      marginBottom: '16px',
    },
    analysisTitle: {
      fontSize: '18px',
      fontWeight: '600',
      marginBottom: '12px',
    },
    analysisContent: {
      fontSize: '14px',
      lineHeight: '1.5',
    },
    technicalGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: '12px',
      marginTop: '16px',
      flexWrap: 'wrap', // Added for mobile
      overflow: 'auto',
    },
    technicalItem: {
      backgroundColor: '#111827',
      borderRadius: '8px',
      padding: '12px',
      textAlign: 'center',
    },
    technicalLabel: {
      fontSize: '12px',
      color: '#9CA3AF',
      marginBottom: '4px',
    },
    technicalValue: {
      fontSize: '16px',
      fontWeight: '600',
    },
    smartPlaysSection: {
      padding: '20px',
    },
    smartPlayCard: {
      backgroundColor: '#1a1a1a',
      border: '1px solid #374151',
      borderRadius: '12px',
      padding: '16px',
      marginBottom: '16px',
    },
    smartPlayTitle: {
      fontSize: '16px',
      fontWeight: '600',
      marginBottom: '8px',
    },
    smartPlayContent: {
      fontSize: '14px',
      lineHeight: '1.5',
    },
    marketSection: {
      padding: '20px',
    },
    marketGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: '12px',
    },
    marketCard: {
      backgroundColor: '#1a1a1a',
      border: '1px solid #374151',
      borderRadius: '12px',
      padding: '16px',
    },
    marketTitle: {
      fontSize: '16px',
      fontWeight: '600',
      marginBottom: '8px',
    },
    marketValue: {
      fontSize: '24px',
      fontWeight: 'bold',
    },
    marketChange: {
      fontSize: '14px',
      marginTop: '4px',
    },
    alertsSection: {
      padding: '20px',
    },
    alertCard: {
      backgroundColor: '#1a1a1a',
      border: '1px solid #374151',
      borderRadius: '12px',
      padding: '16px',
      marginBottom: '16px',
    },
    alertTitle: {
      fontSize: '16px',
      fontWeight: '600',
      marginBottom: '8px',
    },
    alertContent: {
      fontSize: '14px',
      lineHeight: '1.5',
    },
    chatSection: {
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      height: 'calc(100vh - 140px)',
    },
    chatMessages: {
      flex: 1,
      overflowY: 'auto',
      marginBottom: '16px',
    },
    chatMessage: {
      maxWidth: '80%',
      marginBottom: '12px',
      padding: '12px 16px',
      borderRadius: '20px',
      fontSize: '14px',
      lineHeight: '1.5',
    },
    userMessage: {
      backgroundColor: '#3B82F6',
      color: '#ffffff',
      alignSelf: 'flex-end',
    },
    aiMessage: {
      backgroundColor: '#1a1a1a',
      color: '#ffffff',
      alignSelf: 'flex-start',
      border: '1px solid #374151',
    },
    chatInputContainer: {
      display: 'flex',
      gap: '8px',
    },
    chatInput: {
      flex: 1,
      backgroundColor: '#1a1a1a',
      border: '1px solid #374151',
      borderRadius: '12px',
      padding: '12px 16px',
      color: '#ffffff',
      fontSize: '16px',
      outline: 'none',
    },
    chatSendButton: {
      backgroundColor: '#3B82F6',
      color: '#ffffff',
      border: 'none',
      borderRadius: '12px',
      padding: '12px 24px',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'background-color 0.2s',
    },
    nav: {
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: '#000000',
      borderTop: '1px solid #1a1a1a',
      display: 'flex',
      justifyContent: 'space-around',
      padding: '8px 0',
    },
    navItem: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      color: '#9CA3AF',
      fontSize: '10px',
      cursor: 'pointer',
      transition: 'color 0.2s',
    },
    navItemActive: {
      color: '#3B82F6',
    },
    navIcon: {
      fontSize: '24px',
      marginBottom: '4px',
    },
  };

  const getMarketStatus = () => {
    const now = new Date();
    const estTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const hour = estTime.getHours();
    const minute = estTime.getMinutes();
    const day = estTime.getDay();
    if (day === 0 || day === 6) {
      return 'Weekend';
    }
    if (hour < 4) return 'Closed';
    if (hour >= 4 && (hour < 9 || (hour === 9 && minute < 30))) return 'Pre-Market';
    if (hour >= 9 && hour < 16) return 'Market Open';
    if (hour >= 16 && hour < 20) return 'After Hours';
    return 'Market Closed';
  };

  const getMarketStatusStyle = (status) => {
    if (status === 'Market Open') return { background: '#22C55E30', color: '#22C55E', dot: '#22C55E' };
    if (status === 'Pre-Market' || status === 'After Hours') return { background: '#FBBF2430', color: '#FBBF24', dot: '#FBBF24' };
    return { background: '#EF444430', color: '#EF4444', dot: '#EF4444' };
  };

  useEffect(() => {
    setMarketStatus(getMarketStatus());
    const interval = setInterval(() => setMarketStatus(getMarketStatus()), 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchStockData = async (ticker) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/enhanced-stock-data?symbol=${ticker}`);
      const data = await response.json();
      data.session = marketStatus;
      setStockData(data);
    } catch (error) {
      console.error('Error fetching stock data:', error);
    }
    setIsLoading(false);
  };

  const fetchAnalysis = async (ticker) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/ai-analysis?symbol=${ticker}&type=analysis`);
      const data = await response.json();
      setAnalysisData(data);
    } catch (error) {
      console.error('Error fetching analysis:', error);
    }
    setIsLoading(false);
  };

  const fetchSmartPlays = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/ai-analysis?type=smartplays');
      const data = await response.json();
      setSmartPlays(data.plays);
    } catch (error) {
      console.error('Error fetching smart plays:', error);
    }
    setIsLoading(false);
  };

  const fetchMarketData = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/economic-indicators');
      const data = await response.json();
      setMarketData(data);
    } catch (error) {
      console.error('Error fetching market data:', error);
      setMarketData({ dow: 'N/A', nasdaq: 'N/A', futures: 'N/A', treasury10yr: 'N/A' }); // Added fallback to prevent blank
    }
    setIsLoading(false);
  };

  const fetchTechnicalData = async (ticker) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/technical-indicators?symbol=${ticker}`);
      const data = await response.json();
      setTechnicalData(data);
    } catch (error) {
      console.error('Error fetching technical data:', error);
    }
    setIsLoading(false);
  };

  const fetchAlerts = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/news-data?type=alerts');
      const data = await response.json();
      setAlerts(data.alerts);
      if (settings.notifications && Notification.permission === 'granted') {
        data.alerts.forEach(alert => new Notification('Rolo Profit Alert 📈', { body: alert.message }));
      }
    } catch (error) {
      console.error('Error fetching alerts:', error);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (settings.autoRefresh) {
      const interval = setInterval(() => {
        fetchStockData(selectedStock);
      }, 60000); // 1 min
      return () => clearInterval(interval);
    }
  }, [settings.autoRefresh, selectedStock]);

  useEffect(() => {
    if (marketStatus === 'Market Open') {
      fetchSmartPlays();
      smartPlaysIntervalRef.current = setInterval(fetchSmartPlays, 3600000);
    } return () => clearInterval(smartPlaysIntervalRef.current);
  }, [marketStatus]);

  useEffect(() => {
    localStorage.setItem('favorites', JSON.stringify(favorites));
    localStorage.setItem('settings', JSON.stringify(settings));
    localStorage.setItem('chatHistory', JSON.stringify(chatMessages));
  }, [favorites, settings, chatMessages]);

  const sendChatMessage = async () => {
    if (!chatInput) return;
    const newMessages = [...chatMessages, { role: 'user', content: chatInput }];
    setChatMessages(newMessages);
    setChatInput('');
    try {
      const response = await fetch('/api/ai-analysis?type=chat', {
        method: 'POST',
        body: JSON.stringify({ messages: newMessages, stock: selectedStock, favorites }),
      });
      const data = await response.json();
      setChatMessages([...newMessages, { role: 'ai', content: data.response }]);
    } catch (error) {
      console.error('Chat error:', error);
    }
  };

  const changeTab = (tab) => {
    setActiveTab(tab);
    if (tab === 'analysis') fetchAnalysis(selectedStock);
    if (tab === 'smartplays') fetchSmartPlays();
    if (tab === 'market') fetchMarketData();
    if (tab === 'alerts') fetchAlerts();
    if (tab === 'technical') fetchTechnicalData(selectedStock);
  };

  const handleEditStock = (index, newSymbol) => {
    const newStocks = [...popularStocks];
    newStocks[index] = newSymbol.toUpperCase();
    popularStocks = newStocks; // Update
  };

  const addToFavorites = (ticker) => {
    if (!favorites.includes(ticker)) setFavorites([...favorites, ticker]);
  };

  const toggleSetting = (key) => {
    setSettings({ ...settings, [key]: !settings[key] });
  };

  useEffect(() => {
    if (settings.notifications && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [settings]);

  return (
    <div style={styles.app}>
      <div style={styles.header}>
        <h1 style={styles.title}>Rolo</h1>
        <p style={styles.subtitle}>AI Trading Assistant</p>
        <div style={styles.marketStatus}>
          <div style={{ ...styles.marketStatusBadge, background: getMarketStatusStyle(marketStatus).background, color: getMarketStatusStyle(marketStatus).color }}>
            <div style={{ ...styles.marketStatusDot, background: getMarketStatusStyle(marketStatus).dot }} />
            {marketStatus}
          </div>
        </div>
      </div>
      <div style={styles.content}>
        {isLoading && <p>Loading...</p>}
        {activeTab === 'ticker' && (
          <div>
            <div style={styles.searchContainer}>
              <div style={styles.searchBar}>
                <input style={styles.searchInput} value={searchTicker} onChange={(e) => setSearchTicker(e.target.value)} placeholder="Enter stock ticker" />
                <button style={styles.searchButton} onClick={() => { setSelectedStock(searchTicker.toUpperCase()); fetchStockData(searchTicker.toUpperCase()); }}>Search</button>
              </div>
            </div>
            <div style={styles.stocksSection}>
              <h2 style={styles.sectionTitle}>Popular Stocks</h2>
              <div style={styles.stockGrid}>
                {popularStocks.map((stock, index) => (
                  <div key={stock} style={selectedStock === stock ? styles.stockCardActive : styles.stockCard} onClick={() => { setSelectedStock(stock); fetchStockData(stock); addToFavorites(stock); }}>
                    <p style={styles.stockSymbol}>{stock}</p>
                    <p style={styles.stockPrice}>{stockData.price || 'Loading'}</p>
                    <p style={styles.stockSession}>{stockData.session || ''}</p>
                  </div>
                ))}
              </div>
            </div>
            <div style={styles.stockDetails}>
              <div style={styles.stockDetailsCard}>
                <p style={styles.stockDetailsPrice}>{stockData.price || 'Loading'}</p>
                <p style={styles.stockDetailsChange}>{stockData.change || ''}</p>
                <p style={styles.stockDetailsSession}>{stockData.session || ''}</p>
                <div style={styles.stockDetailsGrid}>
                  <div style={styles.stockDetailItem}>
                    <p style={styles.stockDetailLabel}>Volume</p>
                    <p style={styles.stockDetailValue}>{stockData.volume || 'N/A'}</p>
                  </div>
                  <div style={styles.stockDetailItem}>
                    <p style={styles.stockDetailLabel}>High</p>
                    <p style={styles.stockDetailValue}>{stockData.high || 'N/A'}</p>
                  </div>
                  <div style={styles.stockDetailItem}>
                    <p style={styles.stockDetailLabel}>Low</p>
                    <p style={styles.stockDetailValue}>{stockData.low || 'N/A'}</p>
                  </div>
                  <div style={styles.stockDetailItem}>
                    <p style={styles.stockDetailLabel}>Open</p>
                    <p style={styles.stockDetailValue}>{stockData.open || 'N/A'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        {activeTab === 'analysis' && (
          <div style={styles.analysisSection}>
            <h2 style={styles.sectionTitle}>Analysis for {selectedStock}</h2>
            <div style={styles.analysisCard}>
              <h3 style={styles.analysisTitle}>Recommendations</h3>
              <p style={styles.analysisContent}>{analysisData ? analysisData.analysis : 'Loading...'}</p>
              <p>Confidence: {analysisData ? analysisData.confidence + '%' : 'Loading'}</p> 
              <div style={{ ...styles.confidenceBar, width: analysisData.confidence + '%' }} />
            </div>
            <div style={styles.analysisCard}>
              <h3 style={styles.analysisTitle}>Technical Indicators</h3>
              <div style={styles.technicalGrid}>
                {technicalData && Object.entries(technicalData).map(([key, value]) => (
                  <div key={key} style={styles.technicalItem}>
                    <p style={styles.technicalLabel}>{key}</p>
                    <p style={styles.technicalValue}>{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        {activeTab === 'smartplays' && (
          <div style={styles.smartPlaysSection}>
            <h2 style={styles.sectionTitle}>Smart Plays</h2>
            {smartPlays.map((play, index) => (
              <div key={index} style={styles.smartPlayCard}>
                <h3 style={styles.smartPlayTitle}>Play {index + 1}</h3>
                <p style={styles.smartPlayContent}>{play.play}</p>
                <p>Confidence: {play.confidence}%</p>
                <div style={{ ...styles.confidenceBar, width: play.confidence + '%' }} />
              </div>
            ))}
          </div>
        )}
        {activeTab === 'market' && (
          <div style={styles.marketSection}>
            <h2 style={styles.sectionTitle}>Market Overview</h2>
            <div style={styles.marketGrid}>
              <div style={styles.marketCard}>
                <h3 style={styles.marketTitle}>Dow Jones</h3>
                <p style={styles.marketValue}>{marketData.dow || 'N/A'}</p>
                <p style={styles.marketChange}>{marketData.dowChange || 'N/A'}</p>
              </div>
              <div style={styles.marketCard}>
                <h3 style={styles.marketTitle}>Nasdaq</h3>
                <p style={styles.marketValue}>{marketData.nasdaq || 'N/A'}</p>
                <p style={styles.marketChange}>{marketData.nasdaqChange || 'N/A'}</p>
              </div>
              <div style={styles.marketCard}>
                <h3 style={styles.marketTitle}>Futures</h3>
                <p style={styles.marketValue}>{marketData.futures || 'N/A'}</p>
                <p style={styles.marketChange}>{marketData.futuresChange || 'N/A'}</p>
              </div>
              <div style={styles.marketCard}>
                <h3 style={styles.marketTitle}>10-Year Treasury</h3>
                <p style={styles.marketValue}>{marketData.treasury10yr || 'N/A'}</p>
                <p style={styles.marketChange}>{marketData.treasury10yrChange || 'N/A'}</p>
              </div>
            </div>
          </div>
        )}
        {activeTab === 'alerts' && (
          <div style={styles.alertsSection}>
            <h2 style={styles.sectionTitle}>Real-Time Alerts</h2>
            {alerts.map((alert, index) => (
              <div key={index} style={styles.alertCard}>
                <h3 style={styles.alertTitle}>Alert {index + 1}</h3>
                <p style={styles.alertContent}>{alert.message}</p>
              </div>
            ))}
          </div>
        )}
        {activeTab === 'chat' && (
          <div style={styles.chatSection}>
            <h2 style={styles.sectionTitle}>Chat with Rolo</h2>
            <div style={styles.chatMessages}>
              {chatMessages.map((msg, index) => (
                <p key={index} style={msg.role === 'user' ? styles.userMessage : styles.aiMessage}>{msg.content}</p>
              ))}
            </div>
            <div style={styles.chatInputContainer}>
              <input style={styles.chatInput} value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Type your message..." />
              <button style={styles.chatSendButton} onClick={sendChatMessage}>Send</button>
            </div>
          </div>
        )}
        {activeTab === 'settings' && (
          <div style={styles.analysisSection}>
            <h2 style={styles.sectionTitle}>Settings</h2>
            <label>Alerts: <input type="checkbox" checked={settings.alerts} onChange={() => toggleSetting('alerts')} /></label>
            <label>Auto-Refresh: <input type="checkbox" checked={settings.autoRefresh} onChange={() => toggleSetting('autoRefresh')} /></label>
            <label>Notifications: <input type="checkbox" checked={settings.notifications} onChange={() => toggleSetting('notifications')} /></label>
          </div>
        )}
      </div>
      <nav style={styles.nav}>
        <div style={activeTab === 'ticker' ? styles.navItemActive : styles.navItem} onClick={() => changeTab('ticker')} onTouchStart={() => changeTab('ticker')}>
          <span style={styles.navIcon}>📈</span>
          Ticker
        </div>
        <div style={activeTab === 'analysis' ? styles.navItemActive : styles.navItem} onClick={() => changeTab('analysis')} onTouchStart={() => changeTab('analysis')}>
          <span style={styles.navIcon}>📊</span>
          Analysis
        </div>
        <div style={activeTab === 'smartplays' ? styles.navItemActive : styles.navItem} onClick={() => changeTab('smartplays')} onTouchStart={() => changeTab('smartplays')}>
          <span style={styles.navIcon}>⚡</span>
          Plays
        </div>
        <div style={activeTab === 'market' ? styles.navItemActive : styles.navItem} onClick={() => changeTab('market')} onTouchStart={() => changeTab('market')}>
          <span style={styles.navIcon}>🌎</span>
          Market
        </div>
        <div style={activeTab === 'alerts' ? styles.navItemActive : styles.navItem} onClick={() => changeTab('alerts')} onTouchStart={() => changeTab('alerts')}>
          <span style={styles.navIcon}>🔔</span>
          Alerts
        </div>
        <div style={activeTab === 'chat' ? styles.navItemActive : styles.navItem} onClick={() => changeTab('chat')} onTouchStart={() => changeTab('chat')}>
          <span style={styles.navIcon}>💬</span>
          Chat
        </div>
        <div style={activeTab === 'settings' ? styles.navItemActive : styles.navItem} onClick={() => changeTab('settings')} onTouchStart={() => changeTab('settings')}>
          <span style={styles.navIcon}>⚙️</span>
          Settings
        </div>
      </nav>
    </div>
  );
};

export default RoloApp;
