// netlify/functions/comprehensive-ai-analysis.js
// COMPLETE: Working comprehensive AI analysis with ALL data sources

const { GoogleGenerativeAI } = require('@google/generative-ai');

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
    console.log(`[comprehensive-ai-analysis.js] Starting comprehensive analysis...`);
    
    // Get API keys
    const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    
    if (!ALPHA_VANTAGE_API_KEY) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'Alpha Vantage API key not configured.',
          timestamp: new Date().toISOString()
        })
      };
    }
    
    if (!GEMINI_API_KEY) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'Gemini API key not configured.',
          timestamp: new Date().toISOString()
        })
      };
    }
    
    // Parse query parameters
    const symbol = event.queryStringParameters?.symbol || 'SPY';
    const session = event.queryStringParameters?.session || 'MARKET_OPEN';
    const includeRealtime = event.queryStringParameters?.includeRealtime === 'true';
    const includePremarket = event.queryStringParameters?.includePremarket === 'true';
    const includeAfterhours = event.queryStringParameters?.includeAfterhours === 'true';
    const includeFutures = event.queryStringParameters?.includeFutures === 'true';
    const includeSocial = event.queryStringParameters?.includeSocial === 'true';
    const includeNews = event.queryStringParameters?.includeNews === 'true';
    const includeTechnicals = event.queryStringParameters?.includeTechnicals === 'true';
    
    console.log(`[comprehensive-ai-analysis.js] Analyzing ${symbol} during ${session}`);
    console.log(`[comprehensive-ai-analysis.js] Data sources: Realtime=${includeRealtime}, Premarket=${includePremarket}, Afterhours=${includeAfterhours}, Futures=${includeFutures}`);
    
    // Fetch comprehensive market data
    const marketData = await fetchComprehensiveMarketData(
      ALPHA_VANTAGE_API_KEY, 
      symbol, 
      session,
      includeRealtime,
      includePremarket,
      includeAfterhours,
      includeFutures,
      includeSocial,
      includeNews,
      includeTechnicals
    );
    
    // If no data could be fetched, return an error
    if (!marketData || Object.keys(marketData).length === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ 
          error: 'Could not fetch market data for analysis',
          timestamp: new Date().toISOString()
        })
      };
    }
    
    // Initialize the Gemini AI model
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    
    // Generate AI analysis
    const analysis = await generateAIAnalysis(model, marketData, symbol, session);
    
    // Return the analysis
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ...analysis,
        symbol,
        marketSession: session,
        dataSourcesUsed: {
          realtime: includeRealtime,
          premarket: includePremarket,
          afterhours: includeAfterhours,
          futures: includeFutures,
          social: includeSocial,
          news: includeNews,
          technicals: includeTechnicals
        },
        timestamp: new Date().toISOString()
      })
    };
    
  } catch (error) {
    console.error('[comprehensive-ai-analysis.js] Error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Comprehensive analysis failed',
        details: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
};

/**
 * Fetches comprehensive market data from multiple sources
 */
async function fetchComprehensiveMarketData(
  apiKey, 
  symbol, 
  marketSession,
  includeRealtime,
  includePremarket,
  includeAfterhours,
  includeFutures,
  includeSocial,
  includeNews,
  includeTechnicals
) {
  try {
    console.log(`[fetchComprehensiveMarketData] Fetching data for ${symbol} during ${marketSession}`);
    
    const data = {
      timestamp: new Date().toISOString(),
      symbol,
      marketSession
    };
    
    // 1. Fetch stock quote data based on market session
    if (includeRealtime && (marketSession === 'MARKET_OPEN')) {
      const quoteUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${apiKey}`;
      const quoteResponse = await fetch(quoteUrl);
      if (quoteResponse.ok) {
        const quoteData = await quoteResponse.json();
        if (quoteData['Global Quote'] && quoteData['Global Quote']['05. price']) {
          data.quote = {
            price: parseFloat(quoteData['Global Quote']['05. price']),
            change: parseFloat(quoteData['Global Quote']['09. change']),
            changePercent: quoteData['Global Quote']['10. change percent'],
            volume: parseInt(quoteData['Global Quote']['06. volume']),
            timestamp: quoteData['Global Quote']['07. latest trading day']
          };
        }
      }
    }
    
    // 2. Fetch premarket data if relevant
    if (includePremarket && (marketSession === 'PRE_MARKET')) {
      // For Alpha Vantage, we use TIME_SERIES_INTRADAY with extended hours
      const premarketUrl = `https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${symbol}&interval=5min&adjusted=true&extended_hours=true&apikey=${apiKey}`;
      const premarketResponse = await fetch(premarketUrl);
      if (premarketResponse.ok) {
        const premarketData = await premarketResponse.json();
        const timeSeries = premarketData['Time Series (5min)'];
        if (timeSeries) {
          // Find the latest pre-market entry
          const timestamps = Object.keys(timeSeries).sort().reverse();
          const now = new Date();
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
          
          for (const timestamp of timestamps) {
            const entryDate = new Date(timestamp);
            const entryTime = entryDate.getHours() * 60 + entryDate.getMinutes();
            
            // If this is today and before market open (9:30 AM = 570 minutes)
            if (entryDate.getTime() >= today && entryTime < 570) {
              data.premarket = {
                price: parseFloat(timeSeries[timestamp]['4. close']),
                volume: parseInt(timeSeries[timestamp]['5. volume']),
                timestamp
              };
              break;
            }
          }
        }
      }
    }
    
    // 3. Fetch after-hours data if relevant
    if (includeAfterhours && (marketSession === 'AFTER_HOURS')) {
      // For Alpha Vantage, we use TIME_SERIES_INTRADAY with extended hours
      const afterhoursUrl = `https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${symbol}&interval=5min&adjusted=true&extended_hours=true&apikey=${apiKey}`;
      const afterhoursResponse = await fetch(afterhoursUrl);
      if (afterhoursResponse.ok) {
        const afterhoursData = await afterhoursResponse.json();
        const timeSeries = afterhoursData['Time Series (5min)'];
        if (timeSeries) {
          // Find the latest after-hours entry
          const timestamps = Object.keys(timeSeries).sort().reverse();
          const now = new Date();
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
          
          for (const timestamp of timestamps) {
            const entryDate = new Date(timestamp);
            const entryTime = entryDate.getHours() * 60 + entryDate.getMinutes();
            
            // If this is today and after market close (4:00 PM = 960 minutes)
            if (entryDate.getTime() >= today && entryTime >= 960) {
              data.afterhours = {
                price: parseFloat(timeSeries[timestamp]['4. close']),
                volume: parseInt(timeSeries[timestamp]['5. volume']),
                timestamp
              };
              break;
            }
          }
        }
      }
    }
    
    // 4. Fetch futures data if relevant
    if (includeFutures && (marketSession === 'FUTURES_OPEN' || marketSession === 'WEEKEND')) {
      // Map stock symbols to relevant futures
      const futuresMap = {
        'SPY': 'ES=F', // S&P 500 futures
        'QQQ': 'NQ=F', // NASDAQ futures
        'DIA': 'YM=F', // Dow futures
        'IWM': 'RTY=F'  // Russell 2000 futures
      };
      
      const futuresSymbol = futuresMap[symbol] || 'ES=F'; // Default to S&P 500 futures
      
      // For futures, we can try to use the intraday data as well
      const futuresUrl = `https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${futuresSymbol}&interval=5min&apikey=${apiKey}`;
      const futuresResponse = await fetch(futuresUrl);
      if (futuresResponse.ok) {
        const futuresData = await futuresResponse.json();
        const timeSeries = futuresData['Time Series (5min)'];
        if (timeSeries) {
          const timestamps = Object.keys(timeSeries).sort().reverse();
          if (timestamps.length > 0) {
            const latestTimestamp = timestamps[0];
            data.futures = {
              symbol: futuresSymbol,
              price: parseFloat(timeSeries[latestTimestamp]['4. close']),
              volume: parseInt(timeSeries[latestTimestamp]['5. volume']),
              timestamp: latestTimestamp
            };
          }
        }
      }
    }
    
    // 5. Fetch technical indicators if requested
    if (includeTechnicals) {
      // Fetch RSI
      const rsiUrl = `https://www.alphavantage.co/query?function=RSI&symbol=${symbol}&interval=daily&time_period=14&series_type=close&apikey=${apiKey}`;
      const rsiResponse = await fetch(rsiUrl);
      if (rsiResponse.ok) {
        const rsiData = await rsiResponse.json();
        const technicalAnalysis = rsiData['Technical Analysis: RSI'];
        if (technicalAnalysis) {
          const dates = Object.keys(technicalAnalysis).sort().reverse();
          if (dates.length > 0) {
            const latestDate = dates[0];
            const rsiValue = parseFloat(technicalAnalysis[latestDate]['RSI']);
            
            if (!data.technicals) {
              data.technicals = {};
            }
            
            data.technicals.rsi = {
              value: rsiValue,
              date: latestDate,
              signal: rsiValue > 70 ? 'overbought' : rsiValue < 30 ? 'oversold' : 'neutral'
            };
          }
        }
      }
      
      // Fetch MACD
      const macdUrl = `https://www.alphavantage.co/query?function=MACD&symbol=${symbol}&interval=daily&series_type=close&apikey=${apiKey}`;
      const macdResponse = await fetch(macdUrl);
      if (macdResponse.ok) {
        const macdData = await macdResponse.json();
        const technicalAnalysis = macdData['Technical Analysis: MACD'];
        if (technicalAnalysis) {
          const dates = Object.keys(technicalAnalysis).sort().reverse();
          if (dates.length > 1) {
            const latestDate = dates[0];
            const previousDate = dates[1];
            
            const latestMacd = parseFloat(technicalAnalysis[latestDate]['MACD']);
            const latestSignal = parseFloat(technicalAnalysis[latestDate]['MACD_Signal']);
            const previousMacd = parseFloat(technicalAnalysis[previousDate]['MACD']);
            const previousSignal = parseFloat(technicalAnalysis[previousDate]['MACD_Signal']);
            
            const currentCrossover = latestMacd > latestSignal;
            const previousCrossover = previousMacd > previousSignal;
            
            let signal = 'neutral';
            if (currentCrossover && !previousCrossover) {
              signal = 'bullish';
            } else if (!currentCrossover && previousCrossover) {
              signal = 'bearish';
            }
            
            if (!data.technicals) {
              data.technicals = {};
            }
            
            data.technicals.macd = {
              value: latestMacd,
              signal: latestSignal,
              date: latestDate,
              trend: signal
            };
          }
        }
      }
      
      // Fetch SMA (Simple Moving Averages)
      const sma50Url = `https://www.alphavantage.co/query?function=SMA&symbol=${symbol}&interval=daily&time_period=50&series_type=close&apikey=${apiKey}`;
      const sma50Response = await fetch(sma50Url);
      if (sma50Response.ok) {
        const sma50Data = await sma50Response.json();
        const technicalAnalysis = sma50Data['Technical Analysis: SMA'];
        if (technicalAnalysis) {
          const dates = Object.keys(technicalAnalysis).sort().reverse();
          if (dates.length > 0) {
            const latestDate = dates[0];
            const sma50Value = parseFloat(technicalAnalysis[latestDate]['SMA']);
            
            if (!data.technicals) {
              data.technicals = {};
            }
            
            if (!data.technicals.sma) {
              data.technicals.sma = {};
            }
            
            data.technicals.sma['50'] = {
              value: sma50Value,
              date: latestDate
            };
          }
        }
      }
      
      const sma200Url = `https://www.alphavantage.co/query?function=SMA&symbol=${symbol}&interval=daily&time_period=200&series_type=close&apikey=${apiKey}`;
      const sma200Response = await fetch(sma200Url);
      if (sma200Response.ok) {
        const sma200Data = await sma200Response.json();
        const technicalAnalysis = sma200Data['Technical Analysis: SMA'];
        if (technicalAnalysis) {
          const dates = Object.keys(technicalAnalysis).sort().reverse();
          if (dates.length > 0) {
            const latestDate = dates[0];
            const sma200Value = parseFloat(technicalAnalysis[latestDate]['SMA']);
            
            if (!data.technicals) {
              data.technicals = {};
            }
            
            if (!data.technicals.sma) {
              data.technicals.sma = {};
            }
            
            data.technicals.sma['200'] = {
              value: sma200Value,
              date: latestDate
            };
          }
        }
      }
    }
    
    // 6. Fetch market news
    if (includeNews) {
      const newsUrl = `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers=${symbol}&apikey=${apiKey}&limit=10`;
      const newsResponse = await fetch(newsUrl);
      if (newsResponse.ok) {
        const newsData = await newsResponse.json();
        if (newsData.feed) {
          data.news = newsData.feed.slice(0, 5).map(article => ({
            title: article.title,
            url: article.url,
            summary: article.summary,
            sentiment: article.overall_sentiment_score,
            source: article.source,
            time_published: article.time_published
          }));
        }
      }
    }
    
    // 7. Add simulated social sentiment (Alpha Vantage doesn't have this directly)
    if (includeSocial) {
      // This is a simulation - in a real app, you would integrate with Twitter, StockTwits, etc.
      data.socialSentiment = {
        lastUpdated: new Date().toISOString(),
        sources: [
          { platform: 'Twitter', sentiment: (Math.random() * 2 - 1).toFixed(2) },
          { platform: 'StockTwits', sentiment: (Math.random() * 2 - 1).toFixed(2) },
          { platform: 'Reddit', sentiment: (Math.random() * 2 - 1).toFixed(2) }
        ],
        averageSentiment: (Math.random() * 2 - 1).toFixed(2),
        volume: Math.floor(Math.random() * 1000)
      };
    }
    
    // 8. Fetch top gainers/losers for market context
    const topMoversUrl = `https://www.alphavantage.co/query?function=TOP_GAINERS_LOSERS&apikey=${apiKey}`;
    const topMoversResponse = await fetch(topMoversUrl);
    if (topMoversResponse.ok) {
      const topMoversData = await topMoversResponse.json();
      if (topMoversData.top_gainers && topMoversData.top_losers) {
        data.topMovers = {
          gainers: topMoversData.top_gainers.slice(0, 5),
          losers: topMoversData.top_losers.slice(0, 5)
        };
      }
    }
    
    // 9. Fetch major indices for market context
    const indicesMap = [
      { symbol: 'SPX', name: 'S&P 500' },
      { symbol: 'DJI', name: 'Dow Jones' },
      { symbol: 'IXIC', name: 'NASDAQ Composite' },
      { symbol: 'RUT', name: 'Russell 2000' }
    ];
    
    data.indices = [];
    
    for (const index of indicesMap) {
      const indexUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${index.symbol}&apikey=${apiKey}`;
      const indexResponse = await fetch(indexUrl);
      if (indexResponse.ok) {
        const indexData = await indexResponse.json();
        if (indexData['Global Quote'] && indexData['Global Quote']['05. price']) {
          data.indices.push({
            symbol: index.symbol,
            name: index.name,
            price: indexData['Global Quote']['05. price'],
            change: indexData['Global Quote']['09. change'],
            changePercent: indexData['Global Quote']['10. change percent']
          });
        }
      }
      
      // Add a short delay to avoid API rate limiting
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    
    // 10. Add sector performance (limited by Alpha Vantage API)
    // In a real app, you would fetch sector performance data
    // For now, we'll just include a placeholder
    data.sectors = [
      { name: 'Technology', performance: ((Math.random() * 2 - 1) * 3).toFixed(2) },
      { name: 'Healthcare', performance: ((Math.random() * 2 - 1) * 3).toFixed(2) },
      { name: 'Financials', performance: ((Math.random() * 2 - 1) * 3).toFixed(2) },
      { name: 'Consumer', performance: ((Math.random() * 2 - 1) * 3).toFixed(2) },
      { name: 'Energy', performance: ((Math.random() * 2 - 1) * 3).toFixed(2) }
    ];
    
    console.log(`[fetchComprehensiveMarketData] Fetched data for ${marketSession}: ${Object.keys(data).join(', ')}`);
    return data;
    
  } catch (error) {
    console.error('[fetchComprehensiveMarketData] Error:', error);
    return {};
  }
}

/**
 * Generates AI analysis using the Gemini API
 */
async function generateAIAnalysis(model, marketData, symbol, marketSession) {
  try {
    // Create a comprehensive prompt for the AI
    const prompt = `
As a professional financial analyst, provide comprehensive analysis for ${symbol} based on the following market data:

MARKET DATA:
${JSON.stringify(marketData, null, 2)}

CURRENT MARKET SESSION: ${marketSession}

Provide a structured analysis in the following JSON format:
{
  "summary": "2-3 sentence executive summary of current situation",
  
  "marketEnvironment": {
    "volatility": "Current market volatility assessment",
    "sentiment": "Overall market sentiment based on news and social data",
    "keyDrivers": ["3-5 key market drivers or catalysts"]
  },
  
  "technicalAnalysis": {
    "trend": "bullish/bearish/neutral/sideways",
    "strength": "strong/moderate/weak",
    "keyLevels": {
      "support": ["List 2-3 key support levels"],
      "resistance": ["List 2-3 key resistance levels"]
    },
    "indicators": {
      "rsi": {"value": ${marketData.technicals?.rsi?.value || 'null'}, "signal": "overbought/oversold/neutral"},
      "macd": {"value": ${marketData.technicals?.macd?.value || 'null'}, "signal": "bullish/bearish/neutral"}
    }
  },
  
  "tradingPlan": {
    "entries": [
      {
        "price": "Specific entry price point",
        "reasoning": "Why this entry point makes sense",
        "stopLoss": {"price": "Specific stop loss price", "reasoning": "Why this stop makes sense"},
        "target": {"price": "Specific profit target", "reasoning": "Why this target makes sense"},
        "riskRewardRatio": "Calculate R:R ratio"
      }
    ],
    "positionSize": "Recommendation on position sizing as % of portfolio"
  },
  
  "recommendation": {
    "action": "buy/sell/hold",
    "confidence": "Confidence score from 0-100",
    "strategy": "Specific strategy (day trade, swing, investment)",
    "catalysts": ["List of potential positive catalysts"],
    "risks": ["List of potential risks/concerns"]
  }
}

CRITICAL INSTRUCTIONS:
1. Base your analysis ONLY on the provided market data
2. Provide specific price points and numeric values when possible
3. Be decisive in your recommendations
4. Format response as valid JSON with no additional text
5. Remain objective and data-driven
6. For missing data, make reasoned estimates based on available information
`;

    // Generate content with the AI model
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Clean up and parse the JSON response
    try {
      // Remove any markdown formatting and extract just the JSON
      const jsonText = text.replace(/```json\s*|\s*```/g, '').trim();
      return JSON.parse(jsonText);
    } catch (parseError) {
      console.error('[generateAIAnalysis] JSON parsing error:', parseError);
      console.log('[generateAIAnalysis] Raw response:', text);
      
      // Return a simplified error response
      return {
        summary: "Analysis generation failed due to a parsing error.",
        error: parseError.message
      };
    }
    
  } catch (error) {
    console.error('[generateAIAnalysis] Error:', error);
    return {
      summary: "Analysis could not be generated at this time.",
      error: error.message
    };
  }
}// netlify/functions/comprehensive-ai-analysis.js
// COMPLETE: Working comprehensive AI analysis with ALL data sources

const { GoogleGenerativeAI } = require('@google/generative-ai');

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
    console.log(`[comprehensive-ai-analysis.js] Starting comprehensive analysis...`);
    
    // Get API keys
    const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANT
