# Design Spec: Rương Báu Thủy Cung (Mystery Treasure Chest) & Vận May Độc Bản

## 1. Mục tiêu
Tạo ra một sự kiện may rủi (Gacha / Mystery Box) định kỳ và theo yêu cầu quà tặng trên TikTok Live:
- Một chiếc Rương Báu Hoàng Kim xuất hiện chìm dần xuống lòng hồ kèm cột sáng thần thánh.
- Toàn bộ đàn cá nhận lực hút bơi về phía rương báu; khán giả bình luận `boi`, `nhanh`, `rush` hoặc thả tim để tiếp sức tốc độ Burst cho cá của mình lướt nhanh cắn rương trước đối thủ.
- Cá đầu tiên chạm mõm cắn rương sẽ mở ra 1 trong 4 phần thưởng Gacha độc đáo (Skin Dạ Quang Neon, Thuốc tăng trưởng +3cm, Khiên bảo hộ PvP, Quả bom tí hon 20s).

---

## 2. Vòng đời & Cơ chế hoạt động

```
[Kích hoạt Rương] (Tự động 7 phút / Quà tặng / Nút Control Panel)
     │
     ▼
[Giai đoạn FALLING / ACTIVE (Tối đa 45s)]
  - Rương báu xuất hiện tại tọa độ ngẫu nhiên an toàn trong hồ.
  - Cột sáng thần thoại (God Rays) chiếu từ mặt nước xuống rương báu.
  - Toàn đàn cá cảm nhận được rương báu và nhận lực hút bơi về rương.
  - Khán giả comment "boi", "nhanh", "rush", thả tim: cá bứt tốc độ Burst x1.35 lao tới rương.
  │
  ▼
[Phát hiện chạm mõm (< 16px)]
  │
  ▼
[Giai đoạn OPENED (4s)]
  - Nổ tung hiệu ứng ánh sáng kim quang và bọt nước tung tóe.
  - Quay thưởng Gacha ngẫu nhiên:
    + 40%: Thuốc Tăng Trưởng (+3.0 cm) + thả 10 viên linh đan bonus cho đàn cá xung quanh.
    + 25%: Skin Cá Dạ Quang Neon (hào quang lấp lánh độc bản).
    + 20%: Linh Khiên Kim Cương 🛡️ (bảo vệ cá không bị nuốt 1 lần khi thua PvP).
    + 15%: Quả Bom Tí Hon (Cá bị biến thành cá mini 10cm bơi xoay vòng hài hước trong 20s).
  - Loa AI Tiếng Việt và Banner chúc mừng toàn phòng Live.
  │
  ▼
[Dọn dẹp & Chờ chu kỳ tiếp theo]
```

---

## 3. Chi tiết kỹ thuật & Kiến trúc

### A. Lớp `TreasureSystem` (`src/treasure-system.ts`)
- Quản lý trạng thái:
  - `activeTreasure: TreasureChest | null`
  - `autoDropTimer: number` (mặc định đếm ngược 420 giây = 7 phút)
- Phương thức:
  - `spawnChest(pos?: Vec2): TreasureChest`
  - `update(dt: number, school: School): void`:
    - Đếm ngược thời gian tồn tại (45s).
    - Kiểm tra khoảng cách va chạm với mõm từng con cá trong `school.fish`.
    - Khi có cá chạm: roll gacha phần thưởng, áp dụng hiệu ứng lên cá, kích hoạt sự kiện mở rương.
  - `claimReward(fish: Koi, chest: TreasureChest): TreasureRewardType`

### B. Mở rộng Model `Koi` (`src/koi.ts`)
- Thêm các thuộc tính:
  - `public isNeonGlow = false;` (Hào quang Neon phát sáng)
  - `public hasPvPShield = false;` (Khiên bảo vệ PvP)
  - `public isMiniFish = false;` (Bị hóa tí hon)
  - `public miniTimer = 0;` (Thời gian duy trì tí hon, đếm lùi trong school update)
- Trong `PvpArenaManager`:
  - Khi xử lý knockout / nuốt chửng: nếu cá thua có `hasPvPShield === true`:
    - Cá thua làm vỡ khiên (`hasPvPShield = false`), không bị nuốt khỏi hồ mà chỉ bị văng ra xa!
    - Banner/TTS thông báo: *"🛡️ [Tên] đã kích hoạt Linh Khiên Kim Cương thoát chết trong gang tấc!"*

### C. Lực bơi đàn cá (`src/school.ts`)
- Thêm `public treasureSystem: TreasureSystem | null = null;`
- Trong `steeringFor(index, time)`:
  - Nếu `treasureSystem && treasureSystem.activeChest && !this.arena?.isActive`:
    - Tính vector từ cá tới rương: `const toChest = sub(chest.position, fish.position);`
    - Bổ sung lực hút: `steering = add(steering, mul(normalize(toChest), 2.2));`
- Trong `desiredSpeedFor(index)`:
  - Nếu cá đang trong trạng thái `Burst` (do chủ nhân comment `boi`): duy trì tốc độ `fish.maximumSpeed * 1.35`.

### D. Tương tác LiveClient (`src/live-client.ts`)
- Khởi tạo `public treasureSystem = new TreasureSystem();`
- Gắn kết `this.school.treasureSystem = this.treasureSystem;`
- Trong `handleChat`:
  - Nếu bình luận chứa từ khóa: `/boi|bơi|nhanh|chay|rush|go/i`:
    - Tìm cá của người bình luận và kích hoạt:
      `fish.state = SwimState.Burst;`
      `fish.speed = fish.maximumSpeed * 1.35;`
- Trong `handleGift`:
  - Nếu tặng quà có giá trị từ 10 kim cương trở lên: tự động thả ngay 1 rương báu.
- Khi rương xuất hiện hoặc có người trúng thưởng:
  - Gửi lệnh `say` lên server để đọc bằng giọng AI Tiếng Việt chuẩn.

### E. Giao diện trực quan (`src/components/live-overlay.tsx` & `src/styles.css`)
- Hiển thị rương báu tại tọa độ `(chest.position.x, chest.position.y)`:
  - Rương hoàng kim phát sáng bập bềnh theo nhịp sóng.
  - Cột sáng thần thánh (Light beam) rọi từ trên mặt hồ xuống.
  - Hiệu ứng bọt khí sủi tăm.
- Hiển thị Linh Khiên Kim Cương 🛡️ bên cạnh avatar chú cá có khiên.
- Hiệu ứng hào quang Neon cầu vồng quanh chú cá có `isNeonGlow === true`.
- Hiệu ứng thu nhỏ kích thước nếu chú cá bị dính Bom Tí Hon (`isMiniFish === true`).
- Bảng điều khiển (`control.html`): Thêm nút "🎁 Thả Rương Báu Ngay" để streamer test bất kỳ lúc nào.
