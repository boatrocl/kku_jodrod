/* =============================================================
   KKU JODROD – APPLICATION LOGIC (RESPONSIVE MOBILE & PC)
   ============================================================= */

// --- Global App State ---
let map;
let userMarker = null;
let userLat = null;
let userLng = null;
let allSpots = [];
let currentFilteredSpots = [];
let selectedSpotId = null;
const markers = {};

// ค่าพิกัดใจกลางมหาวิทยาลัยขอนแก่น (จุดอ้างอิงเริ่มต้น)
const KKU_CENTER = [16.4735, 102.8235];
const DEFAULT_ZOOM = 15;

// Bottom sheet state (ใช้บนมือถือ): 'collapsed' | 'half' | 'expanded'
let sheetState = 'collapsed';

/* =============================================================
   1. MAP INITIALIZATION
   ============================================================= */
function initMap() {
    // บน PC ขยับจุดกึ่งกลางไปทางซ้ายเล็กน้อย เพื่อให้ มข. อยู่กึ่งกลางพื้นที่แผนที่เปิดโล่ง
    const initialLng = window.innerWidth > 768 ? KKU_CENTER[1] - 0.0035 : KKU_CENTER[1];

    map = L.map('map', {
        zoomControl: false,
        attributionControl: true
    }).setView([KKU_CENTER[0], initialLng], DEFAULT_ZOOM);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 19
    }).addTo(map);

    // เมื่อแตะที่พื้นแผนที่ว่างๆ บนมือถือ ให้ย่อ bottom sheet ลง
    map.on('click', () => {
        if (window.innerWidth <= 768 && sheetState !== 'collapsed') {
            setSheetState('collapsed');
        }
    });
}

/* =============================================================
   2. CUSTOM ICONS
   ============================================================= */
function createParkingIcon(type, isActive = false) {
    const cls = type === 'main' ? 'main' : 'alt';
    const activeCls = isActive ? 'active' : '';
    const icon = type === 'main' ? '🚗' : '🅿️';

    return L.divIcon({
        className: '',
        html: `<div class="custom-marker ${cls} ${activeCls}"><span class="marker-icon">${icon}</span></div>`,
        iconSize: [38, 38],
        iconAnchor: [6, 38],
        popupAnchor: [13, -38]
    });
}

function createUserIcon() {
    return L.divIcon({
        className: '',
        html: `
            <div class="user-marker-container">
                <div class="user-marker-pulse"></div>
                <div class="user-marker-core"></div>
            </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    });
}

/* =============================================================
   3. DATA LOADING & RENDERING
   ============================================================= */
async function loadParkingData() {
    try {
        const res = await fetch('data/spots.json');
        allSpots = await res.json();
        currentFilteredSpots = [...allSpots];
        renderSpots(currentFilteredSpots);

        // ค่าเริ่มต้น: เลือกจุดแรกเพื่อให้มีการแสดง Preview บนหน้าจอ
        if (allSpots.length > 0) {
            selectSpot(allSpots[0], false);
        }
    } catch (err) {
        console.error('ไม่สามารถโหลดข้อมูลจุดจอดรถได้:', err);
        document.getElementById('parking-list').innerHTML = `
            <li style="color: #DC2626; padding: 12px; text-align: center; font-size: 0.85rem;">
                ⚠️ ไม่สามารถโหลดข้อมูลจุดจอดรถได้ กรุณาเปิดผ่าน Live Server
            </li>
        `;
    }
}

function renderSpots(spots) {
    const listContainer = document.getElementById('parking-list');
    listContainer.innerHTML = '';

    // ล้างหมุดเดิมทั้งหมด (ยกเว้น user marker)
    Object.keys(markers).forEach(id => {
        if (id !== 'user') {
            map.removeLayer(markers[id]);
            delete markers[id];
        }
    });

    // อัปเดตตัวเลขจำนวนจุดจอด
    const countBadge = document.getElementById('spots-count-badge');
    if (countBadge) countBadge.textContent = `พบ ${spots.length} จุด`;

    if (spots.length === 0) {
        listContainer.innerHTML = `
            <li style="text-align: center; padding: 24px 10px; color: #64748B; font-size: 0.85rem;">
                🔍 ไม่พบจุดจอดรถที่ตรงกับคำค้นหา
            </li>
        `;
        return;
    }

    spots.forEach(spot => {
        // --- 1. สร้าง Marker บนแผนที่ ---
        const isSelected = spot.id === selectedSpotId;
        const marker = L.marker([spot.lat, spot.lng], {
            icon: createParkingIcon(spot.type, isSelected)
        }).addTo(map);

        marker.on('click', () => {
            selectSpot(spot, true);
        });

        markers[spot.id] = marker;

        // --- 2. คำนวณระยะทางและเวลาเดิน ---
        const distInfo = calculateDistanceInfo(spot.lat, spot.lng);

        // --- 3. สร้าง Card สำหรับรายการใน Bottom Sheet / Sidebar ---
        const card = document.createElement('li');
        card.className = `parking-card ${isSelected ? 'active' : ''}`;
        card.dataset.id = spot.id;

        const badgeClass = spot.type === 'main' ? 'badge-main' : 'badge-alt';
        const badgeLabel = spot.type === 'main' ? '⚠️ คนเยอะ' : '✅ ว่างง่าย';

        card.innerHTML = `
            <div class="card-top">
                <h3 class="card-name">${spot.name}</h3>
                <span class="card-badge ${badgeClass}">${badgeLabel}</span>
            </div>
            <p class="card-desc">${spot.desc}</p>
            <div class="card-footer">
                <div class="card-distance-group">
                    <span>📏 ${distInfo.distanceText}</span>
                    ${distInfo.walkText ? `<span>• 🚶 ${distInfo.walkText}</span>` : ''}
                </div>
                <a href="${getGoogleMapsUrl(spot)}" target="_blank" rel="noopener" class="btn-card-nav" onclick="event.stopPropagation()">
                    🧭 นำทาง
                </a>
            </div>
        `;

        card.addEventListener('click', () => {
            selectSpot(spot, true);
        });

        listContainer.appendChild(card);
    });
}

/* =============================================================
   4. SPOT SELECTION & PREVIEW
   ============================================================= */
function selectSpot(spot, shouldFlyMap = true) {
    selectedSpotId = spot.id;

    // อัปเดตสไตล์ของ Marker บนแผนที่
    Object.keys(markers).forEach(id => {
        if (id !== 'user') {
            const currentSpot = allSpots.find(s => s.id === Number(id));
            if (currentSpot) {
                markers[id].setIcon(createParkingIcon(currentSpot.type, Number(id) === spot.id));
            }
        }
    });

    // เลื่อนแผนที่โดยปรับ Offset ให้เหมาะสม
    if (shouldFlyMap) {
        if (window.innerWidth <= 768) {
            // บนมือถือ: ขยับ lat ขึ้น เพื่อให้หมุดอยู่ครึ่งบนของจอ ไม่ถูก Bottom Sheet บัง
            map.flyTo([spot.lat - 0.0035, spot.lng], 16.5, { duration: 1.0 });
        } else {
            // บน PC: ขยับ lng ไปทางซ้ายเล็กน้อย เพื่อให้หมุดอยู่กึ่งกลางพื้นที่แผนที่เปิดโล่ง (หลบ Sidebar ซ้าย 410px)
            map.flyTo([spot.lat, spot.lng - 0.0045], 16, { duration: 1.0 });
        }
    }

    // ไฮไลต์ Card ในรายการ
    document.querySelectorAll('.parking-card').forEach(c => c.classList.remove('active'));
    const targetCard = document.querySelector(`.parking-card[data-id="${spot.id}"]`);
    if (targetCard) {
        targetCard.classList.add('active');
        targetCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // แสดง Quick Preview Box
    showSelectedPreview(spot);

    // หากอยู่บนมือถือและ Bottom Sheet ถูกพับอยู่ ให้เปิดขึ้นมาที่ระดับ 'half'
    if (window.innerWidth <= 768 && sheetState === 'collapsed') {
        setSheetState('half');
    }
}

function showSelectedPreview(spot) {
    const previewContainer = document.getElementById('selected-preview');
    if (!previewContainer) return;

    const distInfo = calculateDistanceInfo(spot.lat, spot.lng);
    const badgeClass = spot.type === 'main' ? 'badge-main' : 'badge-alt';
    const badgeLabel = spot.type === 'main' ? '⚠️ คนเยอะ' : '✅ ว่างง่าย';

    previewContainer.innerHTML = `
        <div class="preview-card">
            <div class="preview-top">
                <div class="preview-title">${spot.name}</div>
                <span class="card-badge ${badgeClass}">${badgeLabel}</span>
            </div>
            <div class="preview-desc">${spot.desc}</div>
            <div class="preview-metrics">
                <span class="metric-pill pill-dist">📏 ${distInfo.distanceText}</span>
                ${distInfo.walkText ? `<span class="metric-pill pill-walk">🚶 ประมาณ ${distInfo.walkText}</span>` : ''}
            </div>
            <a href="${getGoogleMapsUrl(spot)}" target="_blank" rel="noopener" class="btn-navigate-primary">
                <span>🧭 นำทางทันที (Google Maps)</span>
            </a>
        </div>
    `;

    previewContainer.classList.remove('hidden');

    // อัปเดตข้อความหัวข้อ
    const sheetStatus = document.getElementById('sheet-status');
    if (sheetStatus) {
        sheetStatus.textContent = `เลือก: ${spot.name}`;
    }
}

/* =============================================================
   5. BOTTOM SHEET CONTROLLER (Mobile Gestures & State)
   ============================================================= */
function initBottomSheet() {
    const sheet = document.getElementById('bottom-sheet');
    const handle = document.getElementById('sheet-handle');
    const header = document.getElementById('sheet-header');
    const toggleBtn = document.getElementById('sheet-toggle-btn');

    // สลับระดับความสูงเฉพาะบนมือถือ
    const toggleHandler = (e) => {
        if (window.innerWidth > 768) return; // บน PC ไม่ต้องสลับระดับความสูง

        if (e.target.closest('#sheet-toggle-btn') || e.target.closest('#sheet-handle') || e.target.closest('#sheet-header')) {
            if (sheetState === 'collapsed') {
                setSheetState('half');
            } else if (sheetState === 'half') {
                setSheetState('expanded');
            } else {
                setSheetState('collapsed');
            }
        }
    };

    if (handle) handle.addEventListener('click', toggleHandler);
    if (header) header.addEventListener('click', toggleHandler);
    if (toggleBtn) toggleBtn.addEventListener('click', toggleHandler);

    // Touch Swipe Detection สำหรับมือถือ
    let startY = 0;

    sheet.addEventListener('touchstart', (e) => {
        if (window.innerWidth > 768) return;
        startY = e.touches[0].clientY;
    }, { passive: true });

    sheet.addEventListener('touchend', (e) => {
        if (window.innerWidth > 768) return;
        const endY = e.changedTouches[0].clientY;
        const diffY = startY - endY;

        // สไลด์ขึ้นแรง (> 45px)
        if (diffY > 45) {
            if (sheetState === 'collapsed') setSheetState('half');
            else if (sheetState === 'half') setSheetState('expanded');
        }
        // สไลด์ลงแรง (< -45px)
        else if (diffY < -45) {
            if (sheetState === 'expanded') setSheetState('half');
            else if (sheetState === 'half') setSheetState('collapsed');
        }
    }, { passive: true });
}

function setSheetState(state) {
    if (window.innerWidth > 768) return; // บน PC ความสูงควบคุมผ่าน CSS Flexbox

    const sheet = document.getElementById('bottom-sheet');
    const fabGroup = document.querySelector('.fab-group');
    if (!sheet) return;

    sheetState = state;
    sheet.classList.remove('collapsed', 'half', 'expanded');
    sheet.classList.add(state);

    // ขยับปุ่ม FAB ลอยหลบ Bottom Sheet ตามระดับความสูงบนมือถือ
    if (fabGroup) {
        if (state === 'collapsed') {
            fabGroup.style.bottom = '110px';
        } else if (state === 'half') {
            fabGroup.style.bottom = 'calc(46vh + 16px)';
        } else {
            fabGroup.style.bottom = 'calc(82vh + 16px)';
        }
    }
}

/* =============================================================
   6. GEOLOCATION & DISTANCE CALCULATION
   ============================================================= */
function locateUser() {
    const fab = document.getElementById('fab-locate');
    const gpsBadge = document.getElementById('gps-badge');
    const gpsText = document.getElementById('gps-text');

    if (!navigator.geolocation) {
        alert('อุปกรณ์หรือเบราว์เซอร์นี้ไม่รองรับ Geolocation');
        return;
    }

    fab.classList.add('loading');
    if (gpsText) gpsText.textContent = 'กำลังหาพิกัด...';

    navigator.geolocation.getCurrentPosition(
        (pos) => {
            userLat = pos.coords.latitude;
            userLng = pos.coords.longitude;

            fab.classList.remove('loading');
            fab.classList.add('active');

            if (gpsBadge) gpsBadge.classList.add('active');
            if (gpsText) gpsText.textContent = 'GPS พร้อมใช้งาน';

            // วางหรือย้ายหมุดตำแหน่งผู้ใช้
            if (userMarker) {
                userMarker.setLatLng([userLat, userLng]);
            } else {
                userMarker = L.marker([userLat, userLng], {
                    icon: createUserIcon(),
                    zIndexOffset: 1200
                }).addTo(map);
                userMarker.bindPopup('<b>📍 คุณอยู่ที่นี่</b>');
            }

            // เลื่อนแผนที่ไปหาผู้ใช้
            const offsetLng = window.innerWidth > 768 ? -0.0035 : 0;
            map.flyTo([userLat, userLng + offsetLng], 16, { duration: 1.2 });

            // แสดงปุ่มลอย "⚡ นำทางจุดใกล้สุด"
            const fabNearest = document.getElementById('fab-nearest');
            if (fabNearest) fabNearest.classList.remove('hidden');

            // จัดเรียงจุดจอดตามระยะทางจากผู้ใช้ และ Render ใหม่
            sortSpotsByDistance();
        },
        (err) => {
            fab.classList.remove('loading');
            if (gpsText) gpsText.textContent = 'GPS ไม่พร้อม';
            console.warn('Geolocation error:', err.message);
            alert('ไม่สามารถระบุตำแหน่งได้ กรุณาอนุญาตการเข้าถึงพิกัด GPS ในการตั้งค่าเบราว์เซอร์');
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
}

// สูตรคำนวณระยะทาง Haversine
function haversineDistanceMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000; // รัศมีโลกเป็นเมตร
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
}

function calculateDistanceInfo(lat, lng) {
    if (!userLat || !userLng) {
        return { distanceText: 'เปิด GPS เพื่อดูระยะ', walkText: '' };
    }

    const meters = haversineDistanceMeters(userLat, userLng, lat, lng);
    const distanceText = meters < 1000 ? `${meters} ม.` : `${(meters / 1000).toFixed(1)} กม.`;

    // คำนวณเวลาเดินโดยประมาณ (เฉลี่ย 75 เมตรต่อนาที)
    const walkMinutes = Math.max(1, Math.round(meters / 75));
    const walkText = walkMinutes < 60 ? `${walkMinutes} นาที` : `${Math.round(walkMinutes / 60)} ชม.`;

    return { distanceText, walkText, meters };
}

function sortSpotsByDistance() {
    if (!userLat || !userLng) return;

    currentFilteredSpots.sort((a, b) => {
        const distA = haversineDistanceMeters(userLat, userLng, a.lat, a.lng);
        const distB = haversineDistanceMeters(userLat, userLng, b.lat, b.lng);
        return distA - distB;
    });

    renderSpots(currentFilteredSpots);

    // เลือกจุดที่ใกล้ที่สุดโดยอัตโนมัติ
    if (currentFilteredSpots.length > 0) {
        selectSpot(currentFilteredSpots[0], false);
    }
}

function selectNearestSpot() {
    if (!userLat || !userLng) {
        locateUser();
        return;
    }
    sortSpotsByDistance();
    if (currentFilteredSpots.length > 0) {
        selectSpot(currentFilteredSpots[0], true);
        if (window.innerWidth <= 768) {
            setSheetState('half');
        }
    }
}

function getGoogleMapsUrl(spot) {
    if (userLat && userLng) {
        return `https://www.google.com/maps/dir/?api=1&origin=${userLat},${userLng}&destination=${spot.lat},${spot.lng}`;
    }
    return `https://www.google.com/maps/dir/?api=1&destination=${spot.lat},${spot.lng}`;
}

/* =============================================================
   7. SEARCH & FILTER CHIPS
   ============================================================= */
function initSearchAndFilters() {
    const searchInput = document.getElementById('search-input');
    const clearBtn = document.getElementById('btn-clear-search');
    const chips = document.querySelectorAll('.chip');

    let activeFilterType = 'all';

    function applyFilter() {
        const keyword = searchInput.value.trim().toLowerCase();

        // แสดง/ซ่อนปุ่มเคลียร์ข้อความ
        if (keyword.length > 0) {
            clearBtn.classList.remove('hidden');
        } else {
            clearBtn.classList.add('hidden');
        }

        currentFilteredSpots = allSpots.filter(spot => {
            // กรองตามประเภท
            let matchType = true;
            if (activeFilterType === 'alternative') matchType = spot.type === 'alternative';
            else if (activeFilterType === 'main') matchType = spot.type === 'main';

            // กรองตามคำค้นหา
            const matchKeyword = !keyword ||
                spot.name.toLowerCase().includes(keyword) ||
                spot.desc.toLowerCase().includes(keyword) ||
                spot.landmark.toLowerCase().includes(keyword);

            return matchType && matchKeyword;
        });

        // หากเลือก "ใกล้ฉันที่สุด" ให้จัดเรียงตามระยะทาง
        if (activeFilterType === 'nearest' && userLat && userLng) {
            currentFilteredSpots.sort((a, b) => {
                return haversineDistanceMeters(userLat, userLng, a.lat, a.lng) -
                       haversineDistanceMeters(userLat, userLng, b.lat, b.lng);
            });
        }

        renderSpots(currentFilteredSpots);

        // หากค้นหาแล้วเจอรายการ ให้เลือกจุดแรก
        if (currentFilteredSpots.length > 0) {
            selectSpot(currentFilteredSpots[0], true);
        }
    }

    // Event ค้นหาพิมพ์ข้อความ
    searchInput.addEventListener('input', applyFilter);

    // Event ปุ่มเคลียร์ข้อความ
    clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        clearBtn.classList.add('hidden');
        applyFilter();
        searchInput.focus();
    });

    // Event เลือก Filter Chip
    chips.forEach(chip => {
        chip.addEventListener('click', () => {
            chips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');

            activeFilterType = chip.dataset.filter;

            // หากกดชิป "ใกล้ฉันที่สุด" แต่ยังไม่ได้เปิด GPS ให้ขอพิกัดก่อน
            if (activeFilterType === 'nearest' && (!userLat || !userLng)) {
                locateUser();
            }

            applyFilter();
        });
    });
}

/* =============================================================
   8. RESET KKU MAP VIEW
   ============================================================= */
function resetMapCenter() {
    const offsetLng = window.innerWidth > 768 ? -0.0035 : 0;
    map.flyTo([KKU_CENTER[0], KKU_CENTER[1] + offsetLng], DEFAULT_ZOOM, {
        duration: 1.0
    });
    if (window.innerWidth <= 768) {
        setSheetState('collapsed');
    }
}

/* =============================================================
   9. INITIALIZE ON DOM READY
   ============================================================= */
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    loadParkingData();
    initBottomSheet();
    initSearchAndFilters();
});