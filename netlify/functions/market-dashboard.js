// netlify/functions/market-dashboard.js
// COMPLETE: Real-time market dashboard with proper index symbols

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    console.log(`[market-dashboard.js] Starting market data fetch...`);
    const API_KEY = process.env.ALPHA_VANTAGE_API_KEY;

    if (!API_KEY) {
      console.error("[market-dashboard.js] ALPHA_VANTAGE_API_KEY not set");
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Alpha Vantage API key not configured' })
      };
    }

    // Market session detection
    const now = new Date();
    const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
    const est = new Date(utcTime + (-5 * 3600000));
    const hours = est.getHours();
    const day = est.getDay();
    const totalMinutes = hours * 60 + est.getMinutes();
    
    let marketSession = 'Market Closed';
    let dataStrategy = 'daily';
    
    if (day === 0 && hours >= 18) { // Sunday 6 PM+
      marketSession = 'Futures Open';
      dataStrategy = 'futures';
    } else if (day === 6) { // Saturday
      marketSession = 'Weekend';
      dataStrategy = 'daily';
    } else if (day >= 1 && day <= 5) { // Monday-Friday
      if (totalMinutes >= 240 && totalMinutes < 570) { // 4:00 AM - 9:30 AM
        marketSession = 'Pre-Market';
        dataStrategy = 'premarket';
      } else if (totalMinutes >= 570 && totalMinutes < 960) { // 9:30 AM - 4:00 PM
        marketSession = 'Market Open';
        dataStrategy = 'realtime';
      } else if (totalMinutes >= 960 && totalMinutes < 1200) { // 4:00 PM - 8:00 PM
        marketSession = 'After Hours';
        dataStrategy = 'afterhours';
      } else if (totalMinutes >= 1080 || totalMinutes < 240) { // 6:00 PM - 4:00 AM
        marketSession = 'Futures Open';
        dataStrategy = 'futures';
      }
    }

    console.log(`[market-dashboard.js] Session: ${marketSession}, Strategy: ${dataStrategy}`);

    const marketData = {
      timestamp: new Date().toISOString(),
      estTime: est.toLocaleString('en-US', { timeZone: 'America/New_York' }),
      marketSession: marketSession,
      dataStrategy: dataStrategy,
      indices: [],
      economicIndicators: [],
      sectorPerformance: [],
      topMovers: {
        gainers: [],
        losers: []
      }
    };

    // 1. Fetch Major Indices
    // Use the correct symbols for indices: SPX (S&P 500), DJI (Dow Jones), IXIC (NASDAQ)
    const indicesList = [
      { symbol: 'SPX', name: 'S&P 500 Index' },
      { symbol: 'DJI', name: 'Dow Jones Industrial Average' },
      { symbol: 'IXIC', name: 'NASDAQ Composite' },
      { symbol: 'RUT', name: 'Russell 2000' }
    ];

    // Fetch current index data
    for (const index of indicesList) {
      try {
        // First try to get real-time index data
        const indexUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${index.symbol}&apikey=${API_KEY}`;
        const indexResponse = await fetch(indexUrl);
        
        if (indexResponse.ok) {
          const indexData = await indexResponse.json();
          
          if (indexData['Global Quote'] && indexData['Global Quote']['05. price']) {
            marketData.indices.push({
              symbol: index.symbol,
              name: index.name,
              price: indexData['Global Quote']['05. price'],
              change: indexData['Global Quote']['09. change'],
              changePercent: indexData['Global Quote']['10. change percent'],
              dataSource: 'realtime'
            });
            continue; // Success, so skip to next index
          }
        }
        
        // If no real-time data, try alternative methods
        // For indices, we can try ETF proxies if direct data isn't available
        const proxyMap = {
          'SPX': 'SPY',
          'DJI': 'DIA',
          'IXIC': 'QQQ',
          'RUT': 'IWM'
        };
        
        if (proxyMap[index.symbol]) {
          const proxyUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${proxyMap[index.symbol]}&apikey=${API_KEY}`;
          const proxyResponse = await fetch(proxyUrl);
          
          if (proxyResponse.ok) {
            const proxyData = await proxyResponse.json();
            
            if (proxyData['Global Quote'] && proxyData['Global Quote']['05. price']) {
              // For ETF proxies, we need to adjust the price to approximate the index
              // This is a very rough approximation
              let multiplier = 1;
              if (index.symbol === 'SPX') multiplier = 10; // SPY to SPX
              if (index.symbol === 'DJI') multiplier = 100; // DIA to DJI
              
              const adjustedPrice = parseFloat(proxyData['Global Quote']['05. price']) * multiplier;
              
              marketData.indices.push({
                symbol: index.symbol,
                name: index.name,
                price: adjustedPrice.toFixed(2),
                change: parseFloat(proxyData['Global Quote']['09. change']) * multiplier,
                changePercent: proxyData['Global Quote']['10. change percent'],
                dataSource: 'proxy-etf'
              });
              continue; // Success with proxy, so skip to next index
            }
          }
        }
        
        // If we get here, we couldn't get data for this index
        marketData.indices.push({
          symbol: index.symbol,
          name: index.name,
          price: 'N/A',
          change: 'N/A',
          changePercent: 'N/A',
          dataSource: 'unavailable'
        });
        
      } catch (indexError) {
        console.error(`[market-dashboard.js] Error fetching ${index.name}:`, indexError);
        
        marketData.indices.push({
          symbol: index.symbol,
          name: index.name,
          price: 'Error',
          change: 'Error',
          changePercent: 'Error',
          dataSource: 'error'
        });
      }
      
      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    // 2. Add futures data if relevant to the current market session
    if (dataStrategy === 'futures' || dataStrategy === 'premarket') {
      const futuresList = [
        { symbol: 'ES=F', name: 'S&P 500 Futures', indexSymbol: 'SPX' },
        { symbol: 'NQ=F', name: 'NASDAQ Futures', indexSymbol: 'IXIC' },
        { symbol: 'YM=F', name: 'Dow Futures', indexSymbol: 'DJI' },
        { symbol: 'RTY=F', name: 'Russell 2000 Futures', indexSymbol: 'RUT' }
      ];
      
      for (const future of futuresList) {
        try {
          const futureUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${future.symbol}&apikey=${API_KEY}`;
          const futureResponse = await fetch(futureUrl);
          
          if (futureResponse.ok) {
            const futureData = await futureResponse.json();
            
            if (futureData['Global Quote'] && futureData['Global Quote']['05. price']) {
              marketData.indices.push({
                symbol: future.symbol,
                name: future.name,
                price: futureData['Global Quote']['05. price'],
                change: futureData['Global Quote']['09. change'],
                changePercent: futureData['Global Quote']['10. change percent'],
                dataSource: 'futures',
                relatedIndex: future.indexSymbol
              });
            }
          }
          
          // Add delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 200));
          
        } catch (futureError) {
          console.error(`[market-dashboard.js] Error fetching ${future.name}:`, futureError);
        }
      }
    }
    
    // 3. Economic Indicators
    const economicIndicators = [
      { symbol: 'VIX', name: 'Volatility Index' },
      { symbol: 'TNX', name: '10-Year Treasury' },
      { symbol: 'DXY', name: 'Dollar Index' },
      { symbol: 'GC=F', name: 'Gold Futures' },
      { symbol: 'CL=F', name: 'Crude Oil' }
    ];
    
    for (const indicator of economicIndicators) {
      try {
        const indicatorUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${indicator.symbol}&apikey=${API_KEY}`;
        const indicatorResponse = await fetch(indicatorUrl);
        
        if (indicatorResponse.ok) {
          const indicatorData = await indicatorResponse.json();
          
          if (indicatorData['Global Quote'] && indicatorData['Global Quote']['05. price']) {
            marketData.economicIndicators.push({
              symbol: indicator.symbol,
              name: indicator.name,
              value: indicatorData['Global Quote']['05. price'],
              change: indicatorData['Global Quote']['09. change'],
              changePercent: indicatorData['Global Quote']['10. change percent']
            });
          }
        }
        
        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (indicatorError) {
        console.error(`[market-dashboard.js] Error fetching ${indicator.name}:`, indicatorError);
      }
    }
    
    // 4. Sector Performance
    // For a real app, you would fetch actual sector ETF data
    // Here we're using a few sector ETFs as examples
    const sectorETFs = [
      { symbol: 'XLK', name: 'Technology' },
      { symbol: 'XLF', name: 'Financials' },
      { symbol: 'XLV', name: 'Healthcare' },
      { symbol: 'XLE', name: 'Energy' },
      { symbol: 'XLY', name: 'Consumer Cyclical' }
    ];
    
    for (const sector of sectorETFs) {
      try {
        const sectorUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${sector.symbol}&apikey=${API_KEY}`;
        const sectorResponse = await fetch(sectorUrl);
        
        if (sectorResponse.ok) {
          const sectorData = await sectorResponse.json();
          
          if (sectorData['Global Quote'] && sectorData['Global Quote']['10. change percent']) {
            marketData.sectorPerformance.push({
              symbol: sector.symbol,
              name: sector.name,
              performance: parseFloat(sectorData['Global Quote']['10. change percent'].replace('%', '')).toFixed(2)
            });
          }
        }
        
        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (sectorError) {
        console.error(`[market-dashboard.js] Error fetching ${sector.name}:`, sectorError);
      }
    }
    
    // 5. Top Movers (Gainers and Losers)
    try {
      const moversUrl = `https://www.alphavantage.co/query?function=TOP_GAINERS_LOSERS&apikey=${API_KEY}`;
      const moversResponse = await fetch(moversUrl);
      
      if (moversResponse.ok) {
        const moversData = await moversResponse.json();
        
        if (moversData.top_gainers && moversData.top_losers) {
          // Take top 5 gainers and losers
          marketData.topMovers.gainers = moversData.top_gainers.slice(0, 5);
          marketData.topMovers.losers = moversData.top_losers.slice(0, 5);
        }
      }
    } catch (moversError) {
      console.error('[market-dashboard.js] Error fetching top movers:', moversError);
    }
    
    console.log(`[market-dashboard.js] Successfully fetched market data: indices=${marketData.indices.length}, indicators=${marketData.economicIndicators.length}`);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(marketData)
    };
    
  } catch (error) {
    console.error('[market-dashboard.js] Error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Market dashboard error',
        details: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
};// netlify/functions/market-dashboard.js
// COMPLETE: Real-time market dashboard with proper index symbols

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': '
