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
    
    if (!symbol && type === 'analysis') {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Symbol is required for analysis' })
        };
    }

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
        console.log(`[ai-analysis.js] Generating ${type} for ${symbol || 'market'}`);
        
        // Gather all data from Alpha Vantage
        const marketData = {};

        // 1. Get real-time quote data
        if (symbol) {
            const quoteUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&entitlement=realtime&apikey=${ALPHA_VANTAGE_API_KEY}`;
            const quoteResponse = await fetch(quoteUrl);
            const quoteData = await quoteResponse.json();
            if (quoteData['Global Quote']) {
                marketData.quote = quoteData['Global Quote'];
            }
        }

        // 2. Get technical indicators
        if (symbol) {
            const rsiUrl = `https://www.alphavantage.co/query?function=RSI&symbol=${symbol}&interval=daily&time_period=14&series_type=close&apikey=${ALPHA_VANTAGE_API_KEY}`;
            const rsiResponse = await fetch(rsiUrl);
            const rsiData = await rsiResponse.json();
            if (rsiData['Technical Analysis: RSI']) {
                const latestDate = Object.keys(rsiData['Technical Analysis: RSI'])[0];
                marketData.rsi = rsiData['Technical Analysis: RSI'][latestDate];
            }
        }

        // 3. Get news sentiment
        const newsUrl = `https://www.alphavantage.co/query?function=NEWS_SENTIMENT${symbol ? `&tickers=${symbol}` : ''}&apikey=${ALPHA_VANTAGE_API_KEY}`;
        const newsResponse = await fetch(newsUrl);
        const newsData = await newsResponse.json();
        if (newsData.feed) {
            marketData.news = newsData.feed.slice(0, 5);
        }

        // 4. Get market movers
        const moversUrl = `https://www.alphavantage.co/query?function=TOP_GAINERS_LOSERS&apikey=${ALPHA_VANTAGE_API_KEY}`;
        const moversResponse = await fetch(moversUrl);
        const moversData = await moversResponse.json();
        if (moversData.top_gainers) {
            marketData.topGainers = moversData.top_gainers.slice(0, 3);
            marketData.topLosers = moversData.top_losers.slice(0, 3);
        }

        // Initialize Gemini AI
        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        let prompt = '';
        
        if (type === 'analysis' && symbol) {
            prompt = `You are Rolo, an expert AI trading analyst with access to real-time market data. Provide a comprehensive trading analysis for ${symbol}.

Current Market Data:
${JSON.stringify(marketData, null, 2)}

Provide a detailed analysis including:
1. Current Price Action Analysis (with specific price levels)
2. Technical Indicators Interpretation
3. Support Levels (provide 3 specific price points)
4. Resistance Levels (provide 3 specific price points)
5. Entry Points (provide 2-3 specific prices with reasoning)
6. Stop Loss Levels (specific prices)
7. Price Targets (short-term and long-term with specific prices)
8. Risk/Reward Ratio
9. Options Strategy Recommendation (if applicable)
10. Overall Trading Recommendation with confidence level

Format the response as JSON with the following structure:
{
  "summary": "brief 2-3 sentence overview",
  "currentPrice": number,
  "technicalAnalysis": {
    "trend": "bullish/bearish/neutral",
    "strength": "strong/moderate/weak",
    "rsi": number,
    "rsiSignal": "overbought/oversold/neutral"
  },
  "levels": {
    "support": [price1, price2, price3],
    "resistance": [price1, price2, price3]
  },
  "tradingPlan": {
    "entries": [
      {"price": number, "reason": "string"},
      {"price": number, "reason": "string"}
    ],
    "stopLoss": number,
    "targets": {
      "shortTerm": {"price": number, "timeframe": "string"},
      "longTerm": {"price": number, "timeframe": "string"}
    },
    "riskReward": "ratio like 1:3"
  },
  "recommendation": {
    "action": "buy/sell/hold",
    "confidence": number (0-100),
    "strategy": "detailed strategy",
    "risks": ["risk1", "risk2"]
  }
}`;
        } else if (type === 'smartplays') {
            const now = new Date();
            const marketHour = now.getUTCHours() - 5; // EST
            
            prompt = `You are Rolo, an expert AI trading analyst. Generate smart trading plays for the current market conditions.

Current Market Data:
${JSON.stringify(marketData, null, 2)}

Market Time: ${now.toLocaleTimeString('en-US', { timeZone: 'America/New_York' })} EST
Market Status: ${marketHour >= 9.5 && marketHour < 16 ? 'Open' : 'Closed/Extended Hours'}

Generate 3-5 smart trading plays with the following criteria:
- Focus on stocks with high momentum or unusual activity
- Consider news sentiment and technical indicators
- Provide specific entry, stop loss, and target prices
- Include confidence levels and risk assessments
- Mix of different strategies (momentum, value, options)

Format as JSON:
{
  "timestamp": "ISO timestamp",
  "marketCondition": "bullish/bearish/neutral",
  "plays": [
    {
      "emoji": "appropriate emoji",
      "title": "catchy title",
      "ticker": "SYMBOL",
      "strategy": "momentum/value/options/swing",
      "confidence": number (0-100),
      "entry": number,
      "stopLoss": number,
      "targets": [target1, target2],
      "timeframe": "intraday/short-term/medium-term",
      "riskLevel": "low/medium/high",
      "reasoning": "brief explanation",
      "newsImpact": "any relevant news"
    }
  ]
}`;
        }

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        // Parse the JSON response from Gemini
        let analysisResult;
        try {
            // Extract JSON from the response (Gemini might include extra text)
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                analysisResult = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('No JSON found in response');
            }
        } catch (parseError) {
            console.error('Failed to parse Gemini response:', text);
            analysisResult = { error: 'Failed to parse AI response', rawResponse: text };
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                type,
                symbol,
                analysis: analysisResult,
                timestamp: new Date().toISOString()
            })
        };

    } catch (error) {
        console.error(`[ai-analysis.js] Error:`, error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};
