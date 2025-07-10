// netlify/functions/enhanced-rolo-chat.js
// ADD THIS AS A NEW FILE - makes Rolo AI smarter and more conversational
// Works alongside your existing claude-chat.js as an upgrade

const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");
const { fetch } = require("node-fetch"); // Ensure node-fetch is available

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

        const API_KEY = process.env.GEMINI_API_KEY;

        if (!API_KEY) {
            console.error('GEMINI_API_KEY is not set in environment variables.');
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ 
                    error: 'Gemini API Key is not configured. Please set GEMINI_API_KEY in Netlify environment variables.' 
                })
            };
        }

        // Initialize Google Generative AI
        const genAI = new GoogleGenerativeAI(API_KEY);
        // *** IMPORTANT CHANGE HERE: Updated model name ***
        const model = genAI.getGenerativeModel({ model: "gemini-1.0-pro-vision-latest" });

        const generationConfig = {
            temperature: 0.7,
            topK: 1,
            topP: 1,
            maxOutputTokens: 2048,
        };

        const safetySettings = [
            {
                category: HarmCategory.HARM_CATEGORY_HARASSMENT,
                threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            },
            {
                category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            },
            {
                category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            },
            {
                category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            },
        ];

        const chat = model.startChat({
            generationConfig,
            safetySettings,
            history: [], // You can add conversation history here if passed from frontend
        });

        const prompt = `You are Rolo, an AI-powered trading assistant designed for a stock trading app. Your purpose is to provide highly relevant, accurate, and actionable information about stocks, options, market trends, and trading strategies. 

When a user asks a question, identify if it's about:
1.  **A specific stock or ticker:** (e.g., "AAPL", "What about TSLA?", "Analyze NVDA") - If so, try to find the ticker and integrate real-time (or contextually implied) data.
2.  **General market conditions/sentiment:** (e.g., "How's the market?", "Market outlook", "Fear and Greed Index")
3.  **Options trading:** (e.g., "What are calls?", "Options strategy for SPY")
4.  **Trading strategies/education:** (e.g., "What is RSI?", "How to set stop loss?")
5.  **General greetings/chat:** (e.g., "Hello", "How are you?")
6.  **Anything else:** (e.g., unrelated questions)

Be concise, professional, and directly answer the user's query. If you need more information (e.g., a specific ticker for analysis), ask for it clearly. Prioritize actionable trading insights. Do not give financial advice.

**User Message:** ${message}
`;

        console.log("Sending prompt to Gemini API...");
        const result = await chat.sendMessage(prompt);
        console.log("Received response from Gemini API.");
        const geminiResponse = result.response.text();

        const finalResponse = await generateRoloResponse(message, geminiResponse);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                response: finalResponse,
                source: 'enhanced-rolo-ai-gemini',
                timestamp: new Date().toISOString()
            })
        };

    } catch (error) {
        console.error('Enhanced Rolo chat error:', error);
        // Check if the error is due to an invalid API key or model not found
        if (error.message.includes('404 Not Found') || error.message.includes('API key not valid')) {
             return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ 
                    error: 'API configuration error: Please check your Gemini API key and ensure the correct model name is used (`gemini-1.0-pro`).',
                })
            };
        }
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Enhanced chat temporarily unavailable due to an unexpected error. Please try again later.',
                details: error.message
            })
        };
    }
};

async function generateRoloResponse(userMessage, geminiResponse) {
    const lowerMessage = userMessage.toLowerCase();

    // Placeholder for fetching real-time stock data (would call your stock-data function)
    const fetchStockPrice = async (symbol) => {
        try {
            // Updated to use 'delayed' entitlement
            const stockDataResponse = await fetch(`https://your-netlify-site.netlify.app/.netlify/functions/stock-data?symbol=${symbol}&entitlement=delayed`);
            const stockData = await stockDataResponse.json();
            if (stockData.price) {
                return `**${symbol} Current Price:** $${stockData.price} (${stockData.changePercent})`;
            }
            return `Could not fetch real-time data for ${symbol}.`;
        } catch (e) {
            console.error(`Error fetching stock data for ${symbol}:`, e);
            return `Currently unable to fetch live data for ${symbol}.`;
        }
    };

    // Placeholder for market context (would call your market-conditions function)
    const fetchMarketContext = async () => {
        try {
            const marketResponse = await fetch(`https://your-netlify-site.netlify.app/.netlify/functions/market-conditions`);
            const marketData = await marketResponse.json();
            if (marketData.indices && marketData.indices.spy) {
                return `**Market Indices:** SPY: ${marketData.indices.spy.price} (${marketData.indices.spy.changePercent}), NASDAQ: ${marketData.indices.nasdaq.price} (${marketData.indices.nasdaq.changePercent}).`;
            }
            return 'Current market context unavailable.';
        } catch (e) {
            console.error('Error fetching market context:', e);
            return 'Currently unable to fetch live market context.';
        }
    };

    const tickers = ['aapl', 'tsla', 'spy', 'nvda', 'msft', 'googl', 'amzn', 'meta', 'hood', 'qqq', 'dia', 'vix'];
    let recognizedTicker = null;
    for (const ticker of tickers) {
        if (lowerMessage.includes(ticker)) {
            recognizedTicker = ticker.toUpperCase();
            break;
        }
    }

    let dynamicContext = "";
    if (recognizedTicker) {
        dynamicContext = await fetchStockPrice(recognizedTicker);
    } else if (lowerMessage.includes("market") || lowerMessage.includes("outlook") || lowerMessage.includes("indices")) {
        dynamicContext = await fetchMarketContext();
    }
    
    // Combine Gemini's response with dynamic context
    let finalResponse = `🧠 **Rolo AI powered by Gemini**\n\n`;

    if (dynamicContext) {
        finalResponse += `${dynamicContext}\n\n`;
    }
    
    finalResponse += geminiResponse;

    // Enhance generic responses
    if (geminiResponse.includes("I'm Rolo, your trading assistant") || geminiResponse.includes("What's on your mind?")) {
        finalResponse += `\n\nTry asking me:\n• "What's the price of AAPL?"\n• "Analyze TSLA for me."\n• "What's the current market sentiment?"\n• "Explain call options."`;
    }

    return finalResponse;
}

// Helper functions (keep existing ones if they were in your original enhanced-rolo-chat.js)
async function getMarketContext(symbol) {
    try {
        const now = new Date();
        const hour = now.getHours();
        const isMarketOpen = hour >= 9 && hour < 16 && now.getDay() >= 1 && now.getDay() <= 5;
        
        return `**📊 Market Context (${symbol || 'General'}):**\n• Market Status: ${isMarketOpen ? 'Open' : 'Closed'} \n• Current Focus: Real-time price action and volume analysis\n• Data Source: Live Alpha Vantage and Alpaca feeds\n\n`;
    } catch (error) {
        return '**📊 Market Context:** Analyzing current market conditions...\\n\\n';
    }
}

function getRandomElement(array) {
    return array[Math.floor(Math.random() * array.length)];
}

function getFallbackResponse(message) {
    return `I'm having a brief connectivity issue, but I'm still here to help!\n\nWhile I reconnect to my enhanced systems, here's what you can try:\n\n🔍 **Ticker Tab:** Search any stock for live pricing and analysis\n📊 **Market Tab:** Check major indices and sentiment data\n🎯 **Plays Tab:** View current trading opportunities  \n🔔 **Alerts Tab:** Monitor unusual market activity\n\nI'll be back to full intelligence shortly! In the meantime, feel free to explore the real-time features.\n\nIs there a specific stock you'd like to analyze while I get back online?`;
}
