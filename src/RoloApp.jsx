// src/RoloApp.jsx

// Access React hooks
import { useState, useEffect, useCallback, useRef } from 'react';

// Helper function to format currency
const formatCurrency = (amount) => {
    if (typeof amount !== 'number') return 'N/A';
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount);
};

// Helper function to format percentage
const formatPercentage = (value) => {
    if (typeof value !== 'number') return 'N/A';
    return `${(value * 100).toFixed(2)}%`;
};

// Helper function to get market status
const getMarketStatus = () => {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 for Sunday, 6 for Saturday
    const hour = now.getHours();
    const minute = now.getMinutes();

    // Assuming US market hours (9:30 AM - 4:00 PM ET)
    const currentHourET = hour; // Placeholder: needs actual timezone conversion
    const currentMinuteET = minute;

    if (dayOfWeek === 0 || dayOfWeek === 6) {
        return 'Market Closed (Weekend)';
    }

    if (currentHourET > 16 || (currentHourET === 16 && currentMinuteET >= 0)) {
        return 'After Hours';
    } else if (currentHourET < 9 || (currentHourET === 9 && currentMinuteET < 30)) {
        return 'Pre-Market';
    } else if (currentHourET >= 9 && currentHourET < 16) {
        return 'Market Open';
    }
    return 'Market Closed'; // Default for other times
};

// API Call Helper - Centralized function for fetching data
const fetchData = async (url, apiKey, errorMessage) => {
    if (!apiKey) {
        console.error("API Key is missing for URL:", url);
        return null;
    }
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        if (data["Error Message"] || data["Note"]) {
            console.warn(`API Warning/Error for ${url}: ${data["Error Message"] || data["Note"]}`);
            return null;
        }
        return data;
    } catch (error) {
        console.error(`${errorMessage}:`, error);
        return null;
    }
};

// Main App Component
const App = () => {
    const [activeTab, setActiveTab] = useState('stocks');
    const [stocks, setStocks] = useState([]);
    const [watchlist, setWatchlist] = useState([]);
    const [selectedStock, setSelectedStock] = useState(null);
    const [marketStatus, setMarketStatus] = useState('Loading Market Status...');
    const [analysisData, setAnalysisData] = useState(null);
    const [smartPlays, setSmartPlays] = useState([]);
    const [alerts, setAlerts] = useState([]);
    const [chatHistory, setChatHistory] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const [isLoading, setIsLoading] = useState({});
    const [error, setError] = useState({});
    const [settings, setSettings] = useState({
        enablePlays: true,
        enableAlerts: true,
        enableChat: true,
        playConfidence: 75,
    });
    const [searchTerm, setSearchTerm] = useState('');

    const chatContainerRef = useRef(null);

    // Access API keys from environment variables (Vite-specific)
    const ALPHA_VANTAGE_API_KEY = import.meta.env.VITE_ALPHA_VANTAGE_API_KEY;
    const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

    // --- Data Fetching Functions ---
    const fetchStockQuote = useCallback(async (symbol) => {
        if (!ALPHA_VANTAGE_API_KEY) {
            console.error("Alpha Vantage API Key is missing.");
            setError(prev => ({ ...prev, apiKeys: "Alpha Vantage API Key is missing. Please set VITE_ALPHA_VANTAGE_API_KEY in Netlify." }));
            return null;
        }
        const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${ALPHA_VANTAGE_API_KEY}`;
        const data = await fetchData(url, ALPHA_VANTAGE_API_KEY, `Failed to fetch quote for ${symbol}`);

        if (data && data['Global Quote'] && Object.keys(data['Global Quote']).length > 0) {
            const quote = data['Global Quote'];
            return {
                symbol: quote['01. symbol'],
                open: parseFloat(quote['02. open']),
                high: parseFloat(quote['03. high']),
                low: parseFloat(quote['04. low']),
                price: parseFloat(quote['05. price']),
                volume: parseInt(quote['06. volume']),
                latestTradingDay: quote['07. latest trading day'],
                previousClose: parseFloat(quote['08. previous close']),
                change: parseFloat(quote['09. change']),
                percentChange: parseFloat(quote['10. change percent'].replace('%', '')),
            };
        } else {
            console.warn(`No valid quote data for ${symbol}.`);
            return null;
        }
    }, [ALPHA_VANTAGE_API_KEY]);

    const fetchPopularStocks = useCallback(async () => {
        setIsLoading(prev => ({ ...prev, popularStocks: true }));
        setError(prev => ({ ...prev, popularStocks: null }));
        if (!ALPHA_VANTAGE_API_KEY) {
            setError(prev => ({ ...prev, popularStocks: "Alpha Vantage API Key is missing." }));
            setIsLoading(prev => ({ ...prev, popularStocks: false }));
            return;
        }
        const url = `https://www.alphavantage.co/query?function=TOP_GAINERS_LOSERS&apikey=${ALPHA_VANTAGE_API_KEY}`;
        const data = await fetchData(url, ALPHA_VANTAGE_API_KEY, 'Failed to fetch popular stocks');

        if (data && data.top_gainers) {
            setStocks(data.top_gainers.slice(0, 9).map(stock => ({
                symbol: stock.ticker,
                price: parseFloat(stock.price),
                change: parseFloat(stock.change_amount),
                percentChange: parseFloat(stock.change_percentage.replace('%', '')),
            })));
        } else {
            setStocks([]);
            setError(prev => ({ ...prev, popularStocks: "Could not load popular stocks. Check API key or limits." }));
        }
        setIsLoading(prev => ({ ...prev, popularStocks: false }));
    }, [ALPHA_VANTAGE_API_KEY]);

    const fetchMarketIndices = useCallback(async () => {
        setIsLoading(prev => ({ ...prev, marketIndices: true }));
        setError(prev => ({ ...prev, marketIndices: null }));
        if (!ALPHA_VANTAGE_API_KEY) {
            setError(prev => ({ ...prev, marketIndices: "Alpha Vantage API Key is missing." }));
            setIsLoading(prev => ({ ...prev, marketIndices: false }));
            return;
        }
        const symbols = ['SPY', 'QQQ', 'DIA', 'VIX'];
        const fetchedIndices = [];

        for (const symbol of symbols) {
            const quote = await fetchStockQuote(symbol);
            if (quote) {
                fetchedIndices.push(quote);
            }
        }
        setStocks(prevStocks => {
            const updatedStocks = [...prevStocks];
            fetchedIndices.forEach(newIndex => {
                const existingIndex = updatedStocks.findIndex(s => s.symbol === newIndex.symbol);
                if (existingIndex !== -1) {
                    updatedStocks[existingIndex] = newIndex;
                } else {
                    updatedStocks.push(newIndex);
                }
            });
            return updatedStocks;
        });
        setIsLoading(prev => ({ ...prev, marketIndices: false }));
    }, [ALPHA_VANTAGE_API_KEY, fetchStockQuote]);

    const callGeminiAPI = useCallback(async (prompt, schema = null) => {
        setIsLoading(prev => ({ ...prev, gemini: true }));
        setError(prev => ({ ...prev, gemini: null }));
        if (!GEMINI_API_KEY) {
            setError(prev => ({ ...prev, gemini: "Gemini API Key is missing." }));
            setIsLoading(prev => ({ ...prev, gemini: false }));
            return null;
        }

        let chatHistoryPayload = [];
        chatHistoryPayload.push({ role: "user", parts: [{ text: prompt }] });

        const payload = { contents: chatHistoryPayload };
        if (schema) {
            payload.generationConfig = {
                responseMimeType: "application/json",
                responseSchema: schema
            };
        }

        const apiKey = GEMINI_API_KEY;
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();

            if (result.candidates && result.candidates.length > 0 &&
                result.candidates[0].content && result.candidates[0].content.parts &&
                result.candidates[0].content.parts.length > 0) {
                const text = result.candidates[0].content.parts[0].text;
                setIsLoading(prev => ({ ...prev, gemini: false }));
                try {
                    return schema ? JSON.parse(text) : text;
                } catch (parseError) {
                    console.error("Failed to parse Gemini JSON response:", parseError);
                    setError(prev => ({ ...prev, gemini: "Failed to parse AI response." }));
                    return null;
                }
            } else {
                throw new Error("Gemini API returned an unexpected structure or no content.");
            }
        } catch (err) {
            console.error("Error calling Gemini API:", err);
            setError(prev => ({ ...prev, gemini: "Failed to get AI response. Check API key or network." }));
            setIsLoading(prev => ({ ...prev, gemini: false }));
            return null;
        }
    }, [GEMINI_API_KEY]); // Dependency for useCallback

    const fetchComprehensiveAnalysis = useCallback(async (symbol) => {
        if (!symbol) {
            setAnalysisData(null);
            return;
        }
        setIsLoading(prev => ({ ...prev, analysis: true }));
        setError(prev => ({ ...prev, analysis: null }));

        const prompt = `Provide a comprehensive AI analysis for stock symbol ${symbol}. Include:
        1. Executive Summary (overall outlook, key drivers).
        2. Market Environment (session impact, volatility, sentiment).
        3. Technical Analysis (trend, RSI, support/resistance levels, patterns).
        4. AI Recommendations (buy/sell/hold, confidence %, strategy, catalysts, risks).
        Format the response as JSON according to the schema provided.`;

        const schema = {
            type: "OBJECT",
            properties: {
                executiveSummary: { type: "STRING" },
                marketEnvironment: {
                    type: "OBJECT",
                    properties: {
                        sessionImpact: { type: "STRING" },
                        volatility: { type: "STRING" },
                        sentiment: { type: "STRING" }
                    }
                },
                technicalAnalysis: {
                    type: "OBJECT",
                    properties: {
                        trend: { type: "STRING" },
                        rsi: { type: "STRING" },
                        supportResistance: { type: "STRING" },
                        patterns: { type: "STRING" }
                    }
                },
                aiRecommendations: {
                    type: "OBJECT",
                    properties: {
                        action: { type: "STRING", enum: ["BUY", "SELL", "HOLD"] },
                        confidence: { type: "NUMBER" },
                        strategy: { type: "STRING" },
                        catalysts: { type: "STRING" },
                        risks: { type: "STRING" }
                    }
                }
            },
            required: ["executiveSummary", "marketEnvironment", "technicalAnalysis", "aiRecommendations"]
        };

        const analysis = await callGeminiAPI(prompt, schema);
        setAnalysisData(analysis);
        setIsLoading(prev => ({ ...prev, analysis: false }));
    }, [callGeminiAPI]);

    const generateSmartPlays = useCallback(async () => {
        if (!settings.enablePlays) {
            setSmartPlays([]);
            return;
        }
        setIsLoading(prev => ({ ...prev, plays: true }));
        setError(prev => ({ ...prev, plays: null }));

        const prompt = `Generate 3 smart trading plays based on current market conditions and recent top gainers/losers. For each play, provide:
        - stockSymbol
        - entryPrice
        - stopLoss
        - targetPrice
        - confidence (number between 0 and 100)
        - strategy (e.g., "Breakout", "Swing Trade", "Scalp")
        - reasoning (brief explanation)
        Only include plays with a confidence level of ${settings.playConfidence}% or higher.
        Format the response as a JSON array of objects.`;

        const schema = {
            type: "ARRAY",
            items: {
                type: "OBJECT",
                properties: {
                    stockSymbol: { type: "STRING" },
                    entryPrice: { type: "NUMBER" },
                    stopLoss: { type: "NUMBER" },
                    targetPrice: { type: "NUMBER" },
                    confidence: { type: "NUMBER" },
                    strategy: { type: "STRING" },
                    reasoning: { type: "STRING" }
                },
                required: ["stockSymbol", "entryPrice", "stopLoss", "targetPrice", "confidence", "strategy", "reasoning"]
            }
        };

        const plays = await callGeminiAPI(prompt, schema);
        if (Array.isArray(plays)) {
            setSmartPlays(plays.filter(p => p.confidence >= settings.playConfidence));
        } else {
            setSmartPlays([]);
            setError(prev => ({ ...prev, plays: "Failed to generate smart plays." }));
        }
        setIsLoading(prev => ({ ...prev, plays: false }));
    }, [settings.enablePlays, settings.playConfidence, callGeminiAPI]);

    const generateRealtimeAlerts = useCallback(async () => {
        if (!settings.enableAlerts) {
            setAlerts([]);
            return;
        }
        setIsLoading(prev => ({ ...prev, alerts: true }));
        setError(prev => ({ ...prev, alerts: null }));

        const prompt = `Generate 3 real-time market alerts based on simulated market events (e.g., significant volume spikes, news, sentiment changes). For each alert, provide:
        - type (e.g., "Volume Spike", "News Catalyst", "Sentiment Shift", "Breakout")
        - stockSymbol
        - priority (e.g., "High", "Medium", "Low")
        - message (brief description of the alert)
        - suggestedAction (e.g., "Review", "Consider Entry", "Monitor")
        - timestamp (current ISO string)
        Format the response as a JSON array of objects.`;

        const schema = {
            type: "ARRAY",
            items: {
                type: "OBJECT",
                properties: {
                    type: { type: "STRING" },
                    stockSymbol: { type: "STRING" },
                    priority: { type: "STRING", enum: ["High", "Medium", "Low"] },
                    message: { type: "STRING" },
                    suggestedAction: { type: "STRING" },
                    timestamp: { type: "STRING" }
                },
                required: ["type", "stockSymbol", "priority", "message", "suggestedAction", "timestamp"]
            }
        };

        const generatedAlerts = await callGeminiAPI(prompt, schema);
        if (Array.isArray(generatedAlerts)) {
            setAlerts(generatedAlerts);
        } else {
            setAlerts([]);
            setError(prev => ({ ...prev, alerts: "Failed to generate alerts." }));
        }
        setIsLoading(prev => ({ ...prev, alerts: false }));
    }, [settings.enableAlerts, callGeminiAPI]);

    const handleChatSubmit = useCallback(async (e) => {
        e.preventDefault();
        if (!chatInput.trim() || !settings.enableChat) return;

        const userMessage = { role: 'user', text: chatInput };
        setChatHistory(prev => [...prev, userMessage]);
        setChatInput('');
        setIsLoading(prev => ({ ...prev, chat: true }));
        setError(prev => ({ ...prev, chat: null }));

        const prompt = `You are a helpful stock AI assistant. Respond to the following user query: "${chatInput}"`;
        const aiResponse = await callGeminiAPI(prompt);

        if (aiResponse) {
            setChatHistory(prev => [...prev, { role: 'ai', text: aiResponse }]);
        } else {
            setChatHistory(prev => [...prev, { role: 'ai', text: "Sorry, I couldn't process that request." }]);
        }
        setIsLoading(prev => ({ ...prev, chat: false }));
    }, [chatInput, settings.enableChat, callGeminiAPI]);

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [chatHistory, activeTab]);

    // Effect for initial data load (runs once on mount)
    useEffect(() => {
        fetchPopularStocks();
        fetchMarketIndices();
        setMarketStatus(getMarketStatus());
    }, []); // Empty dependency array: runs only once

    // Effect for refreshing data at intervals
    useEffect(() => {
        const refreshAllData = () => {
            fetchPopularStocks();
            fetchMarketIndices();
            setMarketStatus(getMarketStatus());
            if (settings.enablePlays) generateSmartPlays();
            if (settings.enableAlerts) generateRealtimeAlerts();
        };

        const intervalId = setInterval(refreshAllData, 60 * 1000); // Every minute

        return () => clearInterval(intervalId); // Cleanup on unmount
    }, [settings.enablePlays, settings.enableAlerts, fetchPopularStocks, fetchMarketIndices, generateSmartPlays, generateRealtimeAlerts]); // Dependencies for interval functions

    // This useEffect now explicitly depends on activeTab and selectedStock
    useEffect(() => {
        if (activeTab === 'analysis' && selectedStock) {
            fetchComprehensiveAnalysis(selectedStock.symbol);
        }
    }, [activeTab, selectedStock, fetchComprehensiveAnalysis]);

    // This useEffect now explicitly depends on activeTab and settings.enablePlays/Alerts
    useEffect(() => {
        if (activeTab === 'plays' && settings.enablePlays) {
            generateSmartPlays();
        }
        if (activeTab === 'alerts' && settings.enableAlerts) {
            generateRealtimeAlerts();
        }
    }, [activeTab, generateSmartPlays, generateRealtimeAlerts, settings.enablePlays, settings.enableAlerts]);

    // Watchlist and Settings handlers no longer interact with Firestore
    const handleAddToWatchlist = async (stock) => {
        if (watchlist.some(item => item.symbol === stock.symbol)) {
            console.log(`${stock.symbol} is already in watchlist.`);
            return;
        }
        setWatchlist(prev => [...prev, { symbol: stock.symbol, id: crypto.randomUUID() }]);
        console.log("Added to watchlist (not persistent):", stock.symbol);
    };

    const handleRemoveFromWatchlist = async (id) => {
        setWatchlist(prev => prev.filter(item => item.id !== id));
        console.log("Removed from watchlist (not persistent):", id);
    };

    const handleSettingChange = async (key, value) => {
        const newSettings = { ...settings, [key]: value };
        setSettings(newSettings);
        console.log("Settings updated (not persistent):", newSettings);
    };

    const handleSearchStock = async () => {
        if (!searchTerm.trim()) return;
        const symbol = searchTerm.toUpperCase();
        setIsLoading(prev => ({ ...prev, search: true }));
        setError(prev => ({ ...prev, search: null }));
        const stockData = await fetchStockQuote(symbol);
        if (stockData) {
            setSelectedStock(stockData);
            setActiveTab('analysis');
        } else {
            setError(prev => ({ ...prev, search: `Could not find data for ${symbol}.` }));
        }
        setIsLoading(prev => ({ ...prev, search: false }));
        setSearchTerm('');
    };

    const LoadingSpinner = () => (
        <div className="flex justify-center items-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
            <p className="ml-3 text-gray-400">Loading...</p>
        </div>
    );

    const ErrorMessage = ({ message }) => (
        <div className="bg-red-900 text-red-300 p-3 rounded-lg text-sm text-center mx-4 my-2">
            Error: {message}
        </div>
    );

    const StockCard = ({ stock, onClick, onAddRemoveWatchlist, isWatchlist }) => {
        const isPositive = stock.change > 0;
        const changeColor = isPositive ? 'text-green-400' : 'text-red-400';
        const arrow = isPositive ? '▲' : '▼';

        return (
            <div
                className="bg-gray-800 p-4 rounded-xl shadow-lg flex flex-col justify-between cursor-pointer transform transition-transform duration-200 hover:scale-105"
                onClick={() => onClick(stock)}
            >
                <div>
                    <h3 className="text-lg font-bold text-white mb-1">{stock.symbol}</h3>
                    <p className="text-2xl font-extrabold text-white">{formatCurrency(stock.price)}</p>
                    <p className={`text-sm ${changeColor}`}>
                        {arrow} {formatCurrency(stock.change)} ({stock.percentChange.toFixed(2)}%)
                    </p>
                </div>
                {onAddRemoveWatchlist && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onAddRemoveWatchlist(stock); }}
                        className={`mt-3 px-3 py-1 text-sm rounded-full transition-colors duration-200
                            ${isWatchlist ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
                    >
                        {isWatchlist ? 'Remove' : 'Add to Watchlist'}
                    </button>
                )}
            </div>
        );
    };

    const renderStocksTab = () => (
        <div className="p-4">
            {error.apiKeys && <ErrorMessage message={error.apiKeys} />}
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-white mb-4">My Watchlist</h2>
                {isLoading.watchlist && <LoadingSpinner />}
                {error.watchlist && <ErrorMessage message={error.watchlist} />}
                {watchlist.length === 0 && !isLoading.watchlist ? (
                    <p className="text-gray-400">Your watchlist is empty. Add stocks from the popular list or search.</p>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {watchlist.map(item => {
                            const fullStock = stocks.find(s => s.symbol === item.symbol) || { symbol: item.symbol, price: 0, change: 0, percentChange: 0 };
                            return (
                                <StockCard
                                    key={item.id}
                                    stock={fullStock}
                                    onClick={setSelectedStock}
                                    onAddRemoveWatchlist={() => handleRemoveFromWatchlist(item.id)}
                                    isWatchlist={true}
                                />
                            );
                        })}
                    </div>
                )}
            </div>

            <div className="mb-6">
                <h2 className="text-2xl font-bold text-white mb-4">Popular Stocks</h2>
                {isLoading.popularStocks && <LoadingSpinner />}
                {error.popularStocks && <ErrorMessage message={error.popularStocks} />}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {stocks.filter(s => !watchlist.some(w => w.symbol === s.symbol)).map(stock => (
                        <StockCard
                            key={stock.symbol}
                            stock={stock}
                            onClick={setSelectedStock}
                            onAddRemoveWatchlist={handleAddToWatchlist}
                            isWatchlist={false}
                        />
                    ))}
                </div>
            </div>

            <div className="mb-6">
                <h2 className="text-2xl font-bold text-white mb-4">Search Stock</h2>
                <div className="flex space-x-2">
                    <input
                        type="text"
                        placeholder="Enter stock symbol (e.g., AAPL)"
                        className="flex-grow p-3 rounded-lg bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                                handleSearchStock();
                            }
                        }}
                    />
                    <button
                        onClick={handleSearchStock}
                        className="px-5 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-colors duration-200"
                    >
                        Search
                    </button>
                </div>
                {isLoading.search && <LoadingSpinner />}
                {error.search && <ErrorMessage message={error.search} />}
            </div>
        </div>
    );

    const renderAnalysisTab = () => (
        <div className="p-4">
            <h2 className="text-2xl font-bold text-white mb-4">AI Analysis: {selectedStock?.symbol || 'Select a Stock'}</h2>
            {error.apiKeys && <ErrorMessage message={error.apiKeys} />}
            {!selectedStock && (
                <p className="text-gray-400">Please select a stock from the 'Stocks' tab or search to view its AI analysis.</p>
            )}
            {selectedStock && isLoading.analysis && <LoadingSpinner />}
            {selectedStock && error.analysis && <ErrorMessage message={error.analysis} />}

            {selectedStock && analysisData && !isLoading.analysis && (
                <div className="space-y-6">
                    <div className="bg-gray-800 p-5 rounded-xl shadow-lg">
                        <h3 className="text-xl font-semibold text-white mb-3">📋 Executive Summary</h3>
                        <p className="text-gray-300">{analysisData.executiveSummary}</p>
                    </div>

                    <div className="bg-gray-800 p-5 rounded-xl shadow-lg">
                        <h3 className="text-xl font-semibold text-white mb-3">🌍 Market Environment</h3>
                        <p className="text-gray-300"><strong>Session Impact:</strong> {analysisData.marketEnvironment.sessionImpact}</p>
                        <p className="text-gray-300"><strong>Volatility:</strong> {analysisData.marketEnvironment.volatility}</p>
                        <p className="text-gray-300"><strong>Sentiment:</strong> {analysisData.marketEnvironment.sentiment}</p>
                    </div>

                    <div className="bg-gray-800 p-5 rounded-xl shadow-lg">
                        <h3 className="text-xl font-semibold text-white mb-3">📈 Technical Analysis</h3>
                        <p className="text-gray-300"><strong>Trend:</strong> {analysisData.technicalAnalysis.trend}</p>
                        <p className="text-gray-300"><strong>RSI:</strong> {analysisData.technicalAnalysis.rsi}</p>
                        <p className="text-gray-300"><strong>Support/Resistance:</strong> {analysisData.technicalAnalysis.supportResistance}</p>
                        <p className="text-gray-300"><strong>Patterns:</strong> {analysisData.technicalAnalysis.patterns}</p>
                    </div>

                    <div className="bg-gray-800 p-5 rounded-xl shadow-lg">
                        <h3 className="text-xl font-semibold text-white mb-3">💡 AI Recommendations</h3>
                        <p className={`text-2xl font-bold mb-2 ${analysisData.aiRecommendations.action === 'BUY' ? 'text-green-500' : analysisData.aiRecommendations.action === 'SELL' ? 'text-red-500' : 'text-yellow-500'}`}>
                            {analysisData.aiRecommendations.action}
                        </p>
                        <p className="text-gray-300"><strong>Confidence:</strong> {analysisData.aiRecommendations.confidence}%</p>
                        <p className="text-gray-300"><strong>Strategy:</strong> {analysisData.aiRecommendations.strategy}</p>
                        <p className="text-gray-300"><strong>Catalysts:</strong> {analysisData.aiRecommendations.catalysts}</p>
                        <p className="text-gray-300"><strong>Risks:</strong> {analysisData.aiRecommendations.risks}</p>
                    </div>
                </div>
            );

            const renderPlaysTab = () => (
                <div className="p-4">
                    <h2 className="text-2xl font-bold text-white mb-4">Smart Plays</h2>
                    {error.apiKeys && <ErrorMessage message={error.apiKeys} />}
                    {!settings.enablePlays && (
                        <p className="text-gray-400">Smart Plays are currently disabled in settings.</p>
                    )}
                    {settings.enablePlays && isLoading.plays && <LoadingSpinner />}
                    {settings.enablePlays && error.plays && <ErrorMessage message={error.plays} />}
                    {settings.enablePlays && smartPlays.length === 0 && !isLoading.plays && !error.plays && (
                        <p className="text-gray-400">No smart plays generated at this time. Check back later or adjust confidence settings.</p>
                    )}
                    {settings.enablePlays && smartPlays.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {smartPlays.map((play, index) => (
                                <div key={index} className="bg-gray-800 p-5 rounded-xl shadow-lg border border-purple-700">
                                    <h3 className="text-xl font-semibold text-white mb-3">{play.stockSymbol} - {play.strategy}</h3>
                                    <div className="flex justify-between items-center mb-3">
                                        <span className={`text-sm font-bold px-3 py-1 rounded-full ${play.confidence >= 80 ? 'bg-green-600' : play.confidence >= 60 ? 'bg-yellow-600' : 'bg-red-600'} text-white`}>
                                            Confidence: {play.confidence}%
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 text-center text-sm mb-4">
                                        <div className="bg-gray-700 p-2 rounded-lg">
                                            <p className="text-gray-400">Entry</p>
                                            <p className="text-green-400 font-bold">{formatCurrency(play.entryPrice)}</p>
                                        </div>
                                        <div className="bg-gray-700 p-2 rounded-lg">
                                            <p className="text-gray-400">Stop Loss</p>
                                            <p className="text-red-400 font-bold">{formatCurrency(play.stopLoss)}</p>
                                        </div>
                                        <div className="bg-gray-700 p-2 rounded-lg">
                                            <p className="text-gray-400">Target</p>
                                            <p className="text-blue-400 font-bold">{formatCurrency(play.targetPrice)}</p>
                                        </div>
                                    </div>
                                    <p className="text-gray-300 text-sm">{play.reasoning}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            );

            const renderMarketTab = () => (
                <div className="p-4">
                    <h2 className="text-2xl font-bold text-white mb-4">Market Overview</h2>
                    {error.apiKeys && <ErrorMessage message={error.apiKeys} />}
                    {isLoading.marketIndices && <LoadingSpinner />}
                    {error.marketIndices && <ErrorMessage message={error.marketIndices} />}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {stocks.filter(s => ['SPY', 'QQQ', 'DIA', 'VIX'].includes(s.symbol)).map(index => (
                            <div key={index.symbol} className="bg-gray-800 p-5 rounded-xl shadow-lg">
                                <h3 className="text-xl font-semibold text-white mb-3">
                                    {index.symbol === 'SPY' ? 'S&P 500' : index.symbol === 'QQQ' ? 'NASDAQ 100' : index.symbol === 'DIA' ? 'Dow Jones' : index.symbol === 'VIX' ? 'VIX (Fear Index)' : index.symbol}
                                </h3>
                                <p className="text-3xl font-bold text-white mb-2">{formatCurrency(index.price)}</p>
                                <p className={`${index.change >= 0 ? 'text-green-400' : 'text-red-400'} text-lg`}>
                                    {index.change >= 0 ? '▲' : '▼'} {formatCurrency(index.change)} ({index.percentChange.toFixed(2)}%)
                                </p>
                                {index.symbol === 'VIX' && (
                                    <p className="text-gray-400 text-sm mt-2">
                                        {index.price < 20 ? 'Low Volatility/Fear' : 'High Volatility/Fear'}
                                    </p>
                                )}
                            </div>
                        ))}
                        <div className="bg-gray-800 p-5 rounded-xl shadow-lg">
                            <h3 className="text-xl font-semibold text-white mb-3">Economic Indicators</h3>
                            <p className="text-gray-300">10-Year Treasury Yield: N/A (requires specific API)</p>
                            <p className="text-gray-300">Dollar Index (DXY): N/A (requires specific API)</p>
                            <p className="text-gray-500 text-sm mt-2">
                                (Data for these indicators requires additional API endpoints, not directly from Alpha Vantage GLOBAL_QUOTE)
                            </p>
                        </div>
                    </div>
                </div>
            );

            const renderAlertsTab = () => (
                <div className="p-4">
                    <h2 className="text-2xl font-bold text-white mb-4">Real-time Alerts</h2>
                    {error.apiKeys && <ErrorMessage message={error.apiKeys} />}
                    {!settings.enableAlerts && (
                        <p className="text-gray-400">Real-time Alerts are currently disabled in settings.</p>
                    )}
                    {settings.enableAlerts && isLoading.alerts && <LoadingSpinner />}
                    {settings.enableAlerts && error.alerts && <ErrorMessage message={error.alerts} />}
                    {settings.enableAlerts && alerts.length === 0 && !isLoading.alerts && !error.alerts && (
                        <p className="text-gray-400">No new alerts at this time.</p>
                    )}
                    {settings.enableAlerts && alerts.length > 0 && (
                        <div className="space-y-4">
                            {alerts.map((alert, index) => {
                                let borderColor = 'border-gray-600';
                                let bgColor = 'bg-gray-800';
                                let textColor = 'text-gray-300';
                                let priorityColor = 'text-gray-400';

                                switch (alert.priority) {
                                    case 'High':
                                        borderColor = 'border-red-600';
                                        bgColor = 'bg-red-900/30';
                                        priorityColor = 'text-red-400';
                                        break;
                                    case 'Medium':
                                        borderColor = 'border-yellow-600';
                                        bgColor = 'bg-yellow-900/30';
                                        priorityColor = 'text-yellow-400';
                                        break;
                                    case 'Low':
                                        borderColor = 'border-blue-600';
                                        bgColor = 'bg-blue-900/30';
                                        priorityColor = 'text-blue-400';
                                        break;
                                    default:
                                        break;
                                }

                                return (
                                    <div key={index} className={`p-4 rounded-xl shadow-lg border ${borderColor} ${bgColor}`}>
                                        <div className="flex justify-between items-center mb-2">
                                            <span className={`font-semibold text-lg ${textColor}`}>{alert.type} - {alert.stockSymbol}</span>
                                            <span className={`text-sm font-bold px-3 py-1 rounded-full ${priorityColor}`}>{alert.priority} Priority</span>
                                        </div>
                                        <p className="text-gray-300 mb-2">{alert.message}</p>
                                        <div className="flex justify-between items-center text-sm text-gray-400">
                                            <span className="font-semibold px-3 py-1 bg-gray-700 rounded-full">{alert.suggestedAction}</span>
                                            <span>{new Date(alert.timestamp).toLocaleTimeString()}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            );

            const renderChatTab = () => (
                <div className="flex flex-col h-full p-4">
                    <h2 className="text-2xl font-bold text-white mb-4">AI Chat Assistant</h2>
                    {error.apiKeys && <ErrorMessage message={error.apiKeys} />}
                    {!settings.enableChat && (
                        <p className="text-gray-400">AI Chat is currently disabled in settings.</p>
                    )}
                    {settings.enableChat && (
                        <>
                            <div ref={chatContainerRef} className="flex-grow overflow-y-auto pr-2 mb-4 custom-scrollbar">
                                {chatHistory.length === 0 && (
                                    <p className="text-gray-400 text-center mt-10">Ask Rolo anything about stocks or the market!</p>
                                )}
                                {chatHistory.map((msg, index) => (
                                    <div
                                        key={index}
                                        className={`mb-3 p-3 rounded-lg max-w-[80%] ${msg.role === 'user'
                                            ? 'bg-blue-600 text-white self-end ml-auto'
                                            : 'bg-gray-700 text-gray-100 self-start mr-auto'
                                            }`}
                                    >
                                        {msg.text}
                                    </div>
                                ))}
                                {isLoading.chat && (
                                    <div className="flex items-center p-3 rounded-lg bg-gray-700 text-gray-100 self-start mr-auto max-w-[80%]">
                                        <div className="animate-pulse flex space-x-2">
                                            <div className="h-2 w-2 bg-gray-400 rounded-full"></div>
                                            <div className="h-2 w-2 bg-gray-400 rounded-full"></div>
                                            <div className="h-2 w-2 bg-gray-400 rounded-full"></div>
                                        </div>
                                        <span className="ml-2 text-sm">Rolo is typing...</span>
                                    </div>
                                )}
                                {error.chat && <ErrorMessage message={error.chat} />}
                            </div>
                            <form onSubmit={handleChatSubmit} className="flex space-x-2 mt-auto">
                                <input
                                    type="text"
                                    value={chatInput}
                                    onChange={(e) => setChatInput(e.target.value)}
                                    placeholder="Type your message..."
                                    className="flex-grow p-3 rounded-lg bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    disabled={isLoading.chat}
                                />
                                <button
                                    type="submit"
                                    className="px-5 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-colors duration-200 disabled:opacity-50"
                                    disabled={isLoading.chat}
                                >
                                    Send
                                </button>
                            </form>
                        </>
                    )}
                </div>
            );

            const renderSettingsTab = () => (
                <div className="p-4">
                    <h2 className="text-2xl font-bold text-white mb-4">Settings</h2>
                    {error.settings && <ErrorMessage message={error.settings} />}
                    <div className="space-y-6">
                        <div className="bg-gray-800 p-5 rounded-xl shadow-lg">
                            <h3 className="text-xl font-semibold text-white mb-3">Feature Toggles</h3>
                            <div className="flex items-center justify-between mb-3">
                                <label htmlFor="enablePlays" className="text-gray-300">Enable Smart Plays</label>
                                <input
                                    type="checkbox"
                                    id="enablePlays"
                                    checked={settings.enablePlays}
                                    onChange={(e) => handleSettingChange('enablePlays', e.target.checked)}
                                    className="form-checkbox h-5 w-5 text-purple-600 rounded-md focus:ring-purple-500"
                                />
                            </div>
                            <div className="flex items-center justify-between mb-3">
                                <label htmlFor="enableAlerts" className="text-gray-300">Enable Real-time Alerts</label>
                                <input
                                    type="checkbox"
                                    id="enableAlerts"
                                    checked={settings.enableAlerts}
                                    onChange={(e) => handleSettingChange('enableAlerts', e.target.checked)}
                                    className="form-checkbox h-5 w-5 text-purple-600 rounded-md focus:ring-purple-500"
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <label htmlFor="enableChat" className="text-gray-300">Enable AI Chat Assistant</label>
                                <input
                                    type="checkbox"
                                    id="enableChat"
                                    checked={settings.enableChat}
                                    onChange={(e) => handleSettingChange('enableChat', e.target.checked)}
                                    className="form-checkbox h-5 w-5 text-purple-600 rounded-md focus:ring-purple-500"
                                />
                            </div>
                        </div>

                        <div className="bg-gray-800 p-5 rounded-xl shadow-lg">
                            <h3 className="text-xl font-semibold text-white mb-3">Play Confidence Level</h3>
                            <div className="flex items-center space-x-4">
                                <input
                                    type="range"
                                    min="50"
                                    max="100"
                                    step="5"
                                    value={settings.playConfidence}
                                    onChange={(e) => handleSettingChange('playConfidence', parseInt(e.target.value))}
                                    className="flex-grow h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-purple-500"
                                />
                                <span className="text-white font-bold w-12 text-right">{settings.playConfidence}%</span>
                            </div>
                            <p className="text-gray-400 text-sm mt-2">Only plays with confidence equal to or higher than this level will be shown.</p>
                        </div>
                    </div>
                </div>
            );

            return (
                <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-gray-100 font-inter flex flex-col">
                    <header className="bg-gray-800 p-4 shadow-xl flex items-center justify-between sticky top-0 z-10 rounded-b-xl">
                        <h1 className="text-3xl font-extrabold text-white">Rolo AI</h1>
                        <div className="text-sm px-4 py-2 rounded-full bg-gray-700 text-gray-300">
                            {marketStatus}
                        </div>
                    </header>

                    <main className="flex-grow overflow-y-auto pb-20 custom-scrollbar">
                        {error.apiKeys && <ErrorMessage message={error.apiKeys} />}
                        {activeTab === 'stocks' && renderStocksTab()}
                        {activeTab === 'analysis' && renderAnalysisTab()}
                        {activeTab === 'plays' && renderPlaysTab()}
                        {activeTab === 'market' && renderMarketTab()}
                        {activeTab === 'alerts' && renderAlertsTab()}
                        {activeTab === 'chat' && renderChatTab()}
                        {activeTab === 'settings' && renderSettingsTab()}
                    </main>

                    <nav className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 shadow-2xl z-20 rounded-t-xl">
                        <ul className="flex justify-around py-3">
                            {[
                                { name: 'Stocks', icon: '📈' },
                                { name: 'Analysis', icon: '🔬' },
                                { name: 'Plays', icon: '🎯' },
                                { name: 'Market', icon: '📊' },
                                { name: 'Alerts', icon: '🔔' },
                                { name: 'Chat', icon: '💬' },
                                { name: 'Settings', icon: '⚙️' },
                            ].map((tab) => (
                                <li key={tab.name}>
                                    <button
                                        onClick={() => setActiveTab(tab.name.toLowerCase())}
                                        className={`flex flex-col items-center text-xs font-semibold px-2 py-1 rounded-lg transition-colors duration-200
                                            ${activeTab === tab.name.toLowerCase() ? 'text-purple-400 bg-purple-900/30' : 'text-gray-400 hover:text-white'}`}
                                    >
                                        <span className="text-xl mb-1">{tab.icon}</span>
                                        {tab.name}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </nav>
                </div>
            );
        };

        // Export the App component as default for standard React build tools
        export default App;
