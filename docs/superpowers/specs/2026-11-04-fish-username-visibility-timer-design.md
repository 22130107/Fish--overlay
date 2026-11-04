# Design Spec: Ẩn tên người dùng sau 5 giây từ lúc thả cá và kích hoạt lại khi tương tác

## Mục tiêu
- Giảm thiểu hiện tượng thanh tên người dùng che khuất không gian hồ cá khi có nhiều khán giả tham gia nhận Linh Ngư.
- Tên người dùng chỉ hiển thị trong vòng 5 giây kể từ khi cá được thả (`spawnFishForViewer`).
- Sau 5 giây, thanh thông tin trên đầu cá tự động thu gọn, chỉ giữ lại Avatar và huy hiệu kích thước (`[Avatar] [18cm]`).
- Khi khán giả có bất kỳ tương tác nào (bình luận, tặng quà, thả mồi, gõ lệnh kiểm tra size), tên người xem sẽ hiện lại trong 5 giây rồi tiếp tục ẩn.

## Chi tiết kỹ thuật

### 1. Model & Vòng lặp cập nhật (`src/koi.ts` & `src/school.ts`)
- **Trong `src/koi.ts`**:
  - Thêm thuộc tính `public nameVisibleTimer = 0;` vào class `Koi`.
  - Trong hàm `reset()`: đặt lại `this.nameVisibleTimer = 0;`.
- **Trong `src/school.ts`**:
  - Trong hàm `spawnFishForViewer(id, name, avatar)`: khởi tạo `fish.nameVisibleTimer = 5.0;`.
  - Trong hàm `removeFish(index)`: đặt lại `removedFish.nameVisibleTimer = 0;`.
  - Trong vòng lặp `school.update(dt)`:
    ```typescript
    if (fish.nameVisibleTimer > 0) {
      fish.nameVisibleTimer = Math.max(0, fish.nameVisibleTimer - dt);
    }
    ```

### 2. Kích hoạt lại khi có tương tác (`src/live-client.ts`)
Tạo hàm trợ giúp nội bộ để làm mới timer của cá thuộc về viewer:
```typescript
private refreshFishNameTimer(id: string, name?: string): void {
  const fish = this.school.fish
    .slice(0, this.school.count)
    .find((f) => f.ownerId === id || (name && f.ownerName && f.ownerName.toLowerCase() === name.toLowerCase()));
  if (fish) {
    fish.nameVisibleTimer = 5.0;
  }
}
```
Gọi hàm này trong các trình xử lý sự kiện:
- `handleChat`: khi người xem bình luận hoặc gõ lệnh.
- `handleGift`: khi người xem tặng quà.
- `handleLike`: khi người xem thả like/thả mồi.

### 3. Giao diện hiển thị (`src/components/live-overlay.tsx`)
- Trong `live-overlay.tsx`:
  - Kiểm tra `fish.nameVisibleTimer > 0` trước khi hiển thị `span.fish-owner-name`:
    ```tsx
    <div className={`fish-owner-pill ${isDanger ? "pill-danger" : ""}`}>
      {fish.ownerAvatar ? (
        <img src={fish.ownerAvatar} alt="" className="fish-owner-avatar" />
      ) : (
        <div className="fish-owner-avatar-fallback">
          {fish.ownerName ? fish.ownerName[0].toUpperCase() : "C"}
        </div>
      )}
      {fish.nameVisibleTimer > 0 && (
        <span className="fish-owner-name">{fish.ownerName}</span>
      )}
      <span className="fish-size-pill ...">{fish.sizeCm}cm</span>
    </div>
    ```

### 4. Hiệu ứng hiển thị mượt mà (`src/styles.css`)
- Đảm bảo khi tên xuất hiện/biến mất, pill chuyển động trơn tru:
  ```css
  .fish-owner-pill {
    transition: all 0.25s ease-out;
  }
  ```

## Phạm vi không thay đổi
- Thông tin `fish.ownerName` vẫn được bảo toàn trong model để dùng cho câu cá, popup soi tu vi (`size`), thông báo sự kiện, và TTS.
- Popup soi cảnh giới tu tiên (`fish.sizeAlertTimer > 0`) khi gõ `"size"` vẫn hiển thị đầy đủ pháp hiệu và tên người dùng.
- Bảng vinh danh Top Donors và thông báo quà tặng lớn vẫn hiển thị tên người dùng như bình thường.
