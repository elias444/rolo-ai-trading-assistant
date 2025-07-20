export default function RoloApp() {
  const [activeTab, setActiveTab] = React.useState('stocks');
  const [marketStatus, setMarketStatus] = React.useState('Loading...');
  const [watchlist, setWatchlist] = React.useState(['AAPL', 'MSFT', 'AMZN', 'GOOGL', 'META', 'TSLA']);
  const [stocks, setStocks] = React.useState([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  
  // Detect market session
  const getMarketSession = () => {
    const now = new Date();
    const hours = now.getHours();
    const day = now.getDay(); // 0 = Sunday, 6 = Saturday
    
    if (day === 0 || day === 6) return 'Weekend';
    if (hours < 4) return 'Futures Open';
    if (hours < 9.5) return 'Pre-Market';
    if (hours < 16) return 'Market Open';
    if (hours < 20) return 'After Hours';
    return 'Futures Open';
  };
  
  // Fetch stock data
  React.useEffect(() => {
    async function fetchStocks() {
      if (!watchlist.length) return;
      
      setIsLoading(true);
      setError(null);
      setMarketStatus(getMarketSession());
      
      try {
        // Simulate API call (in real app, call your Netlify functions)
        const mockStocks = watchlist.map(symbol => ({
          symbol,
          price: (Math.random() * 500 + 50).toFixed(2),
          change: (Math.random() * 10 - 5).toFixed(2),
          changePercent: (Math.random() * 5 - 2.5).toFixed(2) + '%',
          marketSession: getMarketSession()
        }));
        
        setStocks(mockStocks);
      } catch (err) {
        setError("Failed to fetch stock data");
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchStocks();
  }, [watchlist]);
  
  // Format market status with color
  const formatMarketStatus = (status) => {
    let color;
    
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
        background: `rgba(128, 128, 128, 0.2)`,
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
        {status}
      </div>
    );
  };
  
  // Format price change with color
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
  
  // Render stocks tab
  const renderStocksTab = () => (
    <div style={{ padding: '16px', paddingBottom: '100px' }}>
      <div style={{ marginBottom: '12px' }}>
        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '600' }}>Popular Stocks</h2>
      </div>
      
      {formatMarketStatus(marketStatus)}
      
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '20px' }}>Loading...</div>
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
          {stocks.map(stock => (
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
  
  // Render analysis tab
  const renderAnalysisTab = () => (
    <div style={{ padding: '16px', paddingBottom: '100px' }}>
      <h2 style={{ margin: '0 0 16px 0', fontSize: '20px', fontWeight: '600' }}>Analysis</h2>
      <div style={{ 
        padding: '40px 20px', 
        textAlign: 'center', 
        color: '#999', 
        background: 'rgba(255, 255, 255, 0.05)', 
        borderRadius: '8px'
      }}>
        <div style={{ fontSize: '36px', marginBottom: '10px' }}>🧠</div>
        <div style={{ fontWeight: '500', marginBottom: '10px', color: '#ccc' }}>Analysis Feature</div>
        <div style={{ fontSize: '14px', opacity: '0.8' }}>
          Connect your AI API to enable analysis
        </div>
      </div>
    </div>
  );
  
  // Render smart plays tab
  const renderSmartPlaysTab = () => (
    <div style={{ padding: '16px', paddingBottom: '100px' }}>
      <h2 style={{ margin: '0 0 16px 0', fontSize: '20px', fontWeight: '600' }}>Smart Plays</h2>
      <div style={{ 
        padding: '40px 20px', 
        textAlign: 'center', 
        color: '#999', 
        background: 'rgba(255, 255, 255, 0.05)', 
        borderRadius: '8px'
      }}>
        <div style={{ fontSize: '36px', marginBottom: '10px' }}>🎯</div>
        <div style={{ fontWeight: '500', marginBottom: '10px', color: '#ccc' }}>Smart Plays Feature</div>
        <div style={{ fontSize: '14px', opacity: '0.8' }}>
          Connect your Alpha Vantage API to see smart trading opportunities
        </div>
      </div>
    </div>
  );
  
  // Render alerts tab
  const renderAlertsTab = () => (
    <div style={{ padding: '16px', paddingBottom: '100px' }}>
      <h2 style={{ margin: '0 0 16px 0', fontSize: '20px', fontWeight: '600' }}>Real-Time Alerts</h2>
      <div style={{ 
        padding: '40px 20px', 
        textAlign: 'center', 
        color: '#999', 
        background: 'rgba(255, 255, 255, 0.05)', 
        borderRadius: '8px'
      }}>
        <div style={{ fontSize: '36px', marginBottom: '10px' }}>🚨</div>
        <div style={{ fontWeight: '500', marginBottom: '10px', color: '#ccc' }}>Alerts Feature</div>
        <div style={{ fontSize: '14px', opacity: '0.8' }}>
          Connect your Alpha Vantage API to see real-time market alerts
        </div>
      </div>
    </div>
  );
  
  // Render market tab
  const renderMarketTab = () => (
    <div style={{ padding: '16px', paddingBottom: '100px' }}>
      <h2 style={{ margin: '0 0 16px 0', fontSize: '20px', fontWeight: '600' }}>Market Dashboard</h2>
      <div style={{ 
        padding: '40px 20px', 
        textAlign: 'center', 
        color: '#999', 
        background: 'rgba(255, 255, 255, 0.05)', 
        borderRadius: '8px'
      }}>
        <div style={{ fontSize: '36px', marginBottom: '10px' }}>📊</div>
        <div style={{ fontWeight: '500', marginBottom: '10px', color: '#ccc' }}>Market Dashboard Feature</div>
        <div style={{ fontSize: '14px', opacity: '0.8' }}>
          Connect your Alpha Vantage API to see market data
        </div>
      </div>
    </div>
  );
  
  // Render chat tab
  const renderChatTab = () => (
    <div style={{ padding: '16px', paddingBottom: '100px' }}>
      <h2 style={{ margin: '0 0 16px 0', fontSize: '20px', fontWeight: '600' }}>Rolo AI Assistant</h2>
      <div style={{ 
        padding: '40px 20px', 
        textAlign: 'center', 
        color: '#999', 
        background: 'rgba(255, 255, 255, 0.05)', 
        borderRadius: '8px'
      }}>
        <div style={{ fontSize: '36px', marginBottom: '10px' }}>💬</div>
        <div style={{ fontWeight: '500', marginBottom: '10px', color: '#ccc' }}>Chat Feature</div>
        <div style={{ fontSize: '14px', opacity: '0.8' }}>
          Connect your Gemini API to enable AI assistant
        </div>
      </div>
    </div>
  );
  
  // Render active tab content
  const renderActiveTab = () => {
    switch (activeTab) {
      case 'stocks':
        return renderStocksTab();
      case 'analysis':
        return renderAnalysisTab();
      case 'smartPlays':
        return renderSmartPlaysTab();
      case 'alerts':
        return renderAlertsTab();
      case 'market':
        return renderMarketTab();
      case 'chat':
        return renderChatTab();
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
        <button 
          onClick={() => setActiveTab('stocks')}
          style={{
            background: 'transparent',
            border: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            color: activeTab === 'stocks' ? '#2196f3' : '#aaa',
            fontSize: '20px',
            cursor: 'pointer'
          }}
        >
          <div style={{ marginBottom: '4px', fontSize: '20px' }}>📊</div>
          <div style={{ fontSize: '12px' }}>Stocks</div>
        </button>
        
        <button 
          onClick={() => setActiveTab('analysis')}
          style={{
            background: 'transparent',
            border: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            color: activeTab === 'analysis' ? '#2196f3' : '#aaa',
            fontSize: '20px',
            cursor: 'pointer'
          }}
        >
          <div style={{ marginBottom: '4px', fontSize: '20px' }}>🧠</div>
          <div style={{ fontSize: '12px' }}>Analysis</div>
        </button>
        
        <button 
          onClick={() => setActiveTab('smartPlays')}
          style={{
            background: 'transparent',
            border: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            color: activeTab === 'smartPlays' ? '#2196f3' : '#aaa',
            fontSize: '20px',
            cursor: 'pointer'
          }}
        >
          <div style={{ marginBottom: '4px', fontSize: '20px' }}>🎯</div>
          <div style={{ fontSize: '12px' }}>Plays</div>
        </button>
        
        <button 
          onClick={() => setActiveTab('alerts')}
          style={{
            background: 'transparent',
            border: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            color: activeTab === 'alerts' ? '#2196f3' : '#aaa',
            fontSize: '20px',
            cursor: 'pointer'
          }}
        >
          <div style={{ marginBottom: '4px', fontSize: '20px' }}>🚨</div>
          <div style={{ fontSize: '12px' }}>Alerts</div>
        </button>
        
        <button 
          onClick={() => setActiveTab('market')}
          style={{
            background: 'transparent',
            border: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            color: activeTab === 'market' ? '#2196f3' : '#aaa',
            fontSize: '20px',
            cursor: 'pointer'
          }}
        >
          <div style={{ marginBottom: '4px', fontSize: '20px' }}>🌎</div>
          <div style={{ fontSize: '12px' }}>Market</div>
        </button>
        
        <button 
          onClick={() => setActiveTab('chat')}
          style={{
            background: 'transparent',
            border: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            color: activeTab === 'chat' ? '#2196f3' : '#aaa',
            fontSize: '20px',
            cursor: 'pointer'
          }}
        >
          <div style={{ marginBottom: '4px', fontSize: '20px' }}>💬</div>
          <div style={{ fontSize: '12px' }}>Chat</div>
        </button>
      </nav>
    </div>
  );
}
