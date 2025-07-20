// netlify/functions/comprehensive-ai-analysis.js
// COMPLETE: Working comprehensive AI analysis with ALL data sources
// ZERO MOCK DATA - Only uses real Alpha Vantage and Gemini data

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

    try {
        console.log(`[comprehensive-ai-analysis.js] Starting comprehensive analysis...`);
        
        // Get API keys
        const ALPHA_VANTAGE_KEY = process.env.ALPHA_VANTAGE_API_KEY;
        const GEMINI_KEY = process.env.GEMINI_API_KEY;
        
        if (!ALPHA_VANTAGE_KEY || !GEMINI_KEY) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ 
                    error: 'API keys not configured',
                    analysis: null,
                    timestamp: new Date().toISOString(),
                    dataSource: "Error - No API Keys"
                })
            };
        }
        
        // Parse request
        let symbol = 'SPY';
        let analysisType = 'analysis';
        
        if (event.httpMethod === 'POST' && event.body) {
            const body = JSON.parse(event.body);
            symbol = body.symbol || 'SPY';
            analysisType = body.type || 'analysis';
        } else if (event.queryStringParameters) {
            symbol = event.queryStringParameters.symbol || 'SPY';
            analysisType = event.queryStringParameters.type || 'analysis';
        }
        
        console.log(`[comprehensive-ai-analysis.js] Analyzing ${symbol}, type: ${analysisType}`);
        
        // Determine current market session
        const now = new Date();
        const currentTime = now.getHours() * 60 + now.getMinutes();
        const dayOfWeek = now.getDay();
        
        let marketSession = 'CLOSED';
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            marketSession = 'WEEKEND';
        } else if (currentTime >= 930 && currentTime < 1600) {
            marketSession = 'MARKET_OPEN';
        } else if (currentTime >= 400 && currentTime < 930) {
            marketSession = 'PRE_MARKET';
        } else if (currentTime >= 1600 && currentTime < 2000) {
            marketSession = 'AFTER_HOURS';
        } else {
            marketSession = 'FUTURES_OPEN';
        }
        
        // Collect REAL market data
        const marketData = {
            session: marketSession,
            timestamp: new Date().toISOString()
        };
        
        let stockData = null;
        let technicalData = null;
        let newsData = null;
        let sectorData = null;
        
        // 1. Get Real Stock Data
        try {
            const quoteUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${ALPHA_VANTAGE_KEY}`;
            const quoteResponse = await fetch(quoteUrl);
            const quoteJson = await quoteResponse.json();
            
            if (quoteJson['Global Quote']) {
                const quote = quoteJson['Global Quote'];
                stockData = {
                    symbol: quote['01. symbol'],
                    price: parseFloat(quote['05. price']),
                    change: parseFloat(quote['09. change']),
                    changePercent: quote['10. change percent'],
                    volume: parseInt(quote['06. volume']),
                    high: parseFloat(quote['03. high']),
                    low: parseFloat(quote['04. low']),
                    previousClose: parseFloat(quote['08. previous close']),
                    lastUpdated: quote['07. latest trading day']
                };
                console.log(`[comprehensive-ai-analysis.js] Got real stock data for ${symbol}`);
            }
        } catch (error) {
            console.warn(`[comprehensive-ai-analysis.js] Stock data error: ${error.message}`);
        }
        
        // 2. Get Real Technical Indicators
        try {
            const rsiUrl = `https://www.alphavantage.co/query?function=RSI&symbol=${symbol}&interval=daily&time_period=14&series_type=close&apikey=${ALPHA_VANTAGE_KEY}`;
            const rsiResponse = await fetch(rsiUrl);
            const rsiJson = await rsiResponse.json();
            
            if (rsiJson['Technical Analysis: RSI']) {
                const rsiData = rsiJson['Technical Analysis: RSI'];
                const latestDate = Object.keys(rsiData)[0];
                const rsiValue = parseFloat(rsiData[latestDate]['RSI']);
                
                technicalData = {
                    rsi: rsiValue,
                    rsiSignal: rsiValue > 70 ? 'Overbought' : rsiValue < 30 ? 'Oversold' : 'Neutral',
                    date: latestDate
                };
                console.log(`[comprehensive-ai-analysis.js] Got real RSI data: ${rsiValue}`);
            }
        } catch (error) {
            console.warn(`[comprehensive-ai-analysis.js] Technical data error: ${error.message}`);
        }
        
        // 3. Get Real Market News (if available)
        try {
            const newsUrl = `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers=${symbol}&apikey=${ALPHA_VANTAGE_KEY}`;
            const newsResponse = await fetch(newsUrl);
            const newsJson = await newsResponse.json();
            
            if (newsJson.feed && newsJson.feed.length > 0) {
                const recentNews = newsJson.feed.slice(0, 3);
                newsData = {
                    articles: recentNews.map(article => ({
                        title: article.title,
                        sentiment: article.overall_sentiment_label,
                        score: article.overall_sentiment_score,
                        summary: article.summary
                    })),
                    overallSentiment: newsJson.feed[0].overall_sentiment_label
                };
                console.log(`[comprehensive-ai-analysis.js] Got real news data: ${newsData.overallSentiment}`);
            }
        } catch (error) {
            console.warn(`[comprehensive-ai-analysis.js] News data error: ${error.message}`);
        }
        
        // 4. Get VIX for Market Context (if not analyzing VIX itself)
        let vixData = null;
        if (symbol !== 'VIX') {
            try {
                const vixUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=VIX&apikey=${ALPHA_VANTAGE_KEY}`;
                const vixResponse = await fetch(vixUrl);
                const vixJson = await vixResponse.json();
                
                if (vixJson['Global Quote']) {
                    const vixQuote = vixJson['Global Quote'];
                    vixData = {
                        level: parseFloat(vixQuote['05. price']),
                        change: parseFloat(vixQuote['10. change percent'].replace('%', '')),
                        fearGreed: parseFloat(vixQuote['05. price']) > 30 ? 'Fear' : 'Greed'
                    };
                    console.log(`[comprehensive-ai-analysis.js] Got real VIX data: ${vixData.level}`);
                }
            } catch (error) {
                console.warn(`[comprehensive-ai-analysis.js] VIX data error: ${error.message}`);
            }
        }
        
        // Only proceed with AI analysis if we have real data
        if (!stockData) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    error: "No real stock data available",
                    analysis: null,
                    timestamp: new Date().toISOString(),
                    dataSource: "Error - No Real Data"
                })
            };
        }
        
        // Initialize Gemini AI
        const genAI = new GoogleGenerativeAI(GEMINI_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        
        // Create comprehensive prompt with REAL data only
        const prompt = `
You are a professional trading analyst. Analyze ${symbol} using this REAL market data:

CURRENT STOCK DATA:
- Price: $${stockData.price}
- Change: ${stockData.changePercent}
- Volume: ${stockData.volume.toLocaleString()}
- High: $${stockData.high}
- Low: $${stockData.low}
- Previous Close: $${stockData.previousClose}

${technicalData ? `TECHNICAL INDICATORS:
- RSI (14): ${technicalData.rsi.toFixed(2)} (${technicalData.rsiSignal})` : ''}

${vixData ? `MARKET CONTEXT:
- VIX: ${vixData.level.toFixed(2)} (${vixData.fearGreed} environment)
- VIX Change: ${vixData.change > 0 ? '+' : ''}${vixData.change.toFixed(1)}%` : ''}

${newsData ? `NEWS SENTIMENT:
- Overall: ${newsData.overallSentiment}
- Recent Headlines: ${newsData.articles.map(a => a.title).join('; ')}` : ''}

MARKET SESSION: ${marketSession}
CURRENT TIME: ${new Date().toLocaleString()}

Provide a comprehensive analysis including:
1. Current market position and trend
2. Key support and resistance levels
3. Risk assessment and outlook
4. Specific entry and exit recommendations
5. Time horizon for the trade

Be specific with price levels and percentages. Base everything on the real data provided.
`;

        console.log(`[comprehensive-ai-analysis.js] Sending prompt to Gemini AI...`);
        
        // Get AI Analysis
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const aiAnalysis = response.text();
        
        console.log(`[comprehensive-ai-analysis.js] Received AI analysis (${aiAnalysis.length} characters)`);
        
        // Structure the response
        const analysisResult = {
            symbol: symbol,
            analysis: aiAnalysis,
            marketData: stockData,
            technicalData: technicalData,
            newsData: newsData,
            vixData: vixData,
            marketSession: marketSession,
            recommendation: extractRecommendation(aiAnalysis),
            priceTarget: extractPriceTarget(aiAnalysis, stockData.price),
            riskLevel: assessRiskLevel(stockData, technicalData, vixData),
            confidence: calculateConfidence(stockData, technicalData, newsData),
            timestamp: new Date().toISOString(),
            dataQuality: 'Real-Time',
            dataSource: 'Alpha Vantage + Gemini AI'
        };
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                analysis: analysisResult,
                marketData: marketData,
                dataQuality: 'Real-Time',
                timestamp: new Date().toISOString(),
                dataSource: "Alpha Vantage Real-Time + Gemini AI"
            })
        };

    } catch (error) {
        console.error('[comprehensive-ai-analysis.js] Error:', error);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: "Comprehensive analysis error",
                details: error.message,
                analysis: null,
                timestamp: new Date().toISOString(),
                dataSource: "Error - Analysis Failed"
            })
        };
    }
};

// Helper functions for analysis structuring
function extractRecommendation(analysis) {
    const text = analysis.toLowerCase();
    if (text.includes('buy') || text.includes('bullish') || text.includes('long')) {
        return 'Buy';
    } else if (text.includes('sell') || text.includes('bearish') || text.includes('short')) {
        return 'Sell';
    } else {
        return 'Hold';
    }
}

function extractPriceTarget(analysis, currentPrice) {
    // Look for price targets in the analysis
    const priceMatches = analysis.match(/\$(\d+\.?\d*)/g);
    if (priceMatches && priceMatches.length > 1) {
        const prices = priceMatches.map(p => parseFloat(p.replace('$', '')));
        const validTargets = prices.filter(p => p > currentPrice * 0.8 && p < currentPrice * 1.5);
        if (validTargets.length > 0) {
            return `$${Math.max(...validTargets).toFixed(2)}`;
        }
    }
    return 'N/A';
}

function assessRiskLevel(stockData, technicalData, vixData) {
    let riskScore = 0;
    
    // Volume risk
    if (stockData.volume > 1000000) riskScore += 1;
    
    // Volatility risk
    const priceRange = (stockData.high - stockData.low) / stockData.price;
    if (priceRange > 0.05) riskScore += 1;
    
    // Technical risk
    if (technicalData && (technicalData.rsi > 70 || technicalData.rsi < 30)) riskScore += 1;
    
    // Market risk
    if (vixData && vixData.level > 25) riskScore += 1;
    
    if (riskScore >= 3) return 'High';
    if (riskScore >= 2) return 'Medium';
    return 'Low';
}

function calculateConfidence(stockData, technicalData, newsData) {
    let confidence = 50; // Base confidence
    
    // Volume confirmation
    if (stockData.volume > 500000) confidence += 10;
    
    // Technical confirmation
    if (technicalData) {
        if (technicalData.rsi > 30 && technicalData.rsi < 70) confidence += 15;
    }
    
    // News sentiment
    if (newsData) {
        if (newsData.overallSentiment === 'Bullish') confidence += 10;
        if (newsData.overallSentiment === 'Bearish') confidence -= 5;
    }
    
    // Price action
    const change = Math.abs(parseFloat(stockData.changePercent.replace('%', '')));
    if (change > 2) confidence += 10;
    
    return Math.min(95, Math.max(20, confidence));
}
