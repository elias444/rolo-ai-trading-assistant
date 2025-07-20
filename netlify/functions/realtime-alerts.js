// netlify/functions/realtime-alerts.js
// COMPLETE: Real-time market alerts with NO mock data

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
    console.log(`[realtime-alerts.js] Starting alerts generation...`);
    
    // Get API key
    const API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
    
    if (!API_KEY) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'Alpha Vantage API key not configured',
          alerts: [],
          timestamp: new Date().toISOString(),
          dataSource: "Error - No API Key"
        })
      };
    }
    
    // Parse query parameters
    const session = event.queryStringParameters?.session || 'MARKET_OPEN';
    console.log(`[realtime-alerts.js] Current market session: ${session}`);
    
    // Don't generate alerts during weekend or off-hours if requested
    if (session === 'WEEKEND' && event.queryStringParameters?.skipWeekend === 'true') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          message: "Alerts disabled during weekend",
          alerts: [],
          marketSession: session,
          timestamp: new Date().toISOString(),
          dataSource: "Alpha Vantage API"
        })
      };
    }
    
    // Fetch top movers for potential alerts
    const topMoversUrl = `https://www.alphavantage.co/query?function=TOP_GAINERS_LOSERS&apikey=${API_KEY}`;
    const topMoversResponse = await fetch(topMoversUrl);
    
    if (!topMoversResponse.ok) {
      return {
        statusCode: topMoversResponse.status,
        headers,
        body: JSON.stringify({ 
          error: `Alpha Vantage API error: ${topMoversResponse.statusText}`,
          alerts: [],
          timestamp: new Date().toISOString(),
          dataSource: "Error - API Failure"
        })
      };
    }
    
    const topMoversData = await topMoversResponse.json();
    
    if (!topMoversData.top_gainers || !topMoversData.top_losers || !topMoversData.most_actively_traded) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'Invalid data format from Alpha Vantage API',
          alerts: [],
          timestamp: new Date().toISOString(),
          dataSource: "Error - Invalid Data Format"
        })
      };
    }
    
    console.log(`[realtime-alerts.js] Received market data: ${topMoversData.top_gainers.length} gainers, ${topMoversData.top_losers.length} losers, ${topMoversData.most_actively_traded.length} active`);
    
    // Generate alerts based on market data
    const alerts = [];
    
    // 1. Volume Spike Alerts
    const volumeAlerts = topMoversData.most_actively_traded
      .filter(stock => parseInt(stock.volume) > 1000000) // At least 1M volume
      .slice(0, 3) // Top 3 by volume
      .map((stock, index) => {
        const volumeInMillions = (parseInt(stock.volume) / 1000000).toFixed(1);
        const changePercent = parseFloat(stock.change_percentage.replace('%', ''));
        const isPositive = changePercent > 0;
        
        return {
          id: `volume-${index + 1}`,
          type: 'volume',
          priority: volumeInMillions > 5 ? 'high' : 'medium',
          ticker: stock.ticker,
          title: `Volume Spike: ${stock.ticker}`,
          description: `${stock.ticker} is seeing ${volumeInMillions}M shares traded, ${isPositive ? 'up' : 'down'} ${Math.abs(changePercent).toFixed(1)}% at ${parseFloat(stock.price).toFixed(2)}.`,
          action: `Monitor ${stock.ticker} for potential ${isPositive ? 'breakout continuation' : 'breakdown acceleration'}.`,
          confidence: Math.min(60 + parseInt(volumeInMillions), 90),
          timestamp: new Date().toISOString()
        };
      });
    
    alerts.push(...volumeAlerts);
    
    // 2. Breakout Alerts (top gainers)
    const breakoutAlerts = topMoversData.top_gainers
      .filter(stock => parseFloat(stock.change_percentage.replace('%', '')) > 7) // At least 7% gain
      .slice(0, 2) // Top 2 by percent gain
      .map((stock, index) => {
        const changePercent = parseFloat(stock.change_percentage.replace('%', ''));
        
        return {
          id: `breakout-${index + 1}`,
          type: 'breakout',
          priority: changePercent > 15 ? 'high' : 'medium',
          ticker: stock.ticker,
          title: `Breakout Alert: ${stock.ticker}`,
          description: `${stock.ticker} has broken out ${changePercent.toFixed(1)}% to ${parseFloat(stock.price).toFixed(2)} on ${(parseInt(stock.volume) / 1000000).toFixed(1)}M volume.`,
          action: `Consider ${changePercent > 20 ? 'waiting for pullback' : 'momentum entry'} with tight stop.`,
          confidence: Math.min(65 + Math.floor(changePercent / 2), 95),
          timestamp: new Date().toISOString()
        };
      });
      
    alerts.push(...breakoutAlerts);
    
    // 3. Breakdown Alerts (top losers)
    const breakdownAlerts = topMoversData.top_losers
      .filter(stock => parseFloat(stock.change_percentage.replace('%', '')) < -8) // At least 8% drop
      .slice(0, 2) // Top 2 by percent loss
      .map((stock, index) => {
        const changePercent = parseFloat(stock.change_percentage.replace('%', ''));
        
        return {
          id: `breakdown-${index + 1}`,
          type: 'breakdown',
          priority: changePercent < -15 ? 'high' : 'medium',
          ticker: stock.ticker,
          title: `Breakdown Alert: ${stock.ticker}`,
          description: `${stock.ticker} has broken down ${Math.abs(changePercent).toFixed(1)}% to ${parseFloat(stock.price).toFixed(2)} on ${(parseInt(stock.volume) / 1000000).toFixed(1)}M volume.`,
          action: `Consider ${changePercent < -20 ? 'watching for capitulation' : 'short position'} with defined risk.`,
          confidence: Math.min(65 + Math.floor(Math.abs(changePercent) / 2), 95),
          timestamp: new Date().toISOString()
        };
      });
      
    alerts.push(...breakdownAlerts);
    
    // 4. VIX Alert - If VIX data is available, check for significant moves
    try {
      const vixUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=VIX&apikey=${API_KEY}`;
      const vixResponse = await fetch(vixUrl);
      
      if (vixResponse.ok) {
        const vixData = await vixResponse.json();
        
        if (vixData['Global Quote'] && vixData['Global Quote']['05. price'] && vixData['Global Quote']['10. change percent']) {
          const vixPrice = parseFloat(vixData['Global Quote']['05. price']);
          const vixChangePercent = parseFloat(vixData['Global Quote']['10. change percent'].replace('%', ''));
          
          // VIX Spike Alert
          if (vixChangePercent > 8 || vixPrice > 25) {
            alerts.push({
              id: 'vix-spike',
              type: 'volatility',
              priority: 'high',
              ticker: 'VIX',
              title: 'Market Volatility Alert',
              description: `VIX has ${vixChangePercent > 0 ? 'spiked' : 'dropped'} ${Math.abs(vixChangePercent).toFixed(1)}% to ${vixPrice.toFixed(1)}. ${vixPrice > 25 ? 'Market fear is elevated.' : ''}`,
              action: vixPrice > 30 ? 'Consider reducing risk exposure' : 'Monitor for potential market reversal',
              confidence: 85,
              timestamp: new Date().toISOString()
            });
          }
        }
      }
    } catch (vixError) {
      console.warn('[realtime-alerts.js] Error fetching VIX data:', vixError);
    }
    
    // 5. Major Index Alerts
    const indicesList = [
      { symbol: 'SPX', name: 'S&P 500', threshold: 1.5 },
      { symbol: 'DJI', name: 'Dow Jones', threshold: 1.5 },
      { symbol: 'IXIC', name: 'NASDAQ', threshold: 1.8 }
    ];
    
    for (const index of indicesList) {
      try {
        const indexUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${index.symbol}&apikey=${API_KEY}`;
        const indexResponse = await fetch(indexUrl);
        
        if (indexResponse.ok) {
          const indexData = await indexResponse.json();
          
          if (indexData['Global Quote'] && indexData['Global Quote']['05. price'] && indexData['Global Quote']['10. change percent']) {
            const price = parseFloat(indexData['Global Quote']['05. price']);
            const changePercent = parseFloat(indexData['Global Quote']['10. change percent'].replace('%', ''));
            
            // Only alert if the move is significant
            if (Math.abs(changePercent) > index.threshold) {
              alerts.push({
                id: `index-${index.symbol}`,
                type: 'index',
                priority: Math.abs(changePercent) > index.threshold * 1.5 ? 'high' : 'medium',
                ticker: index.symbol,
                title: `${index.name} ${changePercent > 0 ? 'Rally' : 'Selloff'}`,
                description: `${index.name} is ${changePercent > 0 ? 'up' : 'down'} ${Math.abs(changePercent).toFixed(1)}% at ${price.toFixed(0)}.`,
                action: `${changePercent > 0 ? 'Bullish' : 'Bearish'} bias for market direction. ${changePercent > 0 ? 'Focus on strength' : 'Use caution'}.`,
                confidence: 80,
                timestamp: new Date().toISOString()
              });
            }
          }
        }
        
        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (indexError) {
        console.warn(`[realtime-alerts.js] Error fetching ${index.name} data:`, indexError);
      }
    }
    
    // 6. News Impact Alerts - If Alpha Vantage has news data
    try {
      // Use SPY as a general market proxy for news
      const newsUrl = `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers=SPY&apikey=${API_KEY}&limit=10`;
      const newsResponse = await fetch(newsUrl);
      
      if (newsResponse.ok) {
        const newsData = await newsResponse.json();
        
        if (newsData.feed && newsData.feed.length > 0) {
          // Find high-sentiment news
          const significantNews = newsData.feed
            .filter(article => Math.abs(parseFloat(article.overall_sentiment_score)) > 0.3)
            .slice(0, 1);
          
          if (significantNews.length > 0) {
            const article = significantNews[0];
            const sentiment = parseFloat(article.overall_sentiment_score);
            const isPositive = sentiment > 0;
            
            alerts.push({
              id: 'market-news',
              type: 'news',
              priority: Math.abs(sentiment) > 0.5 ? 'high' : 'medium',
              ticker: 'MARKET',
              title: `Market News Impact`,
              description: `"${article.title}" - ${isPositive ? 'Positive' : 'Negative'} market news with ${Math.abs(sentiment).toFixed(2)} sentiment score.`,
              action: `Monitor market reaction to this ${isPositive ? 'positive' : 'negative'} development.`,
              confidence: 70,
              timestamp: new Date().toISOString()
            });
          }
        }
      }
    } catch (newsError) {
      console.warn('[realtime-alerts.js] Error fetching news data:', newsError);
    }
    
    // Filter to only high-confidence alerts
    const highConfidenceAlerts = alerts.filter(alert => alert.confidence >= 70);
    
    // Sort alerts by priority
    const sortedAlerts = highConfidenceAlerts.sort((a, b) => {
      const priorityValues = { 'high': 3, 'medium': 2, 'low': 1 };
      return priorityValues[b.priority] - priorityValues[a.priority];
    });
    
    console.log(`[realtime-alerts.js] Generated ${sortedAlerts.length} real alerts`);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        alerts: sortedAlerts,
        marketSession: session,
        alertsGenerated: alerts.length,
        alertsFiltered: alerts.length - sortedAlerts.length,
        timestamp: new Date().toISOString(),
        dataSource: "Alpha Vantage Real-Time Market Data",
        nextUpdate: session === 'MARKET_OPEN' ? '60 seconds' : '5 minutes'
      })
    };
    
  } catch (error) {
    console.error('[realtime-alerts.js] Error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "Alerts generation error",
        details: error.message,
        alerts: [], // Always empty array, never mock data
        timestamp: new Date().toISOString(),
        dataSource: "Error - No Data Available"
      })
    };
  }
};
