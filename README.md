# KKU Parking Alternative – Sprint 2

ระบบต้นแบบแนะนำแหล่งที่จอดรถทางเลือกภายในมหาวิทยาลัยขอนแก่น

## 🆕 สิ่งที่เพิ่มใน Sprint 2
- **Geolocation**: ระบุตำแหน่งผู้ใช้จริง (ปุ่มใน Sidebar + ปุ่มลอยบนแผนที่)
- **ระยะทางอัตโนมัติ**: คำนวณระยะทางจากผู้ใช้ไปยังแต่ละจุดจอดรถ (Haversine)
- **ปุ่มนำทาง**: เปิด Google Maps Directions จากตำแหน่งผู้ใช้ไปยังจุดจอดรถ
- **ค้นหา & กรอง**: พิมพ์ชื่อ หรือเลือกประเภท (ทางเลือก / หลัก)
- **UI ใหม่ทั้งหมด**: Modern Card, Gradient Header, Glassmorphism, Custom Marker, Pulse Animation

## วิธีรัน
1. เปิดด้วย **VS Code + Live Server** (เนื่องจาก fetch() ไฟล์ JSON)
2. กดปุ่ม **"📍 ระบุตำแหน่งของฉัน"** แล้วอนุญาตให้เข้าถึง GPS
3. คลิกการ์ดด้านซ้ายเพื่อดูตำแหน่งบนแผนที่

## เทคโนโลยี
- Leaflet.js + OpenStreetMap
- Geolocation API
- Haversine Formula (ระยะทาง)
- Vanilla JS / HTML5 / CSS3