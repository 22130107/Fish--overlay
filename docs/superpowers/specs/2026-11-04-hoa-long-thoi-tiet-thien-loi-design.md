# Thiết Kế Chi Tiết: Đặc Quyền Điều Khiển Thời Tiết & Triệu Hồi Thiên Lôi Cho Cảnh Giới Hóa Long

## 1. Tổng Quan & Mục Tiêu

Tính năng thiết lập đặc quyền tối thượng dành riêng cho các chú cá đã đạt cảnh giới **Phi Thăng Hóa Long** (kích thước $\ge 82.0\text{ cm}$ hoặc đã vượt qua Cửu Trọng Lôi Kiếp). 

Trước đây, bất kỳ người xem nào cũng có thể đổi thời tiết hồ cá bằng các từ khóa bình luận thông thường. Nhằm nâng cao giá trị của quá trình tu luyện và tạo động lực cho khán giả tích cực tương tác, chăm sóc cá đạt đỉnh cao tu vi, toàn bộ quyền năng:
1. **Hô mưa gọi gió (Điều khiển thời tiết)**.
2. **Hiệu triệu Thiên Lôi (Sấm sét giáng lâm, khuấy đảo mặt nước, làm đàn cá giật mình)**.

Sẽ được chuyển đổi thành **đặc quyền độc nhất của cảnh giới Hóa Long (Thái Cổ Chân Long)**.

---

## 2. Tiêu Chí Xác Định Cảnh Giới Hóa Long

Một người xem được hệ thống công nhận sở hữu đặc quyền Hóa Long khi đối tượng cá tương ứng trong `viewerFish` thỏa mãn một trong các điều kiện:
- `fish.sizeCm >= 82.0`
- `fish.passed82 === true` (đã vượt qua Vũ Môn Lôi Kiếp mốc 82cm)

Hàm kiểm tra helper trên server:
```javascript
function isDragonFish(fish) {
  return Boolean(fish && (Number(fish.sizeCm) >= 82.0 || fish.passed82));
}
```

---

## 3. Quy Tắc & Xử Lý Lệnh Từ Khán Giả (`live-server/server.mjs`)

### 3.1. Lệnh Đổi Thời Tiết (`WEATHER_KEYWORDS`)
- **Từ khóa nhận diện:**
  - Mưa: `mưa`, `rain`, `mua`
  - Nắng: `nắng`, `nang`, `sunny`
  - Hoàng hôn: `hoàng hôn`, `hoang hon`, `sunset`
  - Ánh trăng / đêm: `trăng`, `toi`, `tối`, `moon`, `moonlight`, `đêm`
  - Sương mù: `sương mù`, `suong mu`, `mist`
  - Trong xanh: `trong xanh`, `clear`
- **Quy tắc phân quyền:**
  - Nếu người xem **ĐÃ HÓA LONG**:
    - Hệ thống chuyển đổi thời tiết hồ cá sang preset tương ứng.
    - Phát thông điệp WebSocket: `{ t: 'weather', preset: item.preset, user: name }`.
    - Giọng AI tuyên cáo: *"Thái Cổ Chân Long của đạo hữu [Tên] hô mưa gọi gió, biến hóa càn khôn sang tiết trời [Tên thời tiết]!"*
    - Ghi log hệ thống: `🌤️ 🐉 Thái Cổ Chân Long [Tên] đổi thời tiết: [preset]`.
  - Nếu người xem **CHƯA HÓA LONG** ($< 82.0\text{ cm}$):
    - Hệ thống bỏ qua lệnh đổi thời tiết.
    - Ghi log bảng điều khiển: `⚠️ [Tên] chưa đạt cảnh giới Hóa Long (hiện tại X cm < 82cm), chưa thể đổi thời tiết.` (Không phát âm thanh TTS để tránh spam giọng đọc).

### 3.2. Lệnh Triệu Hồi Thiên Lôi (`THIEN_LOI_KEYWORDS`)
- **Từ khóa nhận diện:**
  - `thiên lôi`, `thien loi`, `sấm sét`, `sam set`, `gọi sét`, `goi set`, `lôi phạt`, `loi phat`, `sét đánh`, `set danh`, `sét`, `lôi giáng`
- **Thời gian hồi chiêu (Cooldown):**
  - Giới hạn 15 giây đối với mỗi người dùng (tránh việc spam liên tục làm chớp giật màn hình).
- **Quy tắc phân quyền:**
  - Nếu người xem **ĐÃ HÓA LONG**:
    - Cập nhật thời gian thi triển gần nhất (`userLastLightning.set(id, now)`).
    - Phát thông điệp WebSocket: `{ t: 'dragon_lightning', user: name, id: fish.id }`.
    - Kích hoạt sự kiện tán loạn đàn cá: `{ t: 'scatter', user: name }`.
    - Giọng AI tuyên cáo: *"Thái Cổ Chân Long của đạo hữu [Tên] hiệu triệu Thiên Lôi giáng thế, uy chấn bát hoang!"*
    - Ghi log: `⚡ 🐉 Thái Cổ Chân Long [Tên] triệu hoán Thiên Lôi!`.
  - Nếu người xem **CHƯA HÓA LONG**:
    - Bỏ qua lệnh và ghi log từ chối.

---

## 4. Hiệu Ứng Đồ Họa & Tương Tác Mặt Hồ (`src/`)

### 4.1. Nâng Cấp Bộ Dựng Sét (`src/fish-renderer.ts` & `src/lightning-effect.ts`)
- Bộ dựng `fish-renderer.ts` được điều chỉnh để luôn cập nhật và vẽ các tia sét chủ động (`lightning.getBolts()`) và chớp sáng màn hình (`lightning.renderFlash()`) ngay cả khi hồ cá không trong trạng thái Độ Kiếp toàn màn hình (`tribulation.active === false`).

### 4.2. Xử Lý Sự Kiện Client (`src/live-client.ts`)
Khi client nhận bản tin `{ t: 'dragon_lightning', user, id }`:
1. **Tìm tọa độ mục tiêu:**
   - Ưu tiên tìm vị trí thực tế của chú Chân Long mang `ownerId === id` hoặc tên tương ứng.
   - Nếu Chân Long đang bơi ngoài khung nhìn, chọn tâm hồ kèm độ lệch ngẫu nhiên.
2. **Kích hoạt tia sét & chớp sáng:**
   - Gọi `fishRenderer.lightning.triggerBurstFlash()` tạo ánh sáng chớp vàng rực rỡ toàn hồ.
   - Gọi `fishRenderer.lightning.spawnBolt(targetPos, 95)` giáng tia lôi điện kim sắc / lam tím đa nhánh từ đỉnh màn hình xuống mục tiêu.
3. **Kích hoạt sóng xung kích:**
   - Gọi `school.ripples.trigger("touch", targetPos)` 3 đợt liên tiếp (ngay lập tức, sau 150ms, sau 300ms) tạo làn sóng nước dữ dội.
4. **Hành vi đàn cá:**
   - Kích hoạt phân tán bầy cá (`school.frighten(targetPos)` / `scatter`) khiến cá nhỏ giật mình tản ra xa vị trí sét đánh.
5. **Thông báo trực quan:**
   - Đẩy thông báo nổi bật góc màn hình: `⚡ THÁI CỔ CHÂN LONG [TÊN] HIỆU TRIỆU THIÊN LÔI GIÁNG LÂM! ⚡`.

---

## 5. Cập Nhật Cảnh Giới Tu Tiên (`src/tu-tien.ts`)

- Cập nhật mô tả cảnh giới Hóa Long (`calculateTuTienRank`):
  - `desc`: `"Cá chép vượt long môn, đắc đạo thành Chân Long phi thăng tiên giới, hô mưa gọi gió, chưởng quản thời tiết và thiên lôi."`
- Cập nhật câu đọc thoại AI khi tra cứu `size` cá $\ge 82\text{ cm}$ (`getTuTienVoiceLine`):
  - `"Kính báo thiên hạ! Linh ngư của đạo hữu [Tên] đã đạt [Số cm] xăng ti mét, đắc đạo cảnh giới Phi Thăng Hóa Long, cá chép hóa Chân Long, chưởng quản thời tiết và hiệu triệu thiên lôi!"`

---

## 6. Giao Diện Bảng Điều Khiển Live (`live-server/control.html`)

- Thêm nút test nhanh: **`[⚡ Test Thiên Lôi (Chân Long)]`** gửi lệnh `{ cmd: 'dragon_lightning', name: 'Thái Cổ Chân Long' }` để streamer test nhanh trực tiếp.
- Bổ sung ghi chú dưới các nút đổi thời tiết: `(Chỉ kích hoạt từ chat khi đạt Hóa Long >= 82cm)`.

---

## 7. Kế Hoạch Kiểm Thử Tự Động (Testing Strategy)

1. **Unit Test Phân Quyền Thời Tiết & Thiên Lôi:**
   - Kiểm tra viewer thường ($20\text{ cm} \rightarrow 81.9\text{ cm}$) gõ từ khóa thời tiết / thiên lôi $\rightarrow$ Không gửi event `weather` hoặc `dragon_lightning`.
   - Kiểm tra viewer Hóa Long ($\ge 82.0\text{ cm}$) gõ từ khóa $\rightarrow$ Kích hoạt thành công.
   - Kiểm tra cooldown 15s của lệnh gọi sét.
2. **Unit Test Hiệu Ứng Sét Độc Lập:**
   - Kiểm tra `fishRenderer` vẽ và giải phóng tia sét khi `tribulation.active === false`.
3. **Tu Tiên Rank Test:**
   - Kiểm tra mô tả và voice line của mốc $\ge 82\text{ cm}$ chứa thông tin thời tiết và thiên lôi.
