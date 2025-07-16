// netlify/functions/comprehensive-ai-analysis.js
// FIXED: Complete comprehensive AI analysis with ZERO mock data

const { GoogleGenerativeAI } = require('@google/generative-ai');

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        console.log('[comprehensive-ai-analysis.js] Starting comprehensive analysis...');
        
        const { symbol, type = 'analysis' } = event.queryStringParameters || {};
        const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

        if (!ALPHA_VANTAGE_API_KEY || !GEMINI_API_KEY) {
            throw new Error('Missing required API keys');
        }

        // Initialize Gemini AI
        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });

        // Determine market session
        const now = new Date();
        const easternTime = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
        const hour = easternTime.getHours();
        const day = easternTime.getDay();
        
        let marketSession;
        if (day === 0 || day === 6) {
            marketSession = 'WEEKEND';
        } else if (hour >= 4 && hour < 9.5) {
            marketSession = 'PRE_MARKET';
        } else if (hour >= 9.5 && hour < 16) {
            marketSession = 'MARKET_OPEN';
        } else if (hour >= 16 && hour < 20) {
            marketSession = 'AFTER_HOURS';
        } else {
            marketSession = 'MARKET_CLOSED';
        }

        // Fetch real market data
        const marketData = await fetchComprehensiveMarketData(ALPHA_VANTAGE_API_KEY, symbol, marketSession);
        
        if (!marketData || Object.keys(marketData).length === 0) {
            console.log('[comprehensive-ai-analysis.js] No real market data available');
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    error: 'No real market data available',
                    analysis: null,
                    plays: [],
                    alerts: [],
                    timestamp: new Date().toISOString(),
                    dataSource: 'No Data Available'
                })
            };
        }

        // Generate AI analysis based on real data
        const analysis = await generateAIAnalysis(model, marketData, type, symbol, marketSession);

        console.log(`[comprehensive-ai-analysis.js] Generated ${type} analysis successfully`);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                analysis,
                marketData,
                sessionContext: marketSession,
                timestamp: new Date().toISOString(),
                dataSource: 'Alpha Vantage Real-Time Data + Gemini AI'
            })
        };

    } catch (error) {
        console.error('[comprehensive-ai-analysis.js] Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'Analysis generation failed',
                details: error.message,
                analysis: null,
                plays: [],
                alerts: [],
                timestamp: new Date().toISOString()
            })
        };
    }
};

async function fetchComprehensiveMarketData(apiKey, symbol, marketSession) {
    const data = {};
    
    try {
        // Fetch market overview
        const overviewResponse = await fetch(
            `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${symbol || 'SPY'}&apikey=${apiKey}`
        );
        if (overviewResponse.ok) {
            const overview = await overviewResponse.json();
            if (!overview.Note && !overview.Error) {
                data.overview = overview;
            }
        }

        // Fetch real-time quote
        const quoteResponse = await fetch(
            `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol || 'SPY'}&apikey=${apiKey}`
        );
        if (quoteResponse.ok) {
            const quote = await quoteResponse.json();
            if (quote['Global Quote'] && Object.keys(quote['Global Quote']).length > 0) {
                data.quote = quote['Global Quote'];
            }
        }

        // Fetch top gainers/losers for market sentiment
        const topResponse = await fetch(
            `https://www.alphavantage.co/query?function=TOP_GAINERS_LOSERS&apikey=${apiKey}`
        );
        if (topResponse.ok) {
            const topData = await topResponse.json();
            if (topData.top_gainers && topData.top_losers) {
                data.topMovers = {
                    gainers: topData.top_gainers.slice(0, 10),
                    losers: topData.top_losers.slice(0, 10),
                    most_active: topData.most_actively_traded?.slice(0, 10) || []
                };
            }
        }

        // Fetch VIX for volatility
        const vixResponse = await fetch(
            `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=VIX&apikey=${apiKey}`
        );
        if (vixResponse.ok) {
            const vix = await vixResponse.json();
            if (vix['Global Quote']) {
                data.vix = vix['Global Quote'];
            }
        }

        // Fetch market news
        const newsResponse = await fetch(
            `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers=${symbol || 'SPY'}&apikey=${apiKey}&limit=10`
        );
        if (newsResponse.ok) {
            const news = await newsResponse.json();
            if (news.feed) {
                data.news = news.feed.slice(0, 5);
            }
        }

        console.log(`[fetchComprehensiveMarketData] Fetched data for ${marketSession}: ${Object.keys(data).join(', ')}`);
        return data;

    } catch (error) {
        console.error('[fetchComprehensiveMarketData] Error:', error);
        return {};
    }
}

async function generateAIAnalysis(model, marketData, type, symbol, marketSession) {
    try {
        let prompt;

        if (type === 'analysis') {
            prompt = `Analyze ${symbol || 'the market'} using this REAL data:

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

CRITICAL: Only generate alerts for real significant activity. Return empty alerts array if no significant activity.`;
        }

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Parse JSON response
        const cleanText = text.replace(/```json\s*|\s*```/g, '').trim();
        return JSON.parse(cleanText);

    } catch (error) {
        console.error('[generateAIAnalysis] Error:', error);
        return {
            error: 'AI analysis failed',
            details: error.message,
            plays: [],
            alerts: []
        };
    }
}
