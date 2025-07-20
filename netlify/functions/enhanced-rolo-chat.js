// netlify/functions/enhanced-rolo-chat.js
// AI-powered chat with context awareness - ZERO MOCK DATA - FINAL FIX

const { GoogleGenerativeAI } = require('@google/generative-ai');

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ 
                error: 'Method not allowed - use POST',
                timestamp: new Date().toISOString()
            })
        };
    }

    try {
        let body;
        try {
            body = JSON.parse(event.body || '{}');
        } catch (parseError) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    error: 'Invalid JSON in request body',
                    timestamp: new Date().toISOString()
                })
            };
        }

        const message = body.message;
        const context = body.context || {};
        
        if (!message || typeof message !== 'string' || !message.trim()) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    error: 'Message is required and must be a non-empty string',
                    timestamp: new Date().toISOString()
                })
            };
        }

        console.log(`[enhanced-rolo-chat.js] Processing chat message: "${message.substring(0, 50)}..."`);
        
        const GEMINI_KEY = process.env.GEMINI_API_KEY;
        const ALPHA_VANTAGE_KEY = process.env.ALPHA_VANTAGE_API_KEY;
        
        if (!GEMINI_KEY) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ 
                    error: 'Gemini API key not configured',
                    response: 'Sorry, AI chat is not available right now. Please try again later.',
                    timestamp: new Date().toISOString()
                })
            };
        }

        // Initialize Gemini AI
        const genAI = new GoogleGenerativeAI(GEMINI_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });

        // Build context-aware prompt with real data
        let contextData = '';
        
        // Add selected stock context if available
        if (context.selectedStock && context.stockData && Object.keys(context.stockData).length > 0) {
            const stock = context.stockData;
            contextData += `\nCURRENT STOCK CONTEXT (${context.selectedStock}):`;
            if (stock.price) contextData += `\n- Price: ${typeof stock.price === 'number' ? '$' + stock.price.toFixed(2) : stock.price}`;
            if (stock.changePercent) contextData += `\n- Change: ${stock.changePercent}`;
            if (stock.volume) contextData += `\n- Volume: ${typeof stock.volume === 'number' ? stock.volume.toLocaleString() : stock.volume}`;
            if (stock.marketSession) contextData += `\n- Market Session: ${stock.marketSession}`;
        }

        // Add market data context if available
        if (context.marketData && Object.keys(context.marketData).length > 0) {
            contextData += `\nMARKET CONTEXT:`;
            if (context.marketData.session) {
                contextData += `\n- Market Session: ${context.marketData.session}`;
            }
            if (context.marketData.indices && Object.keys(context.marketData.indices).length > 0) {
                contextData += `\n- Major Indices:`;
                Object.entries(context.marketData.indices).forEach(([index, data]) => {
                    if (data && data.changePercent) {
                        contextData += `\n  - ${index}: ${data.changePercent}`;
                    }
                });
            }
            if (context.marketData.vix) {
                contextData += `\n- VIX: ${context.marketData.vix} (${context.marketData.marketMood || 'Unknown'})`;
            }
        }

        // Add recent alerts context if available
        if (context.recentAlerts && Array.isArray(context.recentAlerts) && context.recentAlerts.length > 0) {
            contextData += `\nRECENT ALERTS:`;
            context.recentAlerts.slice(0, 3).forEach(alert => {
                if (alert && (alert.message || alert.type)) {
                    contextData += `\n- ${alert.symbol || 'Market'}: ${alert.message || alert.type}`;
                }
            });
        }

        // Detect if user is asking about a specific stock and fetch real-time data
        const stockSymbolMatch = message.match(/\b([A-Z]{1,5})\b/g);
        let additionalStockData = '';
        
        if (stockSymbolMatch && ALPHA_VANTAGE_KEY) {
            const symbol = stockSymbolMatch[0];
            try {
                console.log(`[enhanced-rolo-chat.js] Fetching real-time data for mentioned stock: ${symbol}`);
                
                const quoteUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${ALPHA_VANTAGE_KEY}`;
                const quoteResponse = await fetch(quoteUrl);
                
                if (quoteResponse.ok) {
                    const quoteJson = await quoteResponse.json();
                    
                    if (quoteJson['Global Quote']) {
                        const quote = quoteJson['Global Quote'];
                        additionalStockData = `\nREAL-TIME DATA FOR ${symbol}:`;
                        additionalStockData += `\n- Current Price: $${parseFloat(quote['05. price']).toFixed(2)}`;
                        additionalStockData += `\n- Change: ${quote['10. change percent']}`;
                        additionalStockData += `\n- Volume: ${parseInt(quote['06. volume']).toLocaleString()}`;
                        additionalStockData += `\n- High: $${parseFloat(quote['03. high']).toFixed(2)}`;
                        additionalStockData += `\n- Low: $${parseFloat(quote['04. low']).toFixed(2)}`;
                    }
                }
            } catch (stockError) {
                console.warn(`[enhanced-rolo-chat.js] Could not fetch data for ${symbol}: ${stockError.message}`);
            }
        }

        // Create comprehensive prompt
        const prompt = `You are Rolo, an expert AI trading assistant. You provide helpful, accurate, and professional trading advice.

USER MESSAGE: "${message}"

${contextData}${additionalStockData}

INSTRUCTIONS:
- Be helpful and conversational while maintaining professional expertise
- Use the real market data provided in your context when relevant
- If asked about stocks, provide specific analysis based on real current data
- If no real data is available, be honest about limitations
- Keep responses concise but informative (2-3 paragraphs max)
- Focus on actionable insights when possible
- Never provide investment advice as "recommendations" - frame as educational analysis
- If asked about market conditions, reference the real VIX and market session data
- If market is closed, acknowledge current session and discuss what to watch for next session

Respond as Rolo, the AI trading assistant:`;

        console.log(`[enhanced-rolo-chat.js] Sending chat request to Gemini AI...`);
        
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const aiResponse = response.text();

        console.log(`[enhanced-rolo-chat.js] Generated AI response (${aiResponse.length} characters)`);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                response: aiResponse,
                context: {
                    hasStockContext: !!(context.selectedStock && context.stockData),
                    hasMarketContext: !!(context.marketData && Object.keys(context.marketData).length > 0),
                    hasAlertsContext: !!(context.recentAlerts && context.recentAlerts.length > 0),
                    additionalDataFetched: !!additionalStockData,
                    processedMessage: message.substring(0, 50) + (message.length > 50 ? '...' : '')
                },
                timestamp: new Date().toISOString(),
                dataSource: "Gemini AI with Real Market Context"
            })
        };

    } catch (error) {
        console.error('[enhanced-rolo-chat.js] Error:', error);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: "Chat processing error",
                details: error.message,
                response: "I'm sorry, I encountered an error processing your message. Please try again in a moment.",
                timestamp: new Date().toISOString(),
                dataSource: "Error - Chat Failed"
            })
        };
    }
};
