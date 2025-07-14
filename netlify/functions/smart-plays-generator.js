// netlify/functions/smart-plays-generator.js
// Intelligent Smart Plays using comprehensive AI analysis

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
        console.log(`[smart-plays-generator.js] Generating intelligent smart plays with comprehensive analysis...`);

        // Call the comprehensive AI analysis function
        const analysisResponse = await fetch(`${process.env.URL || 'http://localhost:8888'}/.netlify/functions/comprehensive-ai-analysis`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'smartplays' })
        });

        if (!analysisResponse.ok) {
            throw new Error(`Comprehensive analysis failed: ${analysisResponse.status}`);
        }

        const analysisData = await analysisResponse.json();
        
        if (analysisData.analysis && analysisData.analysis.plays) {
            const plays = analysisData.analysis.plays;
            const marketCondition = analysisData.analysis.marketCondition;
            const overallStrategy = analysisData.analysis.overallStrategy;
            const marketInsights = analysisData.analysis.marketInsights;
            
            console.log(`[smart-plays-generator.js] Generated ${plays.length} intelligent plays based on comprehensive analysis`);
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    plays: plays,
                    marketCondition: marketCondition,
                    overallStrategy: overallStrategy,
                    marketInsights: marketInsights,
                    timestamp: new Date().toISOString(),
                    dataSource: "Comprehensive AI Analysis",
                    dataQuality: analysisData.dataQuality
                })
            };
        } else {
            // Fallback if AI analysis fails
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    plays: [],
                    message: "AI analysis temporarily unavailable",
                    timestamp: new Date().toISOString()
                })
            };
        }

    } catch (error) {
        console.error(`[smart-plays-generator.js] Error:`, error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: "Smart plays generation error",
                details: error.message,
                timestamp: new Date().toISOString()
            })
        };
    }
};
