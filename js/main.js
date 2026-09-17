/* =============================================================
   GLOBAL STATE
   ============================================================= */
let map;
let userMarker    = null;
let userLat       = null;
let userLng       = null;
let allSpots      = [];
const markers     = {};
let activeCardId  = null;

/* =============================================================
   1. INIT MAP
   ============================================================= */
function initMap() {
    map = L.map('map', {
        zoomControl: false          // ย้าย zoom ไปมุมขวาล่างเอง
    }).setView([16.4728, 102.8237], 15);

    L.control.zoom({ position: 'bottomleft' }).addTo(map);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);
}

/* =============================================================
   2. CUSTOM MARKERS (DivIcon สวยๆ)
   ============================================================= */
function createParkingIcon(type) {
    const cls  = type === 'main' ? 'main' : 'alt';
    const icon = type === 'main' ? '🚗' : '🅿️';
    return L.divIcon({
        className: '',                      // ล้าง default
        html: `<div class="custom-marker ${cls}"><span class="marker-icon">${icon}</span></div>`,
        iconSize:   [36, 36],
        iconAnchor: [4, 36],                // ชี้ที่ปลายหมุด
        popupAnchor:[14, -36]
    });
}

function createUserIcon() {
    return L.divIcon({
        className: '',
        html: '<div class="user-marker"></div>',
        iconSize:   [20, 20],
        iconAnchor: [10, 10]
    });
}

/* =============================================================
   3. LOAD DATA & RENDER
   ============================================================= */
async function loadParkingData() {
    try {
        const res  = await fetch('data/spots.json');
        allSpots   = await res.json();
        renderAll(allSpots);
    } catch (err) {
        console.error('โหลดข้อมูลไม่ได้:', err);
        document.getElementById('parking-list').innerHTML =
            '<p style="color:red;padding:12px;">ไม่สามารถโหลดข้อมูลได้ กรุณาเปิดผ่าน Live Server</p>';
    }
}

function renderAll(spots) {
    const list = document.getElementById('parking-list');
    list.innerHTML = '';

    // ลบ marker เก่า (ยกเว้น user)
    Object.keys(markers).forEach(id => {
        if (id !== 'user') {
            map.removeLayer(markers[id]);
            delete markers[id];
        }
    });

    spots.forEach(spot => {
        // ---- Marker ----
        const marker = L.marker([spot.lat, spot.lng], {
            icon: createParkingIcon(spot.type)
        }).addTo(map);

        const statusColor = spot.type === 'main' ? 'var(--warning)' : 'var(--success)';
        marker.bindPopup(`
            <div class="popup-title">${spot.name}</div>
            <div>${spot.description}</div>
            <div class="popup-status" style="color:${statusColor}">${spot.status}</div>
        `);
        markers[spot.id] = marker;

        // ---- Card ----
        const dist = getDistanceText(spot.lat, spot.lng);
        const card = document.createElement('li');
        card.className = `parking-card type-${spot.type}`;
        card.dataset.id = spot.id;
        card.innerHTML = `
            <div class="card-header">
                <h3>${spot.name}</h3>
                <span class="badge ${spot.type === 'main' ? 'badge-crowded' : 'badge-available'}">
                    ${spot.type === 'main' ? '⚠️ แออัด' : '✅ ว่าง'}
                </span>
            </div>
            <p class="card-desc">${spot.description}</p>
            <div class="card-footer">
                <span class="badge badge-distance" id="dist-${spot.id}">
                    📏 ${dist}
                </span>
                <a class="btn-navigate ${userLat ? '' : 'hidden'}"
                   id="nav-${spot.id}"
                   href="https://www.google.com/maps/dir/?api=1&destination=${spot.lat},${spot.lng}"
                   target="_blank"
                   rel="noopener">
                    🧭 นำทาง
                </a>
            </div>
        `;

        card.addEventListener('click', (e) => {
            if (e.target.closest('.btn-navigate')) return;   // ไม่ fly ถ้ากดปุ่มนำทาง
            flyToSpot(spot);
        });

        list.appendChild(card);
    });
}

/* =============================================================
   4. GEOLOCATION – ระบุตำแหน่งผู้ใช้
   ============================================================= */
function locateUser() {
    const btn    = document.getElementById('btn-locate');
    const status = document.getElementById('location-status');

    if (!navigator.geolocation) {
        status.textContent = '❌ เบราว์เซอร์ไม่รองรับ Geolocation';
        status.className   = 'location-status error';
        return;
    }

    // UI loading
    btn.classList.add('loading');
    btn.querySelector('.btn-locate-text').textContent = 'กำลังระบุตำแหน่ง...';
    status.textContent = '';

    navigator.geolocation.getCurrentPosition(
        (pos) => {
            userLat = pos.coords.latitude;
            userLng = pos.coords.longitude;

            // วาง / ย้าย marker
            if (userMarker) {
                userMarker.setLatLng([userLat, userLng]);
            } else {
                userMarker = L.marker([userLat, userLng], {
                    icon: createUserIcon(),
                    zIndexOffset: 1000
                }).addTo(map);
                userMarker.bindPopup('<b>📍 ตำแหน่งของคุณ</b>');
            }

            map.flyTo([userLat, userLng], 16, { duration: 1.2 });

            // UI success
            btn.classList.remove('loading');
            btn.querySelector('.btn-locate-text').textContent = 'ตำแหน่งของฉัน ✓';
            status.textContent = `Lat ${userLat.toFixed(5)}, Lng ${userLng.toFixed(5)}`;
            status.className   = 'location-status success';

            // อัปเดตการ์ดทุกรายการ
            refreshCardsAfterLocate();
        },
        (err) => {
            btn.classList.remove('loading');
            btn.querySelector('.btn-locate-text').textContent = 'ระบุตำแหน่งของฉัน';
            status.textContent = '❌ ไม่สามารถระบุตำแหน่งได้ (กรุณาเปิด GPS)';
            status.className   = 'location-status error';
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
}

/* =============================================================
   5. DISTANCE CALCULATION (Haversine)
   ============================================================= */
function haversineKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 +
              Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
              Math.sin(dLng/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getDistanceText(lat, lng) {
    if (!userLat) return 'ระบุตำแหน่งก่อน';
    const km = haversineKm(userLat, userLng, lat, lng);
    return km < 1 ? `${Math.round(km * 1000)} ม.` : `${km.toFixed(1)} กม.`;
}

function refreshCardsAfterLocate() {
    allSpots.forEach(spot => {
        // อัปเดตระยะทาง
        const distEl = document.getElementById(`dist-${spot.id}`);
        if (distEl) distEl.innerHTML = `📏 ${getDistanceText(spot.lat, spot.lng)}`;

        // แสดงปุ่มนำทาง
        const navEl = document.getElementById(`nav-${spot.id}`);
        if (navEl) {
            navEl.classList.remove('hidden');
            navEl.href = `https://www.google.com/maps/dir/?api=1&origin=${userLat},${userLng}&destination=${spot.lat},${spot.lng}`;
        }
    });
}

/* =============================================================
   6. FLY TO SPOT & HIGHLIGHT CARD
   ============================================================= */
function flyToSpot(spot) {
    map.flyTo([spot.lat, spot.lng], 17, { duration: 1.2 });
    markers[spot.id].openPopup();

    // Highlight card
    document.querySelectorAll('.parking-card').forEach(c => c.classList.remove('active'));
    const card = document.querySelector(`.parking-card[data-id="${spot.id}"]`);
    if (card) {
        card.classList.add('active');
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

/* =============================================================
   7. SEARCH & FILTER
   ============================================================= */
function setupFilters() {
    const input  = document.getElementById('search-input');
    const select = document.getElementById('filter-type');

    function applyFilters() {
        const keyword = input.value.toLowerCase().trim();
        const type    = select.value;

        const filtered = allSpots.filter(s => {
            const matchType    = type === 'all' || s.type === type;
            const matchKeyword = !keyword ||
                s.name.toLowerCase().includes(keyword) ||
                s.description.toLowerCase().includes(keyword);
            return matchType && matchKeyword;
        });

        renderAll(filtered);
    }

    input.addEventListener('input', applyFilters);
    select.addEventListener('change', applyFilters);
}

/* =============================================================
   8. BOOT
   ============================================================= */
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    loadParkingData();
    setupFilters();
});