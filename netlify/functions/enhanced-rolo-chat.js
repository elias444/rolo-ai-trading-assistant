// netlify/functions/enhanced-rolo-chat.js
// AI-powered chat assistant with market awareness

const { GoogleGenerativeAI } = require('@google/generative-ai');

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    console.log(`[enhanced-rolo-chat.js] Processing chat request...`);
    
    // Get API key
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
    
    if (!GEMINI_API_KEY) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'Gemini API key not configured',
          timestamp: new Date().toISOString()
        })
      };
    }
    
    // Get required parameters
    const message = event.queryStringParameters?.message;
    
    if (!message) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Message is required' })
      };
    }
    
    const symbol = event.queryStringParameters?.symbol;
    const session = event.queryStringParameters?.session || 'MARKET_OPEN';
    const contextStr = event.queryStringParameters?.context || '{}';
    
    let context = {};
    try {
      context = JSON.parse(contextStr);
    } catch (e) {
      console.warn(`[enhanced-rolo-chat.js] Invalid context JSON: ${e.message}`);
    }
    
    console.log(`[enhanced-rolo-chat.js] User message: "${message}", Symbol: ${symbol}, Session: ${session}`);
    
    // Fetch market data if needed
    let marketData = {};
    
    if (symbol) {
      try {
        // Fetch stock data if a symbol is provided
        const stockDataUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${ALPHA_VANTAGE_API_KEY}`;
        const stockResponse = await fetch(stockDataUrl);
        
        if (stockResponse.ok) {
          const stockData = await stockResponse.json();
          
          if (stockData['Global Quote'] && stockData['Global Quote']['05. price']) {
            marketData.stockData = {
              symbol: symbol,
              price: stockData['Global Quote']['05. price'],
              change: stockData['Global Quote']['09. change'],
              changePercent: stockData['Global Quote']['10. change percent'],
              volume: stockData['Global Quote']['06. volume']
            };
          }
        }
      } catch (stockError) {
        console.warn(`[enhanced-rolo-chat.js] Error fetching stock data: ${stockError.message}`);
      }
    }
    
    // Fetch market index data
    try {
      const spyUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=SPY&apikey=${ALPHA_VANTAGE_API_KEY}`;
      const spyResponse = await fetch(spyUrl);
      
      if (spyResponse.ok) {
        const spyData = await spyResponse.json();
        
        if (spyData['Global Quote'] && spyData['Global Quote']['05. price']) {
          marketData.marketData = {
            spy: {
              price: spyData['Global Quote']['05. price'],
              change: spyData['Global Quote']['09. change'],
              changePercent: spyData['Global Quote']['10. change percent']
            }
          };
        }
      }
    } catch (marketError) {
      console.warn(`[enhanced-rolo-chat.js] Error fetching market data: ${marketError.message}`);
    }
    
    // Initialize the Gemini AI model
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    
    // Create system prompt with market awareness
    const systemPrompt = `
You are Rolo AI, a sophisticated AI assistant specializing in stock market analysis and trading.
Current date: ${new Date().toLocaleDateString()}
Current market session: ${session}
${symbol ? `User is currently viewing: ${symbol}` : ''}

MARKET DATA:
${JSON.stringify(marketData, null, 2)}

USER CONTEXT:
${JSON.stringify(context, null, 2)}

PERSONALITY AND STYLE:
- You are knowledgeable but conversational and friendly
- You provide clear, concise, and actionable advice
- You avoid financial jargon unless necessary and explain complex concepts simply
- You never make promises about future performance or give financial advice that could be construed as legally binding
- You are confident in your analysis but acknowledge limitations and uncertainties
- You always use numerals for numbers (42 not forty-two)
- You make frequent references to current market conditions based on the data provided
- You're helpful and willing to answer follow-up questions

RESPONSE GUIDELINES:
- Keep responses concise and focused (maximum 3-4 paragraphs)
- If referring to stock prices or market indexes, mention the current values from the provided data
- If the user asks about a specific stock, acknowledge the market session (open, pre-market, after-hours, etc.)
- Avoid making specific price predictions or guarantees
- Always include appropriate disclaimers when discussing investment decisions
- When appropriate, suggest resources or tools that might help the user further

IMPORTANT ETHICS RULES:
- Never recommend specific trades with specific dollar amounts
- Always clarify that you are providing general information, not personalized financial advice
- Remind users to do their own research and consult with financial professionals for investment decisions
- Do not encourage day trading, margin trading, or other high-risk activities
- Do not attempt to time the market or suggest "sure things"

Now respond to the user's message in a helpful, informative way, keeping in mind the market context provided.
`;

    // Generate chat response
    const result = await model.generateContent({
      contents: [
        { role: "user", parts: [{ text: systemPrompt }] },
        { role: "model", parts: [{ text: "I understand my role as Rolo AI. I'll provide helpful market insights while following the guidelines. What would you like to know?" }] },
        { role: "user", parts: [{ text: message }] }
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 800,
      },
    });

    const response = await result.response;
    const text = response.text();
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        response: text,
        timestamp: new Date().toISOString(),
        context: {
          symbol,
          session,
          hasMarketData: Object.keys(marketData).length > 0
        }
      })
    };
    
  } catch (error) {
    console.error('[enhanced-rolo-chat.js] Error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "Chat generation failed",
        details: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
};
