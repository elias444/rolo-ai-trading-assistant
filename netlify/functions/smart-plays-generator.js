// netlify/functions/smart-plays-generator.js
// COMPLETE: Real smart plays generator with NO mock data

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
    console.log(`[smart-plays-generator.js] Starting smart plays generation...`);
    
    // Get API key
    const API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
    
    if (!API_KEY) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'Alpha Vantage API key not configured',
          plays: [],
          timestamp: new Date().toISOString(),
          dataSource: "Error - No API Key"
        })
      };
    }
    
    // Parse query parameters
    const session = event.queryStringParameters?.session || 'MARKET_OPEN';
    console.log(`[smart-plays-generator.js] Current market session: ${session}`);
    
    // Determine data freshness and frequency based on market session
    let dataFrequency = '5min';
    let maxPlays = 5;
    
    switch (session) {
      case 'MARKET_OPEN':
        dataFrequency = '1min';
        maxPlays = 5;
        break;
      case 'PRE_MARKET':
      case 'AFTER_HOURS':
        dataFrequency = '5min';
        maxPlays = 3;
        break;
      case 'FUTURES_OPEN':
        dataFrequency = '15min';
        maxPlays = 2;
        break;
      case 'WEEKEND':
        dataFrequency = 'daily';
        maxPlays = 2;
        break;
    }
    
    // Fetch top movers (gainers, losers, most active)
    const topMoversUrl = `https://www.alphavantage.co/query?function=TOP_GAINERS_LOSERS&apikey=${API_KEY}`;
    const topMoversResponse = await fetch(topMoversUrl);
    
    if (!topMoversResponse.ok) {
      return {
        statusCode: topMoversResponse.status,
        headers,
        body: JSON.stringify({ 
          error: `Alpha Vantage API error: ${topMoversResponse.statusText}`,
          plays: [],
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
          plays: [],
          timestamp: new Date().toISOString(),
          dataSource: "Error - Invalid Data Format"
        })
      };
    }
    
    console.log(`[smart-plays-generator.js] Received top movers: ${topMoversData.top_gainers.length} gainers, ${topMoversData.top_losers.length} losers, ${topMoversData.most_actively_traded.length} active`);
    
    // Combine all movers and select candidates for analysis
    const allMovers = [
      ...topMoversData.top_gainers, 
      ...topMoversData.top_losers,
      ...topMoversData.most_actively_traded
    ];
    
    // Filter candidates based on volume and price movement
    const candidates = allMovers.filter(stock => {
      // Convert string values to numbers
      const price = parseFloat(stock.price);
      const changePercent = parseFloat(stock.change_percentage.replace('%', ''));
      const volume = parseInt(stock.volume);
      
      // Basic filtering criteria
      return (
        price > 5 &&                   // Price above $5
        Math.abs(changePercent) > 3 && // At least 3% move
        volume > 100000                // At least 100K volume
      );
    });
    
    console.log(`[smart-plays-generator.js] Filtered to ${candidates.length} candidates`);
    
    // Shuffle and take the top candidates for deeper analysis
    const shuffled = candidates.sort(() => 0.5 - Math.random());
    const selectedCandidates = shuffled.slice(0, Math.min(10, candidates.length));
    
    console.log(`[smart-plays-generator.js] Selected ${selectedCandidates.length} candidates for analysis`);
    
    // Perform deeper analysis on each candidate
    const validPlays = [];
    
    for (const stock of selectedCandidates) {
      try {
        // Fetch detailed quote
        const quoteUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${stock.ticker}&apikey=${API_KEY}`;
        const quoteResponse = await fetch(quoteUrl);
        
        if (quoteResponse.ok) {
          const quoteData = await quoteResponse.json();
          
          if (quoteData['Global Quote'] && quoteData['Global Quote']['05. price']) {
            const currentPrice = parseFloat(quoteData['Global Quote']['05. price']);
            const openPrice = parseFloat(quoteData['Global Quote']['02. open']);
            const highPrice = parseFloat(quoteData['Global Quote']['03. high']);
            const lowPrice = parseFloat(quoteData['Global Quote']['04. low']);
            const volume = parseInt(quoteData['Global Quote']['06. volume']);
            const change = parseFloat(quoteData['Global Quote']['09. change']);
            const changePercent = parseFloat(quoteData['Global Quote']['10. change percent'].replace('%', ''));
            
            // Fetch RSI to identify overbought/oversold conditions
            const rsiUrl = `https://www.alphavantage.co/query?function=RSI&symbol=${stock.ticker}&interval=daily&time_period=14&series_type=close&apikey=${API_KEY}`;
            const rsiResponse = await fetch(rsiUrl);
            let rsiValue = null;
            let rsiSignal = 'neutral';
            
            if (rsiResponse.ok) {
              const rsiData = await rsiResponse.json();
              const technicalAnalysis = rsiData['Technical Analysis: RSI'];
              
              if (technicalAnalysis) {
                const dates = Object.keys(technicalAnalysis).sort().reverse();
                if (dates.length > 0) {
                  const latestDate = dates[0];
                  rsiValue = parseFloat(technicalAnalysis[latestDate]['RSI']);
                  rsiSignal = rsiValue > 70 ? 'overbought' : rsiValue < 30 ? 'oversold' : 'neutral';
                }
              }
            }
            
            // Determine if this is a valid play based on technical factors
            const isPositiveChange = changePercent > 0;
            const isNearDailyHigh = currentPrice > (highPrice - (highPrice - lowPrice) * 0.2);
            const isNearDailyLow = currentPrice < (lowPrice + (highPrice - lowPrice) * 0.2);
            const hasSignificantVolume = volume > 500000;
            
            // Generate play types based on the data
            let playType = 'momentum';
            let strategy = 'momentum';
            let timeframe = 'short-term';
            let emoji = '📈';
            let isLong = true;
            let confidence = 0;
            let entryPrice = currentPrice;
            let stopLossPrice = 0;
            let targetPrice = 0;
            
            // Momentum play
            if (isPositiveChange && isNearDailyHigh && rsiValue < 70) {
              playType = 'momentum';
              strategy = 'breakout';
              timeframe = 'day-trade';
              emoji = '🚀';
              isLong = true;
              confidence = Math.min(60 + Math.abs(changePercent), 95);
              entryPrice = currentPrice;
              stopLossPrice = lowPrice;
              targetPrice = currentPrice * (1 + Math.abs(changePercent) / 100);
            } 
            // Reversal play
            else if (!isPositiveChange && isNearDailyLow && rsiValue < 40) {
              playType = 'reversal';
              strategy = 'oversold-bounce';
              timeframe = 'swing-trade';
              emoji = '↩️';
              isLong = true;
              confidence = Math.min(50 + (30 - rsiValue), 80);
              entryPrice = currentPrice;
              stopLossPrice = lowPrice * 0.95;
              targetPrice = currentPrice * (1 + Math.abs(changePercent) / 100);
            }
            // Short play
            else if (isPositiveChange && rsiValue > 70) {
              playType = 'short';
              strategy = 'overbought-reversal';
              timeframe = 'day-trade';
              emoji = '📉';
              isLong = false;
              confidence = Math.min(50 + (rsiValue - 70), 85);
              entryPrice = currentPrice;
              stopLossPrice = highPrice * 1.05;
              targetPrice = currentPrice * (1 - Math.abs(changePercent) / 200);
            }
            // Continuation play
            else if ((isPositiveChange && volume > 1000000) || (!isPositiveChange && volume > 1000000)) {
              playType = isPositiveChange ? 'continuation' : 'trend-following';
              strategy = isPositiveChange ? 'strong-uptrend' : 'strong-downtrend';
              timeframe = 'swing-trade';
              emoji = isPositiveChange ? '📈' : '📉';
              isLong = isPositiveChange;
              confidence = Math.min(55 + Math.abs(changePercent), 90);
              entryPrice = currentPrice;
              stopLossPrice = isPositiveChange ? currentPrice * 0.95 : currentPrice * 1.05;
              targetPrice = isPositiveChange ? currentPrice * 1.1 : currentPrice * 0.9;
            }
            
            // Only include plays with decent confidence
            if (confidence >= 60) {
              const play = {
                id: validPlays.length + 1,
                ticker: stock.ticker,
                emoji: emoji,
                title: `${isLong ? 'Long' : 'Short'} ${stock.ticker} - ${playType.charAt(0).toUpperCase() + playType.slice(1)} Play`,
                playType: playType,
                strategy: strategy,
                confidence: confidence,
                timeframe: timeframe,
                entry: {
                  price: parseFloat(entryPrice.toFixed(2)),
                  reasoning: `Entry at ${parseFloat(entryPrice.toFixed(2))} based on ${isLong ? 'bullish' : 'bearish'} ${playType} pattern`
                },
                stopLoss: {
                  price: parseFloat(stopLossPrice.toFixed(2)),
                  reasoning: `Stop loss at ${parseFloat(stopLossPrice.toFixed(2))} below ${isLong ? 'support' : 'resistance'}`
                },
                targets: [
                  {
                    price: parseFloat(targetPrice.toFixed(2)),
                    probability: Math.floor(confidence * 0.8)
                  }
                ],
                reasoning: `${stock.ticker} shows a ${isLong ? 'bullish' : 'bearish'} ${playType} pattern with ${Math.abs(changePercent).toFixed(1)}% ${changePercent > 0 ? 'gain' : 'loss'} with ${(volume/1000000).toFixed(1)}M volume. ${isLong ? 'Momentum' : 'Reversal'} play for ${marketSession.toLowerCase()} session.`,
                realTimeData: {
                  currentPrice,
                  changePercent,
                  volume,
                  marketSession,
                  timestamp: new Date().toISOString()
                }
              };
              
              validPlays.push(play);
            }
          }
        }
        
        // Rate limiting for API calls
        await new Promise(resolve => setTimeout(resolve, 250));
        
      } catch (stockError) {
        console.warn(`[smart-plays-generator.js] Could not analyze ${stock.ticker}: ${stockError.message}`);
      }
    }

    // Sort by confidence and return top plays
    validPlays.sort((a, b) => b.confidence - a.confidence);
    
    console.log(`[smart-plays-generator.js] Generated ${validPlays.length} real smart plays`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        plays: validPlays.slice(0, maxPlays), // Top plays with highest confidence
        marketSession: session,
        dataFrequency,
        totalMoversAnalyzed: allMovers.length,
        qualifyingPlays: validPlays.length,
        timestamp: new Date().toISOString(),
        dataSource: "Alpha Vantage Real-Time Market Data",
        nextUpdate: session === 'MARKET_OPEN' ? '60 seconds' : '5 minutes',
        marketContext: {
          session: session,
          topGainers: topMoversData.top_gainers.length,
          topLosers: topMoversData.top_losers.length,
          activeStocks: topMoversData.most_actively_traded?.length || 0
        }
      })
    };

  } catch (error) {
    console.error('[smart-plays-generator.js] Error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "Smart plays generation error",
        details: error.message,
        plays: [], // Always empty array, never mock data
        timestamp: new Date().toISOString(),
        dataSource: "Error - No Data Available"
      })
    };
  }
};// netlify/functions/smart-plays-generator.js
// COMPLETE: Real smart plays generator with NO mock data

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
    console.log(`[smart-plays-generator.js] Starting smart plays generation...`);
    
    // Get API key
    const API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
    
    if (!API_KEY) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'Alpha Vantage API key not configured',
          plays: [],
          timestamp: new Date().toISOString(),
          dataSource: "Error - No API Key"
        })
      };
    }
    
    // Parse query parameters
    const session = event.queryStringParameters?.session || 'MARKET_OPEN';
    console.log(`[smart-plays-generator.js] Current market session: ${session}`);
    
    // Determine data freshness and frequency based on market session
    let dataFrequency = '5min';
    let maxPlays = 5;
    
    switch (session) {
      case 'MARKET_OPEN':
        dataFrequency = '1min';
        maxPlays = 5;
        break;
      case 'PRE_MARKET':
      case 'AFTER_HOURS':
        dataFrequency = '5min';
        maxPlays = 3;
        break;
      case 'FUTURES_OPEN':
        dataFrequency = '15min';
        maxPlays = 2;
        break;
      case 'WEEKEND':
        dataFrequency = 'daily';
        maxPlays = 2;
        break;
    }
    
    // Fetch top movers (gainers, losers, most active)
    const topMoversUrl = `https://www.alphavantage.co/query?function=TOP_GAINERS_LOSERS&apikey=${API_KEY}`;
    const topMoversResponse = await fetch(topMoversUrl);
    
    if (!topMoversResponse.ok) {
      return {
        statusCode: topMoversResponse.status,
        headers,
        body: JSON.stringify({ 
          error: `Alpha Vantage API error: ${topMoversResponse.statusText}`,
          plays: [],
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
          plays: [],
          timestamp: new Date().toISOString(),
          dataSource: "Error - Invalid Data Format"
        })
      };
    }
    
    console.log(`[smart-plays-generator.js] Received top movers: ${topMoversData.top_gainers.length} gainers, ${topMoversData.top_losers.length} losers, ${topMoversData.most_actively_traded.length} active`);
    
    // Combine all movers and select candidates for analysis
    const allMovers = [
      ...topMoversData.top_gainers, 
      ...topMoversData.top_losers,
      ...topMoversData.most_actively_traded
    ];
    
    // Filter candidates based on volume and price movement
    const candidates = allMovers.filter(stock => {
      // Convert string values to numbers
      const price = parseFloat(stock.price);
      const changePercent = parseFloat(stock.change_percentage.replace('%', ''));
      const volume = parseInt(stock.volume);
      
      // Basic filtering criteria
      return (
        price > 5 &&                   // Price above $5
        Math.abs(changePercent) > 3 && // At least 3% move
        volume > 100000                // At least 100K volume
      );
    });
    
    console.log(`[smart-plays-generator.js] Filtered to ${candidates.length} candidates`);
    
    // Shuffle and take the top candidates for deeper analysis
    const shuffled = candidates.sort(() => 0.5 - Math.random());
    const selectedCandidates = shuffled.slice(0, Math.min(10, candidates.length));
    
    console.log(`[smart-plays-generator.js] Selected ${selectedCandidates.length} candidates for analysis`);
    
    // Perform deeper analysis on each candidate
    const validPlays = [];
    
    for (const stock of selectedCandidates) {
      try {
        // Fetch detailed quote
        const quoteUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${stock.ticker}&apikey=${API_KEY}`;
        const quoteResponse = await fetch(quoteUrl);
        
        if (
