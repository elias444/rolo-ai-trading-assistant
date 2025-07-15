// netlify/functions/comprehensive-ai-analysis.js
// COMPLETE: Working comprehensive AI analysis with ALL data sources

const { GoogleGenerativeAI } = require('@google/generative-ai');

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    const { symbol, type = 'analysis' } = JSON.parse(event.body || '{}');
    
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY;

    if (!GEMINI_API_KEY || !ALPHA_VANTAGE_API_KEY) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'API keys not configured' })
        };
    }

    try {
        console.log(`[comprehensive-ai-analysis.js] Starting ${type} analysis for ${symbol || 'market'}...`);
        
        const marketData = {
            timestamp: new Date().toISOString(),
            dataSource: 'comprehensive-realtime'
        };

        // === MARKET SESSION DETECTION ===
        const now = new Date();
        const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
        const est = new Date(utcTime + (-5 * 3600000));
        const hours = est.getHours();
        const day = est.getDay();
        const totalMinutes = hours * 60 + est.getMinutes();
        
        let marketSession = 'Market Closed';
        
        if (day === 0 && hours >= 18) {
            marketSession = 'Futures Open';
        } else if (day === 6) {
            marketSession = 'Weekend';
        } else if (day >= 1 && day <= 5) {
            if (totalMinutes >= 240 && totalMinutes < 570) {
                marketSession = 'Pre-Market';
            } else if (totalMinutes >= 570 && totalMinutes < 960) {
                marketSession = 'Market Open';
            } else if (totalMinutes >= 960 && totalMinutes < 1200) {
                marketSession = 'After Hours';
            } else if (totalMinutes >= 1080 || totalMinutes < 240) {
                marketSession = 'Futures Open';
            }
        }
        
        marketData.marketSession = marketSession;
        marketData.estTime = est.toLocaleString();

        console.log(`[comprehensive-ai-analysis.js] Market session: ${marketSession}`);

        // === 1. ALPHA VANTAGE STOCK DATA ===
        if (symbol) {
            try {
                console.log(`[comprehensive-ai-analysis.js] Fetching stock data for ${symbol}...`);
                const stockUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${ALPHA_VANTAGE_API_KEY}`;
                const stockResponse = await fetch(stockUrl);
                const stockData = await stockResponse.json();
                
                if (stockData['Global Quote'] && stockData['Global Quote']['05. price']) {
                    marketData.currentStock = {
                        symbol: symbol,
                        price: parseFloat(stockData['Global Quote']['05. price']).toFixed(2),
                        change: parseFloat(stockData['Global Quote']['09. change'] || 0).toFixed(2),
                        changePercent: stockData['Global Quote']['10. change percent'] || '0.00%',
                        volume: parseInt(stockData['Global Quote']['06. volume'] || 0).toLocaleString(),
                        high: parseFloat(stockData['Global Quote']['03. high']).toFixed(2),
                        low: parseFloat(stockData['Global Quote']['04. low']).toFixed(2),
                        open: parseFloat(stockData['Global Quote']['02. open']).toFixed(2),
                        timestamp: stockData['Global Quote']['07. latest trading day']
                    };
                    console.log(`[comprehensive-ai-analysis.js] ✅ Stock data for ${symbol}: $${marketData.currentStock.price}`);
                }
            } catch (e) {
                console.warn(`[comprehensive-ai-analysis.js] Stock data failed for ${symbol}:`, e.message);
            }
        }

        // === 2. YAHOO FINANCE DATA ===
        if (symbol) {
            try {
                console.log(`[comprehensive-ai-analysis.js] Fetching Yahoo Finance data for ${symbol}...`);
                const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`;
                const yahooResponse = await fetch(yahooUrl);
                const yahooData = await yahooResponse.json();
                
                if (yahooData.chart && yahooData.chart.result && yahooData.chart.result[0]) {
                    const result = yahooData.chart.result[0];
                    const meta = result.meta;
                    
                    marketData.yahooFinanceStock = {
                        symbol: symbol,
                        price: meta.regularMarketPrice?.toFixed(2) || 'N/A',
                        change: (meta.regularMarketPrice - meta.previousClose)?.toFixed(2) || 'N/A',
                        changePercent: `${(((meta.regularMarketPrice - meta.previousClose) / meta.previousClose) * 100).toFixed(2)}%`,
                        volume: meta.regularMarketVolume?.toLocaleString() || 'N/A',
                        preMarketPrice: meta.preMarketPrice?.toFixed(2) || null,
                        postMarketPrice: meta.postMarketPrice?.toFixed(2) || null,
                        timestamp: new Date().toISOString(),
                        source: 'Yahoo Finance Free API'
                    };
                    console.log(`[comprehensive-ai-analysis.js] ✅ Yahoo Finance: ${symbol} = $${marketData.yahooFinanceStock.price}`);
                }
            } catch (e) {
                console.warn(`[comprehensive-ai-analysis.js] Yahoo Finance failed for ${symbol}:`, e.message);
            }
        }

        // === 3. STOCKTWITS DATA ===
        if (symbol) {
            try {
                console.log(`[comprehensive-ai-analysis.js] Fetching StockTwits data for ${symbol}...`);
                const stocktwitsUrl = `https://api.stocktwits.com/api/2/streams/symbol/${symbol}.json`;
                const stocktwitsResponse = await fetch(stocktwitsUrl);
                const stocktwitsData = await stocktwitsResponse.json();
                
                if (stocktwitsData.messages && stocktwitsData.messages.length > 0) {
                    const messages = stocktwitsData.messages.slice(0, 20);
                    
                    let bullishCount = 0;
                    let bearishCount = 0;
                    let totalSentiment = 0;
                    
                    messages.forEach(msg => {
                        if (msg.entities && msg.entities.sentiment) {
                            if (msg.entities.sentiment.basic === 'Bullish') bullishCount++;
                            if (msg.entities.sentiment.basic === 'Bearish') bearishCount++;
                            totalSentiment++;
                        }
                    });
                    
                    marketData.stockTwitsSentiment = {
                        symbol: symbol,
                        totalMessages: messages.length,
                        bullishCount: bullishCount,
                        bearishCount: bearishCount,
                        totalWithSentiment: totalSentiment,
                        bullishPercent: totalSentiment > 0 ? ((bullishCount / totalSentiment) * 100).toFixed(1) : 0,
                        bearishPercent: totalSentiment > 0 ? ((bearishCount / totalSentiment) * 100).toFixed(1) : 0,
                        source: 'StockTwits Public API',
                        timestamp: new Date().toISOString()
                    };
                    console.log(`[comprehensive-ai-analysis.js] ✅ StockTwits: ${symbol} - ${bullishCount} bullish, ${bearishCount} bearish`);
                }
            } catch (e) {
                console.warn(`[comprehensive-ai-analysis.js] StockTwits failed for ${symbol}:`, e.message);
            }
        }

        // === 4. NEWS DATA ===
        try {
            console.log(`[comprehensive-ai-analysis.js] Fetching news data...`);
            const newsUrl = `https://www.alphavantage.co/query?function=NEWS_SENTIMENT${symbol ? `&tickers=${symbol}` : ''}&topics=financial_markets,economy_macro,technology&sort=LATEST&limit=50&apikey=${ALPHA_VANTAGE_API_KEY}`;
            const newsResponse = await fetch(newsUrl);
            const newsData = await newsResponse.json();
            
            if (newsData.feed && newsData.feed.length > 0) {
                marketData.news = newsData.feed.slice(0, 20);
                
                const sentimentScores = newsData.feed
                    .map(article => parseFloat(article.overall_sentiment_score))
                    .filter(score => !isNaN(score));
                
                if (sentimentScores.length > 0) {
                    const avgSentiment = sentimentScores.reduce((a, b) => a + b, 0) / sentimentScores.length;
                    marketData.sentiment = {
                        score: avgSentiment.toFixed(3),
                        label: avgSentiment > 0.15 ? 'Very Bullish' : 
                               avgSentiment > 0.05 ? 'Bullish' :
                               avgSentiment < -0.15 ? 'Very Bearish' :
                               avgSentiment < -0.05 ? 'Bearish' : 'Neutral',
                        articleCount: sentimentScores.length
                    };
                }
                console.log(`[comprehensive-ai-analysis.js] ✅ News: ${newsData.feed.length} articles, sentiment: ${marketData.sentiment?.label}`);
            }
        } catch (e) {
            console.warn(`[comprehensive-ai-analysis.js] News failed:`, e.message);
        }

        // === 5. TOP GAINERS/LOSERS ===
        try {
            console.log(`[comprehensive-ai-analysis.js] Fetching market movers...`);
            const moversUrl = `https://www.alphavantage.co/query?function=TOP_GAINERS_LOSERS&apikey=${ALPHA_VANTAGE_API_KEY}`;
            const moversResponse = await fetch(moversUrl);
            const moversData = await moversResponse.json();
            
            if (moversData.top_gainers && moversData.top_losers) {
                marketData.topGainers = moversData.top_gainers.slice(0, 10);
                marketData.topLosers = moversData.top_losers.slice(0, 10);
                console.log(`[comprehensive-ai-analysis.js] ✅ Market movers: ${marketData.topGainers.length} gainers, ${marketData.topLosers.length} losers`);
            }
        } catch (e) {
            console.warn(`[comprehensive-ai-analysis.js] Market movers failed:`, e.message);
        }

        // === 6. VIX DATA ===
        try {
            console.log(`[comprehensive-ai-analysis.js] Fetching VIX data...`);
            const vixUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=VIX&apikey=${ALPHA_VANTAGE_API_KEY}`;
            const vixResponse = await fetch(vixUrl);
            const vixData = await vixResponse.json();
            
            if (vixData['Global Quote'] && vixData['Global Quote']['05. price']) {
                const vixPrice = parseFloat(vixData['Global Quote']['05. price']);
                marketData.volatility = {
                    vix: {
                        price: vixPrice,
                        change: parseFloat(vixData['Global Quote']['09. change'] || 0),
                        changePercent: vixData['Global Quote']['10. change percent'] || '0.00%',
                        level: vixPrice > 30 ? 'Very High' : vixPrice > 25 ? 'High' : vixPrice > 20 ? 'Elevated' : 'Normal'
                    }
                };
                console.log(`[comprehensive-ai-analysis.js] ✅ VIX: ${vixPrice} (${marketData.volatility.vix.level})`);
            }
        } catch (e) {
            console.warn(`[comprehensive-ai-analysis.js] VIX failed:`, e.message);
        }

        // === 7. TECHNICAL INDICATORS ===
        if (symbol) {
            try {
                console.log(`[comprehensive-ai-analysis.js] Fetching RSI for ${symbol}...`);
                const rsiUrl = `https://www.alphavantage.co/query?function=RSI&symbol=${symbol}&interval=daily&time_period=14&series_type=close&apikey=${ALPHA_VANTAGE_API_KEY}`;
                const rsiResponse = await fetch(rsiUrl);
                const rsiData = await rsiResponse.json();
                
                if (rsiData['Technical Analysis: RSI']) {
                    const latestDate = Object.keys(rsiData['Technical Analysis: RSI'])[0];
                    const rsiValue = parseFloat(rsiData['Technical Analysis: RSI'][latestDate]['RSI']);
                    marketData.technicals = {
                        rsi: {
                            value: rsiValue,
                            signal: rsiValue > 70 ? 'Overbought' : rsiValue < 30 ? 'Oversold' : 'Neutral',
                            date: latestDate
                        }
                    };
                    console.log(`[comprehensive-ai-analysis.js] ✅ RSI for ${symbol}: ${rsiValue} (${marketData.technicals.rsi.signal})`);
                }
            } catch (e) {
                console.warn(`[comprehensive-ai-analysis.js] RSI failed:`, e.message);
            }
        }

        // === 8. REDDIT DATA ===
        try {
            console.log(`[comprehensive-ai-analysis.js] Fetching Reddit data...`);
            const redditUrl = `https://www.reddit.com/r/investing+stocks+SecurityAnalysis+ValueInvesting+StockMarket/search.json?q=${symbol || 'stock market'}&sort=new&limit=25&t=day`;
            const redditResponse = await fetch(redditUrl, {
                headers: { 'User-Agent': 'RoloTradingBot/1.0' }
            });
            const redditData = await redditResponse.json();
            
            if (redditData.data && redditData.data.children) {
                const posts = redditData.data.children.slice(0, 15);
                marketData.redditSentiment = {
                    symbol: symbol || 'market',
                    totalPosts: posts.length,
                    posts: posts.map(post => ({
                        title: post.data.title,
                        score: post.data.score,
                        comments: post.data.num_comments,
                        subreddit: post.data.subreddit
                    })),
                    averageScore: posts.reduce((sum, post) => sum + post.data.score, 0) / posts.length,
                    source: 'Reddit Free API'
                };
                console.log(`[comprehensive-ai-analysis.js] ✅ Reddit: ${posts.length} posts, avg score: ${marketData.redditSentiment.averageScore.toFixed(1)}`);
            }
        } catch (e) {
            console.warn(`[comprehensive-ai-analysis.js] Reddit failed:`, e.message);
        }

        // === AI ANALYSIS ===
        console.log(`[comprehensive-ai-analysis.js] Processing with Gemini AI...`);
        
        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        let prompt = '';
        
        if (type === 'analysis') {
            prompt = `You are Rolo, an expert AI trading analyst. Analyze ${symbol || 'the market'} using this REAL data:

DATA AVAILABLE:
${JSON.stringify(marketData, null, 2)}

Provide analysis in JSON format:
{
  "summary": "2-3 sentence summary based on real data",
  "marketEnvironment": {
    "session": "${marketSession}",
    "volatility": "VIX level assessment",
    "sentiment": "news sentiment analysis",
    "keyDrivers": ["driver1", "driver2", "driver3"]
  },
  "technicalAnalysis": {
    "trend": "bullish/bearish/neutral",
    "strength": "strong/moderate/weak",
    "keyLevels": {
      "support": ["price1", "price2"],
      "resistance": ["price1", "price2"]
    },
    "indicators": {
      "rsi": {"value": ${marketData.technicals?.rsi?.value || 'null'}, "signal": "${marketData.technicals?.rsi?.signal || 'unavailable'}"}
    }
  },
  "recommendation": {
    "action": "buy/sell/hold",
    "confidence": 75,
    "strategy": "specific strategy",
    "catalysts": ["catalyst1", "catalyst2"],
    "risks": ["risk1", "risk2"]
  }
}

CRITICAL: Base analysis ONLY on the real data provided. Use actual numbers and sentiment scores.`;

        } else if (type === 'smartplays') {
            prompt = `Generate smart trading plays based ONLY on this REAL market data:

${JSON.stringify(marketData, null, 2)}

Format as JSON:
{
  "timestamp": "${new Date().toISOString()}",
  "marketCondition": "assessment based on real data",
  "sessionContext": "${marketSession}",
  "plays": [
    {
      "id": 1,
      "emoji": "📈",
      "title": "play based on real market movers",
      "ticker": "REAL ticker from data",
      "playType": "stock",
      "strategy": "momentum/breakout",
      "confidence": 80,
      "timeframe": "short-term",
      "entry": {"price": 150.00, "reasoning": "based on real data"},
      "stopLoss": {"price": 145.00, "reasoning": "support level"},
      "targets": [{"price": 160.00, "probability": 70}],
      "reasoning": "detailed reasoning using real data points"
    }
  ]
}

CRITICAL: Only generate plays if strong real data supports them. Return empty plays array if insufficient data.`;

        } else if (type === 'alerts') {
            prompt = `Generate alerts based ONLY on this REAL market data:

${JSON.stringify(marketData, null, 2)}

Format as JSON:
{
  "timestamp": "${new Date().toISOString()}",
  "sessionContext": "${marketSession}",
  "alerts": [
    {
      "id": 1,
      "type": "breakout/news/volume",
      "priority": "high/medium/low",
      "ticker": "REAL ticker",
      "title": "alert based on real data",
      "description": "detailed description using real data",
      "action": "specific action",
      "confidence": 80
    }
  ]
}

CRITICAL: Only generate alerts for real significant activity. Return empty alerts array if no real activity.`;
        }

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        // Parse AI response
        let analysisResult;
        try {
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                analysisResult = JSON.parse(jsonMatch[0]);
                console.log(`[comprehensive-ai-analysis.js] ✅ Generated ${type} analysis`);
            } else {
                throw new Error('No JSON found in AI response');
            }
        } catch (parseError) {
            console.error('[comprehensive-ai-analysis.js] Failed to parse AI response');
            analysisResult = null;
        }

        // Check if we have sufficient real data
        const hasRealData = marketData.currentStock || 
                           (marketData.topGainers && marketData.topGainers.length > 0) ||
                           (marketData.news && marketData.news.length > 0) ||
                           marketData.volatility;

        if (!hasRealData) {
            console.warn(`[comprehensive-ai-analysis.js] Insufficient real data for ${type} analysis`);
            analysisResult = null;
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                type,
                symbol,
                analysis: analysisResult,
                marketData: {
                    session: marketSession,
                    estTime: est.toLocaleString(),
                    dataFreshness: new Date().toISOString()
                },
                dataQuality: {
                    hasStockData: !!marketData.currentStock,
                    topGainers: marketData.topGainers?.length || 0,
                    topLosers: marketData.topLosers?.length || 0,
                    newsArticles: marketData.news?.length || 0,
                    sentiment: marketData.sentiment?.label || 'Unknown',
                    vixLevel: marketData.volatility?.vix?.price || null,
                    technicals: marketData.technicals ? Object.keys(marketData.technicals).length : 0
                },
                timestamp: new Date().toISOString()
            })
        };

    } catch (error) {
        console.error(`[comprehensive-ai-analysis.js] Error:`, error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: "Comprehensive analysis error",
                details: error.message,
                timestamp: new Date().toISOString()
            })
        };
    }
};
