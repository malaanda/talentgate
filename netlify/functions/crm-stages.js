const { getStore } = require('@netlify/blobs');

exports.handler = async (event, context) => {
    // 1. Verify Authentication (Supports both secure custom Token & Netlify Identity)
    const API_TOKEN = process.env.TALENTGATE_API_TOKEN || "TalentGate_Secret_CRM_Token_2026!";
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const clientToken = authHeader && authHeader.split(' ')[1];
    
    const { user } = context.clientContext || {};
    const isNetlifyAdmin = user && user.app_metadata && user.app_metadata.roles && user.app_metadata.roles.includes('admin');
    
    if (clientToken !== API_TOKEN && !isNetlifyAdmin) {
        return {
            statusCode: 403,
            body: JSON.stringify({ error: "Forbidden. Authorized client token or Netlify admin login required." })
        };
    }

    try {
        // Initialize the Netlify Blobs store.
        let store;
        try {
            store = getStore({
                name: 'crm-stages',
                siteID: process.env.NETLIFY_SITE_ID || undefined,
                token: process.env.NETLIFY_API_TOKEN || undefined
            });
        } catch (e) {
            console.warn("Netlify Blobs local environment missing. Falling back gracefully.");
            if (event.httpMethod === 'GET') {
                return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: "{}" };
            } else if (event.httpMethod === 'POST') {
                return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ success: true, dummyFallback: true }) };
            }
        }
        
        if (event.httpMethod === 'GET') {
            // Retrieve all stage mappings
            const stagesBlob = await store.get('all-stages');
            const stages = stagesBlob ? JSON.parse(stagesBlob) : {};
            
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(stages)
            };
            
        } else if (event.httpMethod === 'POST') {
            // Update a stage mapping
            const { applicationId, newStatus, isReviewed } = JSON.parse(event.body);
            
            if (!applicationId) {
                return {
                    statusCode: 400,
                    body: JSON.stringify({ error: "Missing applicationId" })
                };
            }
            
            // Get current mapping
            const stagesBlob = await store.get('all-stages');
            const stages = stagesBlob ? JSON.parse(stagesBlob) : {};
            
            // Backward compatibility
            let currentData = stages[applicationId];
            if (typeof currentData === 'string') {
                currentData = { status: currentData, isReviewed: false };
            } else if (!currentData) {
                currentData = { status: 'Initial', isReviewed: false };
            }
            
            if (newStatus !== undefined) currentData.status = newStatus;
            if (isReviewed !== undefined) currentData.isReviewed = isReviewed;
            
            // Save back
            stages[applicationId] = currentData;
            
            await store.set('all-stages', JSON.stringify(stages));
            
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ success: true, currentData })
            };
            
        } else {
            return {
                statusCode: 405,
                body: "Method Not Allowed"
            };
        }

    } catch (error) {
        console.error("Blob Storage Error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Internal Server Error connecting to Cloud Database" })
        };
    }
};
