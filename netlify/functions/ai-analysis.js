// netlify/functions/ai-analysis.js
// Updated AI analysis with comprehensive data integration - NO MOCK DATA

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
            body: JSON.stringify({ 
                error: 'API keys not configured. Please check GEMINI_API_KEY and ALPHA_VANTAGE_API_KEY environment variables.' 
            })
        };
    }

    try {
        console.log(`[ai-analysis.js] Generating comprehensive ${type} analysis for ${symbol || 'market'}`);
        
        // Use the comprehensive AI analysis function for better data integration
        const baseUrl = process.env.URL || `https://${event.headers.host}`;
        
        try {
            const comprehensiveResponse = await fetch(`${baseUrl}/.netlify/functions/comprehensive-ai-analysis`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'User-Agent': 'Netlify-Function'
                },
                body: JSON.stringify({ symbol, type: 'analysis' })
            });

            if (comprehensiveResponse.ok) {
                const comprehensiveData = await comprehensiveResponse.json();
                
                if (comprehensiveData.analysis && !comprehensiveData.analysis.fallback) {
                    console.log(`[ai-analysis.js] Successfully got comprehensive analysis for ${symbol}`);
                    return {
                        statusCode: 200,
                        headers,
                        body: JSON.stringify({
                            type,
                            symbol,
                            analysis: comprehensiveData.analysis,
                            timestamp: new Date().toISOString(),
                            dataQuality: comprehensiveData.dataQuality,
                            dataSource: "Comprehensive AI Analysis"
                        })
                    };
                }
            }
        } catch (comprehensiveError) {
            console.warn(`[ai-analysis.js] Comprehensive analysis failed, falling back to basic analysis:`, comprehensiveError.message);
        }

        // Fallback to basic analysis if comprehensive fails
        console.log(`[ai-analysis.js] Using fallback basic analysis for ${symbol}`);
        
        // Gather minimal real data for basic analysis
        const marketData = { symbol, timestamp: new Date().toISOString() };

        // 1. Get basic stock quote
        if (symbol) {
            try {
                const quoteUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&entitlement=realtime&apikey=${ALPHA_VANTAGE_API_KEY}`;
                const quoteResponse = await fetch(quoteUrl);
                const quoteData = await quoteResponse.json();
                
                if (quoteData['Global Quote'] && quoteData['Global Quote']['05. price']) {
                    marketData.quote = quoteData['Global Quote'];
                    console.log(`[ai-analysis.js] Got basic quote for ${symbol}: $${quoteData['Global Quote']['05. price']}`);
                } else if (quoteData['Error Message']) {
                    console.warn(`[ai-analysis.js] Quote API error: ${quoteData['Error Message']}`);
                }
            } catch (e) {
                console.warn(`[ai-analysis.js] Could not fetch quote for ${symbol}:`, e.message);
            }
        }

        // 2. Get basic RSI for technical analysis
        if (symbol && marketData.quote) {
            try {
                const rsiUrl = `https://www.alphavantage.co/query?function=RSI&symbol=${symbol}&interval=daily&time_period=14&series_type=close&apikey=${ALPHA_VANTAGE_API_KEY}`;
                const rsiResponse = await fetch(rsiUrl);
                const rsiData = await rsiResponse.json();
                
                if (rsiData['Technical Analysis: RSI']) {
                    const latestDate = Object.keys(rsiData['Technical Analysis: RSI'])[0];
                    marketData.rsi = {
                        value: parseFloat(rsiData['Technical Analysis: RSI'][latestDate]['RSI']),
                        date: latestDate
                    };
                    console.log(`[ai-analysis.js] Got RSI for ${symbol}: ${marketData.rsi.value}`);
                }
            } catch (e) {
                console.warn(`[ai-analysis.js] Could not fetch RSI for ${symbol}:`, e.message);
            }
        }

        // 3. Get limited news for context
        try {
            const newsUrl = `https://www.alphavantage.co/query?function=NEWS_SENTIMENT${symbol ? `&tickers=${symbol}&limit=5` : '&limit=5'}&apikey=${ALPHA_VANTAGE_API_KEY}`;
            const newsResponse = await fetch(newsUrl);
            const newsData = await newsResponse.json();
            
            if (newsData.feed && newsData.feed.length > 0) {
                marketData.news = newsData.feed.slice(0, 3);
                
                // Calculate basic sentiment
                const sentimentScores = newsData.feed
                    .map(article => parseFloat(article.overall_sentiment_score))
                    .filter(score => !isNaN(score));
                
                if (sentimentScores.length > 0) {
                    const avgSentiment = sentimentScores.reduce((a, b) => a + b, 0) / sentimentScores.length;
                    marketData.sentiment = {
                        score: avgSentiment.toFixed(3),
                        label: avgSentiment > 0.1 ? 'Bullish' : avgSentiment < -0.1 ? 'Bearish' : 'Neutral'
                    };
                }
                console.log(`[ai-analysis.js] Got news sentiment: ${marketData.sentiment?.label}`);
            }
        } catch (e) {
            console.warn(`[ai-analysis.js] Could not fetch news:`, e.message);
        }

        // Only proceed with AI analysis if we have real data
        if (!marketData.quote) {
            console.log(`[ai-analysis.js] No real data available for ${symbol}, returning empty analysis`);
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    type,
                    symbol,
                    analysis: null,
                    message: "No real market data available for analysis",
                    timestamp: new Date().toISOString(),
                    dataQuality: {
                        hasQuote: false,
                        hasRSI: false,
                        hasNews: false
                    }
                })
            };
        }

        // Initialize Gemini AI for basic analysis
        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = `You are Rolo, an expert AI trading analyst. Provide analysis for ${symbol} based on available real market data.

REAL MARKET DATA AVAILABLE:
${JSON.stringify(marketData, null, 2)}

Current time: ${new Date().toISOString()}

Provide analysis in JSON format with the following structure:
{
  "summary": "2-3 sentence overview based on available data",
  "currentPrice": ${marketData.quote ? parseFloat(marketData.quote['05. price']) : 'null'},
  "technicalAnalysis": {
    "trend": "bullish/bearish/neutral based on price action",
    "strength": "strong/moderate/weak",
    "rsi": ${marketData.rsi ? marketData.rsi.value : 'null'},
    "rsiSignal": "${marketData.rsi ? 
      (marketData.rsi.value > 70 ? 'overbought' : marketData.rsi.value < 30 ? 'oversold' : 'neutral') : 'unavailable'}"
  },
  "marketContext": {
    "sentiment": "${marketData.sentiment?.label || 'unknown'}",
    "newsImpact": "assessment based on available news"
  },
  "recommendation": {
    "action": "buy/sell/hold based on analysis",
    "confidence": number (60-90 based on data quality),
    "strategy": "specific strategy recommendation",
    "reasoning": "detailed reasoning based on real data available"
  }
}

IMPORTANT: 
- Base analysis ONLY on the real data provided
- If data is limited, reflect that in confidence levels
- Be specific about what data was used
- Response must be valid JSON only, no extra text`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        // Parse the AI response
        let analysisResult;
        try {
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                analysisResult = JSON.parse(jsonMatch[0]);
                console.log(`[ai-analysis.js] Successfully generated basic analysis for ${symbol}`);
            } else {
                throw new Error('No JSON found in AI response');
            }
        } catch (parseError) {
            console.error('[ai-analysis.js] Failed to parse AI response:', text.substring(0, 500));
            // Return null instead of mock data
            analysisResult = null;
        }

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
                    dataSource: "Basic Alpha Vantage + AI Analysis"
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
                analysis: null, // Return null instead of mock data
                timestamp: new Date().toISOString()
            })
        };
    }
};
