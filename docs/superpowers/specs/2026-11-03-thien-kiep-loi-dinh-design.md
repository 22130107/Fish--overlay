# Thiết Kế Chi Tiết: Sự Kiện Thiên Kiếp & Lôi Đình Độ Kiếp (Vượt Vũ Môn Hóa Long)

## 1. Tổng Quan & Mục Tiêu
Tính năng **Thiên Kiếp & Lôi Đình Độ Kiếp** là sự kiện tương tác thời gian thực cao trào trên TikTok LIVE dành cho game Hồ Cá Koi 3D Tu Tiên. Khi cá của một người xem đạt ngưỡng tu vi đỉnh cao, kiếp nạn sấm sét lôi đình sẽ giáng lâm xuống mặt hồ. Toàn thể người xem trong phòng live cùng chung tay tương tác (bình luận "HỘ PHÁP", thả tim, tặng quà) trong vòng 30 giây để giúp linh ngư vượt kiếp hóa rồng, tạo nên khoảnh khắc bùng nổ mắt xích cộng đồng và giữ chân khán giả.

---

## 2. Ngưỡng Kích Hoạt & Quản Lý Trạng Thái

### 2.1. Ngưỡng Kích Hoạt
Sự kiện diễn ra khi kích thước chú cá của một người xem chạm vào 2 mốc cảnh giới huyền thoại:
1. **Mốc 72.0 cm**: Đột phá **Độ Kiếp Kỳ** (Cửu Trọng Lôi Kiếp).
2. **Mốc 82.0 cm**: Cực hạn tu vi **Phi Thăng Hóa Long** (Thái Cổ Chân Long).

### 2.2. Cơ Chế Chống Lặp & Hàng Đợi (Queue)
- Mỗi chú cá chỉ kích hoạt lôi kiếp một lần duy nhất cho mỗi mốc (lưu cờ `passedTribulation72`, `passedTribulation82`).
- Nếu độ kiếp thất bại và bị trừ kích thước, khi ăn đủ thức ăn để đạt lại mốc đó thì mới kích hoạt lại.
- Tại một thời điểm, chỉ có **duy nhất 1 sự kiện Lôi Kiếp** diễn ra trên hồ. Nếu có cá khác đồng thời chạm mốc, hệ thống sẽ đưa vào hàng đợi (`tribulationQueue`) và tự động kích hoạt sau khi sự kiện hiện tại kết thúc 10 giây.

### 2.3. Cấu Trúc Dữ Liệu (`TribulationState`)
```typescript
export interface TribulationState {
  active: boolean;
  targetFishId: string;
  ownerName: string;
  ownerAvatar: string;
  targetRealm: "Độ Kiếp Kỳ" | "Phi Thăng Hóa Long";
  targetCm: number;
  timeLeft: number;          // Đếm ngược 30.0 giây
  requiredPower: number;     // Mốc 72cm: 40 điểm; Mốc 82cm: 60 điểm
  currentPower: number;      // Điểm tích lũy hiện tại
  contributors: Map<string, { name: string; avatar?: string; power: number }>;
  result: "ongoing" | "success" | "failed";
}
```

---

## 3. Quy Tắc Thu Nhận Lực Hộ Pháp (30 Giây)

Trong thời gian 30 giây lôi kiếp diễn ra:
1. **Bình luận (Chat):**
   - Bất kỳ bình luận nào chứa các từ khóa: `hộ pháp`, `ho phap`, `độ kiếp`, `do kiep`, `cố lên`, `co len`, `hóa rồng`, `hoa rong`, `lên`, `len` $\rightarrow$ Tăng **+1 điểm Hộ Pháp**.
   - Các bình luận thông thường khác: Tăng **+1 điểm Hộ Pháp**.
2. **Thả tim (Like):**
   - Mỗi đợt like gửi về từ viewer $\rightarrow$ Tăng **+1 điểm Hộ Pháp**.
3. **Tặng quà (Gift):**
   - Quà nhỏ (1 - 9 kim cương): Tăng **+5 đến +10 điểm Hộ Pháp**.
   - Quà vừa & lớn ($\ge 10$ kim cương): Tăng **+20 đến +50 điểm Hộ Pháp** (giúp lật ngược tình thế tức thì).
4. **Bảng Công Đức:**
   - Hệ thống tự động ghi nhận Top 3 người đóng góp nhiều điểm lực hộ pháp nhất để vinh danh trên bảng điều khiển trực tiếp.

---

## 4. Kịch Bản Thành Bại & Tác Động Lên Cá

### 4.1. Kịch Bản THÀNH CÔNG (`currentPower >= requiredPower` trong 30s)
- **Kết thúc thắng lợi ngay lập tức:** Không cần chờ hết 30s.
- **Tác động lên cá:**
  - Cá đột phá thành công, đánh dấu cờ `passedTribulation`.
  - Thân cá bung vầng hào quang Kim Sắc rực rỡ (`Golden Dragon Aura`).
  - Đạt mốc 82cm: Thân cá biến đổi vảy rồng lấp lánh, danh hiệu hiển thị vĩnh viễn: `🐉👑 Thái Cổ Chân Long`.
  - Thưởng nóng **+1.5 cm** kích thước, hồi phục đầy 100% thanh đói.
- **Phần thưởng toàn phòng Live:**
  - Tự động thả cơn mưa linh đan chúc mừng (30 viên) rơi khắp mặt hồ để toàn thể đàn cá cùng thưởng thức.
- **Giọng đọc AI tuyên cáo:**
  > *"Độ kiếp đại thành công! Nhờ công đức hộ pháp của toàn thể đạo hữu, linh ngư của [Tên] đã vượt qua thiên kiếp, đắc đạo hóa rồng, uy chấn thiên hạ!"*

### 4.2. Kịch Bản THẤT BẠI (Hết 30s mà `currentPower < requiredPower`)
- **Tác động lên cá:**
  - Tia đại lôi kiếp giáng trúng thân cá làm cá choáng váng trong 3 giây.
  - Thân cá bốc khói đen xám (*smoke particles*) trong 20 giây.
  - Hình phạt thương tích: Giảm nhẹ **-2.0 cm** kích thước, thanh đói tụt xuống mức nguy hiểm (20%) để viewer có động lực tiếp tục cho ăn bồi bổ và độ kiếp lại.
- **Giọng đọc AI chia buồn:**
  > *"Độ kiếp bất thành! Thiên uy quá mạnh, linh ngư của đạo hữu [Tên] bị thương tích nhẹ, giảm 2 xăng ti mét. Các đạo hữu hãy mau ban phát linh đan bồi bổ để sớm ngày tái chiến!"*

---

## 5. Hiệu Ứng Đồ Họa & Giao Diện (Visuals & Overlay)

### 5.1. Hiệu Ứng Canvas Mặt Hồ
1. **Bầu trời u ám & Ánh chớp (Ambient Darkening & Screen Flash):**
   - Khi kích hoạt, mặt nước tối dần tạo cảm giác mây đen cuồn cuộn.
   - Khi sét đánh, màn hình nháy sáng nhẹ trong 0.08s (`ctx.fillStyle = "rgba(255, 255, 255, 0.25)"`).
2. **Tia Sét Lôi Đình (*Procedural Lightning*):**
   - Vẽ các đường cong đa nhánh giáng từ cạnh trên màn hình trúng vị trí hoặc lân cận chú cá đang độ kiếp.
   - Màu sắc tia sét: Xanh tím lôi điện (`#a855f7` & `#38bdf8`), chuyển sang Kim Sắc (`#fbbf24`) khi tiến độ $> 80\%$.
   - Sóng xung kích nước: Mỗi điểm sét đánh kích hoạt sóng nước rung giật (`school.ripples.trigger("touch", point)`).
3. **Hào quang Chân Long & Khói Xám:**
   - Khi thành công: Vẽ vầng hào quang phát sáng vàng kim quanh thân cá (`shadowBlur`, `stroke`), kèm hạt tinh tú bụi sao bơi theo đuôi.
   - Khi thất bại: Vẽ các cụm hạt khói bốc lên từ lưng cá.

### 5.2. Giao Diện Trực Tiếp Trên Stream (`LiveOverlay`)
- **Khung Banner Thiên Kiếp (Đỉnh màn hình):**
  - Viền phát quang điện giật phong cách tiên hiệp.
  - Tiêu đề: `⚡ THIÊN KIẾP GIÁNG LÂM: CỬU TRỌNG LÔI KIẾP ⚡`
  - Ảnh đại diện & Tên đạo hữu đang độ kiếp.
  - Đồng hồ đếm ngược: `⏳ [Thời gian còn lại]s`.
  - Thanh năng lượng Hộ Pháp: `[██████████░░░░░░] X / Y Điểm (Z%)` kèm tia điện chạy dọc.
  - Lời kêu gọi hành động: `💬 Bình luận "HỘ PHÁP" • ❤️ Thả Tim • 🎁 Tặng Quà để trợ lực!`
  - Top 3 người hộ pháp công đức cao nhất.

---

## 6. Xử Lý Tình Huống Biên & Bảng Điều Khiển Test

### 6.1. Xử Lý Tình Huống Biên
- **Bảo vệ cá:** Khóa trạng thái đói không để bị câu mất (`isBeingFished = false`) trong suốt 30 giây sự kiện.
- **Khóa thời tiết:** Tạm hoãn lệnh đổi thời tiết từ chat cho đến khi lôi kiếp kết thúc.
- **Viewer ngắt kết nối:** Sự kiện vẫn tiếp diễn đến hết để toàn phòng live cùng tham gia.

### 6.2. Nút Bấm Test Trên Bảng Điều Khiển (`live-server/control`)
Thêm các nút điều khiển trực tiếp trên web control:
- `[⚡ Kích hoạt Test Lôi Kiếp (72cm)]`
- `[🐉 Kích hoạt Test Lôi Kiếp (82cm)]`
- `[+5 Lực Hộ Pháp]`
- `[Thắng Ngay]` / `[Thất Bại Ngay]`
