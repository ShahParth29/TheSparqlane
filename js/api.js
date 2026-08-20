/* ═══════════════════════════════════════════════════════════════════════════════
   API Helper — All fetch calls to FastAPI backend
   ═══════════════════════════════════════════════════════════════════════════════ */

// When running on Vercel (production), route JSON requests through Vercel's proxy
// to avoid CORS and adblocker issues. File uploads still bypass Vercel due to body limits.
const IS_LOCAL = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
const BASE_URL = window.location.origin;
const BACKEND_URL = BASE_URL; // Render is removed; everything is hosted on Vercel

/**
 * Resolve relative /uploads/ paths to the Render backend URL.
 * Cloudinary URLs (absolute https://) are returned as-is.
 * Fixes thumbnails and videos not loading on Vercel deployment.
 */
function resolveUploadUrl(url) {
    if (!url) return url;
    // Cloudinary or other absolute URLs — return as-is
    if (url.startsWith("https://") || url.startsWith("http://")) {
        return url;
    }
    // Relative /uploads/ paths — prefix with backend URL when on Vercel
    if (url.startsWith("/uploads/") && !IS_LOCAL) {
        return BACKEND_URL + url;
    }
    return url;
}

/**
 * Extract YouTube video ID from any common URL format.
 * Supports: youtube.com/watch?v=, youtu.be/, youtube.com/embed/, youtube.com/shorts/
 */
function extractYouTubeId(url) {
    if (!url) return "";
    const patterns = [
        /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
        /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
        /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
        /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    ];
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    return "";
}

/**
 * Generate YouTube thumbnail URL from a YouTube video URL.
 */
function getYouTubeThumbnail(url) {
    const id = extractYouTubeId(url);
    return id ? `https://img.youtube.com/vi/${id}/maxresdefault.jpg` : "";
}

/* ── In-memory + sessionStorage token store (persists across reloads) ────────── */
let _authToken = null;

function setAuthToken(token) {
    _authToken = token;
    if (token) {
        sessionStorage.setItem("authToken", token);
    } else {
        sessionStorage.removeItem("authToken");
    }
}

function getAuthToken() {
    if (!_authToken) {
        _authToken = sessionStorage.getItem("authToken");
    }
    return _authToken;
}

function clearAuthToken() {
    _authToken = null;
    sessionStorage.removeItem("authToken");
}

/**
 * Build headers for authenticated requests.
 */
function authHeaders() {
    const headers = { "Content-Type": "application/json" };
    if (_authToken) {
        headers["Authorization"] = `Bearer ${_authToken}`;
    }
    return headers;
}

/* ── Videos ─────────────────────────────────────────────────────────────────── */

async function fetchVideos(category = null) {
    let url = `${BASE_URL}/api/videos/`;
    if (category) url += `?category=${encodeURIComponent(category)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch videos");
    return res.json();
}

async function fetchFeaturedVideos() {
    const res = await fetch(`${BASE_URL}/api/videos/featured`);
    if (!res.ok) throw new Error("Failed to fetch featured videos");
    return res.json();
}

async function createVideo(data) {
    const res = await fetch(`${BASE_URL}/api/videos/`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(data),
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to create video");
    }
    return res.json();
}

async function updateVideo(id, data) {
    const res = await fetch(`${BASE_URL}/api/videos/${id}`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify(data),
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to update video");
    }
    return res.json();
}

async function deleteVideo(id) {
    const res = await fetch(`${BASE_URL}/api/videos/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to delete video");
    }
    return res.json();
}

/* ── Contact / Enquiries ───────────────────────────────────────────────────── */

async function submitEnquiry(data) {
    // 1. Submit to FastAPI / Supabase backend database
    let backendResult = null;
    try {
        const res = await fetch(`${BASE_URL}/api/contact/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });
        if (res.ok) {
            backendResult = await res.json();
        } else {
            const err = await res.json();
            throw new Error(err.detail || "Failed to submit enquiry");
        }
    } catch (backendErr) {
        console.warn("Backend submit notice:", backendErr.message);
    }

    // 2. Dispatch to Web3Forms API to send directly to thesparqlane@gmail.com
    try {
        const formData = new FormData();
        formData.append("access_key", "f4d7d2c8-96d7-483b-8f12-9949a4fee7cd");
        formData.append("subject", `✨ New Quote Request from ${data.name} — ${data.project_type || 'The Sparqlane'}`);
        formData.append("from_name", "The Sparqlane Website");
        formData.append("name", data.name);
        formData.append("email", data.email);
        formData.append("phone", data.phone);
        formData.append("service_and_niche", data.project_type || "Custom Proposal");
        formData.append("budget", data.budget_range || "Custom");
        formData.append("message", data.message);

        const w3Response = await fetch("https://api.web3forms.com/submit", {
            method: "POST",
            body: formData
        });
        const w3Data = await w3Response.json();
        console.log("Web3Forms Email Dispatch Status:", w3Data);
    } catch (w3err) {
        console.warn("Web3Forms dispatch warning:", w3err);
    }

    return backendResult || { message: "Your custom quote request has been received! Our team will get back to you within 24 hours." };
}

async function adminLogin(username, password) {
    const res = await fetch(`${BASE_URL}/api/contact/admin/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Login failed");
    }
    const data = await res.json();
    setAuthToken(data.access_token);
    return data;
}

async function fetchEnquiries() {
    const res = await fetch(`${BASE_URL}/api/contact/admin/enquiries`, {
        headers: authHeaders(),
    });
    if (!res.ok) throw new Error("Failed to fetch enquiries");
    return res.json();
}

async function markEnquiryRead(id) {
    const res = await fetch(`${BASE_URL}/api/contact/admin/enquiries/${id}/read`, {
        method: "PATCH",
        headers: authHeaders(),
    });
    if (!res.ok) throw new Error("Failed to toggle read status");
    return res.json();
}

/* ── Blog ──────────────────────────────────────────────────────────────────── */

async function fetchBlogPosts() {
    const res = await fetch(`${BASE_URL}/api/blog/`);
    if (!res.ok) throw new Error("Failed to fetch blog posts");
    return res.json();
}

async function fetchBlogPost(slug) {
    const res = await fetch(`${BASE_URL}/api/blog/${slug}`);
    if (!res.ok) throw new Error("Post not found");
    return res.json();
}

async function createBlogPost(data) {
    const res = await fetch(`${BASE_URL}/api/blog/`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(data),
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to create post");
    }
    return res.json();
}

async function updateBlogPost(id, data) {
    const res = await fetch(`${BASE_URL}/api/blog/${id}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify(data),
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to update post");
    }
    return res.json();
}

async function deleteBlogPost(id) {
    const res = await fetch(`${BASE_URL}/api/blog/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to delete post");
    }
    return res.json();
}

/* ── Pricing ───────────────────────────────────────────────────────────────── */

async function fetchPricingPlans() {
    const res = await fetch(`${BASE_URL}/api/pricing/`);
    if (!res.ok) throw new Error("Failed to fetch pricing plans");
    return res.json();
}

async function createPricingPlan(data) {
    const res = await fetch(`${BASE_URL}/api/pricing/`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(data),
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to create plan");
    }
    return res.json();
}

async function updatePricingPlan(id, data) {
    const res = await fetch(`${BASE_URL}/api/pricing/${id}`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify(data),
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to update plan");
    }
    return res.json();
}

async function deletePricingPlan(id) {
    const res = await fetch(`${BASE_URL}/api/pricing/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to delete plan");
    }
    return res.json();
}

async function fetchSiteSettings() {
    const res = await fetch(`${BASE_URL}/api/settings/`);
    if (!res.ok) throw new Error("Failed to fetch site settings");
    return res.json();
}

async function updateSiteSettings(data) {
    const res = await fetch(`${BASE_URL}/api/settings/`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify(data),
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to update settings");
    }
    return res.json();
}

async function fetchAllBlogPosts() {
    const res = await fetch(`${BASE_URL}/api/blog/admin/all`, {
        headers: authHeaders(),
    });
    if (!res.ok) throw new Error("Failed to fetch all blog posts");
    return res.json();
}

async function applySiteSettings() {
    try {
        const res = await fetchSiteSettings();
        const settings = res.settings;

        window.siteSettings = settings; // Cache settings globally

        if (settings.site_name) {
            // Dynamically update document title if it contains old names
            for (const oldName of ["NPJ Productions", "Dhruvam Productions", "NextFrame Studios"]) {
                if (document.title.includes(oldName)) {
                    document.title = document.title.replace(new RegExp(oldName, "g"), settings.site_name);
                }
            }
            
            // Dynamically update description meta tag
            const descriptionMeta = document.querySelector('meta[name="description"]');
            if (descriptionMeta && descriptionMeta.content) {
                for (const oldName of ["NPJ Productions", "Dhruvam Productions", "NextFrame Studios"]) {
                    if (descriptionMeta.content.includes(oldName)) {
                        descriptionMeta.content = descriptionMeta.content.replace(new RegExp(oldName, "g"), settings.site_name);
                    }
                }
            }

            document.querySelectorAll(".setting-site_name").forEach(el => {
                if (el.classList.contains("logo-accent")) return;
                el.textContent = settings.site_name;
            });
        }
        if (settings.tagline) {
            document.querySelectorAll(".setting-tagline").forEach(el => {
                el.textContent = settings.tagline;
            });
        }
        if (settings.email) {
            document.querySelectorAll(".setting-email").forEach(el => {
                if (el.tagName === "A") {
                    el.href = `mailto:${settings.email}`;
                }
                el.textContent = settings.email;
            });
        }
        if (settings.phone) {
            document.querySelectorAll(".setting-phone").forEach(el => {
                if (el.tagName === "A") {
                    el.href = `tel:${settings.phone.replace(/\s+/g, "")}`;
                }
                el.textContent = settings.phone;
            });
        }
        if (settings.location) {
            document.querySelectorAll(".setting-location").forEach(el => {
                el.textContent = settings.location;
            });
        }
        if (settings.about_text) {
            document.querySelectorAll(".setting-about_text").forEach(el => {
                el.textContent = settings.about_text;
            });
        }
        if (settings.about_bio) {
            document.querySelectorAll(".setting-about_bio").forEach(el => {
                el.innerHTML = settings.about_bio.replace(/\n/g, "<br>");
            });
        }

        // Social Links
        if (settings.youtube) {
            document.querySelectorAll(".setting-youtube").forEach(el => {
                el.href = settings.youtube;
                if (settings.youtube === "#" || settings.youtube === "") {
                    el.style.display = "none";
                } else {
                    el.style.display = "";
                }
            });
        }
        if (settings.instagram) {
            document.querySelectorAll(".setting-instagram").forEach(el => {
                el.href = settings.instagram;
                if (settings.instagram === "#" || settings.instagram === "") {
                    el.style.display = "none";
                } else {
                    el.style.display = "";
                }
            });
        }
        if (settings.twitter) {
            document.querySelectorAll(".setting-twitter").forEach(el => {
                el.href = settings.twitter;
                if (settings.twitter === "#" || settings.twitter === "") {
                    el.style.display = "none";
                } else {
                    el.style.display = "";
                }
            });
        }
    } catch (err) {
        console.error("Error applying site settings:", err);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    if (!window.location.pathname.includes("admin.html")) {
        applySiteSettings();
    }
});

async function uploadFile(file) {
    let activeBackend = "local";
    try {
        const paramsRes = await fetch(`${BASE_URL}/api/videos/upload-params?filename=${encodeURIComponent(file.name)}&filetype=${encodeURIComponent(file.type)}`, {
            headers: authHeaders()
        });
        if (paramsRes.ok) {
            const uploadData = await paramsRes.json();
            activeBackend = uploadData.backend || "local";
            
            if (activeBackend === "s3") {
                const putRes = await fetch(uploadData.presigned_url, {
                    method: "PUT",
                    body: file,
                    headers: {
                        "Content-Type": file.type
                    }
                });
                if (putRes.ok) {
                    return { url: uploadData.public_url };
                } else {
                    let errMsg = `S3 direct upload failed with status ${putRes.status}`;
                    try {
                        const text = await putRes.text();
                        if (text && text.includes("<Message>")) {
                            const match = text.match(/<Message>([^<]+)<\/Message>/);
                            if (match) errMsg += `: ${match[1]}`;
                        }
                    } catch (_) {}
                    throw new Error(errMsg);
                }
            } else if (activeBackend === "cloudinary") {
                const isVideo = file.type.startsWith("video/") || 
                                file.name.toLowerCase().endsWith(".mp4") || 
                                file.name.toLowerCase().endsWith(".mov") || 
                                file.name.toLowerCase().endsWith(".avi") || 
                                file.name.toLowerCase().endsWith(".mkv") || 
                                file.name.toLowerCase().endsWith(".webm");
                const resourceType = isVideo ? "video" : "image";
                const url = `https://api.cloudinary.com/v1_1/${uploadData.cloud_name}/${resourceType}/upload`;
                
                const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
                if (file.size <= CHUNK_SIZE) {
                    // Standard direct upload for small files
                    const formData = new FormData();
                    formData.append("file", file);
                    formData.append("api_key", uploadData.api_key);
                    formData.append("timestamp", uploadData.timestamp);
                    formData.append("signature", uploadData.signature);
                    formData.append("folder", uploadData.folder);
                    
                    const res = await fetch(url, {
                        method: "POST",
                        body: formData
                    });
                    if (res.ok) {
                        const data = await res.json();
                        return { url: data.secure_url };
                    } else {
                        let errMsg = "Cloudinary upload failed";
                        try {
                            const err = await res.json();
                            errMsg = err.error?.message || errMsg;
                        } catch (_) {}
                        throw new Error(errMsg);
                    }
                } else {
                    // Signed chunked upload for large files (like videos)
                    const uploadId = "upload_" + Math.random().toString(36).substring(2, 15) + "_" + Date.now();
                    let start = 0;
                    let lastResponseData = null;
                    
                    while (start < file.size) {
                        const end = Math.min(start + CHUNK_SIZE, file.size);
                        const chunk = file.slice(start, end);
                        
                        const formData = new FormData();
                        formData.append("file", chunk);
                        formData.append("api_key", uploadData.api_key);
                        formData.append("timestamp", uploadData.timestamp);
                        formData.append("signature", uploadData.signature);
                        formData.append("folder", uploadData.folder);
                        
                        const res = await fetch(url, {
                            method: "POST",
                            headers: {
                                "X-Unique-Upload-Id": uploadId,
                                "Content-Range": `bytes ${start}-${end - 1}/${file.size}`
                            },
                            body: formData
                        });
                        
                        if (!res.ok) {
                            let errMsg = "Cloudinary chunked upload failed";
                            try {
                                const err = await res.json();
                                errMsg = err.error?.message || errMsg;
                            } catch (_) {}
                            throw new Error(errMsg);
                        }
                        
                        lastResponseData = await res.json();
                        start = end;
                    }
                    
                    if (lastResponseData && lastResponseData.secure_url) {
                        return { url: lastResponseData.secure_url };
                    } else {
                        throw new Error("Failed to retrieve uploaded file URL from Cloudinary");
                    }
                }
            }
        }
    } catch (e) {
        if (activeBackend === "cloudinary" || activeBackend === "s3") {
            console.error(`${activeBackend} upload failed:`, e);
            throw e;
        }
        console.warn("Direct upload params fetch or upload failed, falling back to local backend upload:", e.message);
    }

    // Fallback: upload directly to local/Render backend
    const formData = new FormData();
    formData.append("file", file);

    const uploadBaseUrl = IS_LOCAL ? BASE_URL : BACKEND_URL;
    const res = await fetch(`${uploadBaseUrl}/api/videos/upload`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${getAuthToken()}`
        },
        body: formData
    });
    if (!res.ok) {
        let errMsg = "Failed to upload file";
        try {
            const err = await res.json();
            errMsg = err.detail || errMsg;
        } catch (_) {
            errMsg = `Upload failed: Status ${res.status} (${res.statusText || "Payload Too Large"})`;
        }
        throw new Error(errMsg);
    }
    return res.json();
}

/* ── F12 / Right-Click Inspect Blocker ─────────────────────────────────── */
document.addEventListener("contextmenu", (e) => e.preventDefault());

document.addEventListener("keydown", (e) => {
    // Disable F12
    if (e.key === "F12") {
        e.preventDefault();
    }
    // Disable Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C
    if (e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "J" || e.key === "C" || e.key === "i" || e.key === "j" || e.key === "c")) {
        e.preventDefault();
    }
    // Disable Ctrl+U (View Source)
    if (e.ctrlKey && (e.key === "U" || e.key === "u")) {
        e.preventDefault();
    }
});



/* ── Global Fetch Interceptor to catch 401 Unauthorized errors ─────────────── */
const originalFetch = window.fetch;
window.fetch = async function(...args) {
    const res = await originalFetch(...args);
    if (res.status === 401) {
        clearAuthToken();
        if (typeof handleLogout === "function") {
            handleLogout();
        }
    }
    return res;
};

/* ── HTML Entity Escaper for XSS Security ──────────────────────────────────── */
function escapeHTML(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/* ── Interactive Custom Quote Modal System ─────────────────────────────────── */
document.addEventListener("DOMContentLoaded", () => {
    // Skip entirely on the admin portal
    if (document.getElementById("admin-login-screen") || document.getElementById("admin-dashboard")) return;

    // 1. Inject Floating CTA if not present
    if (!document.getElementById("floating-quote-btn")) {
        const floatBtn = document.createElement("button");
        floatBtn.id = "floating-quote-btn";
        floatBtn.className = "floating-quote-btn";
        floatBtn.innerHTML = `✨ <span>Get Custom Quote</span>`;
        floatBtn.onclick = () => openQuoteModal();
        document.body.appendChild(floatBtn);
    }

    // 2. Inject Modal Overlay HTML if not present
    if (!document.getElementById("quote-modal-overlay")) {
        const modalDiv = document.createElement("div");
        modalDiv.id = "quote-modal-overlay";
        modalDiv.className = "quote-modal-overlay";
        modalDiv.innerHTML = `
            <div class="quote-modal-content">
                <button class="quote-modal-close" onclick="closeQuoteModal()" aria-label="Close modal">&times;</button>
                <div class="quote-modal-header">
                    <span class="tagline-sub">The Sparqlane • Custom Proposal</span>
                    <h2>Get Your Custom Quote</h2>
                    <p>Select your required services and niches for a tailored strategic estimate.</p>
                </div>
                <form id="quote-modal-form" action="https://api.web3forms.com/submit" method="POST" onsubmit="handleQuoteSubmit(event)">
                    <!-- Web3Forms Integration -->
                    <input type="hidden" name="access_key" value="f4d7d2c8-96d7-483b-8f12-9949a4fee7cd">
                    <input type="hidden" name="subject" value="✨ New Custom Quote Request — The Sparqlane">
                    <input type="hidden" name="from_name" value="The Sparqlane Web Portal">
                    <input type="hidden" name="to_email" value="thesparqlane@gmail.com">

                    <!-- Honeypot anti-spam field -->
                    <input type="text" name="website" style="display:none;" tabindex="-1" autocomplete="off">
                    
                    <div class="form-group" style="margin-bottom: 20px;">
                        <label class="form-label" style="font-size:0.9rem; color:var(--gold); font-weight:600; display:block; margin-bottom:8px;">1. Select Required Services (Multi-select)</label>
                        <div class="quote-chip-group">
                            <label class="quote-chip-item"><input type="checkbox" name="services" value="Influencer Marketing" checked><span class="quote-chip-label">📢 Influencer Marketing</span></label>
                            <label class="quote-chip-item"><input type="checkbox" name="services" value="Influencer Handling"><span class="quote-chip-label">📱 Influencer Social Media Handling</span></label>
                            <label class="quote-chip-item"><input type="checkbox" name="services" value="PR & Media House"><span class="quote-chip-label">📰 PR & Media House Coverage</span></label>
                            <label class="quote-chip-item"><input type="checkbox" name="services" value="Local Media & Updates"><span class="quote-chip-label">🏙️ Local Media & Local Updates</span></label>
                            <label class="quote-chip-item"><input type="checkbox" name="services" value="Social Media Management"><span class="quote-chip-label">🔥 Social Media Management</span></label>
                            <label class="quote-chip-item"><input type="checkbox" name="services" value="Cinematography Shoot"><span class="quote-chip-label">🎬 Cinematic Shoots</span></label>
                            <label class="quote-chip-item"><input type="checkbox" name="services" value="Car Delivery Shoot"><span class="quote-chip-label">🏎️ Car Delivery Shoots</span></label>
                            <label class="quote-chip-item"><input type="checkbox" name="services" value="Short Films & Commercials"><span class="quote-chip-label">🍿 Short Films & Ad Films</span></label>
                        </div>
                    </div>

                    <div class="form-group" style="margin-bottom: 20px;">
                        <label class="form-label" style="font-size:0.9rem; color:var(--gold); font-weight:600; display:block; margin-bottom:8px;">2. Select Category / Niche (Choose 1 Category Only) *</label>
                        <div class="quote-chip-group">
                            <label class="quote-chip-item"><input type="radio" name="niche" value="Travel" required checked><span class="quote-chip-label">✈️ Travel</span></label>
                            <label class="quote-chip-item"><input type="radio" name="niche" value="Food"><span class="quote-chip-label">🍕 Food</span></label>
                            <label class="quote-chip-item"><input type="radio" name="niche" value="Fashion"><span class="quote-chip-label">👗 Fashion</span></label>
                            <label class="quote-chip-item"><input type="radio" name="niche" value="Beauty"><span class="quote-chip-label">💄 Beauty</span></label>
                            <label class="quote-chip-item"><input type="radio" name="niche" value="Lifestyle"><span class="quote-chip-label">✨ Lifestyle</span></label>
                            <label class="quote-chip-item"><input type="radio" name="niche" value="Fitness"><span class="quote-chip-label">💪 Fitness</span></label>
                            <label class="quote-chip-item"><input type="radio" name="niche" value="Business"><span class="quote-chip-label">💼 Business</span></label>
                            <label class="quote-chip-item"><input type="radio" name="niche" value="History"><span class="quote-chip-label">🏛️ History</span></label>
                            <label class="quote-chip-item"><input type="radio" name="niche" value="Explore"><span class="quote-chip-label">🔍 Explore</span></label>
                        </div>
                    </div>

                    <div class="form-grid" style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px;">
                        <div class="form-group">
                            <label for="q-name" class="form-label" style="font-size:0.85rem; color:var(--text-secondary);">Your Full Name *</label>
                            <input type="text" id="q-name" name="name" required class="form-input" placeholder="e.g. Alexander Vance" style="width:100%; padding:10px 14px; background:rgba(255,255,255,0.05); border:1px solid var(--border); border-radius:8px; color:#fff;">
                        </div>
                        <div class="form-group">
                            <label for="q-email" class="form-label" style="font-size:0.85rem; color:var(--text-secondary);">Email Address *</label>
                            <input type="email" id="q-email" name="email" required class="form-input" placeholder="name@company.com" style="width:100%; padding:10px 14px; background:rgba(255,255,255,0.05); border:1px solid var(--border); border-radius:8px; color:#fff;">
                        </div>
                    </div>

                    <div class="form-grid" style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px;">
                        <div class="form-group">
                            <label for="q-phone" class="form-label" style="font-size:0.85rem; color:var(--text-secondary);">Phone / WhatsApp *</label>
                            <input type="tel" id="q-phone" name="phone" required class="form-input" placeholder="+91 98765 43210" style="width:100%; padding:10px 14px; background:rgba(255,255,255,0.05); border:1px solid var(--border); border-radius:8px; color:#fff;">
                        </div>
                        <div class="form-group">
                            <label for="q-budget" class="form-label" style="font-size:0.85rem; color:var(--text-secondary);">Estimated Budget Range *</label>
                            <select id="q-budget" name="budget_range" class="form-input" style="width:100%; padding:10px 14px; background:#4D0717; border:1px solid var(--border); border-radius:8px; color:#fff;">
                                <option value="₹5,000 - ₹15,000">₹5,000 - ₹15,000</option>
                                <option value="₹15,000 - ₹35,000" selected>₹15,000 - ₹35,000</option>
                                <option value="₹35,000 - ₹60,000">₹35,000 - ₹60,000</option>
                                <option value="₹60,000 - ₹1,00,000">₹60,000 - ₹1,00,000</option>
                                <option value="₹1,00,000+ Custom Campaign">₹1,00,000+ Custom Campaign</option>
                            </select>
                        </div>
                    </div>

                    <div class="form-group" style="margin-bottom: 24px;">
                        <label for="q-message" class="form-label" style="font-size:0.85rem; color:var(--text-secondary);">Project Brief & Requirements *</label>
                        <textarea id="q-message" name="message" rows="3" required class="form-input" placeholder="Describe your brand goals, target audience, preferred launch date..." style="width:100%; padding:10px 14px; background:rgba(255,255,255,0.05); border:1px solid var(--border); border-radius:8px; color:#fff; resize:vertical;"></textarea>
                    </div>

                    <div id="quote-form-status" style="margin-bottom:16px; font-weight:600; font-size:0.9rem;"></div>

                    <button type="submit" class="btn btn-primary" id="quote-submit-btn" style="width:100%; padding:14px; background:linear-gradient(135deg, var(--gold), #b89228); color:#120308; font-weight:700; border-radius:10px; border:none; cursor:pointer;">
                        Submit Custom Quote Request →
                    </button>
                </form>
            </div>
        `;
        document.body.appendChild(modalDiv);
    }

    // Attach trigger event listeners to all links/buttons with class 'nav-cta', 'open-quote-modal', or href='contact.html' / 'pricing.html'
    document.querySelectorAll(".open-quote-modal, a[href='pricing.html'], a[href='contact.html']").forEach(elem => {
        if (!elem.classList.contains("no-modal-redirect")) {
            elem.addEventListener("click", (e) => {
                if (elem.classList.contains("open-quote-modal") || elem.classList.contains("nav-cta") || elem.classList.contains("btn-quote")) {
                    e.preventDefault();
                    openQuoteModal();
                }
            });
        }
    });
});

function openQuoteModal(preselectedService = "") {
    const modal = document.getElementById("quote-modal-overlay");
    if (modal) {
        modal.classList.add("active");
        document.body.style.overflow = "hidden";
        if (preselectedService) {
            const checkbox = modal.querySelector(`input[value="${preselectedService}"]`);
            if (checkbox) checkbox.checked = true;
        }
    }
}

function closeQuoteModal() {
    const modal = document.getElementById("quote-modal-overlay");
    if (modal) {
        modal.classList.remove("active");
        document.body.style.overflow = "";
    }
}

async function handleQuoteSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const submitBtn = document.getElementById("quote-submit-btn");
    const statusDiv = document.getElementById("quote-form-status");

    const selectedServices = Array.from(form.querySelectorAll('input[name="services"]:checked')).map(cb => cb.value);
    const selectedNicheRadio = form.querySelector('input[name="niche"]:checked');
    const selectedNiche = selectedNicheRadio ? selectedNicheRadio.value : "General";

    const name = form.name.value.trim();
    const email = form.email.value.trim();
    const phone = form.phone.value.trim();
    const budget_range = form.budget_range.value;
    const message = form.message.value.trim();
    const website = form.website ? form.website.value : "";

    const project_type = selectedServices.length > 0 
        ? `Quote: ${selectedServices.join(", ")} (${selectedNiche})`
        : `Custom Agency Quote (${selectedNiche})`;

    submitBtn.disabled = true;
    submitBtn.innerHTML = "Processing Request...";
    statusDiv.style.color = "var(--gold-bright)";
    statusDiv.textContent = "Encrypting & Submitting Quote Request...";

    try {
        const result = await submitEnquiry({
            name,
            email,
            phone,
            project_type,
            budget_range,
            event_date: selectedNiche,
            message: `Selected Category: ${selectedNiche}\nBudget Range: ${budget_range}\n\nClient Brief:\n${message}`,
            website,
        });

        statusDiv.style.color = "var(--success)";
        statusDiv.textContent = "✓ Quote request submitted! Our team will contact you within 24 hours.";
        form.reset();
        setTimeout(() => {
            closeQuoteModal();
            statusDiv.textContent = "";
            submitBtn.disabled = false;
            submitBtn.innerHTML = "Submit Custom Quote Request →";
        }, 2500);
    } catch (err) {
        statusDiv.style.color = "var(--error)";
        statusDiv.textContent = `❌ Submission failed: ${err.message}`;
        submitBtn.disabled = false;
        submitBtn.innerHTML = "Submit Custom Quote Request →";
    }
}


