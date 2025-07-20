// netlify/functions/enhanced-stock-data.js
// Enhanced stock data with real-time, pre-market, futures support

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

  const symbol = event.queryStringParameters?.symbol;
  if (!symbol) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Symbol parameter is required' })
    };
  }

  try {
    console.log(`[enhanced-stock-data.js] Fetching enhanced data for ${symbol}...`);
    const API_KEY = process.env.ALPHA_VANTAGE_API_KEY;

    if (!API_KEY) {
      console.error("[enhanced-stock-data.js] ALPHA_VANTAGE_API_KEY environment variable is not set.");
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Alpha Vantage API key is not configured.' })
      };
    }

    // Enhanced market session detection
    const now = new Date();
    const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
    const est = new Date(utcTime + (-5 * 3600000)); // EST timezone
    const hours = est.getHours();
    const minutes = est.getMinutes();
    const day = est.getDay(); // 0 = Sunday, 6 = Saturday
    const totalMinutes = hours * 60 + minutes;
    
    let marketSession = 'Market Closed';
    let dataSource = 'daily';
    let dataInterval = '5min';
    
    if (day === 0) { // Sunday
      if (hours >= 18) {
        marketSession = 'Futures Open';
        dataSource = 'intraday';
        dataInterval = '5min';
      } else {
        marketSession = 'Weekend';
        dataSource = 'daily';
      }
    } else if (day === 6) { // Saturday
      marketSession = 'Weekend';
      dataSource = 'daily';
    } else { // Monday-Friday
      if (totalMinutes >= 240 && totalMinutes < 570) { // 4:00 AM - 9:30 AM
        marketSession = 'Pre-Market';
        dataSource = 'intraday';
        dataInterval = '5min';
      } else if (totalMinutes >= 570 && totalMinutes < 960) { // 9:30 AM - 4:00 PM
        marketSession = 'Market Open';
        dataSource = 'realtime';
        dataInterval = '1min';
      } else if (totalMinutes >= 960 && totalMinutes < 1200) { // 4:00 PM - 8:00 PM
        marketSession = 'After Hours';
        dataSource = 'intraday';
        dataInterval = '5min';
      } else { // 8:00 PM - 4:00 AM
        marketSession = 'Futures Open';
        dataSource = 'intraday';
        dataInterval = '15min';
      }
    }
    
    console.log(`[enhanced-stock-data.js] Detected session: ${marketSession}, data source: ${dataSource}`);
    
    let stockData = null;
    let fetchedDataType = null;
    
    // Strategy 1: Try intraday data for most current price
    if (dataSource === 'intraday' || dataSource === 'realtime') {
      try {
        const intradayUrl = `https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${symbol}&interval=${dataInterval}&outputsize=compact&apikey=${API_KEY}`;
        console.log(`[enhanced-stock-data.js] Fetching intraday data: ${intradayUrl}`);
        
        const intradayResponse = await fetch(intradayUrl);
        const intradayData = await intradayResponse.json();
        
        const timeSeriesKey = `Time Series (${dataInterval})`;
        
        if (intradayData[timeSeriesKey] && Object.keys(intradayData[timeSeriesKey]).length > 0) {
          // Get the most recent data point
          const timestamps = Object.keys(intradayData[timeSeriesKey]).sort().reverse();
          const latestTimestamp = timestamps[0];
          const latestData = intradayData[timeSeriesKey][latestTimestamp];
          
          // Get previous closing price from metadata or use the last closing price
          let previousClose = null;
          if (intradayData['Meta Data'] && intradayData['Meta Data']['4. Previous Close']) {
            previousClose = parseFloat(intradayData['Meta Data']['4. Previous Close']);
          } else if (timestamps.length > 1) {
            const previousTimestamp = timestamps[1];
            previousClose = parseFloat(intradayData[timeSeriesKey][previousTimestamp]['4. close']);
          }
          
          if (latestData) {
            const currentPrice = parseFloat(latestData['4. close']);
            let change = 0;
            let changePercent = '0.00%';
            
            if (previousClose !== null) {
              change = currentPrice - previousClose;
              changePercent = ((change / previousClose) * 100).toFixed(2) + '%';
            }
            
            stockData = {
              symbol: symbol.toUpperCase(),
              price: parseFloat(latestData['4. close']).toFixed(2),
              open: parseFloat(latestData['1. open']).toFixed(2),
              high: parseFloat(latestData['2. high']).toFixed(2),
              low: parseFloat(latestData['3. low']).toFixed(2),
              volume: parseInt(latestData['5. volume'] || 0).toLocaleString(),
              change: change.toFixed(2),
              changePercent: changePercent,
              lastUpdated: latestTimestamp,
              marketSession: marketSession,
              dataSource: `Intraday ${dataInterval}`,
              isRealTime: dataSource === 'realtime',
              timestamp: new Date().toISOString()
            };
            
            fetchedDataType = `intraday_${dataInterval}`;
            console.log(`[enhanced-stock-data.js] Successfully fetched intraday data for ${symbol}`);
          }
        } else if (intradayData['Note']) {
          console.warn(`[enhanced-stock-data.js] Alpha Vantage rate limit: ${intradayData['Note']}`);
        } else if (intradayData['Error Message']) {
          console.warn(`[enhanced-stock-data.js] Intraday API error: ${intradayData['Error Message']}`);
        }
      } catch (error) {
        console.warn(`[enhanced-stock-data.js] Intraday fetch failed: ${error.message}`);
      }
    }

    // Strategy 2: Fallback to Global Quote if intraday failed or not needed
    if (!stockData) {
      try {
        const globalQuoteUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${API_KEY}`;
        console.log(`[enhanced-stock-data.js] Falling back to Global Quote for ${symbol}`);

        const globalResponse = await fetch(globalQuoteUrl);
        const globalData = await globalResponse.json();

        if (globalData['Global Quote'] && globalData['Global Quote']['05. price']) {
          const quote = globalData['Global Quote'];
          
          stockData = {
            symbol: symbol.toUpperCase(),
            price: parseFloat(quote['05. price']).toFixed(2),
            open: parseFloat(quote['02. open']).toFixed(2),
            high: parseFloat(quote['03. high']).toFixed(2),
            low: parseFloat(quote['04. low']).toFixed(2),
            volume: parseInt(quote['06. volume'] || 0).toLocaleString(),
            change: parseFloat(quote['09. change'] || 0).toFixed(2),
            changePercent: quote['10. change percent'] || '0.00%',
            lastUpdated: quote['07. latest trading day'],
            marketSession: marketSession,
            dataSource: 'Global Quote',
            isRealTime: false,
            timestamp: new Date().toISOString()
          };
          
          fetchedDataType = 'global_quote';
          console.log(`[enhanced-stock-data.js] Successfully fetched Global Quote for ${symbol}`);
        } else if (globalData['Error Message']) {
          console.error(`[enhanced-stock-data.js] Global Quote error: ${globalData['Error Message']}`);
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
              error: `Alpha Vantage API error: ${globalData['Error Message']}`,
              details: 'Please check if the symbol is correct'
            })
          };
        } else {
          console.error(`[enhanced-stock-data.js] No valid data in Global Quote response`);
        }
      } catch (error) {
        console.error(`[enhanced-stock-data.js] Global Quote fetch failed: ${error.message}`);
      }
    }

    // Strategy 3: If symbol might be a futures contract, try direct futures data
    if (!stockData && (symbol.includes('=F') || marketSession === 'Futures Open')) {
      try {
        console.log(`[enhanced-stock-data.js] Attempting futures data for ${symbol}`);
        
        // For futures, we might need to use a different approach or proxy ETFs
        const futuresProxyMap = {
          'ES=F': 'SPY',   // S&P 500 futures -> SPY ETF
          'NQ=F': 'QQQ',   // NASDAQ futures -> QQQ ETF
          'YM=F': 'DIA',   // Dow futures -> DIA ETF
          'RTY=F': 'IWM'   // Russell 2000 futures -> IWM ETF
        };
        
        const proxySymbol = futuresProxyMap[symbol] || symbol;
        
        if (proxySymbol !== symbol) {
          console.log(`[enhanced-stock-data.js] Using proxy ${proxySymbol} for futures ${symbol}`);
          
          const proxyUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${proxySymbol}&apikey=${API_KEY}`;
          const proxyResponse = await fetch(proxyUrl);
          const proxyData = await proxyResponse.json();
          
          if (proxyData['Global Quote'] && proxyData['Global Quote']['05. price']) {
            const quote = proxyData['Global Quote'];
            
            // Apply a multiplier for futures prices based on ETF
            let multiplier = 1;
            if (symbol === 'ES=F') multiplier = 10;  // Approximate ES=F from SPY
            if (symbol === 'YM=F') multiplier = 100; // Approximate YM=F from DIA
            
            const price = parseFloat(quote['05. price']) * multiplier;
            const change = parseFloat(quote['09. change']) * multiplier;
            
            stockData = {
              symbol: symbol.toUpperCase(),
              price: price.toFixed(2),
              change: change.toFixed(2),
              changePercent: quote['10. change percent'],
              volume: parseInt(quote['06. volume'] || 0).toLocaleString(),
              lastUpdated: quote['07. latest trading day'],
              marketSession: 'Futures Open',
              dataSource: 'Futures Proxy',
              isRealTime: false,
              timestamp: new Date().toISOString()
            };
            
            fetchedDataType = 'futures_proxy';
            console.log(`[enhanced-stock-data.js] Successfully estimated futures data for ${symbol} using ${proxySymbol}`);
          }
        }
      } catch (error) {
        console.error(`[enhanced-stock-data.js] Futures data fetch failed: ${error.message}`);
      }
    }

    // Strategy 4: Daily data as a last resort
    if (!stockData) {
      try {
        const dailyUrl = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&outputsize=compact&apikey=${API_KEY}`;
        console.log(`[enhanced-stock-data.js] Falling back to daily data for ${symbol}`);

        const dailyResponse = await fetch(dailyUrl);
        const dailyData = await dailyResponse.json();

        if (dailyData['Time Series (Daily)'] && Object.keys(dailyData['Time Series (Daily)']).length > 0) {
          const timestamps = Object.keys(dailyData['Time Series (Daily)']).sort().reverse();
          const latestTimestamp = timestamps[0];
          const previousTimestamp = timestamps[1] || latestTimestamp;
          
          const latestData = dailyData['Time Series (Daily)'][latestTimestamp];
          const previousData = dailyData['Time Series (Daily)'][previousTimestamp];
          
          if (latestData) {
            const currentPrice = parseFloat(latestData['4. close']);
            const previousPrice = parseFloat(previousData['4. close']);
            const change = currentPrice - previousPrice;
            const changePercent = ((change / previousPrice) * 100).toFixed(2) + '%';
            
            stockData = {
              symbol: symbol.toUpperCase(),
              price: parseFloat(latestData['4. close']).toFixed(2),
              open: parseFloat(latestData['1. open']).toFixed(2),
              high: parseFloat(latestData['2. high']).toFixed(2),
              low: parseFloat(latestData['3. low']).toFixed(2),
              volume: parseInt(latestData['5. volume'] || 0).toLocaleString(),
              change: change.toFixed(2),
              changePercent: changePercent,
              lastUpdated: latestTimestamp,
              marketSession: marketSession,
              dataSource: 'Daily',
              isRealTime: false,
              timestamp: new Date().toISOString()
            };
            
            fetchedDataType = 'daily';
            console.log(`[enhanced-stock-data.js] Successfully fetched daily data for ${symbol}`);
          }
        } else if (dailyData['Error Message']) {
          console.error(`[enhanced-stock-data.js] Daily data error: ${dailyData['Error Message']}`);
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ 
              error: `Could not find data for symbol: ${symbol}`,
              details: dailyData['Error Message']
            })
          };
        }
      } catch (error) {
        console.error(`[enhanced-stock-data.js] Daily data fetch failed: ${error.message}`);
      }
    }

    // If detailed flag is set, fetch additional data
    if (event.queryStringParameters?.detailed === 'true' && stockData) {
      try {
        // Fetch technical indicators like RSI
        const rsiUrl = `https://www.alphavantage.co/query?function=RSI&symbol=${symbol}&interval=daily&time_period=14&series_type=close&apikey=${API_KEY}`;
        const rsiResponse = await fetch(rsiUrl);
        
        if (rsiResponse.ok) {
          const rsiData = await rsiResponse.json();
          const technicalAnalysis = rsiData['Technical Analysis: RSI'];
          
          if (technicalAnalysis) {
            const dates = Object.keys(technicalAnalysis).sort().reverse();
            if (dates.length > 0) {
              const latestDate = dates[0];
              const rsiValue = parseFloat(technicalAnalysis[latestDate]['RSI']);
              
              stockData.technicals = {
                ...stockData.technicals,
                rsi: {
                  value: rsiValue.toFixed(2),
                  signal: rsiValue > 70 ? 'overbought' : rsiValue < 30 ? 'oversold' : 'neutral',
                  date: latestDate
                }
              };
            }
          }
        }
        
        // Fetch SMA (Simple Moving Averages)
        const sma50Url = `https://www.alphavantage.co/query?function=SMA&symbol=${symbol}&interval=daily&time_period=50&series_type=close&apikey=${API_KEY}`;
        const sma50Response = await fetch(sma50Url);
        
        if (sma50Response.ok) {
          const sma50Data = await sma50Response.json();
          const technicalAnalysis = sma50Data['Technical Analysis: SMA'];
          
          if (technicalAnalysis) {
            const dates = Object.keys(technicalAnalysis).sort().reverse();
            if (dates.length > 0) {
              const latestDate = dates[0];
              const sma50Value = parseFloat(technicalAnalysis[latestDate]['SMA']);
              
              if (!stockData.technicals) {
                stockData.technicals = {};
              }
              
              if (!stockData.technicals.sma) {
                stockData.technicals.sma = {};
              }
              
              stockData.technicals.sma['50'] = {
                value: sma50Value.toFixed(2),
                date: latestDate
              };
            }
          }
        }
        
        // Add a short delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Fetch company overview for additional details
        const overviewUrl = `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${symbol}&apikey=${API_KEY}`;
        const overviewResponse = await fetch(overviewUrl);
        
        if (overviewResponse.ok) {
          const overviewData = await overviewResponse.json();
          
          if (overviewData.Name) {
            stockData.companyInfo = {
              name: overviewData.Name,
              sector: overviewData.Sector,
              industry: overviewData.Industry,
              description: overviewData.Description,
              exchange: overviewData.Exchange,
              marketCap: overviewData.MarketCapitalization,
              peRatio: overviewData.PERatio,
              dividend: overviewData.DividendYield,
              eps: overviewData.EPS
            };
          }
        }
        
        // Fetch news related to the stock
        try {
          const newsUrl = `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers=${symbol}&apikey=${API_KEY}&limit=5`;
          const newsResponse = await fetch(newsUrl);
          
          if (newsResponse.ok) {
            const newsData = await newsResponse.json();
            
            if (newsData.feed && newsData.feed.length > 0) {
              stockData.news = newsData.feed.slice(0, 3).map(article => ({
                title: article.title,
                url: article.url,
                source: article.source,
                summary: article.summary,
                sentiment: article.overall_sentiment_score,
                time: article.time_published
              }));
            }
          }
        } catch (newsError) {
          console.warn(`[enhanced-stock-data.js] News fetch failed: ${newsError.message}`);
        }
        
      } catch (detailedError) {
        console.warn(`[enhanced-stock-data.js] Detailed data fetch failed: ${detailedError.message}`);
      }
    }

    // If we still don't have stock data, return an error
    if (!stockData) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ 
          error: `Could not fetch data for symbol: ${symbol}`,
          details: 'Data not available from any source'
        })
      };
    }

    console.log(`[enhanced-stock-data.js] Successfully returned ${fetchedDataType} data for ${symbol}`);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(stockData)
    };
    
  } catch (error) {
    console.error(`[enhanced-stock-data.js] Error: ${error.message}`);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Error fetching stock data',
        details: error.message
      })
    };
  }
};// netlify/functions/enhanced-stock-data.js
// Enhanced stock data with real-time, pre-market, futures support

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

  const symbol = event.queryStringParameters?.symbol;
  if (!symbol) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Symbol parameter is required' })
    };
  }

  try {
    console.log(`[enhanced-stock-data.js] Fetching enhanced data for ${symbol}...`);
    const API_KEY = process.env.ALPHA_VANTAGE_API_KEY;

    if (!API_KEY) {
      console.error("[enhanced-stock-data.js] ALPHA_VANTAGE_API_KEY environment variable is not set.");
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Alpha Vantage API key is not configured.' })
      };
    }

    // Enhanced market session detection
    const now = new Date();
    const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
    const est = new Date(utcTime + (-5 * 3600000)); // EST timezone
    const hours = est.getHours();
    const minutes = est.getMinutes();
    const day = est.getDay(); // 0 = Sunday, 6 = Saturday
    const totalMinutes = hours * 60 + minutes;
    
    let marketSession = 'Market Closed';
    let dataSource = 'daily';
    let dataInterval = '5min';
    
    if (day === 0) { // Sunday
      if (hours >= 18) {
        marketSession = 'Futures Open';
        dataSource = 'intraday';
        dataInterval = '5min';
      } else {
        marketSession = 'Weekend';
        dataSource = 'daily';
      }
    } else if (day === 6) { // Saturday
      marketSession = 'Weekend';
      dataSource = 'daily';
    } else { // Monday-Friday
      if (totalMinutes >= 240 && totalMinutes < 570) { // 4:00 AM - 9:30 AM
        marketSession = 'Pre-Market';
        dataSource = 'intraday';
        dataInterval = '5min';
      } else if (totalMinutes >= 570 && totalMinutes < 960) { // 9:30 AM - 4:00 PM
        marketSession = 'Market Open';
        dataSource = 'realtime';
        dataInterval = '1min';
      } else if (totalMinutes >= 960 && totalMinutes < 1200) { // 4:00 PM - 8:00 PM
        marketSession = 'After Hours';
        dataSource = 'intraday';
        dataInterval = '5min';
      } else { // 8:00 PM - 4:00 AM
        marketSession = 'Futures Open';
        dataSource = 'intraday';
        dataInterval = '15min';
      }
    }
    
    console.log(`[enhanced-stock-data.js] Detected session: ${marketSession}, data source: ${dataSource}`);
    
    let stockData = null;
    let fetchedDataType = null;
    
    // Strategy 1: Try intraday data for most current price
    if (dataSource === 'intraday' || dataSource === 'realtime') {
      try {
        const intradayUrl = `https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${symbol}&interval=${dataInterval}&outputsize=compact&apikey=${API_KEY}`;
        console.log(`[enhanced-stock-data.js] Fetching intraday data: ${intradayUrl}`);
        
        const intradayResponse = await fetch(intradayUrl);
        const intradayData = await intradayResponse.json();
        
        const timeSeriesKey = `Time Series (${dataInterval})`;
        
        if (intradayData[timeSeriesKey] && Object.keys(intradayData[timeSeriesKey]).length > 0) {
          // Get the most recent data point
          const timestamps = Object.keys(intradayData[timeSeriesKey]).sort().reverse();
          const latestTimestamp = timestamps[0];
          const latestData = intradayData[timeSeriesKey][latestTimestamp];
          
          // Get previous closing price from metadata or use the last closing price
          let previousClose = null;
          if (intradayData['Meta Data'] && intradayData['Meta Data']['4. Previous Close']) {
            previousClose = parseFloat(intradayData['Meta Data']['4. Previous Close']);
          } else if (timestamps.length > 1) {
            const previousTimestamp = timestamps[1];
            previousClose = parseFloat(intradayData[timeSeriesKey][previousTimestamp]['4. close']);
          }
          
          if (latestData) {
            const currentPrice = parseFloat(latestData['4. close']);
            let change = 0;
            let changePercent = '0.00%';
            
            if (previousClose !== null) {
              change = currentPrice - previousClose;
              changePercent = ((change / previousClose) * 100).toFixed(2) + '%';
            }
            
            stockData = {
              symbol: symbol.toUpperCase(),
              price: parseFloat(latestData['4. close']).toFixed(2),
              open: parseFloat(latestData['1. open']).toFixed(2),
              high: parseFloat(latestData['2. high']).toFixed(2),
              low: parseFloat(latestData['3. low']).toFixed(2),
              volume: parseInt(latestData['5. volume'] || 0).toLocaleString(),
              change: change.toFixed(2),
              changePercent: changePercent,
              lastUpdated: latestTimestamp,
              marketSession: marketSession,
              dataSource: `Intraday ${dataInterval}`,
              isRealTime: dataSource === 'realtime',
              timestamp: new Date().toISOString()
            };
            
            fetchedDataType = `intraday_${dataInterval}`;
            console.log(`[enhanced-stock-data.js] Successfully fetched intraday data for ${symbol}`);
          }
        } else if (intradayData['Note']) {
          console.warn(`[enhanced-stock-data.js] Alpha Vantage rate limit: ${intradayData['Note']}`);
        } else if (intradayData['Error Message']) {
          console.warn(`[enhanced-stock-data.js] Intraday API error: ${intradayData['Error Message']}`);
        }
      } catch (error) {
        console.warn(`[enhanced-stock-data.js] Intraday fetch failed: ${error.message}`);
      }
    }

    // Strategy 2: Fallback to Global Quote if intraday failed or not needed
    if (!stockData) {
      try {
        const globalQuoteUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${API_KEY}`;
        console.log(`[enhanced-stock-data.js] Falling back to Global Quote for ${symbol}`);

        const globalResponse = await fetch(globalQuoteUrl);
        const globalData = await globalResponse.json();

        if (globalData['Global Quote'] && globalData['Global Quote']['05. price']) {
          const quote = globalData['Global Quote'];
          
          stockData = {
            symbol: symbol.toUpperCase(),
            price: parseFloat(quote['05. price']).toFixed(2),
            open: parseFloat(quote['02. open']).toFixed(2),
            high: parseFloat(quote['03. high']).toFixed(2),
            low: parseFloat(quote['04. low']).toFixed(2),
            volume: parseInt(quote['06. volume'] || 0).toLocaleString(),
            change: parseFloat(quote['09. change'] || 0).toFixed(2),
            changePercent: quote['10. change percent'] || '0.00%',
            lastUpdated: quote['07. latest trading day'],
            marketSession: marketSession,
            dataSource: 'Global Quote',
            isRealTime: false,
            timestamp: new Date().toISOString()
          };
          
          fetchedDataType = 'global_quote';
          console.log(`[enhanced-stock-data.js] Successfully fetched Global Quote for ${symbol}`);
        } else if (globalData['Error Message']) {
          console.error(`[enhanced-stock-data.js] Global Quote error: ${globalData['Error Message']}`);
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
              error: `Alpha Vantage API error: ${globalData['Error Message']}`,
              details: 'Please check if the symbol is correct'
            })
          };
        } else {
          console.error(`[enhanced-stock-data.js] No valid data in Global Quote response`);
        }
      } catch (error) {
        console.error(`[enhanced-stock-data.js] Global Quote fetch failed: ${error.message}`);
      }
    }

    // Strategy 3: If symbol might be a futures contract, try direct futures data
    if (!stockData && (symbol.includes('=F') || marketSession === 'Futures Open')) {
      try {
        console.log(`[enhanced-stock-data.js] Attempting futures data for ${symbol}`);
        
        // For futures, we might need to use a different approach or proxy ETFs
        const futuresProxyMap = {
          'ES=F': 'SPY',   // S&P 500 futures -> SPY ETF
          'NQ=F': 'QQQ',   // NASDAQ futures -> QQQ ETF
          'YM=F': 'DIA',   // Dow futures -> DIA ETF
          'RTY=F': 'IWM'   // Russell 2000 futures -> IWM ETF
        };
        
        const proxySymbol = futuresProxyMap[symbol] || symbol;
        
        if (proxySymbol !== symbol) {
          console.log(`[enhanced-stock-data.js] Using proxy ${proxySymbol} for futures ${symbol}`);
          
          const proxyUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${proxySymbol}&apikey=${API_KEY}`;
          const proxyResponse = await fetch(proxyUrl);
          const proxyData = await proxyResponse.json();
          
          if (proxyData['Global Quote'] && proxyData['Global Quote']['05. price']) {
            const quote = proxyData['Global Quote'];
            
            // Apply a multiplier for futures prices based on ETF
            let multiplier = 1;
            if (symbol === 'ES=F') multiplier = 10;  // Approximate ES=F from SPY
            if (symbol === 'YM=F') multiplier = 100; // Approximate YM=F from DIA
            
            const price = parseFloat(quote['05. price']) * multiplier;
            const change = parseFloat(quote['09. change']) * multiplier;
            
            stockData = {
              symbol: symbol.toUpperCase(),
              price: price.toFixed(2),
              change: change.toFixed(2),
              changePercent: quote['10. change percent'],
              volume: parseInt(quote['06. volume'] || 0).toLocaleString(),
              lastUpdated: quote['07. latest trading day'],
              marketSession: 'Futures Open',
              dataSource: 'Futures Proxy',
              isRealTime: false,
              timestamp: new Date().toISOString()
            };
            
            fetchedDataType = 'futures_proxy';
            console.log(`[enhanced-stock-data.js] Successfully estimated futures data for ${symbol} using ${proxySymbol}`);
          }
        }
      } catch (error) {
        console.error(`[enhanced-stock-data.js] Futures data fetch failed: ${error.message}`);
      }
    }

    // Strategy 4: Daily data as a last resort
    if (!stockData) {
      try {
        const dailyUrl = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&outputsize=compact&apikey=${API_KEY}`;
        console.log(`[enhanced-stock-data.js] Falling back to daily data for ${symbol}`);

        const dailyResponse = await fetch(dailyUrl);
        const dailyData = await dailyResponse.json();

        if (dailyData['Time Series (Daily)'] && Object.keys(dailyData['Time Series (Daily)']).length > 0) {
          const timestamps = Object.keys(dailyData['Time Series (Daily)']).sort().reverse();
          const latestTimestamp = timestamps[0];
          const previousTimestamp = timestamps[1] || latestTimestamp;
          
          const latestData = dailyData['Time Series (Daily)'][latestTimestamp];
          const previousData = dailyData['Time Series (Daily)'][previousTimestamp];
          
          if (latestData) {
            const currentPrice = parseFloat(latestData['4. close']);
            const previousPrice = parseFloat(previousData['4. close']);
            const change = currentPrice - previousPrice;
            const changePercent = ((change / previousPrice) * 100).toFixed(2) + '%';
            
            stockData = {
              symbol: symbol.toUpperCase(),
              price: parseFloat(latestData['4. close']).toFixed(2),
              open: parseFloat(latestData['1. open']).toFixed(2),
              high: parseFloat(latestData['2. high']).toFixed(2),
              low: parseFloat(latestData['3. low']).toFixed(2),
              volume: parseInt(latestData['5. volume'] || 0).toLocaleString(),
              change: change.toFixed(2),
              changePercent: changePercent,
              lastUpdated: latestTimestamp,
              marketSession: marketSession,
              dataSource: 'Daily',
              isRealTime: false,
              timestamp: new Date().toISOString()
            };
            
            fetchedDataType = 'daily';
            console.log(`[enhanced-stock-data.js] Successfully fetched daily data for ${symbol}`);
          }
        } else if (dailyData['Error Message']) {
          console.error(`[enhanced-stock-data.js] Daily data error: ${dailyData['Error Message']}`);
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ 
              error: `Could not find data for symbol: ${symbol}`,
              details: dailyData['Error Message']
            })
          };
        }
      } catch (error) {
        console.error(`[enhanced-stock-data.js] Daily data fetch failed: ${error.message}`);
      }
    }

    // If detailed flag is set, fetch additional data
    if (event.queryStringParameters?.detailed === 'true' && stockData) {
      try {
        // Fetch technical indicators like RSI
        const rsiUrl = `https://www.alphavantage.co/query?function=RSI&symbol=${symbol}&interval=daily&time_period=14&series_type=close&apikey=${API_KEY}`;
        const rsiResponse = await fetch(rsiUrl);
        
        if (rsiResponse.ok) {
          const rsiData = await rsiResponse.json();
          const technicalAnalysis = rsiData['Technical Analysis: RSI'];
          
          if (technicalAnalysis) {
            const dates = Object.keys(technicalAnalysis).sort().reverse();
            if (dates.length > 0) {
              const latestDate = dates[0];
              const rsiValue = parseFloat(technicalAnalysis[latestDate]['RSI']);
              
              stockData.technicals = {
                ...stockData.technicals,
                rsi: {
                  value: rsiValue.toFixed(2),
                  signal: rsiValue > 70 ? 'overbought' : rsiValue < 30 ? 'oversold' : 'neutral',
                  date: latestDate
                }
              };
            }
          }
        }
        
        // Add more detailed data here (e.g. SMA, company overview, etc.)
        // ...
