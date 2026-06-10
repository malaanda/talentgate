const { getStore } = require('@netlify/blobs');
const { Resend } = require('resend');

exports.handler = async (event, context) => {
    // Enable CORS
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Allow-Methods': 'POST, OPTIONS'
            },
            body: ''
        };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    // 1. Verify Authentication
    const API_TOKEN = process.env.TALENTGATE_API_TOKEN || "TalentGate_Secret_CRM_Token_2026!";
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const clientToken = authHeader && authHeader.split(' ')[1];
    
    const { user } = context.clientContext || {};
    const isNetlifyAdmin = user && user.app_metadata && user.app_metadata.roles && user.app_metadata.roles.includes('admin');
    
    if (clientToken !== API_TOKEN && !isNetlifyAdmin) {
        return {
            statusCode: 403,
            body: JSON.stringify({ error: "Forbidden. Authorized client token required." })
        };
    }

    try {
        const { threadId, bodyText } = JSON.parse(event.body);

        if (!threadId || !bodyText) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: "Missing threadId or bodyText" })
            };
        }

        // Connect to Netlify Blobs
        const store = getStore({
            name: 'mailbox',
            siteID: process.env.NETLIFY_SITE_ID || undefined,
            token: process.env.NETLIFY_API_TOKEN || undefined
        });

        const existingData = await store.get('threads');
        const threads = existingData ? JSON.parse(existingData) : [];

        // Find the thread
        const threadIndex = threads.findIndex(t => t.id === threadId);
        if (threadIndex === -1) {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: "Thread not found" })
            };
        }

        const thread = threads[threadIndex];
        const resendKey = process.env.RESEND_API_KEY;
        if (!resendKey) {
            console.error("Missing RESEND_API_KEY environment variable.");
            return {
                statusCode: 500,
                body: JSON.stringify({ error: "SMTP relay configuration error" })
            };
        }

        const resend = new Resend(resendKey);

        // Format email signature/wrapper
        const htmlContent = `
            <div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #333333; max-width: 600px;">
                <p>${bodyText.replace(/\n/g, '<br>')}</p>
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
                <p style="font-size: 12px; color: #9ca3af; margin: 0;">Sent via TalentGate Portal SMTP Relay</p>
                <p style="font-size: 11px; color: #d1d5db; margin: 5px 0 0 0;">This email is a response to your inquiry regarding ${thread.jobTitle || 'careers'}.</p>
            </div>
        `;

        // Determine from email
        // Standardize: if the thread's mailbox contains vltran, label it accordingly
        let fromName = "TalentGate Careers";
        if (thread.mailbox.includes("vltran")) {
            fromName = "V L Tran Careers";
        }

        // Send the email via Resend
        const { data: sendResult, error } = await resend.emails.send({
            from: `${fromName} <noreply@careers.talentgate.com.au>`,
            to: [thread.senderEmail],
            replyTo: thread.mailbox,
            subject: thread.subject.startsWith("Re:") ? thread.subject : `Re: ${thread.subject}`,
            html: htmlContent
        });

        if (error) {
            console.error("Resend send error:", error);
            return {
                statusCode: 500,
                body: JSON.stringify({ error: "Failed to dispatch email", details: error.message })
            };
        }

        // Add the message to the thread history
        const newMsg = {
            id: "msg_out_" + Date.now(),
            direction: "outbound",
            sender: "TalentGate Staff",
            senderEmail: thread.mailbox,
            body: bodyText,
            date: new Date().toLocaleString('en-AU', { timeZone: 'Australia/Perth' }) + ' AWST',
            isOutgoing: true
        };

        if (!thread.messages) thread.messages = [];
        thread.messages.push(newMsg);
        thread.unread = false;

        // Move thread to top of list
        threads.splice(threadIndex, 1);
        threads.unshift(thread);

        // Save threads back to Blob store
        await store.set('threads', JSON.stringify(threads));

        return {
            statusCode: 200,
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ success: true, messageId: sendResult.id, thread })
        };

    } catch (err) {
        console.error("Send reply error:", err);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Internal server error" })
        };
    }
};
