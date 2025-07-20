import React, { useState, useEffect } from 'react';

function RoloApp() {
  // State for tabs and data
  const [activeTab, setActiveTab] = useState('stocks');
  const [marketStatus, setMarketStatus] = useState('Loading...');
  const [watchlist, setWatchlist] = useState(['AAPL', 'MSFT', 'AMZN', 'GOOGL', 'META', 'TSLA']);
  const [popularStocks, setPopularStocks] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Detect market session
  const detectMarketSession = () => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const day = now.getDay(); // 0 = Sunday, 6 = Saturday
    
    if (day === 0 || day === 6) return 'Weekend';
    if (hours < 4) return 'Futures Open';
    if (hours < 9.5) return 'Pre-Market';
    if (hours < 16) return 'Market Open';
    if (hours < 20) return 'After Hours';
    return 'Futures Open';
  };
  
  // Fetch stock data from API
  useEffect(() => {
    async function fetchStocks() {
      if (!watchlist.length) return;
      
      setIsLoading(true);
      setError(null);
      
      const currentSession = detectMarketSession();
      setMarketStatus(currentSession);
      
      try {
        // For demo, we'll use simple mock data (in real app, use /.netlify/functions/enhanced-stock-data)
        setTimeout(() => {
          const stocks = watchlist.map(symbol => ({
            symbol,
            price: (Math.random() * 500 + 50).toFixed(2),
            change: (Math.random() * 10 - 5).toFixed(2),
            changePercent: (Math.random() * 5 - 2.5).toFixed(2) + '%',
            marketSession: currentSession
          }));
          
          setPopularStocks(stocks);
          setIsLoading(false);
        }, 1000);
      } catch (err) {
        console.error('Error fetching stocks:', err);
        setError('Failed to fetch stock data');
        setIsLoading(false);
      }
    }
    
    fetchStocks();
    
    // Set up polling
    const interval = setInterval(() => {
      fetchStocks();
    }, 60000); // refresh every minute
    
    return () => clearInterval(interval);
  }, [watchlist]);
  
  // Format price change
  const formatPriceChange = (change, changePercent) => {
    const isPositive = parseFloat(change) >= 0;
    const color = isPositive ? 'green' : 'red';
    const prefix = isPositive ? '+' : '';
    
    return (
      <span style={{ color }}>
        {`${prefix}${change} (${changePercent})`}
      </span>
    );
  };
  
  // Format market status
  const formatMarketStatus = (status) => {
    let color = '#999';
    let label = status;
    
    switch (status) {
      case 'Market Open':
        color = 'green';
        break;
      case 'Pre-Market':
        color = 'blue';
        break;
      case 'After Hours':
        color = 'orange';
        break;
      case 'Futures Open':
        color = 'purple';
        break;
      case 'Weekend':
      case 'Market Closed':
        color = 'red';
        break;
      default:
        color = 'gray';
    }
    
    return (
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        background: 'rgba(128, 128, 128, 0.2)',
        padding: '3px 8px',
        borderRadius: '12px',
        fontSize: '12px',
        fontWeight: '500',
        color: color,
        marginBottom: '8px'
      }}>
        <span style={{ 
          display: 'inline-block', 
          width: '8px', 
          height: '8px', 
          borderRadius: '50%', 
          backgroundColor: color,
          marginRight: '5px'
        }}></span>
        {label}
      </div>
    );
  };
  
  // Render stocks tab
  const renderStocksTab = () => (
    <div style={{ padding: '16px', paddingBottom: '100px' }}>
      <div style={{ marginBottom: '12px' }}>
        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '600' }}>Popular Stocks</h2>
      </div>
      
      {formatMarketStatus(marketStatus)}
      
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <div style={{ 
            width: '30px', 
            height: '30px', 
            border: '3px solid rgba(255, 255, 255, 0.3)', 
            borderRadius: '50%', 
            borderTop: '3px solid #fff', 
            margin: '0 auto',
            animation: 'spin 1s linear infinite' 
          }}></div>
          <p>Loading stocks...</p>
        </div>
      ) : error ? (
        <div style={{ 
          padding: '20px', 
          textAlign: 'center', 
          color: 'red', 
          background: 'rgba(255, 0, 0, 0.1)', 
          borderRadius: '8px',
          margin: '20px 0'
        }}>
          {error}
        </div>
      ) : (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', 
          gap: '12px'
        }}>
          {popularStocks.map(stock => (
            <div 
              key={stock.symbol}
              style={{
                background: 'linear-gradient(135deg, #1e1e1e, #2a2a2a)',
                borderRadius: '12px',
                padding: '16px',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)'
              }}
            >
              <div style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>
                {stock.symbol}
              </div>
              
              <div style={{ 
                fontSize: '22px', 
                fontWeight: '700', 
                marginBottom: '8px' 
              }}>
                ${stock.price}
              </div>
              
              <div>
                {formatPriceChange(stock.change, stock.changePercent)}
              </div>
              
              {stock.marketSession && (
                <div style={{
                  fontSize: '11px',
                  marginTop: '8px',
                  padding: '3px 6px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: '4px',
                  display: 'inline-block'
                }}>
                  {stock.marketSession}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
  
  // Render placeholder for other tabs
  const renderPlaceholder = (title, emoji, message) => (
    <div style={{ padding: '16px', paddingBottom: '100px' }}>
      <h2 style={{ margin: '0 0 16px 0', fontSize: '20px', fontWeight: '600' }}>{title}</h2>
      <div style={{ 
        padding: '40px 20px', 
        textAlign: 'center', 
        color: '#999', 
        background: 'rgba(255, 255, 255, 0.05)', 
        borderRadius: '8px'
      }}>
        <div style={{ fontSize: '36px', marginBottom: '10px' }}>{emoji}</div>
        <div style={{ fontWeight: '500', marginBottom: '10px', color: '#ccc' }}>{title} Feature</div>
        <div style={{ fontSize: '14px', opacity: '0.8' }}>
          {message}
        </div>
      </div>
    </div>
  );
  
  // Render active tab
  const renderActiveTab = () => {
    switch (activeTab) {
      case 'stocks':
        return renderStocksTab();
      case 'analysis':
        return renderPlaceholder('Analysis', '🧠', 'Connect your AI API to enable analysis');
      case 'smartPlays':
        return renderPlaceholder('Smart Plays', '🎯', 'Connect your Alpha Vantage API to see trading opportunities');
      case 'alerts':
        return renderPlaceholder('Real-Time Alerts', '🚨', 'Connect your API to see market alerts');
      case 'market':
        return renderPlaceholder('Market Dashboard', '📊', 'Connect your API to see market data');
      case 'chat':
        return renderPlaceholder('Rolo AI Assistant', '💬', 'Connect your Gemini API to enable AI assistant');
      default:
        return renderStocksTab();
    }
  };
  
  // Main app render
  return (
    <div style={{ 
      backgroundColor: '#121212', 
      color: '#fff', 
      minHeight: '100vh',
      maxWidth: '500px',
      margin: '0 auto',
      position: 'relative',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
    }}>
      {/* App header */}
      <header style={{ 
        padding: '16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '700' }}>Rolo</h1>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {formatMarketStatus(marketStatus)}
        </div>
      </header>
      
      {/* Main content area */}
      <main>
        {renderActiveTab()}
      </main>
      
      {/* Bottom navigation */}
      <nav style={{ 
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        maxWidth: '500px',
        margin: '0 auto',
        background: '#1e1e1e',
        display: 'flex',
        justifyContent: 'space-around',
        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
        padding: '8px 0',
        zIndex: 10
      }}>
        {[
          { id: 'stocks', icon: '📊', label: 'Stocks' },
          { id: 'analysis', icon: '🧠', label: 'Analysis' },
          { id: 'smartPlays', icon: '🎯', label: 'Plays' },
          { id: 'alerts', icon: '🚨', label: 'Alerts' },
          { id: 'market', icon: '🌎', label: 'Market' },
          { id: 'chat', icon: '💬', label: 'Chat' }
        ].map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              background: 'transparent',
              border: 'none',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              color: activeTab === tab.id ? '#2196f3' : '#aaa',
              fontSize: '20px',
              cursor: 'pointer',
              width: '45px'
            }}
          >
            <div style={{ marginBottom: '4px', fontSize: '20px' }}>{tab.icon}</div>
            <div style={{ fontSize: '12px' }}>{tab.label}</div>
          </button>
        ))}
      </nav>
    </div>
  );
}

export default RoloApp;
