# Design Spec: Võ Đài Thần Ngư (PVP Sumo Ring) - Cá Thắng Ăn Cá Thua & Bầy Cá Quây Vòng Tròn

## 1. Mục tiêu
Tạo ra một cơ chế tương tác kịch tính, bùng nổ trên TikTok Live:
- Cho phép khán giả thách đấu 1vs1 thông qua lệnh bình luận `pvp` (hoặc gửi quà).
- Khi trận đấu diễn ra, 2 cá đấu sĩ bơi vào tâm hồ đối đầu trực diện, toàn bộ các con cá còn lại trong hồ tự động bơi bao quanh tạo thành một **vòng tròn đấu trường sống động**.
- Kết quả trận đấu: Cá đẩy văng đối thủ ra ngoài rìa vòng tròn sẽ **nuốt chửng cá thua**, nhận **+2.0cm** và danh hiệu **👑 Vua Hồ Cá** (King of the Pond). Cá thua bị loại khỏi hồ và có thể hồi sinh lại khi bình luận.

---

## 2. Luồng hoạt động & Vòng đời trận đấu

```
[Chờ lệnh pvp] 
     │ (Khán giả gõ "pvp")
     ▼
[Hàng chờ Challenger 1] ──(Khán giả thứ 2 gõ "pvp")──► [Bắt đầu trận]
                                                             │
  ┌──────────────────────────────────────────────────────────┘
  ▼
[Giai đoạn 1: SUMMON (3s)]
  - 2 cá đấu sĩ bơi về tâm hồ (CANVAS_WIDTH/2, CANVAS_HEIGHT/2).
  - Các cá khác bơi thành vòng tròn bảo vệ bao quanh bán kính R ≈ 140px - 180px.
  - Xuất hiện vòng tròn ma trận nước phát sáng xoay tròn ở tâm hồ.
  - Banner hiển thị: "⚔️ ĐẤU TRƯỜNG THẦN NGƯ: [A] VS [B]! Gõ 'huc' để tiếp sức!"
  │
  ▼
[Giai đoạn 2: FIGHTING (tối đa 30s)]
  - 2 cá lao đầu vào nhau và húc liên tục trong vòng tròn (R = 110px).
  - Lực đẩy = Lực cơ bản theo kích thước (sizeCm) + Lực tiếp sức từ comment (`huc`, `day`, `1`, like, gift).
  - Mỗi cú chạm đầu tạo chấn động nước tóe bọt (`ripples.trigger`).
  - Thanh thế trận trên màn hình dịch chuyển theo vị trí va chạm giữa 2 cá.
  │
  ▼
[Giai đoạn 3: KNOCKOUT & NUỐT CHỬNG (3s)]
  - Khi một cá bị húc văng qua bán kính R > 115px (hoặc hết 30s ai bị đẩy xa tâm hơn):
  - Cá thua rơi vào trạng thái choáng (Stun).
  - Cá thắng phóng nhanh tới há mõm nuốt trọn cá thua (Gulp animation).
  - Cá thua biến mất khỏi hồ (`school.removeFish`).
  - Cá thắng được cộng ngay +2.0 cm và đội vương miện vàng 👑 ("Vua Hồ Cá").
  - TTS thông báo chiến thắng.
  │
  ▼
[Kết thúc & Reset về IDLE]
  - Bầy cá khán giả giải tán vòng tròn, bơi tự do trở lại.
```

---

## 3. Chi tiết kỹ thuật & Kiến trúc

### A. Quản lý trạng thái đấu trường (`src/pvp-arena-types.ts` & `src/pvp-arena-manager.ts`)
1. **Kiểu dữ liệu `PvpArenaState`**:
   - `phase`: `"idle" | "summon" | "fighting" | "knockout"`.
   - `fighter1`: `{ id: string; name: string; avatar: string; score: number } | null`.
   - `fighter2`: `{ id: string; name: string; avatar: string; score: number } | null`.
   - `center`: `Vec2` (mặc định tâm hồ: `CANVAS_WIDTH * 0.5, CANVAS_HEIGHT * 0.5`).
   - `radius`: `number` (bán kính võ đài = `110`).
   - `spectatorRadius`: `number` (bán kính bầy cá quây = `155`).
   - `timer`: `number` (đếm ngược cho từng phase).
   - `winnerId`: `string | null`.
   - `kingId`: `string | null` (Id của Vua Hồ Cá hiện tại).
   - `waitingChallenger`: `{ id: string; name: string; avatar: string } | null`.

2. **Lớp `PvpArenaManager`**:
   - Quản lý hàng chờ `registerChallenger(id, name, avatar)`.
   - Hàm `update(dt, school)`:
     - Giảm `timer`.
     - Cập nhật vật lý giáp chiến cho 2 đấu sĩ.
     - Kiểm tra điều kiện Knockout ($distance > radius$).
     - Xử lý nuốt chửng khi thắng và trao danh hiệu King.
   - Hàm `addCheerPower(idOrName, power)`: Tăng lực húc cho đấu sĩ khi khán giả chat `huc` hoặc tặng quà.

### B. Hành vi bơi bầy đàn (`src/school.ts`)
- Thêm cờ `arenaManager: PvpArenaManager | null`.
- Trong hàm `steeringFor(index, time)`:
  - Nếu `arena.isActive`:
    - Nếu cá là `fighter1` hoặc `fighter2`: nhận steering trực diện về phía đối thủ + phản lực va chạm.
    - Nếu cá là **khán giả (spectator)**:
      - Nhận lực hút về vòng bán kính `spectatorRadius` (`targetDistance = 155`).
      - Nhận lực tiếp tuyến `tangentialForce` vuông góc với vector từ tâm hồ ra cá:
        ```typescript
        const toCenter = sub(arena.center, fish.position);
        const tangent = perpendicular(normalize(toCenter));
        // Ép bầy cá bơi xoay vòng quanh tâm
        steering = add(steering, mul(tangent, 3.2));
        ```

### C. Cơ chế Cá Nuốt Cá (`src/koi.ts` & `src/school.ts`)
- Khi `knockout`:
  - Cá thua đặt `state = SwimState.Coast` và giảm tốc độ.
  - Cá thắng kích hoạt `state = SwimState.Burst`, bơi thẳng tới tọa độ cá thua.
  - Khi khoảng cách giữa mõm cá thắng và cá thua $< 12\text{px}$:
    - Kích hoạt `fish.gulpAnimation = 1.0` trên cá thắng.
    - `school.removeFish(loserIndex)`.
    - Cá thắng nhận `eatCount += 4` (tương đương `+2.0 cm`).
    - Gán `fish.isKing = true`.

### D. Giao diện Đấu Trường & Vương Miện (`src/components/live-overlay.tsx` & `src/styles.css`)
1. **Vòng tròn Võ Đài (Arena Circle Layer)**:
   - Một vòng tròn phát sáng SVG/CSS tại tâm hồ có hoa văn Bát Quái / Nước xoáy phát sáng màu xanh ngọc / vàng kim huyền ảo.
2. **Thanh giằng co trận đấu (Tug-of-War Bar)**:
   - Hiển thị trên cùng màn hình khi `phase === "fighting"`:
     `[Avatar A - Tên A]  < 55% | 45% >  [Avatar B - Tên B]`
     Kèm chỉ dẫn: *"Khán giả bình luận 'huc' hoặc tặng quà để đẩy văng đối thủ!"*
3. **Vương miện 👑 Vua Hồ Cá**:
   - Trên đầu chú cá chiến thắng (có `fish.isKing === true`):
     Hiển thị icon `👑` vàng lấp lánh nổi bật ngay phía trên avatar của nó khi bơi khắp hồ.
4. **Loa thông báo (TTS)**:
   - Phát âm thanh khi trận đấu bắt đầu và khi cá thắng ngoạm trọn cá thua.

---

## 4. Phạm vi & Kế thừa
- Không ảnh hưởng đến cơ chế Thiên Kiếp Lôi Đình (72cm và 82cm Chân Long).
- Tương thích 100% với việc che/ẩn tên người dùng đã làm ở bước trước (cá thắng vẫn hiển thị vương miện 👑 trên đầu avatar tròn nhỏ).
