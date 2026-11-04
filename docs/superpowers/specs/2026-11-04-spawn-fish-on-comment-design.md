# Design Spec: Chỉ Cấp Cá Khi Bình Luận Hoặc Tặng Quà (Thay Vì Vào Xem)

## 1. Mục tiêu
- Ngăn chặn việc người xem chỉ vừa vào phòng Live (Join) đã tự động nhận cá làm đầy hồ (giới hạn 48 con) bằng các tài khoản thụ động không tương tác.
- Tăng tỷ lệ tương tác (engagement) của phiên Live bằng cách yêu cầu khán giả phải **bình luận (Chat)** bất kỳ hoặc **tặng quà (Gift)** mới được cấp 1 chú cá mang tên và avatar của họ vào hồ.
- Giữ hồ cá gọn gàng khi mới mở Live: bắt đầu với 1 chú cá mẫu bơi lội, khi có người bình luận đầu tiên sẽ trao quyền sở hữu chú cá này hoặc sinh thêm cá mới khi có nhiều người bình luận.

---

## 2. Chi tiết kỹ thuật & Luồng xử lý

### A. Client (`nagomi/src/live-client.ts`)
1. **Xử lý sự kiện `join`:**
   - Bỏ lệnh gọi `this.school.spawnFishForViewer(...)`. Khán giả vào xem không còn sinh cá nữa.
   - Không kích hoạt hiệu ứng tạo gợn sóng sinh cá cho sự kiện `join`.
2. **Xử lý sự kiện `chat` & `gift`:**
   - Giữ nguyên cơ chế kiểm tra cá: Nếu khán giả chưa có cá trong hồ (`!fish`), gọi `this.school.spawnFishForViewer(id, name, avatar)`.
   - Cập nhật thông báo nổi khi cá được cấp (`school.onViewerSpawned`):
     - Đổi từ `✨ ${name} vừa vào hồ và nhận 1 chú cá!` thành `✨ ${name} đã bình luận và nhận 1 chú cá Koi!`.
3. **Xử lý sự kiện `share` & `follow`:**
   - Không tự động gọi `spawnFishForViewer` nếu người đó chưa có cá. Chỉ kích hoạt hiệu ứng mồi ăn / tăng no cho cá nếu họ đã sở hữu cá trước đó.

### B. Logic Đàn Cá (`nagomi/src/school.ts` & `nagomi/src/app.tsx`)
1. **Khởi tạo đàn cá ban đầu:**
   - Trong `app.tsx`: Khởi tạo `School` với 1 cá mẫu (`new School(1)` khi chạy chế độ Live) thay vì 14 con cá mặc định vô chủ.
2. **Tái sử dụng cá mẫu cho người bình luận đầu tiên (`school.ts`):**
   - Trong hàm `spawnFishForViewer`: Trước khi tăng `this.count += 1`, kiểm tra xem trong số các cá hiện tại (`0 <= i < this.count`) có cá nào chưa có chủ (`!fish.ownerId`) không.
   - Nếu có (ví dụ con cá số 0 ban đầu chưa ai sở hữu), gán luôn con cá đó cho người bình luận đầu tiên thay vì sinh thêm con thứ 2 và để lại con vô chủ.

### C. Server & TTS (`nagomi/live-server/server.mjs`)
1. **Sự kiện `handleJoin`:**
   - Ghi log: `👋 ${name} đã vào phòng Live!` (bỏ phần "Đã cấp 1 chú cá").
   - Giọng đọc AI chào mừng: `Chào mừng ${spokenName} đã vào xem live!` (bỏ phần "đã vào hồ nhận linh ngư").
2. **Sự kiện `handleShare` / `handleFollow`:**
   - Bỏ lệnh gọi ngầm `handleJoin(...)` vốn dùng để cấp cá cưỡng ép.

### D. Giao diện Overlay & Bảng điều khiển
1. **Thanh Marquee hướng dẫn (`nagomi/src/components/live-overlay.tsx`):**
   - Thay thế `👋 Vào xem: Nhận cá` và `🥖 Bình luận: Cho ăn` thành:
     - `💬 <b>Bình luận: Nhận cá & Cho ăn</b>`
2. **Bảng điều khiển Test (`nagomi/live-server/control.html`):**
   - Đổi nhãn nút test:
     - `👤 Người mới vào xem (Chào mừng)`
     - `💬 Khán giả bình luận (Cấp cá & Cho ăn)`

---

## 3. Kế hoạch kiểm thử (Testing & Verification)
1. **Unit Test:**
   - Kiểm tra logic gán cá unowned trong `school.ts`: khi có 1 cá unowned và gọi `spawnFishForViewer`, con cá đó được nhận diện và gán chủ, `school.count` giữ nguyên là 1.
2. **Kiểm tra luồng sự kiện:**
   - Khi gửi tin nhắn websocket `{ t: 'join' }`: kiểm tra `school.count` không tăng.
   - Khi gửi tin nhắn websocket `{ t: 'chat' }`: kiểm tra `school.count` tăng lên hoặc cá được cấp mang tên người bình luận.
   - Khi người xem cũ chat lần 2: cá chỉ được cho ăn và tăng no, không sinh thêm cá trùng lặp.
3. **Build & Verify:**
   - Chạy `npm run build` trong `nagomi` để đảm bảo TypeScript biên dịch thành công 100%.
