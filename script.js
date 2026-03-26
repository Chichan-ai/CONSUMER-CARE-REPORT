'use strict';

// --- CONFIGURATION ---
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyefF574W_3mWAm6XDAAxZFC4C9HgMnN0-Ugx5jBD81rXMkKZt9a98SJc7Ps45lcwz7/exec";
const KIOSK_URL = "https://script.google.com/macros/s/AKfycbwUxNHnqVc2iW2M0XPz_ZmDvttPea046Z3fKq2rdrso5MuydrCLqNt4Q8FXEfhIoloi/exec";

// --- GLOBAL STATE ---
let cachedTickets = [];
let myChart = null;
let branchChart = null;
let engagementChart = null;

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    // Check session validity immediately on load
    checkSession();

    const loggedIn = localStorage.getItem('isLoggedIn');

    if (loggedIn === 'true') {
        showDashboard();
        initializeAppData();
    } else {
        document.getElementById('login-section').classList.remove('hidden');
        document.getElementById('main-dashboard').classList.add('hidden');
    }
});

// Reset timer when they interact with the page
document.addEventListener('click', () => {
    if (localStorage.getItem('isLoggedIn') === 'true') {
        localStorage.setItem('loginTimestamp', new Date().getTime());
    }
});

// Separated data loading to call after login or on refresh
function initializeAppData() {
    const savedPage = localStorage.getItem('activePage') || 'dashboard';
    showPage(savedPage);

    // Initial Data Pull
    loadData();
    loadKioskData();

    // Setup Form
    const ticketForm = document.getElementById('ticketForm');
    if (ticketForm) {
        ticketForm.onsubmit = handleFormSubmit;
    }

    // Check for session timeout every 5 seconds
    setInterval(checkSession, 5000); 
}

// --- LOGIN & SESSION MANAGEMENT ---
async function handleLogin() {
    const user = document.getElementById('username').value;
    const pass = document.getElementById('password').value;
    const errorMsg = document.getElementById('login-error');
    const btn = document.querySelector('button[onclick="handleLogin()"]');
    
    if (!user || !pass) {
        if (errorMsg) {
            errorMsg.innerText = "! CREDENTIALS REQUIRED";
            errorMsg.classList.remove('hidden');
        }
        return;
    }

    // UI Feedback
    btn.innerText = "AUTHENTICATING...";
    btn.disabled = true;
    if (errorMsg) errorMsg.classList.add('hidden');

    try {
        const response = await fetch(SCRIPT_URL, {
            method: "POST",
            body: JSON.stringify({ 
                action: "login", 
                username: user, 
                password: pass 
            })
        });

        const data = await response.json();

        if (data.status === "success") {
            localStorage.setItem('isLoggedIn', 'true');
            localStorage.setItem('loginTimestamp', Date.now()); // Store current time in ms
            showDashboard();
            initializeAppData();
        } 
        else {
            if (errorMsg) {
                errorMsg.innerText = "INVALID CREDENTIALS";
                errorMsg.classList.remove('hidden');
            } else {
                alert("Invalid Credentials");
            }
            btn.innerText = "INITIALIZE SESSION";
            btn.disabled = false;
        }
    } catch (error) {
        console.error("Login Error:", error);
        if (errorMsg) {
            errorMsg.innerText = "! CONNECTION ERROR";
            errorMsg.classList.remove('hidden');
        }
        btn.innerText = "INITIALIZE SESSION";
        btn.disabled = false;
    }
}

function checkSession() {
    const loginTime = localStorage.getItem('loginTimestamp');
    const isLoggedIn = localStorage.getItem('isLoggedIn');

    if (isLoggedIn === 'true' && loginTime) {
        const currentTime = Date.now();
        const fiveMinutes = 5 * 60 * 1000; // 5 minutes timeout session

        if (currentTime - loginTime > fiveMinutes) {
            alert("SESSION EXPIRED: Session limit reached (1 min).");
            forceLogout();
        }
    }
}

// Helper to clear everything
function forceLogout() {
    localStorage.clear(); // Clears login, timestamp, and active page
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('loginTimestamp');
    localStorage.removeItem('activePage');
    location.reload(); 
}

function handleLogout() {
    if (confirm("Are you sure you want to logout?")) {
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('activePage');
        location.reload(); 
    }
}

function showDashboard() {
    const loginSec = document.getElementById('login-section');
    const mainDash = document.getElementById('main-dashboard');
    if(loginSec) loginSec.classList.add('hidden');
    if(mainDash) mainDash.classList.remove('hidden');
}

// --- NAVIGATION & THEME ---
function toggleTheme() {
    document.body.classList.toggle('light-theme');
    const icon = document.getElementById('theme-icon');
    if (icon) icon.innerText = document.body.classList.contains('light-theme') ? '🌙' : '☀️';
    if (cachedTickets.length > 0) renderDashboard(cachedTickets);
}

function showPage(page) {
    localStorage.setItem('activePage', page);
    ['dashboard', 'summary', 'report', 'kiosk'].forEach(p => {
        const pageEl = document.getElementById(`page-${p}`);
        const navEl = document.getElementById(`nav-${p}`);
        if (pageEl) pageEl.classList.toggle('hidden', p !== page);
        if (navEl) navEl.classList.toggle('active', p === page);
    });

    if (page === 'report') updateDateInput();
}

function openFilteredSheet() {
    window.open("https://docs.google.com/spreadsheets/d/1mDv4lzB3qDy_e9OQ0mG6YA_49kPJ1Q53SCC1lGSy6Fs/edit", '_blank');
}

// --- DATA FETCHING ---
async function loadData() {
    const loadingEl = document.getElementById('loading-state');
    if (loadingEl) loadingEl.classList.remove('hidden');

    try {
        const response = await fetch(`${SCRIPT_URL}?token=${SECRET_TOKEN}&type=tickets`);
        const result = await response.json();
        cachedTickets = result.tickets;

        const lastID = parseInt(result.lastTicket) || 0;
        const hint = document.getElementById('last-ticket-hint');
        const input = document.getElementById('ticketNoInput');
        if (hint) hint.innerText = lastID;
        if (input) input.value = lastID + 1;

        updateDateInput();
        renderDashboard(cachedTickets);
        updateSummary(cachedTickets);
    } catch (err) {
        console.error("Load Error:", err);
    } finally {
        if (loadingEl) loadingEl.classList.add('hidden');
    }
}

async function loadKioskData() {
    const table = document.getElementById('kioskTable'),
          loader = document.getElementById('loader'),
          tbody = document.getElementById('tableBody');

    if (!tbody) return;
    loader.style.display = 'block';
    table.style.display = 'none';

    try {
        const response = await fetch(`${KIOSK_URL}?token=${SECRET_TOKEN}&type=kiosks`);
        const result = await response.json();
        
        tbody.innerHTML = '';
        result.kiosks.forEach(k => {
            const statusStr = (k.Status || 'Offline').toUpperCase();
            const statusColor = statusStr === 'ONLINE' ? 'status-online' : 'status-offline';
            const cleanDate = k.GoLive ? k.GoLive.split('T')[0] : '---';

            tbody.innerHTML += `
                <tr>
                    <td class="terminal-id">#${k.TerminalID || '---'}</td>
                    <td class="location-name">${k.Location || '---'}</td>
                    <td style="color: var(--text-main);">${cleanDate}</td>
                    <td style="color: var(--text-main);">${k.Hours || '---'}</td>
                    <td class="text-end status-tag ${statusColor}">[${statusStr}]</td>
                </tr>`;
        });
        loader.style.display = 'none';
        table.style.display = 'table';
    } catch (e) {
        loader.innerHTML = `<div class="p-5 text-danger fw-bold">CONNECTION FAILED</div>`;
    }
}

// --- DASHBOARD RENDERING ---
function renderDashboard(data) {
    document.getElementById('stat-total').innerText = data.length;
    document.getElementById('stat-resolved').innerText = data.filter(t => String(t.Status).toLowerCase() === 'resolved').length;
    document.getElementById('stat-pending').innerText = data.filter(t => String(t.Status).toLowerCase() === 'pending').length;

    const resolvedTickets = data.filter(t => String(t.Status).toLowerCase() === 'resolved' && t.DateIssued && t.DateReplied);
    let totalMinutes = 0;
    resolvedTickets.forEach(t => {
        const diff = (new Date(t.DateReplied) - new Date(t.DateIssued)) / 60000;
        if (diff > 0) totalMinutes += diff;
    });
    const avgMin = resolvedTickets.length > 0 ? totalMinutes / resolvedTickets.length : 0;
    document.getElementById('stat-tat').innerText = avgMin >= 60 ? (avgMin / 60).toFixed(1) + "h" : Math.round(avgMin) + "m";

    const criticalCount = data.filter(t => getCriticality(t.Concerns || t.concerns) === "CRITICAL" && String(t.Status).toLowerCase() !== 'resolved').length;
    if (document.getElementById('stat-critical')) document.getElementById('stat-critical').innerText = criticalCount;

    populateTable(data.slice(-50).reverse());

    const catCounts = data.reduce((acc, t) => { acc[t.Type || 'Other'] = (acc[t.Type || 'Other'] || 0) + 1; return acc; }, {});
    const branchCounts = data.reduce((acc, t) => { acc[t.Branch || 'Unknown'] = (acc[t.Branch || 'Unknown'] || 0) + 1; return acc; }, {});
    const engCounts = data.reduce((acc, t) => { acc[t.Engagement || 'Not Set'] = (acc[t.Engagement || 'Not Set'] || 0) + 1; return acc; }, {});

    updateChart(catCounts);
    updateBranchChart(branchCounts);
    updateEngagementChart(engCounts);
}

function populateTable(dataToDisplay) {
    const reportBody = document.getElementById('daily-report-body');
    if (!reportBody) return;

    if (!dataToDisplay || dataToDisplay.length === 0) {
        reportBody.innerHTML = '<tr><td colspan="5" class="py-4 text-center opacity-30">NO DATA FOUND</td></tr>';
        return;
    }

    reportBody.innerHTML = dataToDisplay.map(t => {
        const tStatus = (t.Status || 'PENDING').toString().toUpperCase();
        const tSeverity = (t.SeverityLevel || 'LOW').toString().toUpperCase();
        
        let sevClass = "text-blue-400";
        if (tSeverity === 'CRITICAL') sevClass = "text-red-500 font-bold animate-pulse";
        else if (tSeverity === 'HIGH') sevClass = "text-orange-500";
        else if (tSeverity === 'MODERATE') sevClass = "text-yellow-500";

        const statusStyle = tStatus === 'RESOLVED' ? 'text-[#00ff9d]' : 'opacity-40';

        return `
            <tr class="hover:bg-white/5 transition border-b border-white/5">
                <td class="py-3 px-2 text-slate-500">#${t.TicketNo || '---'}</td>
                <td class="py-3 px-2 font-bold uppercase">${t.Name || '---'}</td>
                <td class="py-3 px-2 opacity-60">${t.Branch || '---'}</td>
                <td class="py-3 px-2 ${sevClass}">${tSeverity}</td>
                <td class="py-3 px-2 text-right ${statusStyle}">[${tStatus}]</td>
            </tr>`;
    }).join('');
}

// --- CHART UPDATES ---
function updateChart(counts) {
    const ctx = document.getElementById('ticketChart').getContext('2d');
    const isLight = document.body.classList.contains('light-theme');
    if (myChart) myChart.destroy();
    myChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(counts),
            datasets: [{
                label: 'VOLUME',
                data: Object.values(counts),
                backgroundColor: isLight ? '#059669' : '#00ff9d',
                borderRadius: 4
            }]
        },
        options: { 
            responsive: true, maintainAspectRatio: false,
            scales: {
                y: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: isLight ? '#000' : '#64748b' } },
                x: { grid: { display: false }, ticks: { color: isLight ? '#000' : '#64748b', font: { size: 9 } } }
            },
            plugins: { legend: { display: false } } 
        }
    });
}

function updateBranchChart(counts) {
    const ctx = document.getElementById('branchChart').getContext('2d');
    const isLight = document.body.classList.contains('light-theme');
    const sorted = Object.entries(counts).sort((a,b) => b[1] - a[1]).slice(0, 10);
    
    if (branchChart) branchChart.destroy();
    branchChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sorted.map(i => i[0]),
            datasets: [{
                label: 'Top Branches',
                data: sorted.map(i => i[1]),
                backgroundColor: '#00e5ff',
                borderRadius: 4
            }]
        },
        options: { 
            indexAxis: 'y',
            responsive: true, maintainAspectRatio: false,
            scales: {
                x: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: isLight ? '#000' : '#64748b' } },
                y: { grid: { display: false }, ticks: { color: isLight ? '#000' : '#64748b', font: { size: 9 } } }
            },
            plugins: { legend: { display: false } } 
        }
    });
}

function updateEngagementChart(counts) {
    const ctx = document.getElementById('engagementChart').getContext('2d');
    const isLight = document.body.classList.contains('light-theme');
    if (engagementChart) engagementChart.destroy();
    engagementChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(counts),
            datasets: [{
                data: Object.values(counts),
                backgroundColor: ['#00ff9d', '#00e5ff', '#ff007a', '#ffb800', '#9d00ff', '#71717a'],
                borderWidth: 0
            }]
        },
        options: { 
            responsive: true, maintainAspectRatio: false,
            plugins: { 
                legend: { 
                    position: 'bottom',
                    labels: { color: isLight ? '#000' : '#64748b', font: { size: 10, family: 'Fira Code' }, padding: 20 } 
                } 
            },
            cutout: '70%'
        }
    });
}

// --- FIXED FORM & VALIDATION LOGIC ---
async function handleFormSubmit(e) {
    e.preventDefault(); 
    const form = e.target;
    const btn = document.getElementById('submitBtn');
    const requiredFields = form.querySelectorAll('[required]');
    let isValid = true;

    requiredFields.forEach(field => {
        if (!field.value.trim()) {
            field.classList.add('input-error');
            isValid = false;
        } else {
            field.classList.remove('input-error');
        }
        const eventType = field.tagName === 'SELECT' ? 'change' : 'input';
        field.addEventListener(eventType, function() {
            if (this.value.trim()) {
                this.classList.remove('input-error');
            }
        }, { once: true });
    });

    if (!isValid) {
        alert("UPLOAD FAILED: Please fill in all required fields highlighted in red.");
        return;
    }

    const formData = new FormData(form);
    const name = formData.get('name');
    if (name) formData.set('name', name.toUpperCase());
    
    // Add token to form data for verification
    formData.append('token', SECRET_TOKEN);

    btn.innerText = "TRANSMITTING...";
    btn.disabled = true;

    try {
        const response = await fetch(SCRIPT_URL, { 
            method: 'POST', 
            body: new URLSearchParams(formData) 
        });

        if (response.ok) {
            alert("UPLOAD COMPLETE");
            form.reset();
            updateDateInput();
            loadData();
        } else {
            throw new Error("Server responded with an error.");
        }
    } catch (err) {
        alert("CRITICAL_ERROR: " + err.message);
    } finally {
        btn.innerText = "UPLOAD";
        btn.disabled = false;
    }
}

function filterTable() {
    const searchInput = document.getElementById('tableSearch') || document.getElementById('searchInput');
    const query = searchInput.value.toLowerCase();
    
    if (document.getElementById('page-kiosk').classList.contains('hidden')) {
        const filtered = cachedTickets.filter(t => {
            return [t.TicketNo, t.Name, t.Branch, t.Status, t.SeverityLevel].join(' ').toLowerCase().includes(query);
        }).reverse();
        populateTable(filtered);
    } else {
        document.querySelectorAll("#tableBody tr").forEach(row => {
            row.style.display = row.innerText.toLowerCase().includes(query) ? "" : "none";
        });
    }
}

function updateSummary(tickets) {
    const now = new Date();
    const todayStr = now.toLocaleDateString();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const daysPassed = now.getDate();

    const todayTickets = tickets.filter(t => new Date(t.DateIssued).toLocaleDateString() === todayStr);
    const monthlyTickets = tickets.filter(t => {
        const d = new Date(t.DateIssued);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const mobileTickets = monthlyTickets.filter(t => (t.Type || "").toString().toUpperCase().includes("MOBILE APP"));

    if (document.getElementById('stat-daily-avg')) document.getElementById('stat-daily-avg').innerText = todayTickets.length;
    if (document.getElementById('stat-monthly-total')) document.getElementById('stat-monthly-total').innerText = monthlyTickets.length;
    if (document.getElementById('stat-mobile-avg')) document.getElementById('stat-mobile-avg').innerText = (mobileTickets.length / daysPassed).toFixed(1);
}

function getCriticality(concernText) {
    if (!concernText) return "NORMAL";
    const redFlags = ['fraud', 'scam', 'unauthorized', 'stolen', 'legal', 'lawyer', 'bsp', 'complaint', 'missing funds', 'hacked'];
    return redFlags.some(word => concernText.toLowerCase().includes(word)) ? "CRITICAL" : "NORMAL";
}

function updateDateInput() {
    const el = document.getElementById('dateIssuedInput');
    if (el) {
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        el.value = now.toISOString().slice(0, 16);
    }
}

function refreshDashboardData() {
    const loadingEl = document.getElementById('loading-state');
    if (loadingEl) loadingEl.classList.remove('hidden');
    loadData();
    loadKioskData();
    setTimeout(() => { if (loadingEl) loadingEl.classList.add('hidden'); }, 1500);
}

// Enter key support for Login
document.addEventListener('keypress', function (e) {
    const loginSection = document.getElementById('login-section');
    if (e.key === 'Enter' && loginSection && !loginSection.classList.contains('hidden')) {
        handleLogin();
    }
});
