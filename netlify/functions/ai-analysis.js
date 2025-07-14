// netlify/functions/ai-analysis.js
// AI-powered analysis using Gemini with all Alpha Vantage data

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
            body: JSON.stringify({ error: 'API keys not configured. Please check GEMINI_API_KEY and ALPHA_VANTAGE_API_KEY environment variables.' })
        };
    }

    try {
        console.log(`[ai-analysis.js] Generating ${type} for ${symbol || 'market'}`);
        
        // Gather all data from Alpha Vantage
        const marketData = {};

        // 1. Get real-time quote data
        if (symbol) {
            try {
                const quoteUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&entitlement=realtime&apikey=${ALPHA_VANTAGE_API_KEY}`;
                const quoteResponse = await fetch(quoteUrl);
                const quoteData = await quoteResponse.json();
                if (quoteData['Global Quote']) {
                    marketData.quote = quoteData['Global Quote'];
                }
            } catch (e) {
                console.warn(`[ai-analysis.js] Could not fetch quote for ${symbol}:`, e.message);
            }
        }

        // 2. Get technical indicators (RSI only for speed)
        if (symbol) {
            try {
                const rsiUrl = `https://www.alphavantage.co/query?function=RSI&symbol=${symbol}&interval=daily&time_period=14&series_type=close&apikey=${ALPHA_VANTAGE_API_KEY}`;
                const rsiResponse = await fetch(rsiUrl);
                const rsiData = await rsiResponse.json();
                if (rsiData['Technical Analysis: RSI']) {
                    const latestDate = Object.keys(rsiData['Technical Analysis: RSI'])[0];
                    marketData.rsi = rsiData['Technical Analysis: RSI'][latestDate];
                }
            } catch (e) {
                console.warn(`[ai-analysis.js] Could not fetch RSI for ${symbol}:`, e.message);
            }
        }

        // 3. Get news sentiment (limit to prevent timeout)
        try {
            const newsUrl = `https://www.alphavantage.co/query?function=NEWS_SENTIMENT${symbol ? `&tickers=${symbol}&limit=5` : '&limit=5'}&apikey=${ALPHA_VANTAGE_API_KEY}`;
            const newsResponse = await fetch(newsUrl);
            const newsData = await newsResponse.json();
            if (newsData.feed) {
                marketData.news = newsData.feed.slice(0, 3); // Limit to 3 articles
            }
        } catch (e) {
            console.warn(`[ai-analysis.js] Could not fetch news:`, e.message);
        }

        // 4. Get market movers (for smart plays context)
        if (type === 'smartplays') {
            try {
                const moversUrl = `https://www.alphavantage.co/query?function=TOP_GAINERS_LOSERS&apikey=${ALPHA_VANTAGE_API_KEY}`;
                const moversResponse = await fetch(moversUrl);
                const moversData = await moversResponse.json();
                if (moversData.top_gainers) {
                    marketData.topGainers = moversData.top_gainers.slice(0, 3);
                    marketData.topLosers = moversData.top_losers.slice(0, 3);
                }
            } catch (e) {
                console.warn(`[ai-analysis.js] Could not fetch market movers:`, e.message);
            }
        }

        // Initialize Gemini AI
        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        let prompt = '';
        
        if (type === 'analysis' && symbol) {
            prompt = `You are Rolo, an expert AI trading analyst. Provide a comprehensive trading analysis for ${symbol}.

Current Market Data:
${JSON.stringify(marketData, null, 2)}

Current time: ${new Date().toISOString()}
Analysis request: Detailed trading analysis for ${symbol}

Provide a detailed analysis in JSON format with the following structure:
{
  "summary": "2-3 sentence overview of the stock's current situation",
  "currentPrice": ${marketData.quote ? parseFloat(marketData.quote['05. price']) : 'null'},
  "technicalAnalysis": {
    "trend": "bullish/bearish/neutral",
    "strength": "strong/moderate/weak",
    "rsi": ${marketData.rsi ? parseFloat(marketData.rsi.RSI) : 'null'},
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
    "riskReward": "1:X format"
  },
  "recommendation": {
    "action": "buy/sell/hold",
    "confidence": number (0-100),
    "strategy": "detailed strategy explanation",
    "risks": ["risk1", "risk2", "risk3"]
  }
}

IMPORTANT: 
- Use realistic price levels based on current price
- Provide specific, actionable entry points
- Include detailed reasoning
- Response must be valid JSON only, no extra text`;

        } else if (type === 'smartplays') {
            const now = new Date();
            const marketHour = now.getUTCHours() - 5; // EST
            
            prompt = `You are Rolo, an expert AI trading analyst. Generate smart trading plays for current market conditions.

Current Market Data:
${JSON.stringify(marketData, null, 2)}

Current time: ${now.toISOString()}
Market Status: ${marketHour >= 9.5 && marketHour < 16 ? 'Open' : 'Closed/Extended Hours'}

Generate 2-4 smart trading plays based on current market data. Focus on:
- Stocks with momentum or unusual activity
- Consider news sentiment and technical indicators
- Provide specific entry, stop loss, and target prices
- Include confidence levels and risk assessments

Format as JSON:
{
  "timestamp": "${now.toISOString()}",
  "marketCondition": "bullish/bearish/neutral",
  "plays": [
    {
      "emoji": "📈",
      "title": "descriptive title",
      "ticker": "SYMBOL",
      "strategy": "momentum/value/options/swing",
      "confidence": number (0-100),
      "entry": number,
      "stopLoss": number,
      "targets": [target1, target2],
      "timeframe": "intraday/short-term/medium-term",
      "riskLevel": "low/medium/high",
      "reasoning": "detailed explanation why this is a good play",
      "newsImpact": "any relevant news affecting this play"
    }
  ]
}

IMPORTANT: Response must be valid JSON only, no extra text`;
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
            analysisResult = { 
                error: 'Failed to parse AI response', 
                rawResponse: text.substring(0, 500),
                fallback: type === 'analysis' ? {
                    summary: `Analysis for ${symbol} is being processed. Please try again in a moment.`,
                    technicalAnalysis: { trend: 'neutral', strength: 'moderate' },
                    recommendation: { action: 'hold', confidence: 50 }
                } : {
                    plays: [{
                        emoji: '⏳',
                        title: 'Analysis in Progress',
                        ticker: 'MARKET',
                        strategy: 'patience',
                        confidence: 50,
                        entry: 0,
                        stopLoss: 0,
                        targets: [0],
                        timeframe: 'pending',
                        riskLevel: 'low',
                        reasoning: 'AI analysis is being processed. Please try again shortly.'
                    }]
                }
            };
        }

        console.log(`[ai-analysis.js] Successfully generated ${type} analysis`);
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                type,
                symbol,
                analysis: analysisResult,
                timestamp: new Date().toISOString(),
                dataQuality: {
                    hasQuote: !!marketData.quote,
                    hasRSI: !!marketData.rsi,
                    hasNews: !!(marketData.news && marketData.news.length > 0),
                    hasMovers: !!(marketData.topGainers && marketData.topGainers.length > 0)
                }
            })
        };

    } catch (error) {
        console.error(`[ai-analysis.js] Error:`, error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: `AI analysis error: ${error.message}`,
                details: 'Check server logs for more information'
            })
        };
    }
};
