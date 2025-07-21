// netlify/functions/enhanced-rolo-chat.js
// FINAL WORKING VERSION - Chat function that actually works

exports.handler = async (event, context) => {
    console.log('Chat function started');
    
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
                response: 'Please use POST method to send messages.',
                timestamp: new Date().toISOString()
            })
        };
    }

    try {
        console.log('Processing chat request...');
        
        // Parse request body safely
        let message = '';
        let context = {};
        
        if (event.body) {
            try {
                const requestBody = JSON.parse(event.body);
                message = requestBody.message || '';
                context = requestBody.context || {};
                console.log(`Message received: "${message.substring(0, 50)}..."`);
            } catch (parseError) {
                console.error('JSON parse error:', parseError);
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({ 
                        response: 'I had trouble understanding your message format. Please try again.',
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
                    response: 'Please provide a message for me to respond to.',
                    timestamp: new Date().toISOString()
                })
            };
        }

        // Get Gemini API key
        const GEMINI_KEY = process.env.GEMINI_API_KEY;
        
        if (!GEMINI_KEY) {
            console.error('Gemini API key missing');
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ 
                    response: 'I\'m temporarily unavailable due to configuration issues. Please try again later.',
                    timestamp: new Date().toISOString()
                })
            };
        }

        // Build context information
        let contextInfo = '';
        
        try {
            if (context.selectedStock) {
                contextInfo += `\nUser is currently viewing: ${context.selectedStock}`;
            }
            
            if (context.marketData && context.marketData.session) {
                contextInfo += `\nCurrent market session: ${context.marketData.session}`;
            }
            
            if (context.stockData && context.selectedStock) {
                const stock = context.stockData;
                if (stock.price) {
                    contextInfo += `\n${context.selectedStock} current price: $${stock.price}`;
                }
                if (stock.changePercent) {
                    contextInfo += ` (${stock.changePercent})`;
                }
            }
        } catch (contextError) {
            console.warn('Context processing error:', contextError);
            // Continue without context
        }

        // Generate AI response
        let aiResponse = '';
        
        try {
            // Dynamic import to avoid module loading issues
            const { GoogleGenerativeAI } = await import('@google/generative-ai');
            const genAI = new GoogleGenerativeAI(GEMINI_KEY);
            const model = genAI.getGenerativeModel({ model: "gemini-pro" });

            const prompt = `You are Rolo, a helpful AI trading assistant. 

User message: "${message}"
${contextInfo}

Provide a helpful, conversational response about trading, markets, or stocks. Keep it under 200 words and be friendly but professional. If asked about specific stocks, provide educational analysis but never direct investment advice.`;

            console.log('Generating AI response...');
            const result = await model.generateContent(prompt);
            const response = await result.response;
            aiResponse = response.text();
            
            if (!aiResponse || aiResponse.trim().length === 0) {
                throw new Error('Empty AI response');
            }
            
            console.log('AI response generated successfully');
            
        } catch (aiError) {
            console.error('AI generation error:', aiError);
            
            // Provide intelligent fallback responses based on message content
            const messageLower = message.toLowerCase();
            
            if (messageLower.includes('price') || messageLower.includes('stock')) {
                aiResponse = `I understand you're asking about stock prices or market information. While I'm having trouble accessing my AI analysis right now, I can tell you that it's always important to do your own research and consider multiple factors when evaluating investments. What specific aspect of trading would you like to know more about?`;
            } else if (messageLower.includes('market') || messageLower.includes('trading')) {
                aiResponse = `Great question about the markets! While I'm experiencing some technical difficulties with my advanced analysis, I'm here to help with trading and market questions. The markets are complex and influenced by many factors including economic data, company earnings, and global events. What specific area would you like to explore?`;
            } else if (messageLower.includes('buy') || messageLower.includes('sell')) {
                aiResponse = `I understand you're thinking about trading decisions. While I can't provide specific investment advice, I can share that successful trading typically involves careful research, risk management, and staying informed about market conditions. What aspects of trading strategy interest you most?`;
            } else {
                aiResponse = `Thanks for your message! I'm here to help with trading and market questions, though I'm having some technical difficulties right now. Feel free to ask me about market analysis, trading strategies, or any stocks you're interested in learning about.`;
            }
        }

        console.log('Chat response completed');

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                response: aiResponse,
                timestamp: new Date().toISOString(),
                dataSource: "Rolo AI Assistant"
            })
        };

    } catch (error) {
        console.error('Chat function error:', error);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                response: "I'm having some technical difficulties right now, but I'm here to help with trading questions. Please try asking again, or feel free to ask about stocks, markets, or trading strategies.",
                timestamp: new Date().toISOString()
            })
        };
    }
};
