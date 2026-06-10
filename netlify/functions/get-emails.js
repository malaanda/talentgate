const { getStore } = require('@netlify/blobs');

exports.handler = async (event, context) => {
    // Enable CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Allow-Methods': 'GET, OPTIONS'
            },
            body: ''
        };
    }

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
        // Connect to Netlify Blobs to retrieve the email threads
        const store = getStore({
            name: 'mailbox',
            siteID: process.env.NETLIFY_SITE_ID || undefined,
            token: process.env.NETLIFY_API_TOKEN || undefined
        });

        const existingData = await store.get('threads');
        const threads = existingData ? JSON.parse(existingData) : [];

        return {
            statusCode: 200,
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            },
            body: JSON.stringify(threads)
        };

    } catch (error) {
        console.error("Error retrieving emails:", error);
        return {
            statusCode: 500,
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ 
                error: "Failed to load email thread data securely.", 
                message: error.message,
                name: error.name,
                stack: error.stack
            })
        };
    }
};
