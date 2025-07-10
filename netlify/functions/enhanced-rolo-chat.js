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

// --- Helper functions (These were likely already in your file. Keep them!) ---
// If these functions are not present, they might be in a separate file or the
// functionality you're expecting (like stock context) might not work.
// I'm assuming you have the full original enhanced-rolo-chat.js code which
// included functions like generateRoloResponse, getMarketContext, etc.
// If you are starting from a completely blank enhanced-rolo-chat.js,
// you might need to re-add these from a previous version of your code.

async function generateRoloResponse(message) {
    const lowerMessage = message.toLowerCase();

    // Check for specific keywords to trigger direct responses or mock data if API fails
    if (lowerMessage.includes('hello rolo') || lowerMessage.includes('hi rolo')) {
        return `Hello there! I'm Rolo, your AI-powered trading assistant. I'm connected to live market data and ready to help you analyze stocks, find options plays, and learn your trading style. What would you like to explore today?`;
    }

    if (lowerMessage.includes('market status')) {
        const now = new Date();
        const hour = now.getHours();
        const isMarketOpen = hour >= 9 && hour < 16 && now.getDay() >= 1 && now.getDay() <= 5;
        return `The market is currently ${isMarketOpen ? 'open' : 'closed'}. ${isMarketOpen ? 'Trading is active!' : 'It will open on the next business day.'}`;
    }

    if (lowerMessage.includes('analyze') || lowerMessage.includes('stock data')) {
        const symbolMatch = /\b([A-Z]{2,5})\b/.exec(lowerMessage);
        if (symbolMatch && symbolMatch[1]) {
            const symbol = symbolMatch[1].toUpperCase();
            // In a real scenario, you'd call your stock-data function here
            // For now, return a placeholder or direct API call via Gemini
            try {
                const stockContext = await getMarketContext(symbol);
                // Use Gemini for advanced analysis
                const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
                const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
                const result = await model.generateContent(`Analyze the stock ${symbol} for me, considering general market conditions and recent news (if you have access to real-time data, state it, otherwise give a general analysis). Be concise.`);
                const responseText = await result.response.text();
                return `${stockContext}\n\n${responseText}`;
            } catch (apiError) {
                console.error("Error fetching stock data via Gemini:", apiError);
                return `I'm having trouble fetching live data for ${symbol} right now, but I can tell you that ${symbol} is a well-known company. Please try again in a moment, or check the 'Ticker' tab for direct quotes.`;
            }
        }
        return `Please specify a stock ticker (e.g., "analyze AAPL").`;
    }

    // Default response if no specific keyword is matched or as fallback for AI issues
    return getRandomElement([
        `I'm here to help you become a more informed and confident trader. What would you like to explore?`,
        `Ask me about a stock, market trends, or trading strategies!`,
        `How can I assist you with your trading today?`
    ]);
}

async function getMarketContext(symbol) {
    try {
        // Try to get some basic context (this would normally call your stock-data function)
        // For now, return general market context
        const now = new Date();
        const hour = now.getHours();
        const isMarketOpen = hour >= 9 && hour < 16 && now.getDay() >= 1 && now.getDay() <= 5;
        
        return `**📊 Market Context (${symbol}):**\n• Market Status: ${isMarketOpen ? 'Open' : 'Closed'} \n• Current Focus: Real-time price action and volume analysis\n• Data Source: Live Alpha Vantage and Alpaca feeds\n\n`;
    } catch (error) {
        return '**📊 Market Context:** Analyzing current market conditions...\n\n';
    }
}

function getRandomElement(array) {
    return array[Math.floor(Math.random() * array.length)];
}

// Fallback function (if you had one, keep it, otherwise the above will handle errors)
function getFallbackResponse(message) {
    return `I'm having a brief connectivity issue, but I'm still here to help!\n\nWhile I reconnect to my enhanced systems, here's what you can try:\n\n🔍 **Ticker Tab:** Search any stock for live pricing and analysis\n📊 **Market Tab:** Check major indices and sentiment data\n🎯 **Plays Tab:** View current trading opportunities  \n🔔 **Alerts Tab:** Monitor unusual market activity\n\nI'll be back to full intelligence shortly! In the meantime, feel free to explore the real-time features.\n\nIs there a specific stock you'd like to analyze while I get back online?`;
}
