// netlify/functions/realtime-alerts.js
// Intelligent real-time alerts using comprehensive AI analysis

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
        console.log(`[realtime-alerts.js] Generating intelligent alerts with comprehensive analysis...`);

        // Call the comprehensive AI analysis function
        const analysisResponse = await fetch(`${process.env.URL || 'http://localhost:8888'}/.netlify/functions/comprehensive-ai-analysis`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'alerts' })
        });

        if (!analysisResponse.ok) {
            throw new Error(`Comprehensive analysis failed: ${analysisResponse.status}`);
        }

        const analysisData = await analysisResponse.json();
        
        if (analysisData.analysis && analysisData.analysis.alerts) {
            const alerts = analysisData.analysis.alerts;
            const marketCondition = analysisData.analysis.marketCondition;
            const riskLevel = analysisData.analysis.riskLevel;
            const keyWatches = analysisData.analysis.keyWatches;
            
            console.log(`[realtime-alerts.js] Generated ${alerts.length} intelligent alerts based on comprehensive analysis`);
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    alerts: alerts,
                    marketCondition: marketCondition,
                    riskLevel: riskLevel,
                    keyWatches: keyWatches,
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
                    alerts: [],
                    message: "AI analysis temporarily unavailable",
                    timestamp: new Date().toISOString()
                })
            };
        }

    } catch (error) {
        console.error(`[realtime-alerts.js] Error:`, error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: "Alerts generation error",
                details: error.message,
                timestamp: new Date().toISOString()
            })
        };
    }
};
