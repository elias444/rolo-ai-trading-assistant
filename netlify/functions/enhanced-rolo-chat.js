// netlify/functions/enhanced-rolo-chat.js
// ADD THIS AS A NEW FILE - makes Rolo AI smarter and more conversational
// This function integrates with Google's Gemini AI for conversational responses.

const { GoogleGenerativeAI } = require("@google/generative-ai");
const fetch = require('node-fetch'); // Required for server-side fetch

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

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method Not Allowed', message: 'Only POST requests are allowed.' })
        };
    }

    try {
        // Expecting 'message' and 'history' (array of previous messages) from the frontend
        const { message, history } = JSON.parse(event.body || '{}');

        if (!message) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Bad Request', message: 'Message content is required.' })
            };
        }

        // Get Gemini API key from Netlify environment variables
        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

        if (!GEMINI_API_KEY) {
            console.error("GEMINI_API_KEY is not set in environment variables.");
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({
                    error: 'Server Configuration Error',
                    message: 'Gemini API Key is not configured. Please set GEMINI_API_KEY in Netlify environment variables.'
                })
            };
        }

        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        // Use gemini-pro for general conversational chat
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });

        // Format the chat history for Gemini API.
        // Gemini's API expects roles 'user' and 'model' and content in 'parts'.
        const formattedHistory = (history || []).map(msg => ({
            role: msg.type === 'user' ? 'user' : 'model', // 'assistant' maps to 'model' for Gemini
            parts: [{ text: msg.content }]
        }));

        // Start a chat session with the formatted history
        const chat = model.startChat({
            history: formattedHistory,
            generationConfig: {
                maxOutputTokens: 2000, // Adjust as needed
            },
        });

        // Send the new message to the chat session
        const result = await chat.sendMessage(message);
        const response = await result.response;
        const text = response.text();

        console.log("Gemini response:", text); // Log the AI's response for debugging

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                response: text,
                source: 'Gemini AI',
                timestamp: new Date().toISOString()
            })
        };

    } catch (error) {
        console.error('Error in enhanced-rolo-chat function:', error);
        
        let errorMessage = 'An unexpected error occurred.';
        if (error.message.includes('API key')) {
             errorMessage = 'Invalid or expired Gemini API key. Please check your Netlify environment variables.';
        } else if (error.message.includes('quota')) {
            errorMessage = 'Gemini API quota exceeded. Please try again later.';
        } else if (error.response && error.response.status) {
            errorMessage = `Gemini API error: ${error.response.status} - ${error.message}`;
        }


        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'AI Communication Error',
                message: errorMessage,
                details: error.message // Include error details for debugging
            })
        };
    }
};
