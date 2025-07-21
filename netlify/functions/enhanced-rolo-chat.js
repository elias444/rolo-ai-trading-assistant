// netlify/functions/enhanced-rolo-chat.js
// FIXED: Working AI chat with proper error handling

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
                error: 'Only POST method allowed',
                response: 'Please use POST method to send messages.',
                timestamp: new Date().toISOString()
            })
        };
    }

    try {
        console.log(`[enhanced-rolo-chat.js] Processing chat request...`);
        
        // Parse request body safely
        let requestBody = {};
        try {
            if (event.body) {
                requestBody = JSON.parse(event.body);
            }
        } catch (parseError) {
            console.error(`[enhanced-rolo-chat.js] JSON parse error: ${parseError.message}`);
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    error: 'Invalid JSON in request body',
                    response: 'Please send a valid JSON message.',
                    timestamp: new Date().toISOString()
                })
            };
        }

        const message = requestBody.message;
        const context = requestBody.context || {};
        
        // Validate message
        if (!message || typeof message !== 'string' || message.trim().length === 0) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    error: 'Message is required',
                    response: 'Please provide a message to chat with Rolo.',
                    timestamp: new Date().toISOString()
                })
            };
        }

        console.log(`[enhanced-rolo-chat.js] Message: "${message.substring(0, 50)}..."`);
        
        // Get API keys
        const GEMINI_KEY = process.env.GEMINI_API_KEY;
        const ALPHA_VANTAGE_KEY = process.env.ALPHA_VANTAGE_API_KEY;
        
        if (!GEMINI_KEY) {
            console.error('[enhanced-rolo-chat.js] Gemini API key missing');
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ 
                    error: 'AI service unavailable',
                    response: 'Sorry, the AI chat service is temporarily unavailable. Please try again later.',
                    timestamp: new Date().toISOString()
                })
            };
        }

        // Initialize Gemini AI safely
        let genAI, model;
        try {
            genAI = new GoogleGenerativeAI(GEMINI_KEY);
            model = genAI.getGenerativeModel({ model: "gemini-pro" });
            console.log(`[enhanced-rolo-chat.js] ✅ Gemini AI initialized`);
        } catch (aiInitError) {
            console.error(`[enhanced-rolo-chat.js] Gemini init error: ${aiInitError.message}`);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({
                    error: 'AI initialization failed',
                    response: 'Sorry, I\'m having trouble starting up. Please try again in a moment.',
                    timestamp: new Date().toISOString()
                })
            };
        }

        // Build context string safely
        let contextString = '';
        
        try {
            // Add stock context if available
            if (context.selectedStock && context.stockData) {
                const stock = context.stockData;
                contextString += `\nCURRENT STOCK CONTEXT (${context.selectedStock}):`;
                if (stock.price) contextString += `\n- Price: ${typeof stock.price === 'number' ? ' + stock.price.toFixed(2) : stock.price}`;
                if (stock.changePercent) contextString += `\n- Change: ${stock.changePercent}`;
                if (stock.volume) contextString += `\n- Volume: ${typeof stock.volume === 'number' ? stock.volume.toLocaleString() : stock.volume}`;
                if (stock.marketSession) contextString += `\n- Session: ${stock.marketSession}`;
            }

            // Add market context if available
            if (context.marketData && typeof context.marketData === 'object') {
                if (context.marketData.session) {
                    contextString += `\nMARKET SESSION: ${context.marketData.session}`;
                }
                
                if (context.marketData.indices && typeof context.marketData.indices === 'object') {
                    const indicesCount = Object.keys(context.marketData.indices).length;
                    if (indicesCount > 0) {
                        contextString += `\nMAJOR INDICES:`;
                        Object.entries(context.marketData.indices).slice(0, 3).forEach(([index, data]) => {
                            if (data && data.changePercent) {
                                contextString += `\n- ${index}: ${data.changePercent}`;
                            }
                        });
                    }
                }
                
                if (context.marketData.vix) {
                    contextString += `\nVIX: ${context.marketData.vix} (${context.marketData.marketMood || 'Unknown'})`;
                }
            }

            // Add alerts context if available
            if (context.recentAlerts && Array.isArray(context.recentAlerts) && context.recentAlerts.length > 0) {
                contextString += `\nRECENT ALERTS:`;
                context.recentAlerts.slice(0, 2).forEach(alert => {
                    if (alert && (alert.message || alert.type)) {
                        contextString += `\n- ${alert.symbol || 'Market'}: ${alert.message || alert.type}`;
                    }
                });
            }
        } catch (contextError) {
            console.warn(`[enhanced-rolo-chat.js] Context processing error: ${contextError.message}`);
            // Continue without context if there's an error
        }

        // Detect stock symbols in message and fetch real-time data
        let additionalStockData = '';
        if (ALPHA_VANTAGE_KEY) {
            try {
                const stockSymbolMatch = message.match(/\b([A-Z]{2,5})\b/g);
                if (stockSymbolMatch && stockSymbolMatch.length > 0) {
                    const symbol = stockSymbolMatch[0];
                    console.log(`[enhanced-rolo-chat.js] Fetching data for mentioned stock: ${symbol}`);
                    
                    const quoteUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${ALPHA_VANTAGE_KEY}`;
                    const quoteResponse = await fetch(quoteUrl);
                    
                    if (quoteResponse.ok) {
                        const quoteJson = await quoteResponse.json();
                        
                        if (quoteJson['Global Quote'] && quoteJson['Global Quote']['01. symbol']) {
                            const quote = quoteJson['Global Quote'];
                            additionalStockData = `\nREAL-TIME DATA FOR ${symbol}:`;
                            additionalStockData += `\n- Current Price: ${parseFloat(quote['05. price']).toFixed(2)}`;
                            additionalStockData += `\n- Change: ${quote['10. change percent']}`;
                            additionalStockData += `\n- Volume: ${parseInt(quote['06. volume']).toLocaleString()}`;
                            console.log(`[enhanced-rolo-chat.js] ✅ Got real-time data for ${symbol}`);
                        }
                    }
                }
            } catch (stockDataError) {
                console.warn(`[enhanced-rolo-chat.js] Stock data fetch error: ${stockDataError.message}`);
                // Continue without additional stock data
            }
        }

        // Create comprehensive prompt
        const prompt = `You are Rolo, an expert AI trading assistant. You provide helpful, accurate, and professional trading advice in a conversational manner.

USER MESSAGE: "${message}"

${contextString}${additionalStockData}

INSTRUCTIONS:
- Be helpful and conversational while maintaining professional expertise
- Use any real market data provided in your context when relevant
- If asked about specific stocks, provide analysis based on current data when available
- If no real data is available, be honest about limitations but still provide general guidance
- Keep responses concise but informative (2-3 paragraphs maximum)
- Focus on actionable insights when possible
- Frame advice as educational analysis, not personal investment recommendations
- If market is closed, acknowledge the session and discuss what to watch for next
- Be friendly and approachable while remaining professional

Respond as Rolo, the AI trading assistant:`;

        // Generate AI response
        let aiResponse;
        try {
            console.log(`[enhanced-rolo-chat.js] Sending request to Gemini AI...`);
            const result = await model.generateContent(prompt);
            const response = await result.response;
            aiResponse = response.text();
            
            if (!aiResponse || aiResponse.trim().length === 0) {
                throw new Error('Empty response from AI');
            }
            
            console.log(`[enhanced-rolo-chat.js] ✅ AI response generated (${aiResponse.length} characters)`);
            
        } catch (aiResponseError) {
            console.error(`[enhanced-rolo-chat.js] AI response error: ${aiResponseError.message}`);
            
            // Provide a helpful fallback response
            aiResponse = `I understand you're asking about "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}". I'm having trouble accessing my AI analysis right now, but I'm here to help with trading and market questions. Could you try asking your question again, or perhaps be more specific about what you'd like to know?`;
        }

        // Return successful response
        const responseData = {
            response: aiResponse,
            context: {
                hasStockContext: !!(context.selectedStock && context.stockData),
                hasMarketContext: !!(context.marketData && typeof context.marketData === 'object' && Object.keys(context.marketData).length > 0),
                hasAlertsContext: !!(context.recentAlerts && Array.isArray(context.recentAlerts) && context.recentAlerts.length > 0),
                additionalDataFetched: !!additionalStockData,
                messageLength: message.length
            },
            timestamp: new Date().toISOString(),
            dataSource: "Gemini AI with Real Market Context"
        };

        console.log(`[enhanced-rolo-chat.js] ✅ Chat response completed successfully`);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(responseData)
        };

    } catch (unexpectedError) {
        console.error(`[enhanced-rolo-chat.js] Unexpected error:`, unexpectedError);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: "Chat processing error",
                details: unexpectedError.message,
                response: "I'm sorry, I encountered an unexpected error. Please try asking your question again, and if the problem persists, try refreshing the page.",
                timestamp: new Date().toISOString(),
                dataSource: "Error - Chat Failed"
            })
        };
    }
};
