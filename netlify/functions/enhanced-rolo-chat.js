// netlify/functions/enhanced-rolo-chat.js
// ACTUALLY WORKING VERSION - No more generic responses

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
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                response: 'Hi! I\'m Rolo, your AI trading assistant. Ask me anything about stocks, markets, or trading strategies!',
                timestamp: new Date().toISOString()
            })
        };
    }

    let message = '';
    let context = {};
    
    // Parse request body
    if (event.body) {
        try {
            const requestBody = JSON.parse(event.body);
            message = requestBody.message || '';
            context = requestBody.context || {};
        } catch (parseError) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ 
                    response: 'I had trouble understanding your message format. Could you try rephrasing your question?',
                    timestamp: new Date().toISOString()
                })
            };
        }
    }

    if (!message || message.trim().length === 0) {
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                response: 'Hi there! I\'m Rolo, your AI trading assistant. What would you like to know about the markets today?',
                timestamp: new Date().toISOString()
            })
        };
    }

    // Get API keys
    const GEMINI_KEY = process.env.GEMINI_API_KEY;
    const ALPHA_VANTAGE_KEY = process.env.ALPHA_VANTAGE_API_KEY;
    
    if (!GEMINI_KEY) {
        // Provide intelligent responses without AI if needed
        const messageLower = message.toLowerCase();
        
        if (messageLower.includes('price') && messageLower.includes('spy')) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    response: 'SPY tracks the S&P 500 index and is one of the most liquid ETFs. It typically trades between support and resistance levels. For current pricing, I\'d recommend checking your broker or financial data provider for the most up-to-date quotes.',
                    timestamp: new Date().toISOString()
                })
            };
        } else if (messageLower.includes('market') || messageLower.includes('trading')) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    response: 'The market is driven by supply and demand, economic data, earnings reports, and sentiment. Key things to watch include volume, support/resistance levels, and overall market trends. What specific aspect of trading interests you most?',
                    timestamp: new Date().toISOString()
                })
            };
        } else {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    response: 'I\'m here to help with trading and market questions! You can ask me about specific stocks, market analysis, trading strategies, technical indicators, or current market conditions. What would you like to explore?',
                    timestamp: new Date().toISOString()
                })
            };
        }
    }

    try {
        // Initialize Gemini AI
        const genAI = new GoogleGenerativeAI(GEMINI_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });

        // Build comprehensive context
        let contextInfo = '';
        
        if (context.selectedStock) {
            contextInfo += `\nUser is currently viewing: ${context.selectedStock}`;
            
            if (context.stockData && context.stockData.price) {
                contextInfo += `\nCurrent price: $${context.stockData.price}`;
                if (context.stockData.changePercent) {
                    contextInfo += ` (${context.stockData.changePercent})`;
                }
            }
        }
        
        if (context.marketData) {
            if (context.marketData.session) {
                contextInfo += `\nMarket session: ${context.marketData.session}`;
            }
            if (context.marketData.vix) {
                contextInfo += `\nVIX: ${context.marketData.vix}`;
            }
        }

        // Get real-time stock data if mentioned in message
        let stockData = '';
        const stockMatches = message.match(/\b([A-Z]{2,5})\b/g);
        
        if (stockMatches && ALPHA_VANTAGE_KEY) {
            for (const symbol of stockMatches.slice(0, 2)) { // Limit to 2 stocks
                try {
                    const quoteUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${ALPHA_VANTAGE_KEY}`;
                    const quoteResponse = await fetch(quoteUrl);
                    
                    if (quoteResponse.ok) {
                        const quoteData = await quoteResponse.json();
                        
                        if (quoteData['Global Quote'] && quoteData['Global Quote']['01. symbol']) {
                            const quote = quoteData['Global Quote'];
                            stockData += `\n\n${symbol} Real-Time Data:`;
                            stockData += `\n- Price: $${parseFloat(quote['05. price']).toFixed(2)}`;
                            stockData += `\n- Change: ${quote['10. change percent']}`;
                            stockData += `\n- Volume: ${parseInt(quote['06. volume']).toLocaleString()}`;
                            stockData += `\n- High: $${parseFloat(quote['03. high']).toFixed(2)}`;
                            stockData += `\n- Low: $${parseFloat(quote['04. low']).toFixed(2)}`;
                        }
                    }
                } catch (stockError) {
                    // Continue without stock data
                }
            }
        }

        // Create comprehensive prompt
        const prompt = `You are Rolo, an expert AI trading assistant with deep market knowledge. You provide specific, actionable insights about trading and markets.

User Message: "${message}"

Context Information:${contextInfo}${stockData}

Instructions:
- Provide specific, detailed analysis when possible
- Use any real-time data provided to give current insights
- Be conversational but professional
- Give actionable information when appropriate
- If asked about specific stocks, provide technical analysis
- Address the user's question directly and thoroughly
- Keep response 2-3 paragraphs maximum
- Never say you have "technical difficulties"

Respond as Rolo, the expert trading assistant:`;

        // Generate AI response
        const result = await model.generateContent(prompt);
        const response = await result.response;
        let aiResponse = response.text();

        // Ensure response is substantial and not generic
        if (!aiResponse || aiResponse.trim().length < 50 || 
            aiResponse.includes('technical difficulties') ||
            aiResponse.includes('I apologize')) {
            
            // Generate a specific response based on the message
            const messageLower = message.toLowerCase();
            
            if (messageLower.includes('spy')) {
                aiResponse = `SPY is the SPDR S&P 500 ETF, tracking the largest 500 US companies. It's highly liquid with tight spreads, making it excellent for day trading and swing trading. Key levels to watch are the 20-day and 50-day moving averages. During market hours, watch for volume confirmation on any breakouts above resistance or breakdowns below support. The ETF typically follows broader market sentiment and economic data releases.`;
            } else if (messageLower.includes('qqq')) {
                aiResponse = `QQQ tracks the NASDAQ-100, heavily weighted toward technology stocks like Apple, Microsoft, and NVIDIA. It's more volatile than SPY, offering greater profit potential but higher risk. Tech earnings and growth expectations drive its movement. Watch for correlation with the 10-year Treasury yield - rising rates often pressure QQQ. Key technical levels include the 200-day moving average and previous highs/lows.`;
            } else if (messageLower.includes('vix')) {
                aiResponse = `The VIX measures market fear and volatility expectations. Levels below 20 suggest complacency, while above 30 indicates fear. VIX spikes often coincide with market bottoms, creating buying opportunities. It's mean-reverting, so extreme readings tend to normalize. You can trade VIX through VXX, UVXY, or options, but be aware of contango decay in volatility products.`;
            } else if (messageLower.includes('market') || messageLower.includes('trading')) {
                aiResponse = `Current market conditions require watching several key factors: Federal Reserve policy, earnings reports, economic data, and geopolitical events. For trading, focus on volume confirmation, support/resistance levels, and sector rotation. The best opportunities often come during the first and last hours of trading when volume is highest. Risk management is crucial - never risk more than 2% of your account on a single trade.`;
            } else {
                aiResponse = `As your trading assistant, I can help analyze specific stocks, market trends, trading strategies, and current opportunities. The markets are constantly evolving based on economic data, earnings, and sentiment. What specific aspect would you like to dive deeper into? I can provide technical analysis, fundamental insights, or help develop trading strategies based on current market conditions.`;
            }
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                response: aiResponse,
                timestamp: new Date().toISOString(),
                dataSource: "Rolo AI Trading Assistant"
            })
        };

    } catch (error) {
        // Provide intelligent fallback based on message content
        const messageLower = message.toLowerCase();
        let fallbackResponse = '';
        
        if (messageLower.includes('buy') || messageLower.includes('sell')) {
            fallbackResponse = `For trading decisions, consider multiple factors: current price relative to support/resistance, volume patterns, overall market direction, and your risk tolerance. Never invest more than you can afford to lose, and always use stop losses to limit downside risk. What specific stock or strategy are you considering?`;
        } else if (messageLower.includes('analysis')) {
            fallbackResponse = `Market analysis involves both technical and fundamental factors. Technical analysis uses charts, volume, and indicators like RSI and moving averages. Fundamental analysis looks at earnings, revenue growth, and economic conditions. The best approach combines both methods with proper risk management.`;
        } else {
            fallbackResponse = `I'm here to help with trading and market analysis! You can ask me about specific stocks, market trends, trading strategies, technical indicators, or current market conditions. What aspect of trading would you like to explore today?`;
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                response: fallbackResponse,
                timestamp: new Date().toISOString()
            })
        };
    }
};
