'use strict';

// --- CONFIGURATION ---
const _0x4f23 = "aHR0cHM6Ly9zY3JpcHQuZ29vZ2xlLmNvbS9tYWNyb3Mvcy9BS2Z5Y2J3RHU2TlpwelFraGdtdGtxOW83UFNJTXdnemdTcl94ckdFQXVYX0JkaGluUmNobFhXblViZDNCNENjRUhneWNvN20vZXhlYw==";
const SCRIPT_URL = atob(_0x4f23);
const _0x4f21 = "aHR0cHM6Ly9zY3JpcHQuZ29vZ2xlLmNvbS9tYWNyb3Mvcy9BS2Z5Y2J3VXhOSG5xVmMyaVcyTTBYUHpfWm1EdnR0UGVhMDQ2WjNmS3EycmRyc281TXV5ZHJDTHFOdDRROEZYRWZoSW9sb2kvZXhlYwo=";
const KIOSK_URL =atob(_0x4f21);
const _0x4f22 = "TXlTdXBlclNlY3JldEtleTEyMw=="; 
const SECRET_TOKEN = atob(_0x4f22);

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

    btn.innerText = "AUTHENTICATING...";
    btn.disabled = true;

    try {
        const response = await fetch(SCRIPT_URL, {
            method: "POST",
            mode: "cors", // Ensure CORS is active
            // Using text/plain avoids complex 'preflight' checks in GAS
            headers: { "Content-Type": "text/plain" }, 
            body: JSON.stringify({ 
                action: "login", 
                username: user, 
                password: pass,
                token: SECRET_TOKEN // Crucial: Your backend requires this!
            })
        });

        const data = await response.json();

        if (data.status === "success") {
            localStorage.setItem('isLoggedIn', 'true');
            localStorage.setItem('loginTimestamp', Date.now());
            showDashboard();
            initializeAppData();
        } else {
            throw new Error("Invalid Credentials");
        }
    } catch (error) {
        console.error("Login Error:", error);
        if (errorMsg) {
            errorMsg.innerText = error.message === "Invalid Credentials" ? "INVALID CREDENTIALS" : "! CONNECTION ERROR";
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
    ['dashboard', 'summary', 'report', 'kiosk', 'admin'].forEach(p => {
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
// --- ADMIN CORE LOGIC ---

function toggleTokenVisibility() {
    const input = document.getElementById('admin-token-input');
    if (input) input.type = input.type === 'password' ? 'text' : 'password';
}

function addLog(message) {
    const logContainer = document.getElementById('admin-logs');
    if (!logContainer) return;

    const time = new Date().toLocaleTimeString([], { hour12: false });
    const logEntry = document.createElement('p');
    logEntry.className = "mb-1 border-l-2 border-[#00ff9d]/30 pl-2 py-0.5 hover:bg-white/5 transition";
    logEntry.innerHTML = `<span class="opacity-30 font-mono text-[10px]">[${time}]</span> <span class="text-[#00ff9d]">>></span> ${message}`;
    
    logContainer.prepend(logEntry); 
}

// Automatically log important events by wrapping existing functions
const originalLoadData = loadData;
loadData = async function() {
    addLog("FETCHING_TICKET_DATA...");
    await originalLoadData();
    addLog("TICKET_SYNC_COMPLETE");
};

const originalLoadKiosk = loadKioskData;
loadKioskData = async function() {
    addLog("SCANNING_KIOSK_STATUS...");
    await originalLoadKiosk();
    addLog("KIOSK_SCAN_SUCCESSFUL");
};

// --- USER MANAGEMENT CORE ---

async function renderUserTable() {
    const tableBody = document.getElementById('user-list-table');
    if (!tableBody) return;

    try {
        addLog("SYNCING_USER_DATABASE...");
        // Ensure we are hitting the correct endpoint with the 'users' type
        const response = await fetch(`${SCRIPT_URL}?token=${SECRET_TOKEN}&type=users`);
        const data = await response.json(); // Fixed the 'data is undefined' error
        
        const users = Array.isArray(data) ? data : (data.users || []);

        if (users.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5" class="text-center py-4 opacity-50">NO USERS FOUND</td></tr>';
            return;
        }

        tableBody.innerHTML = users.map(user => {
            const usernameClean = user.username ? user.username.trim().toLowerCase() : "unknown";
            const currentStatus = (user.status || 'ACTIVE').toString().toUpperCase();
            
            // Visual Role Detection logic
            const isAdmin = usernameClean.includes('admin') || usernameClean === 'christian';
            const roleLabel = isAdmin ? 'ADMIN' : 'ENCODER';
            const roleClass = isAdmin 
                ? 'bg-purple-500/20 text-purple-400 border-purple-500/50' 
                : 'bg-blue-500/20 text-blue-400 border-blue-500/50';

            const statusClass = currentStatus === 'ACTIVE' ? 'text-[#00ff9d]' : 'text-red-500';

            return `
            <tr class="border-b border-white/5 hover:bg-white/10 transition group">
                <td class="py-3 font-bold uppercase tracking-tighter ${isAdmin ? 'text-purple-400' : 'text-slate-200'}">
                    ${user.username}
                </td>
                <td class="py-3">
                    <span class="px-2 py-0.5 rounded text-[10px] border ${roleClass}">
                        ${roleLabel}
                    </span>
                </td>
                <td class="py-3 text-slate-500 text-xs uppercase font-mono">${user.branch || 'N/A'}</td>
                <td class="py-3 ${statusClass} font-mono text-xs font-bold">
                    [${currentStatus}]
                </td>
                <td class="py-3 text-right">
                    <button onclick="toggleUserStatusRemote('${user.username}', '${currentStatus}')" 
                            class="text-[10px] text-blue-400 hover:bg-blue-400 hover:text-black border border-blue-400/30 px-3 py-1 rounded-sm transition-all uppercase font-bold">
                        TOGGLE_STATUS
                    </button>
                </td>
            </tr>`;
        }).join('');
        
        addLog("USER_SYNC_SUCCESS");

    } catch (e) {
        console.error("User Fetch Error:", e);
        addLog("CRITICAL: USER_DATABASE_UNREACHABLE");
        tableBody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-red-500">FAILED TO LOAD USERS</td></tr>';
    }
}

// --- REMOTE STATUS TOGGLE ---
async function toggleUserStatusRemote(username, currentStatus) {
    // Logic: If active, make inactive. If anything else (INACTIVE/ERROR), make active.
    const newStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    
    addLog(`REQUESTING_STATUS_CHANGE: ${username} -> ${newStatus}`);

    try {
        const response = await fetch(SCRIPT_URL, {
            method: "POST",
            body: JSON.stringify({
                action: "updateUserStatus",
                username: username,
                newStatus: newStatus,
                token: SECRET_TOKEN
            })
        });

        const result = await response.json();

        if (result.status === "success") {
            addLog(`SUCCESS: ${username} UPDATED`);
            renderUserTable(); // Refresh the table
        } else {
            throw new Error(result.message || "Unknown error");
        }

    } catch (e) {
        addLog("ERROR: STATUS_UPDATE_FAILED");
        console.error("Transmission Error:", e);
        alert("SYNC ERROR: Status could not be updated in the database.");
    }
}

// --- ADD NEW USER MODAL ---
async function openAddUserModal() {
    const user = prompt("NEW USERNAME:");
    if (!user) return;
    const pass = prompt("ASSIGN PASSWORD:");
    if (!pass) return;
    const branch = prompt("ASSIGN BRANCH (e.g. PASIG, MALABON):") || "GENERAL";

    addLog(`POSTING_NEW_USER: ${user.toUpperCase()}...`);

    try {
        const response = await fetch(SCRIPT_URL, {
            method: "POST",
            body: JSON.stringify({
                action: "createUser",
                username: user,
                password: pass,
                branch: branch.toUpperCase(),
                token: SECRET_TOKEN
            })
        });

        const result = await response.json();
        
        if (result.status === "success") {
            addLog(`DATABASE_RECORD_CREATED: ${user.toUpperCase()}`);
            alert(`USER ${user} ADDED SUCCESSFULLY`);
            renderUserTable(); 
        } else {
            throw new Error(result.message);
        }

    } catch (e) {
        addLog("ERROR: FAILED_TO_CREATE_USER");
        console.error("Transmission Error:", e);
        alert("TRANSMISSION ERROR: Check connection to Google Sheets.");
    }
}
