// netlify/functions/comprehensive-ai-analysis.js
// FIXED: HTTP 500 error and working comprehensive AI analysis

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
        console.log(`[comprehensive-ai-analysis.js] Starting analysis...`);
        
        // Get API keys with validation
        const ALPHA_VANTAGE_KEY = process.env.ALPHA_VANTAGE_API_KEY;
        const GEMINI_KEY = process.env.GEMINI_API_KEY;
        
        if (!ALPHA_VANTAGE_KEY) {
            console.error('[comprehensive-ai-analysis.js] Alpha Vantage API key missing');
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ 
                    error: 'Alpha Vantage API key not configured',
                    analysis: null,
                    timestamp: new Date().toISOString()
                })
            };
        }

        if (!GEMINI_KEY) {
            console.error('[comprehensive-ai-analysis.js] Gemini API key missing');
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ 
                    error: 'Gemini API key not configured',
                    analysis: null,
                    timestamp: new Date().toISOString()
                })
            };
        }
        
        // Parse symbol from request
        let symbol = 'SPY'; // Default symbol
        
        if (event.queryStringParameters && event.queryStringParameters.symbol) {
            symbol = event.queryStringParameters.symbol.toUpperCase();
        } else if (event.httpMethod === 'POST' && event.body) {
            try {
                const body = JSON.parse(event.body);
                symbol = body.symbol ? body.symbol.toUpperCase() : 'SPY';
            } catch (parseError) {
                console.warn('[comprehensive-ai-analysis.js] Could not parse POST body, using default symbol');
            }
        }
        
        console.log(`[comprehensive-ai-analysis.js] Analyzing symbol: ${symbol}`);
        
        // Step 1: Get real stock data
        let stockData = null;
        try {
            const quoteUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${ALPHA_VANTAGE_KEY}`;
            console.log(`[comprehensive-ai-analysis.js] Fetching stock data for ${symbol}...`);
            
            const quoteResponse = await fetch(quoteUrl);
            if (!quoteResponse.ok) {
                throw new Error(`Alpha Vantage API returned ${quoteResponse.status}`);
            }
            
            const quoteJson = await quoteResponse.json();
            
            if (quoteJson['Global Quote'] && quoteJson['Global Quote']['01. symbol']) {
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
                console.log(`[comprehensive-ai-analysis.js] Got stock data: ${symbol} at $${stockData.price}`);
            } else {
                console.warn(`[comprehensive-ai-analysis.js] No stock data returned for ${symbol}`);
                // Return a basic response instead of throwing an error
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        error: `No real data available for ${symbol}`,
                        analysis: null,
                        timestamp: new Date().toISOString(),
                        dataSource: "Alpha Vantage - No Data"
                    })
                };
            }
        } catch (stockError) {
            console.error(`[comprehensive-ai-analysis.js] Stock data error: ${stockError.message}`);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({
                    error: `Failed to fetch stock data: ${stockError.message}`,
                    analysis: null,
                    timestamp: new Date().toISOString()
                })
            };
        }

        // Step 2: Get VIX for market context (if not analyzing VIX itself)
        let vixData = null;
        if (symbol !== 'VIX') {
            try {
                const vixUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=VIX&apikey=${ALPHA_VANTAGE_KEY}`;
                const vixResponse = await fetch(vixUrl);
                
                if (vixResponse.ok) {
                    const vixJson = await vixResponse.json();
                    if (vixJson['Global Quote']) {
                        const vixQuote = vixJson['Global Quote'];
                        vixData = {
                            level: parseFloat(vixQuote['05. price']),
                            change: parseFloat(vixQuote['10. change percent'].replace('%', '')),
                            fearGreed: parseFloat(vixQuote['05. price']) > 30 ? 'Fear' : 
                                      parseFloat(vixQuote['05. price']) > 20 ? 'Elevated' : 'Greed'
                        };
                        console.log(`[comprehensive-ai-analysis.js] Got VIX data: ${vixData.level}`);
                    }
                }
            } catch (vixError) {
                console.warn(`[comprehensive-ai-analysis.js] VIX data error: ${vixError.message}`);
            }
        }

        // Step 3: Initialize Gemini AI
        let genAI, model;
        try {
            genAI = new GoogleGenerativeAI(GEMINI_KEY);
            model = genAI.getGenerativeModel({ model: "gemini-pro" });
            console.log(`[comprehensive-ai-analysis.js] Initialized Gemini AI`);
        } catch (aiError) {
            console.error(`[comprehensive-ai-analysis.js] Gemini initialization error: ${aiError.message}`);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({
                    error: `AI initialization failed: ${aiError.message}`,
                    analysis: null,
                    timestamp: new Date().toISOString()
                })
            };
        }

        // Step 4: Create analysis prompt with real data only
        const prompt = `You are a professional financial analyst. Provide a comprehensive analysis of ${stockData.symbol} using this REAL market data:

CURRENT STOCK DATA:
- Symbol: ${stockData.symbol}
- Current Price: $${stockData.price}
- Daily Change: ${stockData.changePercent}
- Volume: ${stockData.volume.toLocaleString()}
- Day High: $${stockData.high}
- Day Low: $${stockData.low}
- Previous Close: $${stockData.previousClose}
- Last Updated: ${stockData.lastUpdated}

${vixData ? `MARKET CONTEXT:
- VIX Level: ${vixData.level.toFixed(2)}
- VIX Change: ${vixData.change > 0 ? '+' : ''}${vixData.change.toFixed(1)}%
- Market Sentiment: ${vixData.fearGreed}` : ''}

ANALYSIS REQUIREMENTS:
Please provide a detailed analysis including:

1. **Current Trend Analysis**: Based on the price action and volume
2. **Support and Resistance Levels**: Calculate specific price levels
3. **Risk Assessment**: Evaluate current risk factors
4. **Trading Recommendation**: Buy/Hold/Sell with reasoning
5. **Price Targets**: Specific entry, stop-loss, and target prices
6. **Time Horizon**: Short-term (1-5 days) and medium-term (1-4 weeks) outlook

Use only the real data provided above. Be specific with price levels and percentages. Format your response clearly with sections.`;

        // Step 5: Get AI Analysis
        let aiResponse;
        try {
            console.log(`[comprehensive-ai-analysis.js] Sending prompt to Gemini AI...`);
            const result = await model.generateContent(prompt);
            const response = await result.response;
            aiResponse = response.text();
            console.log(`[comprehensive-ai-analysis.js] Received AI analysis (${aiResponse.length} characters)`);
        } catch (aiError) {
            console.error(`[comprehensive-ai-analysis.js] AI analysis error: ${aiError.message}`);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({
                    error: `AI analysis failed: ${aiError.message}`,
                    analysis: null,
                    timestamp: new Date().toISOString()
                })
            };
        }

        // Step 6: Structure the response
        const analysisResult = {
            symbol: stockData.symbol,
            analysis: aiResponse,
            marketData: stockData,
            vixData: vixData,
            recommendation: extractRecommendation(aiResponse),
            priceTarget: extractPriceTarget(aiResponse, stockData.price),
            riskLevel: assessRiskLevel(stockData, vixData),
            confidence: calculateConfidence(stockData, vixData),
            timestamp: new Date().toISOString(),
            dataQuality: 'Real-Time',
            dataSource: 'Alpha Vantage + Gemini AI'
        };

        console.log(`[comprehensive-ai-analysis.js] Analysis completed successfully for ${symbol}`);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                analysis: analysisResult,
                dataQuality: 'Real-Time',
                timestamp: new Date().toISOString(),
                dataSource: "Alpha Vantage Real-Time + Gemini AI"
            })
        };

    } catch (error) {
        console.error('[comprehensive-ai-analysis.js] Unexpected error:', error);
        
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
    if (!analysis) return 'Hold';
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
    if (!analysis || !currentPrice) return 'N/A';
    
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

function assessRiskLevel(stockData, vixData) {
    if (!stockData) return 'Medium';
    
    let riskScore = 0;
    
    // Volume risk
    if (stockData.volume > 1000000) riskScore += 1;
    
    // Volatility risk based on daily range
    const priceRange = (stockData.high - stockData.low) / stockData.price;
    if (priceRange > 0.05) riskScore += 1;
    
    // Market risk from VIX
    if (vixData && vixData.level > 25) riskScore += 1;
    
    // Price change risk
    const changePercent = Math.abs(parseFloat(stockData.changePercent.replace('%', '')));
    if (changePercent > 3) riskScore += 1;
    
    if (riskScore >= 3) return 'High';
    if (riskScore >= 2) return 'Medium';
    return 'Low';
}

function calculateConfidence(stockData, vixData) {
    if (!stockData) return 50;
    
    let confidence = 50; // Base confidence
    
    // Volume confirmation
    if (stockData.volume > 500000) confidence += 10;
    if (stockData.volume > 2000000) confidence += 5;
    
    // Price action clarity
    const changePercent = Math.abs(parseFloat(stockData.changePercent.replace('%', '')));
    if (changePercent > 1) confidence += 10;
    if (changePercent > 3) confidence += 5;
    
    // Market environment
    if (vixData) {
        if (vixData.level < 20) confidence += 10; // Low volatility = higher confidence
        if (vixData.level > 30) confidence -= 10; // High volatility = lower confidence
    }
    
    return Math.min(95, Math.max(20, confidence));
}
