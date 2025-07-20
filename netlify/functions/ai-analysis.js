// netlify/functions/ai-analysis.js
// AI-powered analysis using Gemini with all Alpha Vantage data - ZERO MOCK DATA

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
        const symbol = event.queryStringParameters?.symbol || 'SPY';
        console.log(`[ai-analysis.js] Starting AI analysis for ${symbol}`);
        
        const ALPHA_VANTAGE_KEY = process.env.ALPHA_VANTAGE_API_KEY;
        const GEMINI_KEY = process.env.GEMINI_API_KEY;
        
        if (!ALPHA_VANTAGE_KEY || !GEMINI_KEY) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ 
                    error: 'API keys not configured',
                    timestamp: new Date().toISOString()
                })
            };
        }

        // First try comprehensive analysis
        try {
            const comprehensiveUrl = `${event.headers.host}/.netlify/functions/comprehensive-ai-analysis?symbol=${symbol}`;
            const comprehensiveResponse = await fetch(`https://${comprehensiveUrl}`);
            
            if (comprehensiveResponse.ok) {
                const comprehensiveData = await comprehensiveResponse.json();
                if (comprehensiveData.analysis && !comprehensiveData.error) {
                    console.log(`[ai-analysis.js] Using comprehensive analysis for ${symbol}`);
                    return {
                        statusCode: 200,
                        headers,
                        body: JSON.stringify(comprehensiveData)
                    };
                }
            }
        } catch (comprehensiveError) {
            console.warn(`[ai-analysis.js] Comprehensive analysis failed: ${comprehensiveError.message}`);
        }

        // Fallback to basic analysis with real data only
        console.log(`[ai-analysis.js] Falling back to basic analysis for ${symbol}`);
        
        // Get real stock data
        const quoteUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${ALPHA_VANTAGE_KEY}`;
        const quoteResponse = await fetch(quoteUrl);
        const quoteJson = await quoteResponse.json();
        
        if (!quoteJson['Global Quote']) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({
                    error: `No real data available for ${symbol}`,
                    timestamp: new Date().toISOString(),
                    dataSource: "Alpha Vantage - No Data"
                })
            };
        }

        const quote = quoteJson['Global Quote'];
        const stockData = {
            symbol: quote['01. symbol'],
            price: parseFloat(quote['05. price']),
            change: parseFloat(quote['09. change']),
            changePercent: quote['10. change percent'],
            volume: parseInt(quote['06. volume']),
            high: parseFloat(quote['03. high']),
            low: parseFloat(quote['04. low']),
            previousClose: parseFloat(quote['08. previous close'])
        };

        // Get real VIX for market context (if not analyzing VIX itself)
        let vixData = null;
        if (symbol !== 'VIX') {
            try {
                const vixUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=VIX&apikey=${ALPHA_VANTAGE_KEY}`;
                const vixResponse = await fetch(vixUrl);
                const vixJson = await vixResponse.json();
                
                if (vixJson['Global Quote']) {
                    vixData = {
                        level: parseFloat(vixJson['Global Quote']['05. price']),
                        change: vixJson['Global Quote']['10. change percent']
                    };
                }
            } catch (vixError) {
                console.warn(`[ai-analysis.js] Could not fetch VIX: ${vixError.message}`);
            }
        }

        // Initialize Gemini AI
        const genAI = new GoogleGenerativeAI(GEMINI_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });

        // Create analysis prompt with real data only
        const prompt = `
You are a professional financial analyst. Provide a comprehensive analysis of ${stockData.symbol} based on this REAL market data:

CURRENT DATA:
- Price: $${stockData.price}
- Daily Change: ${stockData.changePercent}
- Volume: ${stockData.volume.toLocaleString()}
- Day High: $${stockData.high}
- Day Low: $${stockData.low}
- Previous Close: $${stockData.previousClose}

${vixData ? `MARKET CONTEXT:
- VIX: ${vixData.level} (${vixData.change})` : ''}

Provide analysis including:
1. Current trend and momentum
2. Support and resistance levels
3. Volume analysis
4. Risk assessment
5. Trading recommendation with specific price targets

Base your analysis solely on the real data provided. Be specific with price levels.
`;

        console.log(`[ai-analysis.js] Sending analysis request to Gemini AI...`);
        
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const aiAnalysis = response.text();

        // Structure the analysis response
        const analysisResult = {
            symbol: stockData.symbol,
            analysis: aiAnalysis,
            marketData: stockData,
            vixData: vixData,
            recommendation: extractRecommendation(aiAnalysis),
            priceTarget: extractPriceTarget(aiAnalysis, stockData.price),
            riskLevel: assessRiskLevel(stockData, vixData),
            confidence: calculateConfidence(stockData),
            timestamp: new Date().toISOString(),
            dataSource: 'Alpha Vantage + Gemini AI Basic Analysis'
        };

        console.log(`[ai-analysis.js] Successfully generated AI analysis for ${symbol}`);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                analysis: analysisResult,
                dataQuality: 'Real-Time',
                timestamp: new Date().toISOString(),
                dataSource: "Alpha Vantage + Gemini AI"
            })
        };

    } catch (error) {
        console.error('[ai-analysis.js] Error:', error);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: "AI analysis error",
                details: error.message,
                timestamp: new Date().toISOString(),
                dataSource: "Error - Analysis Failed"
            })
        };
    }
};

// Helper functions
function extractRecommendation(analysis) {
    const text = analysis.toLowerCase();
    if (text.includes('buy') || text.includes('bullish')) return 'Buy';
    if (text.includes('sell') || text.includes('bearish')) return 'Sell';
    return 'Hold';
}

function extractPriceTarget(analysis, currentPrice) {
    const priceMatches = analysis.match(/\$(\d+\.?\d*)/g);
    if (priceMatches && priceMatches.length > 1) {
        const prices = priceMatches.map(p => parseFloat(p.replace('$', '')));
        const validTargets = prices.filter(p => p > currentPrice * 0.9 && p < currentPrice * 1.2);
        if (validTargets.length > 0) {
            return `$${Math.max(...validTargets).toFixed(2)}`;
        }
    }
    return 'N/A';
}

function assessRiskLevel(stockData, vixData) {
    let riskScore = 0;
    
    const priceRange = (stockData.high - stockData.low) / stockData.price;
    if (priceRange > 0.05) riskScore += 1;
    
    const changePercent = Math.abs(parseFloat(stockData.changePercent.replace('%', '')));
    if (changePercent > 3) riskScore += 1;
    
    if (vixData && vixData.level > 25) riskScore += 1;
    
    if (riskScore >= 2) return 'High';
    if (riskScore >= 1) return 'Medium';
    return 'Low';
}

function calculateConfidence(stockData) {
    let confidence = 60; // Base confidence
    
    if (stockData.volume > 1000000) confidence += 15;
    
    const changePercent = Math.abs(parseFloat(stockData.changePercent.replace('%', '')));
    if (changePercent > 2) confidence += 10;
    
    return Math.min(90, confidence);
}
