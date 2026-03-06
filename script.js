// Mobile Menu Toggle
document.addEventListener('DOMContentLoaded', () => {
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
    let allJobs = [];
    window.currentCategory = '';

    const jobList = document.getElementById('job-list');
    const categorySelection = document.getElementById('category-selection');
    const jobDisplay = document.getElementById('job-display');
    const backBtn = document.getElementById('back-to-categories');
    const categoryTitle = document.getElementById('category-title');

    if (jobList) {
        fetchJobs();

        // Check for Back Button
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                // Show Categories, Hide Jobs
                if (categorySelection) categorySelection.style.display = 'block';
                if (jobDisplay) jobDisplay.style.display = 'none';
                window.currentCategory = '';
                // Clear search
                const searchInput = document.getElementById('job-search');
                if (searchInput) searchInput.value = '';
            });
        }
    }

    // Exported function for onclick in HTML
    window.filterJobsCallback = function () {
        if (!allJobs.length) {
            console.log("Jobs not loaded yet");
            return;
        }

        // Hide Categories, Show Jobs
        if (categorySelection) categorySelection.style.display = 'none';
        if (jobDisplay) jobDisplay.style.display = 'block';

        // Update Title
        let displayTitle = window.currentCategory;
        if (window.currentCategory === 'Construction') displayTitle = 'Services & Support'; // Map
        if (categoryTitle) categoryTitle.textContent = `${displayTitle} Jobs`;


        // Filter
        const filtered = allJobs.filter(job => job.industry === window.currentCategory);
        renderJobs(filtered);
    }

    async function fetchJobs() {
        try {
            const response = await fetch('data/jobs.json');
            const jsonJobs = await response.json();

            // Merge with Custom Jobs from Local Storage
            const customJobs = JSON.parse(localStorage.getItem('tg_custom_jobs') || '[]');
            allJobs = [...customJobs, ...jsonJobs]; // Store Globally
            const urlParams = new URLSearchParams(window.location.search);
            const categoryParam = urlParams.get('category');

            if (categoryParam) {
                // Map param to internal category name if needed, or use directly
                // Simple validation to ensure it matches one of our known categories
                const validCategories = ['Agriculture', 'Healthcare', 'Hospitality', 'Construction'];
                if (validCategories.includes(categoryParam)) {
                    window.currentCategory = categoryParam;
                    // Trigger filter after a brief delay to ensure DOM is ready? 
                    // No, we can just call it. But renderJobs needs elements.
                    // Elements are already selected at top of scope.
                    window.filterJobsCallback();
                }
            }

            // Setup Search Input for the Job List View
            const searchInput = document.getElementById('job-search');

            const filterJobs = () => {
                const searchTerm = searchInput.value.toLowerCase();

                const filtered = allJobs.filter(job => {
                    const matchesSearch = job.title.toLowerCase().includes(searchTerm) ||
                        job.description.toLowerCase().includes(searchTerm) ||
                        job.location.toLowerCase().includes(searchTerm);
                    const matchesIndustry = job.industry === window.currentCategory; // Only current category
                    return matchesSearch && matchesIndustry;
                });
                renderJobs(filtered);
            };

            if (searchInput) searchInput.addEventListener('input', filterJobs);

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
            if (occupationInput) {
                occupationInput.value = jobTitle;
                occupationInput.readOnly = true; // Lock it so they don't change it by accident
                occupationInput.style.backgroundColor = "#e9ecef";
            }

            // Fetch Job Details to Populate UI
            fetch('data/jobs.json')
                .then(response => response.json())
                .then(jobs => {
                    const job = jobs.find(j => j.title === jobTitle);
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
                })
                .catch(err => console.error("Error fetching job details for application:", err));
        }

        // Form submission is now handled natively by Netlify Forms via the HTML <form data-netlify="true"> tag.
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
    if (!jobs.length) {
        jobList.innerHTML = '<p>No matching jobs found.</p>';
        return;
    }

    jobList.innerHTML = jobs.map(job => {
        const imageHtml = job.image && job.image.trim() !== '' ?
            `<div style="margin-bottom: 1rem;"><img src="${job.image}" alt="${job.title}" style="width: 100%; height: 200px; object-fit: cover; border-radius: 6px;"></div>` : '';

        const datesHtml = job.datePosted ?
            `<div style="margin-top: 1rem; font-size: 0.85rem; color: #666; display: flex; justify-content: space-between;">
                <span><strong>Posted:</strong> ${new Date(job.datePosted).toLocaleDateString()}</span>
                ${job.dateClosing ? `<span><strong>Closes:</strong> ${new Date(job.dateClosing).toLocaleDateString()}</span>` : ''}
            </div>` : '';

        return `
        <div class="job-card" style="display: flex; flex-direction: column;">
            ${imageHtml}
            <div class="job-header">
                <h3 class="job-title">${job.title}</h3>
                <div class="job-meta">
                    <span><i class="fas fa-map-marker-alt"></i> ${job.location}</span>
                    <span><i class="fas fa-briefcase"></i> ${job.type}</span>
                    <span><i class="fas fa-industry"></i> ${job.industry}</span>
                </div>
            </div>
            <p class="job-desc" style="flex-grow: 1;">${job.description}</p>
            ${datesHtml}
            <div style="margin-top: 1.5rem; text-align: center;">
                <a href="application.html?job=${encodeURIComponent(job.title)}" class="btn btn-outline-primary" style="width: 100%; display: inline-block;">Apply Now</a>
            </div>
        </div>
    `}).join('');
}
