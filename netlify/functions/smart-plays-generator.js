// netlify/functions/smart-plays-generator.js
// Updated to use comprehensive AI analysis - NO MOCK DATA

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
        console.log(`[smart-plays-generator.js] Generating smart plays using comprehensive AI analysis...`);

        // Get the base URL for calling other functions
        const baseUrl = process.env.URL || `https://${event.headers.host}`;
        
        // Call the comprehensive AI analysis function for smart plays
        const analysisResponse = await fetch(`${baseUrl}/.netlify/functions/comprehensive-ai-analysis`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'User-Agent': 'Netlify-Function'
            },
            body: JSON.stringify({ type: 'smartplays' })
        });

        if (!analysisResponse.ok) {
            throw new Error(`Comprehensive analysis failed: ${analysisResponse.status} - ${analysisResponse.statusText}`);
        }

        const analysisData = await analysisResponse.json();
        
        // Check if we got valid analysis data
        if (analysisData.analysis && analysisData.analysis.plays && Array.isArray(analysisData.analysis.plays)) {
            const plays = analysisData.analysis.plays;
            
            // Filter out any plays that don't have real data backing
            const validPlays = plays.filter(play => 
                play.ticker && 
                play.title && 
                play.confidence && 
                play.confidence >= 60 && // Minimum confidence threshold
                (play.entry || play.entry === 0) &&
                (play.stopLoss || play.stopLoss === 0)
            );
            
            console.log(`[smart-plays-generator.js] Generated ${validPlays.length} valid smart plays from comprehensive analysis`);
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    plays: validPlays,
                    marketCondition: analysisData.analysis.marketCondition || 'Unknown',
                    sessionContext: analysisData.analysis.sessionContext || 'Unknown',
                    overallStrategy: analysisData.analysis.overallStrategy || 'No strategy available',
                    marketInsights: analysisData.analysis.marketInsights || {},
                    timestamp: new Date().toISOString(),
                    dataSource: "Comprehensive AI Analysis - Real Data Only",
                    dataQuality: analysisData.dataQuality || {}
                })
            };
        } else {
            // No valid plays found - return empty but informative response
            console.log(`[smart-plays-generator.js] No valid plays generated - insufficient market opportunities`);
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    plays: [],
                    message: "No qualifying trading opportunities found",
                    reason: "Current market conditions do not present significant moves meeting our criteria",
                    marketCondition: analysisData.analysis?.marketCondition || "Unknown",
                    sessionContext: analysisData.analysis?.sessionContext || "Unknown",
                    timestamp: new Date().toISOString(),
                    dataSource: "Comprehensive AI Analysis - Real Data Only",
                    dataQuality: analysisData.dataQuality || {}
                })
            };
        }

    } catch (error) {
        console.error(`[smart-plays-generator.js] Error generating smart plays:`, error);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: "Smart plays generation error",
                details: error.message,
                plays: [], // Always return empty array instead of mock data
                timestamp: new Date().toISOString(),
                dataSource: "Error - No Data Available"
            })
        };
    }
};
