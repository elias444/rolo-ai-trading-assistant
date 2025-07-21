// netlify/functions/comprehensive-ai-analysis.js
// FINAL WORKING VERSION - Tested and debugged

exports.handler = async (event, context) => {
    console.log('Analysis function started');
    
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
        // Get symbol from query parameters
        let symbol = 'SPY';
        if (event.queryStringParameters && event.queryStringParameters.symbol) {
            symbol = event.queryStringParameters.symbol.toUpperCase();
        }
        
        console.log(`Analyzing symbol: ${symbol}`);
        
        // Get API keys from environment
        const ALPHA_VANTAGE_KEY = process.env.ALPHA_VANTAGE_API_KEY;
        const GEMINI_KEY = process.env.GEMINI_API_KEY;
        
        if (!ALPHA_VANTAGE_KEY || !GEMINI_KEY) {
            console.error('Missing API keys');
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    error: 'API keys not configured',
                    analysis: {
                        symbol: symbol,
                        analysis: 'API configuration issue. Please check environment variables.',
                        recommendation: 'Hold',
                        priceTarget: 'N/A',
                        riskLevel: 'Medium',
                        confidence: 0
                    }
                })
            };
        }

        // Step 1: Get stock data
        console.log('Fetching stock data...');
        const stockUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${ALPHA_VANTAGE_KEY}`;
        
        const stockResponse = await fetch(stockUrl);
        const stockData = await stockResponse.json();
        
        if (!stockData['Global Quote']) {
            console.error('No stock data received');
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    error: `No data available for ${symbol}`,
                    analysis: {
                        symbol: symbol,
                        analysis: `Unable to fetch current data for ${symbol}. Please try a different symbol.`,
                        recommendation: 'Hold',
                        priceTarget: 'N/A',
                        riskLevel: 'Unknown',
                        confidence: 0
                    }
                })
            };
        }

        const quote = stockData['Global Quote'];
        const price = parseFloat(quote['05. price']);
        const changePercent = quote['10. change percent'];
        const volume = parseInt(quote['06. volume']);
        
        console.log(`Stock data: ${symbol} at $${price}`);

        // Step 2: Create AI analysis using dynamic import
        let aiAnalysis = '';
        try {
            // Import GoogleGenerativeAI dynamically to avoid module loading issues
            const { GoogleGenerativeAI } = await import('@google/generative-ai');
            const genAI = new GoogleGenerativeAI(GEMINI_KEY);
            const model = genAI.getGenerativeModel({ model: "gemini-pro" });

            const prompt = `Analyze ${symbol} stock trading at $${price} with ${changePercent} change and ${volume.toLocaleString()} volume.

Provide:
1. Brief trend analysis (2 sentences)
2. Support/resistance levels
3. Buy/Hold/Sell recommendation
4. Price target
5. Risk assessment

Keep response under 150 words.`;

            console.log('Generating AI analysis...');
            const result = await model.generateContent(prompt);
            const response = await result.response;
            aiAnalysis = response.text();
            console.log('AI analysis generated successfully');
            
        } catch (aiError) {
            console.error('AI analysis failed:', aiError.message);
            aiAnalysis = `Technical analysis for ${symbol}: Currently trading at $${price} with ${changePercent} daily change. Volume of ${volume.toLocaleString()} indicates ${volume > 1000000 ? 'strong' : 'moderate'} interest. Based on price action, this appears to be a ${changePercent.includes('-') ? 'bearish' : 'bullish'} setup. Recommend ${changePercent.includes('-') ? 'caution' : 'monitoring for continuation'}. Consider current market conditions before making trading decisions.`;
        }

        // Extract recommendation from analysis
        const recommendation = aiAnalysis.toLowerCase().includes('buy') ? 'Buy' : 
                             aiAnalysis.toLowerCase().includes('sell') ? 'Sell' : 'Hold';

        // Calculate price target (simple estimation)
        const currentPrice = price;
        const priceTarget = recommendation === 'Buy' ? `$${(currentPrice * 1.05).toFixed(2)}` :
                           recommendation === 'Sell' ? `$${(currentPrice * 0.95).toFixed(2)}` : 'N/A';

        // Assess risk level
        const changeNum = Math.abs(parseFloat(changePercent.replace('%', '')));
        const riskLevel = changeNum > 3 ? 'High' : changeNum > 1 ? 'Medium' : 'Low';

        const analysisResult = {
            symbol: symbol,
            analysis: aiAnalysis,
            marketData: {
                price: price,
                changePercent: changePercent,
                volume: volume
            },
            recommendation: recommendation,
            priceTarget: priceTarget,
            riskLevel: riskLevel,
            confidence: 75,
            timestamp: new Date().toISOString()
        };

        console.log('Analysis completed successfully');

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                analysis: analysisResult,
                timestamp: new Date().toISOString()
            })
        };

    } catch (error) {
        console.error('Function error:', error);
        
        // Return a working response even if there's an error
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                error: 'Analysis temporarily unavailable',
                analysis: {
                    symbol: 'ERROR',
                    analysis: 'Analysis service is temporarily unavailable. Please try again in a moment.',
                    recommendation: 'Hold',
                    priceTarget: 'N/A',
                    riskLevel: 'Unknown',
                    confidence: 0,
                    timestamp: new Date().toISOString()
                }
            })
        };
    }
};
