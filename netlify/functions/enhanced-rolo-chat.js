// netlify/functions/enhanced-rolo-chat.js
// ADD THIS AS A NEW FILE - makes Rolo AI smarter and more conversational
// Works alongside your existing claude-chat.js as an upgrade

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
        const { message, context: userContext } = JSON.parse(event.body || '{}');
        
        if (!message) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Message is required' })
            };
        }

        // Initialize Google Generative AI
        const API_KEY = process.env.GEMINI_API_KEY; // Ensure this env variable is set in Netlify!
        if (!API_KEY) {
            console.error("GEMINI_API_KEY environment variable is not set.");
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'AI service configuration error. Please contact support.' })
            };
        }
        const genAI = new GoogleGenerativeAI(API_KEY);

        // *** THIS IS THE CRUCIAL LINE: Using the recommended gemini-1.5-flash model ***
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); 
        
        // Start a chat session
        const chat = model.startChat({
            history: [], // You might want to pass actual conversation history here
            generationConfig: {
                maxOutputTokens: 2000,
            },
        });

        console.log("Sending prompt to Gemini API...");
        const result = await chat.sendMessage(message);
        const responseText = await result.response.text();
        console.log("Received response from Gemini API.");

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                response: responseText,
                source: 'enhanced-rolo-ai',
                timestamp: new Date().toISOString()
            })
        };

    } catch (error) {
        console.error('Enhanced Rolo chat error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Enhanced chat temporarily unavailable',
                details: error.message // Provide error details for debugging
            })
        };
    }
};
