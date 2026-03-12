'use strict';
    const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxBauciqLsQTM7cvuU4G6H2xqal7DUEZ8nQ8ZU_IE6abYffRrrlVw2P01QkAB7bCykq/exec"; 
    let myChart = null;
    let branchChart = null; 
    let engagementChart = null; 
    let cachedTickets = []; 

    function toggleTheme() {
        document.body.classList.toggle('dark-theme');
        const icon = document.getElementById('theme-icon');
        icon.innerText = document.body.classList.contains('dark-theme') ? '☀️' : '🌙';
        if(cachedTickets.length > 0) renderDashboard(cachedTickets);
    }

    function showPage(page) {
    // Save the current page to localStorage
    localStorage.setItem('activePage', page);

    ['dashboard', 'summary', 'report'].forEach(p => {
        document.getElementById(`page-${p}`).classList.add('hidden');
        document.getElementById(`nav-${p}`).classList.remove('active');
    });
    document.getElementById(`page-${page}`).classList.remove('hidden');
    document.getElementById(`nav-${page}`).classList.add('active');
    
    // Only load data if we aren't already on the report page (or keep as per your logic)
    if(page !== 'report') loadData();
    }

    // Replace these specific functions in your HTML <script> section

    async function loadData() {
        const loadingEl = document.getElementById('loading-state');
        loadingEl.classList.remove('hidden');
        try {
            const response = await fetch(SCRIPT_URL);
            const result = await response.json();
            cachedTickets = result.tickets; 
            
            // 1. Update the Hint
            const lastID = parseInt(result.lastTicket) || 0;
            document.getElementById('last-ticket-hint').innerText = lastID;
            
            // 2. Auto-fill the next ID
            document.getElementById('ticketNoInput').value = lastID + 1;

            // 3. Auto-fill the Date field with Current Time
            const now = new Date();
            now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
            document.getElementById('dateIssuedInput').value = now.toISOString().slice(0, 16);

            renderDashboard(cachedTickets);
        } catch (err) { 
            console.error("Load Error:", err); 
        } finally { 
            loadingEl.classList.add('hidden'); 
        }
        // Initial Load Logic
        window.addEventListener('DOMContentLoaded', () => {
            // Check if there is a saved page, otherwise default to 'dashboard'
            const savedPage = localStorage.getItem('activePage') || 'dashboard';
            
            // Switch to that page visually
            showPage(savedPage);
            
            // Load the data
            loadData();
        });
    }

    function populateTable(dataToDisplay) {
    const reportBody = document.getElementById('daily-report-body');
    const concern = t.Concerns || t.concerns || "";
    const criticality = getCriticality(concern);

    if (!dataToDisplay || dataToDisplay.length === 0) {
        reportBody.innerHTML = '<tr><td colspan="4" class="py-4 text-center opacity-30">NO DATA FOUND</td></tr>';
        return;
    }
    // If critical, apply a flashing or red style
    const criticalStyle = criticality === "CRITICAL" 
        ? "text-red-500 font-bold animate-pulse" 
        : "text-slate-500";

    return `
        <tr class="hover:bg-white/5 transition border-white/5">
            <td class="py-3 px-2 text-slate-500">#${tID}</td>
            <td class="py-3 px-2 font-bold uppercase">${tName}</td>
            <td class="py-3 px-2 opacity-60">${tBranch}</td>
            <td class="py-3 px-2 text-[10px]">
                <span class="${sevStyle}">●</span> ${sev}
            </td>
            <td class="py-3 px-2 text-right ${statusStyle}">[${tStatus}]</td>
        </tr>
    `;

    // Inside your populateTable(dataToDisplay) function:
    reportBody.innerHTML = dataToDisplay.map(t => {
        const tID = t.TicketNo || "---";
        const tName = t.Name || "---";
        const tBranch = t.Branch || "---";
        const tStatus = (t.Status || 'PENDING').toString().toUpperCase();
        
        // IMPORTANT: Make sure this matches the key in your Apps Script (SeverityLevel)
        const tSeverity = (t.SeverityLevel || 'LOW').toString().toUpperCase();
        
        // Severity Styling
        let sevClass = "text-blue-400"; // Default LOW
        if (tSeverity === 'CRITICAL') sevClass = "text-red-500 font-bold animate-pulse";
        else if (tSeverity === 'HIGH') sevClass = "text-orange-500";
        else if (tSeverity === 'MODERATE') sevClass = "text-yellow-500";

        const statusStyle = tStatus === 'RESOLVED' ? 'text-[#00ff9d]' : 'opacity-40';

        return `
            <tr class="hover:bg-white/5 transition border-white/5 border-b">
                <td class="py-3 px-2 text-slate-500">#${tID}</td>
                <td class="py-3 px-2 font-bold uppercase">${tName}</td>
                <td class="py-3 px-2 opacity-60">${tBranch}</td>
                <td class="py-3 px-2 ${sevClass}">${tSeverity}</td>
                <td class="py-3 px-2 text-right ${statusStyle}">[${tStatus}]</td>
            </tr>
        `;
    }).join('');
    }
    function renderDashboard(data) {
        // Update Stats
        document.getElementById('stat-total').innerText = data.length;
        document.getElementById('stat-resolved').innerText = data.filter(t => String(t.Status).toLowerCase() === 'resolved').length;
        document.getElementById('stat-pending').innerText = data.filter(t => String(t.Status).toLowerCase() === 'pending').length;

        // Show last 50 entries
        populateTable(data.slice(-50).reverse());

        // Update Charts (Using the exact keys from Apps Script)
        const catCounts = data.reduce((acc, t) => { acc[t.Type || 'Other'] = (acc[t.Type || 'Other'] || 0) + 1; return acc; }, {});
        updateChart(catCounts);

        const branchCounts = data.reduce((acc, t) => { acc[t.Branch || 'Unknown'] = (acc[t.Branch || 'Unknown'] || 0) + 1; return acc; }, {});
        updateBranchChart(branchCounts);

        const engCounts = data.reduce((acc, t) => { acc[t.Engagement || 'Not Set'] = (acc[t.Engagement || 'Not Set'] || 0) + 1; return acc; }, {});
        updateEngagementChart(engCounts);
        // ... your existing stats code ...

        // Calculate Average Resolution Time (TAT)
        const resolvedTickets = data.filter(t => 
            String(t.Status).toLowerCase() === 'resolved' && t.DateIssued && t.DateReplied
        );

        let totalMinutes = 0;

        resolvedTickets.forEach(t => {
            const start = new Date(t.DateIssued);
            const end = new Date(t.DateReplied);
            const diff = (end - start) / (1000 * 60); // Difference in minutes
            if (diff > 0) totalMinutes += diff;
        });

        const avgMinutes = resolvedTickets.length > 0 ? totalMinutes / resolvedTickets.length : 0;
        
        // Format the display (e.g., "1.5h" or "45m")
        let displayTAT = "0m";
        if (avgMinutes >= 60) {
            displayTAT = (avgMinutes / 60).toFixed(1) + "h";
        } else {
            displayTAT = Math.round(avgMinutes) + "m";
        }

        document.getElementById('stat-tat').innerText = displayTAT;

        // ... your existing table and chart code ...

        // Inside renderDashboard(data)
        const criticalCount = data.filter(t => 
            getCriticality(t.Concerns || t.concerns) === "CRITICAL" && 
            String(t.Status).toLowerCase() !== 'resolved'
        ).length;

        // Update a new stat element (you'd need to add this ID to your HTML)
        document.getElementById('stat-critical').innerText = criticalCount;
    }
    function populateTable(dataToDisplay) {
        const reportBody = document.getElementById('daily-report-body');
        
        reportBody.innerHTML = dataToDisplay.map(t => {
            const tStatus = (t.Status || 'PENDING').toString().toUpperCase();
            const tSeverity = (t.SeverityLevel || 'LOW').toString().toUpperCase();

            // Style based on severity
            let sevStyle = "text-blue-400";
            if (tSeverity === 'CRITICAL') sevStyle = "text-red-500 font-bold animate-pulse";
            else if (tSeverity === 'HIGH') sevStyle = "text-orange-500";
            else if (tSeverity === 'MODERATE') sevStyle = "text-yellow-500";

            const statusStyle = tStatus === 'RESOLVED' ? 'text-[#00ff9d]' : 'opacity-40';

            // THE FIX: Ensure there are exactly 5 <td> elements
            return `
                <tr class="hover:bg-white/5 transition border-b border-white/5">
                    <td class="py-3 px-2 text-slate-500">#${t.TicketNo || '---'}</td>
                    <td class="py-3 px-2 font-bold uppercase">${t.Name || '---'}</td>
                    <td class="py-3 px-2 opacity-60">${t.Branch || '---'}</td>
                    <td class="py-3 px-2 ${sevStyle}">${tSeverity}</td>
                    <td class="py-3 px-2 text-right ${statusStyle}">[${tStatus}]</td>
                </tr>
            `;
        }).join('');
    }

    function filterTable() {
        const query = document.getElementById('tableSearch').value.toLowerCase();
        if (!query) {
            populateTable(cachedTickets.slice(-50).reverse());
            return;
        }
        const filtered = cachedTickets.filter(t => {
            const searchableText = [
                t.TicketNo, t.Name, t.Branch, t.Status, t.SeverityLevel
            ].join(' ').toLowerCase();
            return searchableText.includes(query);
        }).reverse();
        populateTable(filtered);
    }

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
                    y: { grid: { color: 'rgba(128,128,128,0.1)' }, ticks: { color: isLight ? '#000' : '#64748b' } },
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
                    x: { grid: { color: 'rgba(128,128,128,0.1)' }, ticks: { color: isLight ? '#000' : '#64748b' } },
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
                        labels: { 
                            color: isLight ? '#000' : '#64748b', 
                            font: { size: 10, family: 'Fira Code' },
                            padding: 20
                        } 
                    } 
                },
                cutout: '70%'
            }
        });
    }

    document.getElementById('ticketForm').onsubmit = async (e) => {
        e.preventDefault();
        const btn = document.getElementById('submitBtn');
        btn.innerText = "TRANSMITTING...";
        btn.disabled = true;
        
        try {
            const response = await fetch(SCRIPT_URL, { 
                method: 'POST', 
                body: new URLSearchParams(new FormData(e.target)) 
            });
            
            // Even with no-cors, we can check if the fetch failed entirely
            alert("UPLOAD_COMPLETE");
            e.target.reset();
            loadData(); // Refresh the dashboard automatically
        } catch (error) { 
            console.error(error);
            alert("CRITICAL_ERROR: " + error.message); 
        } finally { 
            btn.innerText = "UPLOAD"; 
            btn.disabled = false; 
        }
    };

    function openFilteredSheet() {
        window.open("https://docs.google.com/spreadsheets/d/1mDv4lzB3qDy_e9OQ0mG6YA_49kPJ1Q53SCC1lGSy6Fs/edit", '_blank');
    }
        // Add this to your script to auto-fill the date when "NEW ENTRY" is clicked
    document.getElementById('nav-report').addEventListener('click', () => {
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        document.getElementById('dateIssuedInput').value = now.toISOString().slice(0, 16);
    });

    function getCriticality(concernText) {
        if (!concernText) return "NORMAL";
        
        const lowerText = concernText.toLowerCase();
        
        // High-priority keywords
        const redFlags = [
            'fraud', 'scam', 'unauthorized', 'stolen', 'legal', 
            'lawyer', 'bsp', 'complaint', 'missing funds', 'hacked'
        ];

        // Check if any red flag exists in the text
        const isCritical = redFlags.some(word => lowerText.includes(word));
        
        return isCritical ? "CRITICAL" : "NORMAL";  
    }
    function updateSummary(tickets) {
        const now = new Date();
        const todayStr = now.toLocaleDateString(); // Format: MM/DD/YYYY
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        // 1. Daily Ticket Count
        const todayTickets = tickets.filter(t => {
            const ticketDate = new Date(t.DateIssued);
            return ticketDate.toLocaleDateString() === todayStr;
        });
        const dailyCount = todayTickets.length;

        // 2. Monthly Total (All Tickets)
        const monthlyTickets = tickets.filter(t => {
            const ticketDate = new Date(t.DateIssued);
            return ticketDate.getMonth() === currentMonth && ticketDate.getFullYear() === currentYear;
        });
        const monthlyTotal = monthlyTickets.length;

        // 3. Monthly Average (Total / Days passed in month)
        const daysPassed = now.getDate();
        const monthlyAverage = (monthlyTotal / daysPassed).toFixed(1);

        // 4. Mobile App Specifics (Monthly)
        const mobileAppTickets = monthlyTickets.filter(t => 
            (t.Type || "").toString().toUpperCase().includes("MOBILE APP")
        );
        const mobileTotal = mobileAppTickets.length;
        const mobileAverage = (mobileTotal / daysPassed).toFixed(1);

        // Update the UI (Ensure these IDs exist in your HTML stat cards)
        document.getElementById('stat-daily-avg').innerText = dailyCount; // Current Daily
        document.getElementById('stat-monthly-total').innerText = monthlyTotal;
        document.getElementById('stat-mobile-avg').innerText = mobileAverage;

        fetch(WEB_APP_URL)
            .then(response => response.json())
            .then(data => {
                cachedTickets = data.tickets;
                populateTable(cachedTickets.slice(-50).reverse());
                
                // ADD THIS LINE HERE
                updateSummary(cachedTickets); 
        });

    }
 

    // Initial Load
    loadData();
