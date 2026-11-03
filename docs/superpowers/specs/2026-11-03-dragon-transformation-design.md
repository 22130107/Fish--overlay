# Thiết Kế Chi Tiết: Biến Hình Hoàng Kim Chân Long (82cm Độ Kiếp Thành Công)

## 1. Tổng Quan & Mục Tiêu
Khi chú cá Koi của viewer trải qua sự kiện Cửu Trọng Lôi Kiếp tại ngưỡng **82.0 cm** và độ kiếp thành công, mô hình của chú cá sẽ thực sự **biến hóa thành Hoàng Kim Chân Long Á Đông** (Thái Cổ Chân Long). Đây là sự thay đổi mô hình hình học 3D procedurally rendered đầy đủ với sừng rồng, râu rồng dài lướt sóng, dải vây bờm lưng lửa bập bùng, 4 vây móng vuốt rồng và chùm đuôi rồng thần thoại rực sáng.

---

## 2. Hình Học Giải Phẫu Hoàng Kim Chân Long (`drawEasternDragon`)

### 2.1. Đầu Rồng & Cặp Sừng Rồng (Antlers & Whiskers)
- **Đầu Rồng:** Đầu thon dài oai vệ hơn cá chép, mũi rồng gồ ghề dũng mãnh.
- **Cặp Sừng Rồng (Dragon Antlers):**
  - Mọc từ đỉnh đầu (đốt sống 0 - 1), chia nhánh vươn chếch về phía sau 45 độ.
  - Sừng chính dài vươn dài kèm các nhánh sừng phụ (`hornProngs`), phát ánh kim rực rỡ.
- **Râu Rồng Dài Uốn Lượn (Dynamic Dragon Barbels):**
  - 2 sợi râu rồng dài (gấp 1.5 - 2.0 lần chiều rộng đầu rồng) xuất phát từ 2 mép mõm rồng.
  - Vẫy lượn tự nhiên trong nước theo hàm sóng sin trễ pha với nhịp bơi của cá (`sin(swimPhase * 1.2 - offset)`), tạo cảm giác râu rồng mềm mại lướt trong nước.
- **Mắt Rồng Thần:** Mắt rực sáng hoàng kim óng ả.

### 2.2. Thân Rồng & Bờm Lưng Lửa (Fire Mane Crest)
- **Thân Rồng (Serpentine Body):**
  - Dáng thân rồng kéo dài thon thả hơn cá Koi thông thường.
  - Vảy rồng phát ánh kim vàng óng toàn thân (`#fbbf24`, `#f59e0b`).
- **Dải Bờm Lưng Rồng (Flaming Dorsal Crest):**
  - Chạy dọc từ gáy (đốt sống 1) xuyên suốt đến đốt sống 14.
  - Cấu tạo từ các tam giác răng cưa dạng ngọn lửa uốn lượn nhấp nhô theo từng bước sóng bơi của thân rồng.

### 2.3. Vây Móng Vuốt Rồng (Dragon Claws)
- Thay thế vây cá chép bằng 4 cụm vây móng vuốt rồng:
  - 2 chân móng trước (ngực) và 2 chân móng sau (bụng).
  - Mỗi chân móng vuốt gồm các ngón móng sắc bén xòe ra quạt nước uy nghi.

### 2.4. Đuôi Rồng Rực Lửa (Dragon Flame Plume)
- Đuôi cá chép thông thường được biến hóa thành chùm đuôi rồng thần thoại xòe rộng dạng ngọn lửa nhiều dải lụa lướt thướt.

---

## 3. Khoảnh Khắc Biến Hình (Burst Transformation)

1. **Hiệu ứng Kim Quang Bùng Nổ:**
   - Khi độ kiếp 82cm thành công, màn hình nháy sáng kim quang rực rỡ (`flashAlpha = 0.6` với ánh sáng vàng chói lọi).
   - Kích hoạt 3 đợt sóng xung kích liên tiếp tại tâm chú cá (`school.ripples.trigger("touch", fish.position)`).
2. **Chuyển Đổi Trạng Thái:**
   - Gán `fish.isDragon = true`.
   - `fish.tribulationAura = "dragon"` duy trì vĩnh viễn trên màn hình stream.
3. **Cập nhật Bảng Điều Khiển Test:**
   - Trong trang `http://localhost:3001/control`, khi nhấn `[Thắng Ngay]` tại mốc 82cm, chú cá lập tức biến thành Chân Long để streamer kiểm tra ngay.

---

## 4. Kiến Trúc Mã Nguồn

1. **`src/koi.ts`**:
   - Thêm getter/thuộc tính:
     ```typescript
     public get isDragon(): boolean {
       return this.passedTribulation82 || (this.sizeCm >= 82.0 && this.tribulationAura === "dragon");
     }
     ```
2. **`src/fish-renderer.ts`**:
   - Bổ sung phương thức `private drawEasternDragon(fish: Koi, appearance: FishAppearance): void`.
   - Trong vòng lặp render cá, kiểm tra:
     ```typescript
     if (fish.isDragon) {
       this.drawEasternDragon(fish, targetAppearance);
     } else {
       this.drawKoi(fish, targetAppearance);
     }
     ```
3. **`src/live-client.ts`**:
   - Trong `onSuccess` của Lôi Kiếp: Khi `st.targetCm >= 82.0`, kích hoạt `fish.passedTribulation82 = true`, màn hình chớp sáng kim quang và phóng ra sóng nước chúc mừng.
