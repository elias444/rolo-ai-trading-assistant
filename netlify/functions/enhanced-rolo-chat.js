// netlify/functions/enhanced-rolo-chat.js
// SIMPLE WORKING VERSION - Fixes chat errors

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
                error: 'Only POST allowed',
                response: 'Please use POST method.'
            })
        };
    }

    try {
        // Parse request body
        let message = '';
        let context = {};
        
        if (event.body) {
            try {
                const requestBody = JSON.parse(event.body);
                message = requestBody.message || '';
                context = requestBody.context || {};
            } catch (parseError) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ 
                        error: 'Invalid JSON',
                        response: 'Please send valid JSON.'
                    })
                };
            }
        }

        if (!message || message.trim().length === 0) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    error: 'Message required',
                    response: 'Please provide a message.'
                })
            };
        }

        console.log(`Chat message: ${message.substring(0, 50)}...`);
        
        // Get Gemini API key
        const GEMINI_KEY = process.env.GEMINI_API_KEY;
        
        if (!GEMINI_KEY) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ 
                    error: 'AI unavailable',
                    response: 'Sorry, AI chat is temporarily unavailable.'
                })
            };
        }

        // Initialize Gemini AI
        const { GoogleGenerativeAI } = require('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(GEMINI_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });

        // Build context string
        let contextInfo = '';
        
        if (context.selectedStock) {
            contextInfo += `\nUser is viewing: ${context.selectedStock}`;
        }
        
        if (context.marketData && context.marketData.session) {
            contextInfo += `\nMarket Session: ${context.marketData.session}`;
        }

        // Create prompt
        const prompt = `You are Rolo, a helpful AI trading assistant. 

User asks: "${message}"
${contextInfo}

Provide a helpful, conversational response about trading or markets. Keep it under 150 words and be friendly but professional. If asked about specific stocks, provide educational analysis. Never give direct investment advice.`;

        console.log('Sending to Gemini AI...');
        
        // Get AI response
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const aiResponse = response.text();

        if (!aiResponse || aiResponse.trim().length === 0) {
            throw new Error('Empty AI response');
        }

        console.log(`AI response generated: ${aiResponse.length} characters`);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                response: aiResponse,
                timestamp: new Date().toISOString()
            })
        };

    } catch (error) {
        console.error('Chat error:', error);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: "Chat failed",
                response: "I'm having trouble right now. Please try asking your question again.",
                timestamp: new Date().toISOString()
            })
        };
    }
};
