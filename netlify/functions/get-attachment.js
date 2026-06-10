const { Resend } = require('resend');

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

    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            body: 'Method Not Allowed'
        };
    }

    // 1. Verify Authentication (Supports secure custom Token & Netlify Identity)
    const API_TOKEN = process.env.TALENTGATE_API_TOKEN || "TalentGate_Secret_CRM_Token_2026!";
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const clientToken = authHeader && authHeader.split(' ')[1];
    
    const { user } = context.clientContext || {};
    const isNetlifyAdmin = user && user.app_metadata && user.app_metadata.roles && user.app_metadata.roles.includes('admin');
    
    if (clientToken !== API_TOKEN && !isNetlifyAdmin) {
        return {
            statusCode: 403,
            headers: {
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ error: "Forbidden. Authorized client token or Netlify admin login required." })
        };
    }

    try {
        const { emailId, attachmentId } = event.queryStringParameters || {};

        if (!emailId || !attachmentId) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ error: "Missing emailId or attachmentId query parameters" })
            };
        }

        const resendKey = process.env.RESEND_API_KEY;
        if (!resendKey) {
            console.error("Missing RESEND_API_KEY environment variable.");
            return {
                statusCode: 500,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ error: "SMTP relay configuration error" })
            };
        }

        const resend = new Resend(resendKey);

        console.log(`Requesting attachment download URL from Resend for Email: ${emailId}, Attachment: ${attachmentId}`);
        const { data, error } = await resend.emails.receiving.attachments.get({
            id: attachmentId,
            emailId: emailId
        });

        if (error) {
            console.error("Resend API error fetching attachment:", error);
            return {
                statusCode: 500,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ error: "Failed to retrieve attachment from Resend", details: error.message })
            };
        }

        if (!data || !data.download_url) {
            return {
                statusCode: 404,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ error: "Attachment download URL not found" })
            };
        }

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ 
                success: true, 
                downloadUrl: data.download_url 
            })
        };

    } catch (err) {
        console.error("Error in get-attachment function:", err);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ error: "Internal server error" })
        };
    }
};
