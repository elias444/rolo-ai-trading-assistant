// netlify/functions/comprehensive-ai-analysis.js
// SIMPLE WORKING VERSION - Fixes HTTP 500 errors

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
        // Get API keys
        const ALPHA_VANTAGE_KEY = process.env.ALPHA_VANTAGE_API_KEY;
        const GEMINI_KEY = process.env.GEMINI_API_KEY;
        
        if (!ALPHA_VANTAGE_KEY) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ 
                    error: 'Alpha Vantage API key not configured'
                })
            };
        }

        if (!GEMINI_KEY) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ 
                    error: 'Gemini API key not configured'
                })
            };
        }
        
        // Get symbol from request
        let symbol = 'SPY';
        if (event.queryStringParameters && event.queryStringParameters.symbol) {
            symbol = event.queryStringParameters.symbol.toUpperCase();
        }
        
        console.log(`Analyzing symbol: ${symbol}`);
        
        // Get stock data from Alpha Vantage
        const quoteUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${ALPHA_VANTAGE_KEY}`;
        const quoteResponse = await fetch(quoteUrl);
        const quoteJson = await quoteResponse.json();
        
        if (!quoteJson['Global Quote']) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({
                    error: `No data available for ${symbol}`
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

        // Create simple AI analysis using Gemini
        const { GoogleGenerativeAI } = require('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(GEMINI_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });

        const prompt = `Analyze ${stockData.symbol} stock with this data:
Price: $${stockData.price}
Change: ${stockData.changePercent}
Volume: ${stockData.volume.toLocaleString()}
High: $${stockData.high}
Low: $${stockData.low}

Provide a brief analysis with:
1. Current trend assessment
2. Support and resistance levels
3. Buy/Hold/Sell recommendation
4. Price target
5. Risk level (Low/Medium/High)

Keep response under 200 words.`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const aiAnalysis = response.text();

        // Extract recommendation and price target
        const recommendation = aiAnalysis.toLowerCase().includes('buy') ? 'Buy' : 
                             aiAnalysis.toLowerCase().includes('sell') ? 'Sell' : 'Hold';
        
        const priceMatches = aiAnalysis.match(/\$(\d+\.?\d*)/g);
        const priceTarget = priceMatches && priceMatches.length > 1 ? 
                           priceMatches.find(p => parseFloat(p.replace('$', '')) > stockData.price * 0.9) || 'N/A' : 'N/A';

        const riskLevel = aiAnalysis.toLowerCase().includes('high risk') ? 'High' :
                         aiAnalysis.toLowerCase().includes('low risk') ? 'Low' : 'Medium';

        const analysisResult = {
            symbol: stockData.symbol,
            analysis: aiAnalysis,
            marketData: stockData,
            recommendation: recommendation,
            priceTarget: priceTarget,
            riskLevel: riskLevel,
            confidence: 75,
            timestamp: new Date().toISOString()
        };

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                analysis: analysisResult,
                dataQuality: 'Real-Time',
                timestamp: new Date().toISOString()
            })
        };

    } catch (error) {
        console.error('Analysis error:', error);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: "Analysis failed",
                details: error.message
            })
        };
    }
};
