/* ═══════════════════════════════════════════════════════════════════════════════
   Admin Dashboard — JWT-protected panel logic
   ═══════════════════════════════════════════════════════════════════════════════ */

let currentAdminTab = "videos";
let sessionTimer = null;

/* ── Login & Session ───────────────────────────────────────────────────────── */

function initAdminLogin() {
    const loginForm = document.getElementById("admin-login-form");
    const loginAlert = document.getElementById("login-alert");

    if (!loginForm) return;

    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        loginAlert.className = "login-alert"; // reset
        loginAlert.style.display = "";

        const userField = document.getElementById("login-username");
        const passField = document.getElementById("login-password");
        const username = userField.value.trim();
        const password = passField.value;

        const loginBtn = document.getElementById("login-btn");
        if (loginBtn) { loginBtn.disabled = true; loginBtn.textContent = "Signing in…"; }

        try {
            await adminLogin(username, password);
            document.getElementById("admin-login-screen").style.display = "none";
            document.getElementById("admin-dashboard").classList.add("active");
            startSessionCountdown();
            loadAdminTab("enquiries");
        } catch (err) {
            loginAlert.textContent = err.message || "Login failed";
            loginAlert.classList.add("error");
        } finally {
            if (loginBtn) { loginBtn.disabled = false; loginBtn.textContent = "Sign In →"; }
        }
    });
}

function startSessionCountdown() {
    if (sessionTimer) clearInterval(sessionTimer);
    const warningEl = document.getElementById("session-warning");
    const loginTime = Date.now();
    const duration = 60 * 60 * 1000; // 60 minutes

    sessionTimer = setInterval(() => {
        const elapsed = Date.now() - loginTime;
        const remaining = duration - elapsed;

        if (remaining <= 0) {
            clearInterval(sessionTimer);
            handleLogout();
            alert("Your admin session has expired. Please log in again.");
        } else if (remaining <= 5 * 60 * 1000) { // 5 minutes remaining
            warningEl.style.display = "inline";
            const mins = Math.ceil(remaining / 60000);
            warningEl.textContent = `Session expiring in ${mins}m`;
        } else {
            warningEl.style.display = "none";
        }
    }, 10000);
}

function handleLogout() {
    clearAuthToken();
    if (sessionTimer) {
        clearInterval(sessionTimer);
        sessionTimer = null;
    }
    const warningEl = document.getElementById("session-warning");
    if (warningEl) warningEl.style.display = "none";

    const dashboard = document.getElementById("admin-dashboard");
    const loginScreen = document.getElementById("admin-login-screen");
    if (dashboard) dashboard.classList.remove("active");
    if (loginScreen) loginScreen.style.display = "";

    const loginForm = document.getElementById("admin-login-form");
    if (loginForm) loginForm.reset();

    const loginAlert = document.getElementById("login-alert");
    if (loginAlert) {
        loginAlert.textContent = "";
        loginAlert.className = "login-alert";
        loginAlert.style.display = "";
    }
}

/* ── Tab Switching ─────────────────────────────────────────────────────────── */

function switchAdminTab(tab) {
    currentAdminTab = tab;

    document.querySelectorAll(".sidebar-btn").forEach((t) => t.classList.remove("active"));
    document.querySelectorAll(".admin-panel").forEach((p) => p.classList.remove("active"));

    document.querySelector(`.sidebar-btn[data-tab="${tab}"]`).classList.add("active");
    document.getElementById(`panel-${tab}`).classList.add("active");

    loadAdminTab(tab);
}

async function loadAdminTab(tab) {
    try {
        if (tab === "videos") await loadAdminVideos();
        else if (tab === "enquiries") await loadAdminEnquiries();
        else if (tab === "blog") await loadAdminBlog();
        else if (tab === "pricing") await loadAdminPricing();
        else if (tab === "settings") await loadAdminSettings();
    } catch (err) {
        console.error(`Failed to load ${tab}:`, err);
    }
}

/* ── Videos Panel ──────────────────────────────────────────────────────────── */

async function loadAdminVideos() {
    const tbody = document.getElementById("admin-videos-tbody");
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:32px;"><div class="spinner" style="margin:auto;"></div></td></tr>';

    try {
        const videos = await fetchVideos();
        if (videos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text-muted);">No videos yet</td></tr>';
            return;
        }

        tbody.innerHTML = videos
            .map(
                (v) => `
            <tr>
                <td><strong>${v.title}</strong></td>
                <td><span class="category-badge">${v.category}</span></td>
                <td>${v.is_featured ? "⭐" : "—"}</td>
                <td>${v.sort_order}</td>
                <td>${new Date(v.created_at).toLocaleDateString()}</td>
                <td>
                    <button class="btn btn-sm btn-secondary" onclick='editVideoAdmin(${JSON.stringify(v).replace(/'/g, "&#39;")})'>Edit</button>
                    <button class="btn btn-sm btn-secondary" onclick="deleteVideoAdmin(${v.id})">Delete</button>
                </td>
            </tr>`
            )
            .join("");
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--error);">Failed to load videos</td></tr>`;
    }
}

async function handleAddVideo(e) {
    e.preventDefault();
    const alert = document.getElementById("video-alert");
    alert.textContent = "Processing... Please wait.";
    alert.className = "alert alert-info show";

    const videoId = document.getElementById("v-id").value;
    const sourceType = document.getElementById("v-source-type").value;
    const title = document.getElementById("v-title").value.trim();
    const category = document.getElementById("v-category").value;
    const description = document.getElementById("v-description").value.trim();
    const is_featured = document.getElementById("v-featured").checked;

    let youtube_url = null;
    let video_file_url = null;
    let thumbnail_url = null;

    // If editing, retrieve existing paths
    let existingVideo = null;
    if (videoId) {
        try {
            const videos = await fetchVideos();
            existingVideo = videos.find(v => v.id === parseInt(videoId));
            if (existingVideo) {
                youtube_url = existingVideo.youtube_url;
                video_file_url = existingVideo.video_file_url;
                thumbnail_url = existingVideo.thumbnail_url;
            }
        } catch (err) {
            console.error("Failed to load existing video for edit:", err);
        }
    }

    try {
        if (sourceType === "upload") {
            const videoFile = document.getElementById("v-file").files[0];
            if (videoFile) {
                const videoRes = await uploadFile(videoFile);
                video_file_url = videoRes.url;
            } else if (!videoId) {
                throw new Error("Please select a video file to upload");
            }

            const thumbFile = document.getElementById("v-thumb-file").files[0];
            if (thumbFile) {
                const thumbRes = await uploadFile(thumbFile);
                thumbnail_url = thumbRes.url;
            }
            youtube_url = null;
        } else {
            youtube_url = document.getElementById("v-url").value.trim();
            if (!youtube_url) throw new Error("Please enter a YouTube URL");
            
            const thumbFile = document.getElementById("v-thumb-file").files[0];
            if (thumbFile) {
                const thumbRes = await uploadFile(thumbFile);
                thumbnail_url = thumbRes.url;
            } else if (!videoId) {
                thumbnail_url = null; // Let backend generate from youtube_url if no custom uploaded
            }
            video_file_url = null;
        }

        const data = {
            title,
            category,
            description,
            is_featured,
            youtube_url,
            video_file_url,
            thumbnail_url,
            sort_order: existingVideo ? existingVideo.sort_order : 0,
        };

        if (videoId) {
            await updateVideo(parseInt(videoId), data);
            alert.textContent = "Video updated successfully!";
        } else {
            await createVideo(data);
            alert.textContent = "Video added successfully!";
        }

        alert.className = "alert alert-success show";
        cancelVideoEdit();
        loadAdminVideos();
    } catch (err) {
        alert.textContent = err.message;
        alert.className = "alert alert-error show";
    }
}

window.deleteVideoAdmin = async function(id) {
    if (!confirm("Delete this video?")) return;
    try {
        await deleteVideo(id);
        loadAdminVideos();
    } catch (err) {
        alert(err.message);
    }
};

window.editVideoAdmin = function(v) {
    document.getElementById("video-form-title").textContent = "✏️ Edit Video";
    document.getElementById("v-id").value = v.id;
    document.getElementById("v-title").value = v.title;
    document.getElementById("v-category").value = v.category;
    document.getElementById("v-description").value = v.description || "";
    document.getElementById("v-featured").checked = v.is_featured;

    const sourceType = v.video_file_url ? "upload" : "youtube";
    document.getElementById("v-source-type").value = sourceType;

    if (sourceType === "youtube") {
        document.getElementById("v-url").value = v.youtube_url || "";
        document.getElementById("v-file").value = "";
    } else {
        document.getElementById("v-url").value = "";
    }

    // Explicitly reset file inputs
    document.getElementById("v-file").value = "";
    document.getElementById("v-thumb-file").value = "";

    if (typeof toggleVideoSourceInputs === "function") {
        toggleVideoSourceInputs();
    }

    document.getElementById("v-submit-btn").textContent = "Update Video";
    document.getElementById("v-cancel-btn").style.display = "inline-block";
};

window.cancelVideoEdit = function() {
    document.getElementById("video-form-title").textContent = "+ Add New Video";
    document.getElementById("video-form").reset();
    document.getElementById("v-id").value = "";
    document.getElementById("v-submit-btn").textContent = "Add Video";
    document.getElementById("v-cancel-btn").style.display = "none";
    if (typeof toggleVideoSourceInputs === "function") {
        toggleVideoSourceInputs();
    }
};

/* ── Enquiries Panel ───────────────────────────────────────────────────────── */

async function loadAdminEnquiries() {
    const tbody = document.getElementById("admin-enquiries-tbody");
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:32px;"><div class="spinner" style="margin:auto;"></div></td></tr>';

    try {
        const enquiries = await fetchEnquiries();
        if (enquiries.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--text-muted);">No enquiries yet</td></tr>';
            return;
        }

        tbody.innerHTML = enquiries
            .map(
                (eq) => `
            <tr style="opacity: ${eq.is_read ? 0.6 : 1}">
                <td><strong>${eq.name}</strong><br><span style="font-size:0.75rem;color:var(--text-muted);">${eq.email}</span></td>
                <td><span class="badge ${eq.is_read ? 'badge-muted' : 'badge-gold'}">${eq.project_type}</span></td>
                <td>${eq.budget_range || "—"}</td>
                <td>${eq.event_date || "—"}</td>
                <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${eq.message}">${eq.message}</td>
                <td>
                    <button class="read-pill ${eq.is_read ? "read" : "unread"}" onclick="toggleRead(${eq.id})">
                        ${eq.is_read ? "Read" : "Unread"}
                    </button>
                </td>
            </tr>`
            )
            .join("");

        // Update dashboard stats
        const total = enquiries.length;
        const readCount = enquiries.filter(e => e.is_read).length;
        const unreadCount = total - readCount;
        
        const statTotal = document.getElementById("stat-total");
        const statUnread = document.getElementById("stat-unread");
        const statRead = document.getElementById("stat-read");
        const sidebarBadge = document.getElementById("unread-badge");

        if (statTotal) statTotal.textContent = total;
        if (statUnread) statUnread.textContent = unreadCount;
        if (statRead) statRead.textContent = readCount;
        
        if (sidebarBadge) {
            sidebarBadge.textContent = unreadCount;
            sidebarBadge.style.display = unreadCount > 0 ? "inline-block" : "none";
        }
        
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--error);">Failed to load enquiries</td></tr>`;
    }
}

window.toggleRead = async function(id) {
    try {
        await markEnquiryRead(id);
        loadAdminEnquiries();
    } catch (err) {
        alert(err.message);
    }
};

/* ── Blog Panel ────────────────────────────────────────────────────────────── */

async function loadAdminBlog() {
    const tbody = document.getElementById("admin-blog-tbody");
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:32px;"><div class="spinner" style="margin:auto;"></div></td></tr>';

    try {
        const posts = await fetchAllBlogPosts();

        if (posts.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--text-muted);">No blog posts yet</td></tr>';
            return;
        }

        tbody.innerHTML = posts
            .map(
                (p) => `
            <tr>
                <td><strong>${p.title}</strong></td>
                <td><span class="category-badge">${p.category}</span></td>
                <td>${new Date(p.created_at).toLocaleDateString()}</td>
                <td>
                    <button class="toggle-btn ${p.is_published ? "on" : ""}" onclick="togglePublish(${p.id}, ${p.is_published})">
                        ${p.is_published ? "Published" : "Draft"}
                    </button>
                </td>
                <td>
                    <button class="btn btn-sm btn-danger" onclick="deleteBlogAdmin(${p.id})">Delete</button>
                </td>
            </tr>`
            )
            .join("");
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--error);">Failed to load posts</td></tr>`;
    }
}

window.togglePublish = async function(id, currentState) {
    try {
        await updateBlogPost(id, { is_published: !currentState });
        loadAdminBlog();
    } catch (err) {
        alert(err.message);
    }
};

window.deleteBlogAdmin = async function(id) {
    if (!confirm("Delete this blog post?")) return;
    try {
        await deleteBlogPost(id);
        loadAdminBlog();
    } catch (err) {
        alert(err.message);
    }
};

async function handleAddBlogPost(e) {
    e.preventDefault();
    const alert = document.getElementById("blog-alert");

    const data = {
        title: document.getElementById("b-title").value.trim(),
        slug: document.getElementById("b-slug").value.trim(),
        content: document.getElementById("b-content").value,
        cover_image_url: document.getElementById("b-cover").value.trim(),
        category: document.getElementById("b-category").value,
        is_published: document.getElementById("b-published").checked,
    };

    try {
        await createBlogPost(data);
        alert.textContent = "Blog post created!";
        alert.className = "alert alert-success show";
        e.target.reset();
        loadAdminBlog();
    } catch (err) {
        alert.textContent = err.message;
        alert.className = "alert alert-error show";
    }
}

/* ── Pricing Panel ─────────────────────────────────────────────────────────── */

async function loadAdminPricing() {
    const tbody = document.getElementById("admin-pricing-tbody");
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:32px;"><div class="spinner" style="margin:auto;"></div></td></tr>';

    try {
        const plans = await fetchPricingPlans();
        if (plans.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text-muted);">No pricing plans yet</td></tr>';
            return;
        }

        tbody.innerHTML = plans
            .map(
                (p) => `
            <tr>
                <td><strong>${p.name}</strong></td>
                <td>₹${p.price.toLocaleString()} ${p.original_price ? `<span style="text-decoration:line-through;color:var(--text-muted);font-size:0.85rem;margin-left:4px;">₹${p.original_price.toLocaleString()}</span>` : ""}</td>
                <td style="max-width:300px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${p.features}">${p.features}</td>
                <td>${p.is_popular ? "⭐ Yes" : "No"}</td>
                <td>${p.is_active ? "✅ Yes" : "❌ No"}</td>
                <td>
                    <button class="btn btn-sm btn-secondary" onclick='editPricingAdmin(${JSON.stringify(p).replace(/'/g, "&#39;")})'>Edit</button>
                    <button class="btn btn-sm btn-secondary" onclick="deletePricingAdmin(${p.id})">Delete</button>
                </td>
            </tr>`
            )
            .join("");
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--error);">Failed to load pricing plans: ${err.message}</td></tr>`;
    }
}

async function handleSavePricingPlan(e) {
    e.preventDefault();
    const alert = document.getElementById("pricing-alert");
    const planId = document.getElementById("p-id").value;
    const origPriceVal = document.getElementById("p-original-price").value;

    const data = {
        name: document.getElementById("p-name").value.trim(),
        price: parseFloat(document.getElementById("p-price").value),
        original_price: origPriceVal ? parseFloat(origPriceVal) : null,
        features: document.getElementById("p-features").value.trim(),
        is_popular: document.getElementById("p-popular").checked,
        is_active: document.getElementById("p-active").checked,
    };

    try {
        if (planId) {
            await updatePricingPlan(parseInt(planId), data);
            alert.textContent = "Pricing plan updated successfully!";
        } else {
            await createPricingPlan(data);
            alert.textContent = "Pricing plan added successfully!";
        }
        alert.className = "alert alert-success show";
        cancelPricingEdit();
        loadAdminPricing();
    } catch (err) {
        alert.textContent = err.message;
        alert.className = "alert alert-error show";
    }
}

window.editPricingAdmin = function(plan) {
    document.getElementById("pricing-form-title").textContent = "✏️ Edit Pricing Plan";
    document.getElementById("p-id").value = plan.id;
    document.getElementById("p-name").value = plan.name;
    document.getElementById("p-price").value = plan.price;
    document.getElementById("p-original-price").value = plan.original_price || "";
    document.getElementById("p-features").value = plan.features;
    document.getElementById("p-popular").checked = plan.is_popular;
    document.getElementById("p-active").checked = plan.is_active;

    document.getElementById("p-submit-btn").textContent = "Update Plan";
    document.getElementById("p-cancel-btn").style.display = "inline-block";
};

window.cancelPricingEdit = function() {
    document.getElementById("pricing-form-title").textContent = "+ Add New Pricing Plan";
    document.getElementById("pricing-form").reset();
    document.getElementById("p-id").value = "";
    document.getElementById("p-submit-btn").textContent = "Add Plan";
    document.getElementById("p-cancel-btn").style.display = "none";
};

window.deletePricingAdmin = async function(id) {
    if (!confirm("Are you sure you want to delete this pricing plan?")) return;
    try {
        await deletePricingPlan(id);
        loadAdminPricing();
    } catch (err) {
        alert("Failed to delete plan: " + err.message);
    }
};

/* ── Settings Panel ────────────────────────────────────────────────────────── */

async function loadAdminSettings() {
    const alert = document.getElementById("settings-alert");
    try {
        const res = await fetchSiteSettings();
        const settings = res.settings;

        document.getElementById("s-name").value = settings.site_name || "";
        document.getElementById("s-tagline").value = settings.tagline || "";
        document.getElementById("s-email").value = settings.email || "";
        document.getElementById("s-phone").value = settings.phone || "";
        document.getElementById("s-location").value = settings.location || "";
        document.getElementById("s-instagram").value = settings.instagram || "";
        document.getElementById("s-youtube").value = settings.youtube || "";
        document.getElementById("s-twitter").value = settings.twitter || "";
        document.getElementById("s-about-text").value = settings.about_text || "";
        document.getElementById("s-about-bio").value = settings.about_bio || "";
    } catch (err) {
        alert.textContent = "Failed to load settings: " + err.message;
        alert.className = "alert alert-error show";
    }
}

async function handleSaveSettings(e) {
    e.preventDefault();
    const alert = document.getElementById("settings-alert");
    alert.style.display = "none";

    const data = {
        settings: {
            site_name: document.getElementById("s-name").value.trim(),
            tagline: document.getElementById("s-tagline").value.trim(),
            email: document.getElementById("s-email").value.trim(),
            phone: document.getElementById("s-phone").value.trim(),
            location: document.getElementById("s-location").value.trim(),
            instagram: document.getElementById("s-instagram").value.trim(),
            youtube: document.getElementById("s-youtube").value.trim(),
            twitter: document.getElementById("s-twitter").value.trim(),
            about_text: document.getElementById("s-about-text").value.trim(),
            about_bio: document.getElementById("s-about-bio").value.trim(),
        }
    };

    try {
        await updateSiteSettings(data);
        alert.textContent = "Site settings saved successfully!";
        alert.className = "alert alert-success show";
        setTimeout(() => {
            alert.style.display = "none";
        }, 3000);
    } catch (err) {
        alert.textContent = err.message;
        alert.className = "alert alert-error show";
    }
}

/* ── Init ──────────────────────────────────────────────────────────────────── */

async function updateAdminLogoTitle() {
    try {
        const res = await fetchSiteSettings();
        const settings = res.settings;
        if (settings.site_name) {
            document.title = `Admin Dashboard — ${settings.site_name}`;
            const logoSpan = document.querySelector(".nav-logo span");
            if (logoSpan) logoSpan.textContent = settings.site_name;
        }
    } catch (e) {}
}

document.addEventListener("DOMContentLoaded", () => {
    initAdminLogin();
    updateAdminLogoTitle();

    // Auto-login session recovery on reload/refresh
    const savedToken = getAuthToken();
    if (savedToken) {
        const loginScreen = document.getElementById("admin-login-screen");
        const dashboard = document.getElementById("admin-dashboard");
        if (loginScreen) loginScreen.style.display = "none";
        if (dashboard) dashboard.classList.add("active");
        startSessionCountdown();
        loadAdminTab("enquiries");
    }
});
