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

    // 2. Fetch data securely from Netlify API
    const SITE_ID = process.env.NETLIFY_SITE_ID; 
    const NETLIFY_TOKEN = process.env.NETLIFY_API_TOKEN;

    if (!NETLIFY_TOKEN || !SITE_ID) {
        console.warn("Missing API keys locally. Falling back to graceful return.");
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify([])
        };
    }

    try {
        // Fetch forms for the site to find the 'candidate-application' form ID
        const formsResponse = await fetch(`https://api.netlify.com/api/v1/sites/${SITE_ID}/forms`, {
            headers: {
                'Authorization': `Bearer ${NETLIFY_TOKEN}`
            }
        });
        
        if (!formsResponse.ok) {
            throw new Error(`Error fetching forms: ${formsResponse.statusText}`);
        }
        
        const forms = await formsResponse.json();
        const appForm = forms.find(f => f.name === 'candidate-application');
        
        if (!appForm) {
            return {
                statusCode: 200,
                body: JSON.stringify([]) // No applications form found yet
            };
        }

        // Fetch submissions for the specific form
        const submissionsResponse = await fetch(`https://api.netlify.com/api/v1/forms/${appForm.id}/submissions`, {
            headers: {
                'Authorization': `Bearer ${NETLIFY_TOKEN}`
            }
        });

        if (!submissionsResponse.ok) {
            throw new Error(`Error fetching submissions: ${submissionsResponse.statusText}`);
        }

        const submissions = await submissionsResponse.json();

        // 3. Map Netlify Submissions to our required secure format
        const formattedData = submissions.map(sub => {
            const data = sub.data;
            return {
                id: sub.id,
                submittedAt: new Date(sub.created_at).toLocaleString(),
                fullName: data.fullName || 'N/A',
                email: data.email || 'N/A',
                phone: data.phone || 'N/A',
                location: data.location || 'N/A',
                visaStatus: data.visaStatus || 'N/A',
                jobTitle: data.applied_job_title || data.occupation || 'N/A',
                experienceYears: data.experienceYears || '0',
                // Explicitly securely retrieve the file URLs if they exist
                passportUrl: data.passport ? data.passport.url : null,
                resumeUrl: data.resume ? data.resume.url : null,
                certificatesUrls: data.certificates ? (Array.isArray(data.certificates) ? data.certificates.map(c => c.url) : [data.certificates.url]) : [],
                licensesUrls: data.licensesUpload ? (Array.isArray(data.licensesUpload) ? data.licensesUpload.map(c => c.url) : [data.licensesUpload.url]) : [],
                referencesUrls: data.references ? (Array.isArray(data.references) ? data.references.map(c => c.url) : [data.references.url]) : [],
                rawForm: data
            };
        });

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formattedData)
        };

    } catch (error) {
        console.error("Backend Error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Failed to load application data securely." })
        };
    }
};
