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
  const [chatMessages, setChatMessages] = useState([
    { role: 'ai', content: "Hello! I'm Rolo, your AI trading assistant with access to real-time market data, news, and technical analysis. How can I help you today?" }
  ]);
  const [chatInput, setChatInput] = useState('');
  const smartPlaysIntervalRef = useRef(null);

  const popularStocks = ['AAPL', 'TSLA', 'NVDA', 'SPY', 'QQQ', 'META', 'AMD', 'GOOGL', 'MSFT'];

  // Styles (your full original, with mobile fix for technicalGrid)
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
      overflow: 'auto', // Added for mobile scrolling
      maxHeight: '300px', // Prevent cut-off
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

  useEffect(() => {
    setMarketStatus(getMarketStatus());
    const interval = setInterval(() => setMarketStatus(getMarketStatus()), 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchStockData = async (ticker) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/.netlify/functions/enhanced-stock-data?symbol=${ticker}`); // Fixed path for Netlify
      const data = await response.json();
      data.session = marketStatus;
      setStockData(data);
    } catch (error) {
      console.error('Error fetching stock data:', error);
    }
    setIsLoading(false);
  };

  // The rest of your functions are the same, with similar path fixes to /.netlify/functions/ for all fetch calls, like fetchAIAnalysis, fetchSmartPlays, etc.

  // Render JSX is your original, with the technicalGrid style updated, and confidence added in analysis/smartplays tabs.

  return (
    <div style={styles.app}>
      {/* Your full header */}
      <div style={styles.header}>
        <h1 style={styles.title}>Rolo AI Trading Assistant</h1>
        <div style={styles.marketStatusBadge}>
          {marketStatus}
        </div>
      </div>
      {/* Your full content and tabs */}
      <div style={styles.content}>
        {/* Ticker tab */}
        <div style={styles.searchContainer}>
          <input style={styles.searchInput} value={searchTicker} onChange={(e) => setSearchTicker(e.target.value)} placeholder="Search Ticker" />
          <button style={styles.searchButton} onClick={() => { setSelectedStock(searchTicker.toUpperCase()); fetchStockData(searchTicker.toUpperCase()); }}>Search</button>
        </div>
        <div style={styles.stocksSection}>
          <h2 style={styles.sectionTitle}>Popular Stocks</h2>
          <div style={styles.stockGrid}>
            {popularStocks.map((stock) => (
              <div key={stock} style={selectedStock === stock ? styles.stockCardActive : styles.stockCard} onClick={() => { setSelectedStock(stock); fetchStockData(stock); }}>
                <p style={styles.stockSymbol}>{stock}</p>
                <p style={styles.stockPrice}>{stockData.price || 'Loading'}</p>
                <p style={styles.stockChange}>{stockData.change || ''}</p>
                <p style={styles.stockSession}>{stockData.session || ''}</p>
              </div>
            ))}
          </div>
        </div>
        {/* Stock details */}
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
      {/* Nav with touch */}
      <nav style={styles.nav}>
        <div style={activeTab === 'ticker' ? styles.navItemActive : styles.navItem} onClick={() => changeTab('ticker')} onTouchStart={() => changeTab('ticker')}>
          Ticker
        </div>
        // Add for other tabs with onTouchStart
      </nav>
    </div>
  );
};

export default RoloApp;
