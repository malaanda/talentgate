// Mobile Menu Toggle
document.addEventListener('DOMContentLoaded', () => {
    // Pre-populate a mock custom job to localStorage to showcase local Recruiter ATS synchronization
    if (!localStorage.getItem('tg_custom_jobs')) {
        const mockCustomJobs = [
            {
                id: 'job_demo_999',
                title: 'Horticulture Team Leader',
                industry: 'Agriculture',
                location: 'Hunter Valley, NSW',
                type: 'Full-time',
                salary: '$75,000 – $85,000 per annum',
                employerCompany: 'Scenic Vineyard Holdings',
                aboutEmployer: 'Scenic Vineyard Holdings is one of the premier estate viticulture and wine producers in the Hunter Valley, operating state-of-the-art harvesting and processing operations with a dedication to fine craftsmanship and sustainable farming.',
                description: 'We are seeking an experienced Horticulture Team Leader to oversee vineyard cultivation, coordinate pickers and machinery operators during harvest, and implement quality controls in the field. This is a secure, permanent full-time position offering excellent salary and career progression.',
                responsibilities: [
                    "Supervise and coordinate field crews in fruit harvesting and vineyard maintenance",
                    "Ensure compliance with farm biosecurity protocols and active WHS policies",
                    "Operate and conduct basic pre-start checks on farm machinery and irrigation lines",
                    "Monitor crop health, crop yield data, and coordinate daily tasks with the Vineyard Manager"
                ],
                qualifications: [
                    "Certificate III or IV in Horticulture or Viticulture (highly regarded)",
                    "Minimum 2 years of leading/supervising crews in an agricultural setting",
                    "Valid Driver's Licence and reliable transport",
                    "Strong communication and team-building skills"
                ],
                datePosted: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 3 days ago
                dateClosing: new Date(Date.now() + 27 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 27 days from now (customized close)
            }
        ];
        localStorage.setItem('tg_custom_jobs', JSON.stringify(mockCustomJobs));
    }

    // Mobile Nav Logic
    const mobileBtn = document.querySelector('.menu-toggle');
    const mobileMenu = document.querySelector('.nav-links');

    if (mobileBtn && mobileMenu) {
        mobileBtn.addEventListener('click', () => {
            mobileMenu.classList.toggle('active');
        });

        const navLinks = mobileMenu.querySelectorAll('a');
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                mobileMenu.classList.remove('active');
            });
        });
    }

    // Job Board Logic
    window.allJobs = [];

    const jobList = document.getElementById('job-list');
    
    // Dynamic Job Board State management on jobs.html
    window.showJobBoard = function(showBoard, categoryName = '') {
        const catSelection = document.getElementById('category-selection');
        const jobDisplay = document.getElementById('job-display');
        const catTitle = document.getElementById('category-title');
        
        if (!catSelection || !jobDisplay) return; // Only runs on jobs.html
        
        if (showBoard) {
            catSelection.style.display = 'none';
            jobDisplay.style.display = 'block';
            if (catTitle) {
                if (categoryName) {
                    let label = categoryName;
                    if (categoryName === 'Agriculture') label = 'Agriculture & Processing';
                    if (categoryName === 'Healthcare') label = 'Healthcare & Care';
                    if (categoryName === 'Hospitality') label = 'Hospitality & Trades';
                    if (categoryName === 'Construction') label = 'Services & Support';
                    catTitle.textContent = `${label} Opportunities`;
                } else {
                    catTitle.textContent = 'All Opportunities';
                }
            }
        } else {
            catSelection.style.display = 'block';
            jobDisplay.style.display = 'none';
            // Clear URL queries smoothly without reloading
            if (history.pushState) {
                const newurl = window.location.protocol + "//" + window.location.host + window.location.pathname;
                window.history.pushState({path:newurl},'',newurl);
            }
            // Clear search filter input
            const jobSearch = document.getElementById('job-search');
            if (jobSearch) jobSearch.value = '';
            
            // Clear Indeed/Upwork panels if they exist
            const searchOcc = document.getElementById('search-occupation');
            const filterLoc = document.getElementById('filter-location');
            const filterInd = document.getElementById('filter-industry');
            if (searchOcc) searchOcc.value = '';
            if (filterLoc) filterLoc.value = '';
            if (filterInd) filterInd.value = '';
            
            window.applyUnifiedFilters();
        }
    };

    // Unified Filter Function for Indeed/Upwork style Search & Filter Panel
    window.applyUnifiedFilters = function () {
        const searchVal = (document.getElementById('search-occupation')?.value || document.getElementById('job-search')?.value || '').toLowerCase();
        const locationVal = (document.getElementById('filter-location')?.value || '').toLowerCase();
        const industryVal = document.getElementById('filter-industry')?.value || '';

        // If on jobs.html and we have a selected category from the URL, filter by it too!
        const urlParams = new URLSearchParams(window.location.search);
        const categoryParam = urlParams.get('category');
        
        if (!window.allJobs || !window.allJobs.length) return;

        const filtered = window.allJobs.filter(job => {
            const matchesSearch = !searchVal || 
                job.title.toLowerCase().includes(searchVal) || 
                job.description.toLowerCase().includes(searchVal) ||
                (job.location && job.location.toLowerCase().includes(searchVal)) ||
                (job.employerCompany && job.employerCompany.toLowerCase().includes(searchVal));
            
            // Match location dynamically
            const matchesLocation = !locationVal || 
                (job.location && job.location.toLowerCase().includes(locationVal));
            
            // Filter by industry
            const matchesIndustry = !industryVal ? 
                (!categoryParam || job.industry === categoryParam) : 
                (job.industry === industryVal);
            
            return matchesSearch && matchesLocation && matchesIndustry;
        });

        renderJobs(filtered);

        // Update list header text based on filters
        const listHeader = document.getElementById('jobs-list-header');
        if (listHeader) {
            if (searchVal || locationVal || industryVal || categoryParam) {
                let filterSummary = [];
                if (searchVal) filterSummary.push(`"${searchVal}"`);
                if (industryVal || categoryParam) {
                    let indLabel = industryVal || categoryParam;
                    if (indLabel === 'Agriculture') indLabel = 'Agriculture & Processing';
                    if (indLabel === 'Healthcare') indLabel = 'Healthcare & Care';
                    if (indLabel === 'Hospitality') indLabel = 'Hospitality & Trades';
                    if (indLabel === 'Construction') indLabel = 'Services & Support';
                    filterSummary.push(indLabel);
                }
                if (locationVal) filterSummary.push(locationVal);
                listHeader.textContent = `Filtered Opportunities (${filterSummary.join(' in ')})`;
            } else {
                listHeader.textContent = 'All Open Positions';
            }
        }
    };

    if (jobList) {
        fetchJobs();
    }

    async function fetchJobs() {
        try {
            // Fetch static generic jobs with cache-busting
            let jsonJobs = [];
            try {
                const response = await fetch('data/jobs.json?t=' + Date.now());
                jsonJobs = await response.json();
            } catch (e) {
                console.warn("Could not load static jobs", e);
            }

            // Fetch live custom jobs (merge localStorage fallback with cloud API)
            let customJobs = [];
            try {
                const localJobs = JSON.parse(localStorage.getItem('tg_custom_jobs') || '[]');
                if (localJobs && localJobs.length > 0) {
                    customJobs = [...localJobs];
                }
            } catch (e) {
                console.warn("Could not load custom jobs from localStorage", e);
            }

            try {
                const apiResponse = await fetch('/.netlify/functions/jobs-api');
                if (apiResponse.ok) {
                    const cloudJobs = await apiResponse.json();
                    cloudJobs.forEach(cloudJob => {
                        const index = customJobs.findIndex(j => String(j.id) === String(cloudJob.id));
                        if (index !== -1) {
                            customJobs[index] = cloudJob;
                        } else {
                            customJobs.unshift(cloudJob);
                        }
                    });
                }
            } catch (e) {
                console.warn("Could not load live custom jobs", e);
            }

            window.allJobs = [...customJobs, ...jsonJobs].map((j, i) => {
                if (!j.id) j.id = 'static_job_' + i;
                return j;
            }); // Store Globally

            // Wire up event listeners for Indeed/Upwork Search panel
            const searchOcc = document.getElementById('search-occupation');
            const filterLoc = document.getElementById('filter-location');
            const filterInd = document.getElementById('filter-industry');
            const resetBtn = document.getElementById('reset-filters');
            const jobSearch = document.getElementById('job-search');
            const backBtn = document.getElementById('back-to-categories');

            if (searchOcc || filterLoc || filterInd) {
                searchOcc?.addEventListener('input', window.applyUnifiedFilters);
                filterLoc?.addEventListener('change', window.applyUnifiedFilters);
                filterInd?.addEventListener('change', window.applyUnifiedFilters);

                if (resetBtn) {
                    resetBtn.addEventListener('click', () => {
                        if (searchOcc) searchOcc.value = '';
                        if (filterLoc) filterLoc.value = '';
                        if (filterInd) filterInd.value = '';
                        window.applyUnifiedFilters();
                    });
                }
            }

            if (jobSearch) {
                jobSearch.addEventListener('input', window.applyUnifiedFilters);
            }

            if (backBtn) {
                backBtn.addEventListener('click', () => {
                    window.showJobBoard(false);
                });
            }

            // Handle URL Parameters (Pre-filling filters)
            const urlParams = new URLSearchParams(window.location.search);
            const categoryParam = urlParams.get('category');
            const searchParam = urlParams.get('search') || urlParams.get('q');
            const locationParam = urlParams.get('location');
            const jobParam = urlParams.get('job');

            // If we are on jobs.html and have ANY URL parameters, show the job board immediately
            if (categoryParam || searchParam || locationParam || jobParam) {
                window.showJobBoard(true, categoryParam || '');
            }

            if (categoryParam && filterInd) {
                const validCategories = ['Agriculture', 'Healthcare', 'Hospitality', 'Construction'];
                if (validCategories.includes(categoryParam)) {
                    filterInd.value = categoryParam;
                }
            }
            if (searchParam) {
                if (searchOcc) searchOcc.value = searchParam;
                if (jobSearch) jobSearch.value = searchParam;
            }
            if (locationParam && filterLoc) {
                filterLoc.value = locationParam;
            }

            // Render matching list initially
            window.applyUnifiedFilters();

            // Auto-open specific job modal if supplied in URL
            if (jobParam) {
                setTimeout(() => {
                    const jobToOpen = window.allJobs.find(j => j.title === jobParam);
                    if (jobToOpen) {
                        window.showJobBoard(true, jobToOpen.industry);
                        window.openJobModal(jobToOpen.id);
                    }
                }, 500);
            }

        } catch (error) {
            console.error('Error fetching jobs:', error);
            if (jobList) jobList.innerHTML = '<p>Unable to load jobs at this time. Please try again later.</p>';
        }
    }

    // Blog Logic
    const blogList = document.getElementById('blog-list');
    if (blogList) {
        fetchBlog();
    }

    // Application Form Logic
    const applicationForm = document.getElementById('applicationForm');
    if (applicationForm) {
        const urlParams = new URLSearchParams(window.location.search);
        const jobTitle = urlParams.get('job');

        if (jobTitle) {
            // Update Page Title (Optional, keeping existing logic)
            const pageTitle = document.querySelector('.section-title');
            if (pageTitle) {
                pageTitle.textContent = `Candidate Application: ${jobTitle}`;
            }

            // Pre-fill Occupation
            const occupationInput = document.getElementById('occupation');
            const hiddenInput = document.getElementById('applied_job_hidden');
            if (occupationInput) {
                occupationInput.value = jobTitle;
                occupationInput.readOnly = true; // Lock it so they don't change it by accident
                occupationInput.style.backgroundColor = "#e9ecef";
            }
            if (hiddenInput) {
                hiddenInput.value = jobTitle;
            }

            // Fetch Job Details to Populate UI
            async function loadAppJobDetails() {
                try {
                    let jsonJobs = [];
                    try {
                        const response = await fetch('data/jobs.json');
                        jsonJobs = await response.json();
                    } catch (e) {}

                    let customJobs = [];
                    try {
                        const apiResponse = await fetch('/.netlify/functions/jobs-api');
                        if (apiResponse.ok) {
                            customJobs = await apiResponse.json();
                        }
                    } catch (e) {}

                    const combinedJobs = [...customJobs, ...jsonJobs];
                    const job = combinedJobs.find(j => j.title === jobTitle);
                    
                    if (job) {
                        const container = document.getElementById('job-details-container');
                        if (container) {
                            document.getElementById('app-job-title').textContent = job.title;
                            document.getElementById('app-job-location').textContent = job.location;
                            document.getElementById('app-job-type').textContent = job.type;
                            document.getElementById('app-job-industry').textContent = job.industry;
                            document.getElementById('app-job-desc').textContent = job.description;
                            container.style.display = 'block';
                        }
                    }
                } catch (err) {
                    console.error("Error fetching job details for application:", err);
                }
            }
            loadAppJobDetails();
        }

        // Intercept form submission to parse files to base64 and sync to recruiter CRM localStorage!
        applicationForm.addEventListener('submit', function(e) {
            e.preventDefault();

            const fullName = document.getElementById('fullName').value.trim();
            const email = document.getElementById('email').value.trim();
            const phone = document.getElementById('phone').value.trim();
            const location = document.getElementById('location').value.trim();
            const visaStatus = document.getElementById('visaStatus').value;
            const occupation = document.getElementById('occupation').value.trim();
            const comments = document.getElementById('comments')?.value.trim() || '';
            const englishLevel = document.getElementById('englishLevel')?.value || 'Fluent';
            const startDate = document.getElementById('startDate')?.value || 'Immediately';
            const preferredLocation = document.getElementById('preferredLocation')?.value || location;

            const resumeInput = document.getElementById('resume');
            const resumeFile = resumeInput && resumeInput.files ? resumeInput.files[0] : null;

            const passportInput = document.getElementById('passport');
            const passportFile = passportInput && passportInput.files ? passportInput.files[0] : null;

            // Standard candidate CRM mock base64 PDF
            const dummyPdf = 'data:application/pdf;base64,JVBERi0xLjAKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKPj4KZW5kb2JqCjIgMCBvYmoKPDwKL1R5cGUgL1BhZ2VzCi9LaWRzIFszIDAgUl0KL0NvdW50IDEKPj4KZW5kb2JqCjMgMCBvYmoKPDwKL1R5cGUgL1BhZ2UKL1BhcmVudCAyIDAgUgovTWVkaWFCb3ggWzAgMCA1OTUgODQyXQo+PgplbmRvYmoKeHJlZgowIDQKMDAwMDAwMDAwMCA2NTUzNSBmCjAwMDAwMDAwMTAgMDAwMDAgbgowMDAwMDAwMDYwIDAwMDAwIG4KMDAwMDAwMDExNyAwMDAwMCBuCnRyYWlsZXIKPDwKL1NpemUgNAovUm9vdCAxIDAgUgo+PgpzdGFydHhyZWYKMTczCiUlRU9GCg==';

            function saveApplicationToLocalStorage(resumeBase64Data, passportBase64Data) {
                const newApp = {
                    id: 'app_' + Date.now(),
                    submittedAt: new Date().toLocaleString(),
                    fullName: fullName,
                    email: email,
                    phone: phone,
                    visaStatus: visaStatus || 'Citizen',
                    jobTitle: occupation || 'General Application',
                    employerCompany: 'TalentGate Client',
                    location: location || 'Australia',
                    status: 'New',
                    rawForm: { 
                        comments: comments, 
                        englishLevel: englishLevel,
                        startDate: startDate,
                        preferredLocation: preferredLocation
                    },
                    resumeUrl: resumeBase64Data || dummyPdf,
                    passportUrl: passportBase64Data || dummyPdf
                };

                let currentApps = [];
                try {
                    currentApps = JSON.parse(localStorage.getItem('tg_applications') || '[]');
                } catch (err) {
                    console.warn("Could not read tg_applications from localStorage", err);
                }

                currentApps.unshift(newApp);

                try {
                    localStorage.setItem('tg_applications', JSON.stringify(currentApps));
                } catch (err) {
                    console.warn("Could not write tg_applications to localStorage", err);
                }
            }

            async function postToNetlifyForms() {
                try {
                    const formData = new FormData(applicationForm);
                    await fetch('/', {
                        method: 'POST',
                        headers: { "Content-Type": "application/x-www-form-urlencoded" },
                        body: new URLSearchParams(formData).toString()
                    });
                } catch (err) {
                    console.warn("Netlify form submission failed, local storage sync fallback active.", err);
                }
            }

            // Read documents sequentially to generate base64 data URLs
            const readFileAsDataURL = (file) => {
                return new Promise((resolve) => {
                    if (!file) return resolve(null);
                    const reader = new FileReader();
                    reader.onload = (e) => resolve(e.target.result);
                    reader.readAsDataURL(file);
                });
            };

            Promise.all([readFileAsDataURL(resumeFile), readFileAsDataURL(passportFile)]).then(async ([resumeBase64, passportBase64]) => {
                saveApplicationToLocalStorage(resumeBase64, passportBase64);
                await postToNetlifyForms();

                // Replace the contact-form with a gorgeous full-page success screen!
                const contactFormContainer = document.querySelector('.contact-form');
                if (contactFormContainer) {
                    contactFormContainer.innerHTML = `
                        <div style="background: white; border: 1px solid #e2e8f0; padding: 4rem 3rem; border-radius: 12px; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05); text-align: center; animation: scaleIn 0.3s ease-out; width: 100%; box-sizing: border-box;">
                            <i class="fas fa-check-circle" style="font-size: 4rem; color: #16a34a; margin-bottom: 1.5rem; display: block;"></i>
                            <h2 style="font-size: 2.2rem; font-weight: 800; color: var(--primary); margin-bottom: 1rem; font-family: var(--font-heading);">Application Submitted!</h2>
                            <p style="font-size: 1.1rem; color: #475569; max-width: 600px; margin: 0 auto 2.5rem; line-height: 1.8;">
                                Thank you for submitting your application to TalentGate. Your profile and documents have been securely processed and linked to our recruitment network. Our specialists will review your credentials and match you with active openings.
                            </p>
                            <a href="index.html" class="btn btn-primary" style="padding: 14px 30px; font-size: 1rem; font-weight: 700; text-transform: uppercase; border-radius: 6px; display: inline-block; text-decoration: none;">Return to Portal Home</a>
                        </div>
                    `;
                    // Smoothly scroll the candidate to the top of the form area
                    contactFormContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });
        });
    }
    // Article Page Logic
    const articleContent = document.getElementById('article-content');
    if (articleContent) {
        const urlParams = new URLSearchParams(window.location.search);
        const articleId = urlParams.get('id');
        if (articleId) {
            fetchArticle(articleId);
        } else {
            articleContent.innerHTML = '<p>Article not found.</p>';
        }
    }
});

async function fetchArticle(id) {
    try {
        const response = await fetch('data/blog.json?v=' + new Date().getTime());
        const posts = await response.json();
        const post = posts.find(p => p.id == id);

        const container = document.getElementById('article-content');
        if (!post) {
            container.innerHTML = '<p>Article not found.</p>';
            return;
        }

        container.innerHTML = `
            <img src="${post.image}" alt="${post.title}" style="width: 100%; max-height: 400px; object-fit: cover; border-radius: 8px; margin-bottom: 2rem;">
            <span class="blog-date" style="color: var(--secondary); font-weight: 600;">${post.date}</span>
            <h1 style="color: var(--primary); margin: 1rem 0 2rem;">${post.title}</h1>
            <div class="article-body" style="line-height: 1.8; color: var(--text-dark);">
                <p><strong>${post.summary}</strong></p>
                <br>
                <div class="content-text">${post.content}</div>
            </div>
        `;

    } catch (error) {
        console.error('Error fetching article:', error);
        document.getElementById('article-content').innerHTML = '<p>Error loading article.</p>';
    }
}

async function fetchBlog() {
    try {
        const response = await fetch('data/blog.json?v=' + new Date().getTime());
        const posts = await response.json();
        renderBlog(posts);
    } catch (error) {
        console.error('Error fetching blog:', error);
        document.getElementById('blog-list').innerHTML = '<p>Unable to load articles at this time.</p>';
    }
}

function renderBlog(posts) {
    const blogList = document.getElementById('blog-list');
    if (!posts.length) {
        blogList.innerHTML = '<p>No articles found.</p>';
        return;
    }

    blogList.innerHTML = posts.map(post => `
        <div class="blog-card">
            <div class="blog-image">
                <img src="${post.image}" alt="${post.title}">
            </div>
            <div class="blog-content">
                <span class="blog-date">${post.date}</span>
                <h3 class="blog-title">${post.title}</h3>
                <p class="blog-summary">${post.summary}</p>
                <a href="article.html?id=${post.id}" class="btn-text">Read More <i class="fas fa-arrow-right"></i></a>
            </div>
        </div>
    `).join('');
}

function renderJobs(jobs) {
    const jobList = document.getElementById('job-list');
    if (!jobList) return; // Defensive
    if (!jobs.length) {
        jobList.innerHTML = '<div style="text-align:center; padding: 4rem 2rem; color: #94a3b8;"><i class="fas fa-search" style="font-size: 2rem; margin-bottom: 1rem; display: block;"></i><p style="font-size:1.1rem;">No matching jobs found. Try adjusting your search filters.</p></div>';
        return;
    }

    jobList.innerHTML = jobs.map(job => {
        // Strip HTML for the short excerpt on the card
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = job.description || "";
        const plainTextDesc = tempDiv.textContent || tempDiv.innerText || "";

        // Parse datePosted safely
        let postedDate = new Date();
        const dateVal = job.datePosted || job.posted;
        if (dateVal) {
            const parsed = new Date(dateVal);
            if (!isNaN(parsed.getTime())) {
                postedDate = parsed;
            }
        }
        
        // Parse closingDate safely, enforcing 30 days minimum
        let closingDate = new Date(postedDate.getTime() + 30 * 24 * 60 * 60 * 1000);
        if (job.dateClosing) {
            const parsedClosing = new Date(job.dateClosing);
            if (!isNaN(parsedClosing.getTime())) {
                closingDate = parsedClosing;
            }
        }
        
        const diffTime = closingDate.getTime() - postedDate.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (isNaN(diffDays) || diffDays < 30) {
            closingDate = new Date(postedDate.getTime() + 30 * 24 * 60 * 60 * 1000);
        }

        const postedDateStr = postedDate.toLocaleDateString('en-AU', {day:'numeric', month:'short', year:'numeric'});
        const closingDateStr = closingDate.toLocaleDateString('en-AU', {day:'numeric', month:'short', year:'numeric'});

        // Determine icon based on industry
        let industryIcon = 'fa-briefcase';
        if (job.industry === 'Agriculture') industryIcon = 'fa-tractor';
        if (job.industry === 'Healthcare') industryIcon = 'fa-hospital-user';
        if (job.industry === 'Hospitality') industryIcon = 'fa-hotel';
        if (job.industry === 'Construction') industryIcon = 'fa-bus';

        const salaryHtml = job.salary ? `<span><i class="fas fa-dollar-sign" style="color: var(--accent);"></i> ${job.salary}</span>` : '';
        const hasResponsibilities = job.responsibilities && job.responsibilities.length > 0;
        const responsibilitiesPreview = hasResponsibilities 
            ? `<ul style="margin: 0.8rem 0 0 0; padding-left: 1.3rem; color: #475569; font-size: 0.9rem; line-height: 1.7;">${job.responsibilities.slice(0, 3).map(r => `<li>${r}</li>`).join('')}${job.responsibilities.length > 3 ? `<li style="color: #94a3b8; font-style: italic;">+${job.responsibilities.length - 3} more...</li>` : ''}</ul>` 
            : '';

        // Industry Label mapping for elegant categories
        let industryLabel = job.industry || '';
        if (job.industry === 'Agriculture') industryLabel = 'Agriculture & Processing';
        else if (job.industry === 'Healthcare') industryLabel = 'Healthcare & Care';
        else if (job.industry === 'Hospitality') industryLabel = 'Hospitality & Trades';
        else if (job.industry === 'Construction') industryLabel = 'Services & Support';

        return `
        <div class="job-row-card" style="display: flex; flex-direction: column;">
            <div style="display: flex; gap: 1.2rem; align-items: flex-start;">
                <div class="job-row-logo">
                    <i class="fas ${industryIcon}"></i>
                </div>
                <div style="flex: 1; min-width: 0;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; flex-wrap: wrap; margin-bottom: 0.6rem;">
                        <h3 class="job-title" style="margin: 0; font-size: 1.25rem; font-weight: 700; color: var(--primary);">${job.title}</h3>
                    </div>
                    <div style="display: flex; flex-wrap: wrap; gap: 0.6rem 1.4rem; font-size: 0.875rem; color: #64748b; font-weight: 500; margin-bottom: 1rem;">
                        <span><i class="fas fa-map-marker-alt" style="color: var(--accent); margin-right: 4px;"></i>${job.location || 'Australia'}</span>
                        <span><i class="fas fa-briefcase" style="color: var(--accent); margin-right: 4px;"></i>${job.type || 'Full-time'}</span>
                        <span><i class="fas fa-layer-group" style="color: var(--accent); margin-right: 4px;"></i>${industryLabel}</span>
                        ${salaryHtml}
                    </div>
                    <p style="margin: 0 0 0.8rem 0; color: #475569; font-size: 0.95rem; line-height: 1.65; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${plainTextDesc}</p>
                    ${responsibilitiesPreview}
                </div>
            </div>
            <div style="display: flex; flex-direction: column; gap: 0.8rem; margin-top: auto; padding-top: 1.4rem; border-top: 1px solid #f1f5f9; margin-top: 1.4rem;">
                <span style="font-size: 0.82rem; color: #64748b; display: flex; align-items: center; gap: 6px; font-weight: 500; flex-wrap: wrap;">
                    <i class="fas fa-calendar-alt" style="color: var(--accent);"></i> Posted: ${postedDateStr}
                    &nbsp;&nbsp;&nbsp;|&nbsp;&nbsp;&nbsp;
                    <i class="fas fa-clock" style="color: var(--accent);"></i> Applications Close: ${closingDateStr}
                </span>
                <button onclick="openJobModal('${job.id}')" class="btn btn-primary" style="width: 100%; padding: 0.75rem 2rem; font-size: 0.9rem; font-weight: 600; border-radius: 6px; cursor: pointer; transition: all 0.2s; display: flex; justify-content: center; align-items: center; gap: 8px; border: none; box-shadow: 0 2px 4px rgba(201, 168, 76, 0.2);">
                    View Details &amp; Apply <i class="fas fa-arrow-right"></i>
                </button>
            </div>
        </div>
        `;
    }).join('');
}

// Inline 2-Column Details View State Logic
window.openJobModal = function(jobId) {
    try {
        const job = window.allJobs.find(j => String(j.id) === String(jobId));
        if (!job) {
            console.error("Job not found for ID: " + jobId);
            return;
        }
        
        // Helper to safely set text content if element exists
        const safeSetText = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        };

        const safeSetHtml = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = val;
        };
        
        safeSetText('jd-title', job.title);
        safeSetText('jd-location', job.location || 'Australia');
        safeSetText('jd-type', job.type || 'Full-time');
        safeSetText('jd-salary', job.salary || 'Competitive');
        
        // Set Industry Badge
        const badgeEl = document.getElementById('jd-industry-badge');
        if (badgeEl) {
            let label = job.industry || 'Opportunity';
            if (job.industry === 'Agriculture') label = 'Agriculture & Processing';
            if (job.industry === 'Healthcare') label = 'Healthcare & Care';
            if (job.industry === 'Hospitality') label = 'Hospitality & Trades';
            if (job.industry === 'Construction') label = 'Services & Support';
            badgeEl.textContent = label;
        }
        
        // Set image
        const imageContainer = document.getElementById('jd-image-container');
        const imageEl = document.getElementById('jd-image');
        if (imageContainer && imageEl) {
            if (job.image && job.image.trim() !== '') {
                imageEl.src = job.image;
                imageContainer.style.display = 'block';
            } else {
                imageContainer.style.display = 'none';
            }
        }
        
        // Build rich details inside jd-body
        const responsibilitiesHtml = (job.responsibilities && job.responsibilities.length > 0)
            ? `<h3><i class="fas fa-tasks"></i> Key Responsibilities</h3>
               <ul>${job.responsibilities.map(r => `<li>${r}</li>`).join('')}</ul>` 
            : '';
        
        const qualificationsHtml = (job.qualifications && job.qualifications.length > 0)
            ? `<h3><i class="fas fa-certificate"></i> Qualifications &amp; Requirements</h3>
               <ul>${job.qualifications.map(q => `<li>${q}</li>`).join('')}</ul>` 
            : '';
        
        const aboutEmployerHtml = job.aboutEmployer
            ? `<h3><i class="fas fa-building"></i> About the Employer</h3>
               <p>${job.aboutEmployer}</p>` 
            : '';

        // Strip HTML from description
        const tempDiv2 = document.createElement('div');
        tempDiv2.innerHTML = job.description || '';
        const descText = tempDiv2.textContent || tempDiv2.innerText || job.description || '';
        
        safeSetHtml('jd-body', `
            <h3><i class="fas fa-info-circle"></i> Role Overview</h3>
            <p>${descText}</p>
            ${aboutEmployerHtml}
            ${responsibilitiesHtml}
            ${qualificationsHtml}
        `);
        
        // Parse datePosted safely
        let postedDate = new Date();
        const dateVal = job.datePosted || job.posted;
        if (dateVal) {
            const parsed = new Date(dateVal);
            if (!isNaN(parsed.getTime())) {
                postedDate = parsed;
            }
        }
        
        // Parse closingDate safely, enforcing 30 days minimum
        let closingDate = new Date(postedDate.getTime() + 30 * 24 * 60 * 60 * 1000);
        if (job.dateClosing) {
            const parsedClosing = new Date(job.dateClosing);
            if (!isNaN(parsedClosing.getTime())) {
                closingDate = parsedClosing;
            }
        }
        
        const diffTime = closingDate.getTime() - postedDate.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (isNaN(diffDays) || diffDays < 30) {
            closingDate = new Date(postedDate.getTime() + 30 * 24 * 60 * 60 * 1000);
        }
        
        const postedStr = postedDate.toLocaleDateString('en-AU', {day:'numeric', month:'long', year:'numeric'});
        const closingStr = closingDate.toLocaleDateString('en-AU', {day:'numeric', month:'long', year:'numeric'});
        
        const datesEl = document.getElementById('jd-posted-date');
        if (datesEl) {
            datesEl.innerHTML = `<strong>DATE POSTED:</strong> ${postedStr} &nbsp;|&nbsp; <strong>APPLICATIONS CLOSE:</strong> ${closingStr}`;
        }
        safeSetText('jd-closing', closingStr);
        
        // Pre-fill hidden inputs on the inline application form
        const appliedJobEl = document.getElementById('inline_applied_job');
        if (appliedJobEl) appliedJobEl.value = job.title;
        
        const appliedIndEl = document.getElementById('inline_applied_industry');
        if (appliedIndEl) appliedIndEl.value = job.industry || '';
        
        // Reset Application Form state
        const inlineForm = document.getElementById('inlineApplicationForm');
        const successMsg = document.getElementById('inlineSuccessMessage');
        if (inlineForm && successMsg) {
            inlineForm.style.display = 'block';
            successMsg.style.display = 'none';
            inlineForm.reset();
        }
        
        // Transitions
        const catSelection = document.getElementById('category-selection');
        const jobDisplay = document.getElementById('job-display');
        const detailView = document.getElementById('job-detail-view');
        
        if (catSelection) catSelection.style.display = 'none';
        if (jobDisplay) jobDisplay.style.display = 'none';
        if (detailView) {
            detailView.style.display = 'block';
            detailView.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    } catch (e) {
        console.error("Error in openJobModal:", e);
    }
};

// Back from details navigation
document.addEventListener('DOMContentLoaded', () => {
    const backToJobsBtn = document.getElementById('back-to-jobs');
    if (backToJobsBtn) {
        backToJobsBtn.addEventListener('click', () => {
            const detailView = document.getElementById('job-detail-view');
            const jobDisplay = document.getElementById('job-display');
            
            if (detailView) detailView.style.display = 'none';
            if (jobDisplay) jobDisplay.style.display = 'block';
            
            // Scroll back smoothly to top of listing
            if (jobDisplay) jobDisplay.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    }
    
    // Handle inline application form submits
    const inlineForm = document.getElementById('inlineApplicationForm');
    if (inlineForm) {
        inlineForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const fullName = document.getElementById('inlineFullName').value.trim();
            const email = document.getElementById('inlineEmail').value.trim();
            const phone = document.getElementById('inlinePhone').value.trim();
            const comments = document.getElementById('inlineCoverNote').value.trim();
            const jobTitle = document.getElementById('inline_applied_job').value;
            const industry = document.getElementById('inline_applied_industry').value;
            
            // Find current job details to fill mock database items
            const job = window.allJobs.find(j => j.title === jobTitle);
            const employerCompany = job ? (job.employerCompany || 'TalentGate Client') : 'TalentGate Client';
            const location = job ? (job.location || 'Australia') : 'Australia';
            
            const resumeInput = document.getElementById('inlineResume');
            const resumeFile = resumeInput && resumeInput.files ? resumeInput.files[0] : null;
            
            // Standard candidate CRM mock base64 PDF
            const dummyPdf = 'data:application/pdf;base64,JVBERi0xLjAKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKPj4KZW5kb2JqCjIgMCBvYmoKPDwKL1R5cGUgL1BhZ2VzCi9LaWRzIFszIDAgUl0KL0NvdW50IDEKPj4KZW5kb2JqCjMgMCBvYmoKPDwKL1R5cGUgL1BhZ2UKL1BhcmVudCAyIDAgUgovTWVkaWFCb3ggWzAgMCA1OTUgODQyXQo+PgplbmRvYmoKeHJlZgowIDQKMDAwMDAwMDAwMCA2NTUzNSBmCjAwMDAwMDAwMTAgMDAwMDAgbgowMDAwMDAwMDYwIDAwMDAwIG4KMDAwMDAwMDExNyAwMDAwMCBuCnRyYWlsZXIKPDwKL1NpemUgNAovUm9vdCAxIDAgUgo+PgpzdGFydHhyZWYKMTczCiUlRU9GCg==';
            
            function saveApplicationToLocalStorage(resumeBase64Data) {
                // Construct applicant CRM object matching database schema
                const newApp = {
                    id: 'inline_app_' + Date.now(),
                    submittedAt: new Date().toLocaleString(),
                    fullName: fullName,
                    email: email,
                    phone: phone,
                    visaStatus: 'Citizen', // default for simplified form
                    jobTitle: jobTitle,
                    employerCompany: employerCompany,
                    location: location,
                    status: 'New',
                    rawForm: { comments: comments, englishLevel: "Fluent" },
                    resumeUrl: resumeBase64Data || dummyPdf,
                    passportUrl: dummyPdf
                };
                
                // Sync to LocalStorage (ensures full parity for offline & Electron desktop CRM stages!)
                let currentApps = [];
                try {
                    currentApps = JSON.parse(localStorage.getItem('tg_applications') || '[]');
                } catch (err) {
                    console.warn("Could not read tg_applications from localStorage", err);
                }
                
                currentApps.unshift(newApp);
                
                try {
                    localStorage.setItem('tg_applications', JSON.stringify(currentApps));
                } catch (err) {
                    console.warn("Could not write tg_applications to localStorage", err);
                }
            }
            
            async function postToNetlifyForms() {
                // Dynamic AJAX post submission to Netlify Forms (seamless backgrounds!)
                try {
                    const formData = new FormData(inlineForm);
                    await fetch('/', {
                        method: 'POST',
                        headers: { "Content-Type": "application/x-www-form-urlencoded" },
                        body: new URLSearchParams(formData).toString()
                    });
                } catch (err) {
                    console.warn("Netlify form submission failed, local storage sync fallback active.", err);
                }
            }
            
            // Read resume file as base64 data URL so it's fully viewable inside the staff CRM stages file explorer!
            if (resumeFile) {
                const reader = new FileReader();
                reader.onload = async function(event) {
                    saveApplicationToLocalStorage(event.target.result);
                    await postToNetlifyForms();
                    
                    // Show success alert state in sticky card
                    inlineForm.style.display = 'none';
                    const successMsg = document.getElementById('inlineSuccessMessage');
                    if (successMsg) successMsg.style.display = 'block';
                };
                reader.readAsDataURL(resumeFile);
            } else {
                saveApplicationToLocalStorage(null);
                postToNetlifyForms().then(() => {
                    // Show success alert state in sticky card
                    inlineForm.style.display = 'none';
                    const successMsg = document.getElementById('inlineSuccessMessage');
                    if (successMsg) successMsg.style.display = 'block';
                });
            }
        });
    }
});
