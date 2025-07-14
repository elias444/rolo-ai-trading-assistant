// netlify/functions/comprehensive-ai-analysis.js
// Comprehensive AI analysis with ALL data sources for Rolo

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

    const { symbol, type = 'smartplays' } = JSON.parse(event.body || '{}');
    
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
        console.log(`[comprehensive-ai-analysis.js] Gathering ALL data sources for AI analysis...`);
        
        const marketData = {
            timestamp: new Date().toISOString(),
            dataSource: 'comprehensive'
        };

        // === 1. REAL-TIME STOCK DATA ===
        console.log("Fetching real-time stock data...");
        
        // Get current market status
        const now = new Date();
        const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
        const est = new Date(utcTime + (-5 * 3600000));
        const hours = est.getHours();
        const day = est.getDay();
        const totalMinutes = hours * 60 + est.getMinutes();
        
        let marketSession = 'Closed';
        if (day === 0 || day === 6) {
            marketSession = day === 0 && hours >= 18 ? 'Futures Open' : 'Weekend';
        } else if (totalMinutes >= 240 && totalMinutes < 570) {
            marketSession = 'Pre-Market';
        } else if (totalMinutes >= 570 && totalMinutes < 960) {
            marketSession = 'Market Open';
        } else if (totalMinutes >= 960 && totalMinutes < 1200) {
            marketSession = 'After Hours';
        } else {
            marketSession = 'Futures Open';
        }
        
        marketData.marketSession = marketSession;

        // === 2. TOP GAINERS/LOSERS FOR OPPORTUNITY DETECTION ===
        try {
            const moversResponse = await fetch(`https://www.alphavantage.co/query?function=TOP_GAINERS_LOSERS&apikey=${ALPHA_VANTAGE_API_KEY}`);
            const moversData = await moversResponse.json();
            
            if (moversData.top_gainers && moversData.top_losers) {
                marketData.topGainers = moversData.top_gainers.slice(0, 10);
                marketData.topLosers = moversData.top_losers.slice(0, 10);
                console.log(`Found ${marketData.topGainers.length} top gainers and ${marketData.topLosers.length} top losers`);
            }
        } catch (e) {
            console.warn("Could not fetch market movers:", e.message);
        }

        // === 3. NEWS & SENTIMENT ANALYSIS ===
        console.log("Fetching news and sentiment data...");
        try {
            const newsResponse = await fetch(`https://www.alphavantage.co/query?function=NEWS_SENTIMENT${symbol ? `&tickers=${symbol}` : ''}&limit=20&apikey=${ALPHA_VANTAGE_API_KEY}`);
            const newsData = await newsResponse.json();
            
            if (newsData.feed) {
                marketData.news = newsData.feed.slice(0, 15);
                
                // Calculate overall market sentiment
                const sentimentScores = newsData.feed
                    .map(article => parseFloat(article.overall_sentiment_score))
                    .filter(score => !isNaN(score));
                
                if (sentimentScores.length > 0) {
                    const avgSentiment = sentimentScores.reduce((a, b) => a + b, 0) / sentimentScores.length;
                    marketData.overallSentiment = {
                        score: avgSentiment.toFixed(3),
                        label: avgSentiment > 0.15 ? 'Very Bullish' : 
                               avgSentiment > 0.05 ? 'Bullish' :
                               avgSentiment < -0.15 ? 'Very Bearish' :
                               avgSentiment < -0.05 ? 'Bearish' : 'Neutral',
                        articleCount: sentimentScores.length
                    };
                }
                
                console.log(`Processed ${newsData.feed.length} news articles, sentiment: ${marketData.overallSentiment?.label}`);
            }
        } catch (e) {
            console.warn("Could not fetch news sentiment:", e.message);
        }

        // === 4. VOLATILITY INDEX (VIX) ===
        try {
            const vixResponse = await fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=VIX&apikey=${ALPHA_VANTAGE_API_KEY}`);
            const vixData = await vixResponse.json();
            
            if (vixData['Global Quote']) {
                marketData.vix = {
                    price: parseFloat(vixData['Global Quote']['05. price']),
                    change: parseFloat(vixData['Global Quote']['09. change']),
                    changePercent: parseFloat(vixData['Global Quote']['10. change percent'].replace('%', ''))
                };
                console.log(`VIX: ${marketData.vix.price}, Change: ${marketData.vix.changePercent}%`);
            }
        } catch (e) {
            console.warn("Could not fetch VIX:", e.message);
        }

        // === 5. MAJOR INDICES FOR MARKET DIRECTION ===
        const indices = ['SPY', 'QQQ', 'IWM', 'DIA'];
        marketData.indices = {};
        
        for (const index of indices) {
            try {
                const response = await fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${index}&apikey=${ALPHA_VANTAGE_API_KEY}`);
                const data = await response.json();
                
                if (data['Global Quote']) {
                    marketData.indices[index] = {
                        price: parseFloat(data['Global Quote']['05. price']),
                        change: parseFloat(data['Global Quote']['09. change']),
                        changePercent: parseFloat(data['Global Quote']['10. change percent'].replace('%', ''))
                    };
                }
            } catch (e) {
                console.warn(`Could not fetch ${index}:`, e.message);
            }
        }

        // === 6. SECTOR PERFORMANCE ===
        const sectorETFs = ['XLK', 'XLF', 'XLE', 'XLV', 'XLI', 'XLP', 'XLY', 'XLU', 'XLRE'];
        marketData.sectors = {};
        
        for (const sector of sectorETFs) {
            try {
                const response = await fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${sector}&apikey=${ALPHA_VANTAGE_API_KEY}`);
                const data = await response.json();
                
                if (data['Global Quote']) {
                    marketData.sectors[sector] = {
                        changePercent: parseFloat(data['Global Quote']['10. change percent'].replace('%', ''))
                    };
                }
            } catch (e) {
                console.warn(`Could not fetch sector ${sector}:`, e.message);
            }
        }

        // === 7. ECONOMIC INDICATORS ===
        console.log("Fetching economic indicators...");
        try {
            // Federal Funds Rate
            const fedResponse = await fetch(`https://www.alphavantage.co/query?function=FEDERAL_FUNDS_RATE&interval=monthly&apikey=${ALPHA_VANTAGE_API_KEY}`);
            const fedData = await fedResponse.json();
            if (fedData.data && fedData.data.length > 0) {
                marketData.fedRate = parseFloat(fedData.data[0].value);
            }
            
            // Treasury Yield
            const treasuryResponse = await fetch(`https://www.alphavantage.co/query?function=TREASURY_YIELD&interval=monthly&maturity=10year&apikey=${ALPHA_VANTAGE_API_KEY}`);
            const treasuryData = await treasuryResponse.json();
            if (treasuryData.data && treasuryData.data.length > 0) {
                marketData.treasury10Y = parseFloat(treasuryData.data[0].value);
            }
        } catch (e) {
            console.warn("Could not fetch economic indicators:", e.message);
        }

        // === 8. OPTIONS FLOW ANALYSIS (Simulated based on volatility and volume) ===
        if (marketData.topGainers && marketData.vix) {
            marketData.optionsFlow = {
                callVolume: marketData.vix.price < 20 ? 'High' : marketData.vix.price > 30 ? 'Low' : 'Moderate',
                putVolume: marketData.vix.price > 25 ? 'High' : marketData.vix.price < 15 ? 'Low' : 'Moderate',
                putCallRatio: marketData.vix.price > 25 ? 1.2 : marketData.vix.price < 15 ? 0.7 : 0.9,
                impliedVolatility: marketData.vix.price > 25 ? 'Elevated' : marketData.vix.price < 15 ? 'Compressed' : 'Normal'
            };
        }

        // === 9. CRYPTOCURRENCY CORRELATION ===
        try {
            const btcResponse = await fetch(`https://www.alphavantage.co/query?function=DIGITAL_CURRENCY_DAILY&symbol=BTC&market=USD&apikey=${ALPHA_VANTAGE_API_KEY}`);
            const btcData = await btcResponse.json();
            
            if (btcData['Time Series (Digital Currency Daily)']) {
                const latestDate = Object.keys(btcData['Time Series (Digital Currency Daily)'])[0];
                const btcClose = parseFloat(btcData['Time Series (Digital Currency Daily)'][latestDate]['4a. close (USD)']);
                const btcOpen = parseFloat(btcData['Time Series (Digital Currency Daily)'][latestDate]['1a. open (USD)']);
                
                marketData.crypto = {
                    btcPrice: btcClose,
                    btcChange: ((btcClose - btcOpen) / btcOpen * 100).toFixed(2)
                };
            }
        } catch (e) {
            console.warn("Could not fetch crypto data:", e.message);
        }

        // === 10. SOCIAL SENTIMENT SIMULATION ===
        // Note: In production, you'd integrate with Twitter API, Reddit API, Discord webhooks, etc.
        // For now, we'll simulate based on news sentiment and market moves
        if (marketData.topGainers && marketData.overallSentiment) {
            const strongMovers = marketData.topGainers.filter(stock => parseFloat(stock.change_percentage.replace('%', '')) > 10).length;
            
            marketData.socialSentiment = {
                twitter: marketData.overallSentiment.score > 0.1 ? 'Bullish' : marketData.overallSentiment.score < -0.1 ? 'Bearish' : 'Mixed',
                reddit: strongMovers > 3 ? 'FOMO High' : strongMovers < 1 ? 'Low Activity' : 'Moderate',
                discord: marketData.vix && marketData.vix.price > 25 ? 'Fear Dominant' : 'Optimistic',
                stocktwits: marketData.indices.SPY ? (marketData.indices.SPY.changePercent > 1 ? 'Very Bullish' : marketData.indices.SPY.changePercent < -1 ? 'Very Bearish' : 'Neutral') : 'Neutral'
            };
        }

        // === AI ANALYSIS WITH GEMINI ===
        console.log("Sending comprehensive data to AI for analysis...");
        
        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        let prompt = '';
        
        if (type === 'smartplays') {
            prompt = `You are Rolo, an expert AI trading analyst with access to comprehensive real-time market data. Generate smart trading plays and options strategies based on ALL available data.

COMPREHENSIVE MARKET DATA:
${JSON.stringify(marketData, null, 2)}

CURRENT MARKET CONDITIONS:
- Market Session: ${marketSession}
- Time: ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} EST

ANALYSIS REQUEST: Generate 3-5 smart trading plays (stocks AND options) based on:
1. Real market movers and momentum
2. News sentiment and social sentiment
3. Options flow and volatility conditions
4. Political/economic factors
5. Sector rotation opportunities
6. Technical patterns emerging

For each play, provide:
- Entry strategy (exact prices/strikes)
- Risk management (stop losses)
- Profit targets (multiple levels)
- Options strategies when appropriate (calls, puts, spreads, etc.)
- Timeframe for execution
- Why this opportunity exists NOW

Focus on ACTIONABLE opportunities that exist right now based on the real data provided.

Format as JSON:
{
  "marketCondition": "bullish/bearish/neutral/volatile",
  "overallStrategy": "brief strategy for current conditions",
  "plays": [
    {
      "id": 1,
      "emoji": "appropriate emoji",
      "title": "descriptive title",
      "ticker": "SYMBOL",
      "playType": "stock/options/etf",
      "strategy": "momentum/breakout/mean_reversion/volatility/earnings",
      "confidence": number (60-95),
      "entry": {
        "type": "market/limit",
        "price": number,
        "strike": number (if options),
        "expiration": "date (if options)",
        "optionType": "call/put/spread (if options)"
      },
      "stopLoss": number,
      "targets": [target1, target2, target3],
      "timeframe": "intraday/short-term/medium-term",
      "riskLevel": "low/medium/high",
      "reasoning": "detailed explanation based on the data",
      "catalysts": ["news", "technical", "sentiment", "options_flow"],
      "socialBuzz": "description of social sentiment",
      "newsImpact": "specific news affecting this play",
      "dataSupport": "which data points support this play"
    }
  ],
  "alerts": [
    {
      "type": "breakout/breakdown/volume_spike/news/political/social",
      "priority": "high/medium/low",
      "message": "specific alert description",
      "action": "what to do about it",
      "timeframe": "immediate/hours/days"
    }
  ],
  "marketInsights": {
    "volatilityOutlook": "assessment",
    "sectorRotation": "which sectors to watch",
    "riskFactors": ["factor1", "factor2"],
    "opportunities": ["opportunity1", "opportunity2"]
  }
}

IMPORTANT: Base ALL recommendations on the actual data provided. No generic advice - only specific plays supported by the real market conditions shown in the data.`;

        } else if (type === 'alerts') {
            prompt = `You are Rolo, an expert AI trading analyst. Generate ACTIONABLE alerts based on the comprehensive market data provided.

COMPREHENSIVE MARKET DATA:
${JSON.stringify(marketData, null, 2)}

Generate alerts for:
1. Immediate trading opportunities (price breakouts, volume spikes)
2. News-driven moves (earnings, political events, economic data)
3. Social sentiment shifts (Reddit, Twitter, Discord buzz)
4. Options flow anomalies (unusual activity, IV changes)
5. Sector rotation signals
6. Political/economic event impacts
7. Volatility expansion/contraction

Format as JSON:
{
  "alerts": [
    {
      "id": number,
      "type": "breakout/news/social/options/political/economic/volatility",
      "priority": "high/medium/low",
      "ticker": "SYMBOL (if specific)",
      "title": "attention-grabbing title",
      "description": "detailed description of the alert",
      "action": "specific action to take",
      "timeframe": "immediate/hours/days",
      "confidence": number (60-95),
      "dataSupport": "which data supports this alert",
      "profitPotential": "estimated profit opportunity"
    }
  ],
  "marketCondition": "overall market assessment",
  "riskLevel": "current market risk level",
  "keyWatches": ["things to monitor closely"]
}`;
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
            } else {
                throw new Error('No JSON found in response');
            }
        } catch (parseError) {
            console.error('Failed to parse AI response:', text);
            analysisResult = { 
                error: 'Failed to parse AI response', 
                rawResponse: text.substring(0, 500),
                fallback: {
                    message: "AI analysis temporarily unavailable. Check back in a moment.",
                    marketCondition: "unknown",
                    plays: [],
                    alerts: []
                }
            };
        }

        console.log(`[comprehensive-ai-analysis.js] AI analysis completed successfully`);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                type,
                analysis: analysisResult,
                dataQuality: {
                    topGainers: marketData.topGainers?.length || 0,
                    newsArticles: marketData.news?.length || 0,
                    sentiment: marketData.overallSentiment?.label || 'Unknown',
                    vixLevel: marketData.vix?.price || null,
                    marketSession: marketSession,
                    indicesTracked: Object.keys(marketData.indices || {}).length,
                    sectorsTracked: Object.keys(marketData.sectors || {}).length
                },
                timestamp: new Date().toISOString(),
                dataSource: "Alpha Vantage + AI Analysis"
            })
        };

    } catch (error) {
        console.error(`[comprehensive-ai-analysis.js] Error:`, error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: "Comprehensive analysis error",
                details: error.message
            })
        };
    }
};
