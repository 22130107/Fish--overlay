# Design Spec: Tăng lượng thức ăn khi có người tặng quà

## Mục tiêu
Tăng lượng thức ăn thả vào hồ khi có khán giả tặng quà (gift) trong livestream, tỷ lệ theo giá trị quà (kim cương/coins) và số lượng quà (count), tạo hiệu ứng đại tiệc thức ăn (10 đến 60 viên).

## Hiện trạng
Trong `src/live-client.ts`:
- Số lượng thức ăn thả ra bị giới hạn cứng: `Math.min(msg.count * 2, 8)` (tối đa chỉ 8 viên).
- Trong `src/food-system.ts`: Số lượng thức ăn trên hồ bị giới hạn 30 viên (`if (this.pellets.length > 30) this.pellets.shift()`).
- Mọi viên thức ăn đều hiển thị nhãn chữ `🥖 {pellet.user}`, nếu thả nhiều sẽ gây rối màn hình.

## Thiết kế chi tiết
1. **Công thức tính số lượng viên thức ăn (`live-client.ts`):**
   ```typescript
   const coins = Math.max(1, msg.coins || 1);
   const count = Math.max(1, msg.count || 1);
   const pelletCount = Math.min(60, Math.max(10, Math.floor(coins * 1.5) + count * 2));
   ```
   - Quà nhỏ (1-5 kim cương): 10 - 15 viên.
   - Quà vừa (10-30 kim cương): 20 - 35 viên.
   - Quà lớn (≥ 50 kim cương): 50 - 60 viên.

2. **Cập nhật `FoodPellet` và `FoodSystem` (`food-system.ts`):**
   - Thêm thuộc tính tuỳ chọn `showTag?: boolean` trong interface `FoodPellet` (mặc định `true`).
   - Cho phép truyền tham số `showTag` trong hàm `spawn(point, user, avatar, showTag = true)`.
   - Nâng giới hạn tối đa `pellets.length` từ 30 lên 120 viên.

3. **Tối ưu hiển thị `LiveOverlay` (`components/live-overlay.tsx`):**
   - Chỉ render thẻ `<div className="food-user-tag">` khi `pellet.showTag !== false`.
   - Khi tặng quà, gán `showTag: true` cho 3 viên đầu tiên, các viên còn lại `showTag: false` để tạo hiệu ứng mưa linh đan sạch đẹp, không che khuất màn hình.

4. **Kích thích đàn cá:**
   - Tạo sóng nước (ripples) nhẹ tại các điểm rơi ngẫu nhiên và gọi toàn bộ đàn cá `this.school.callTo(center)` để cùng bơi tới thưởng thức bữa tiệc.
