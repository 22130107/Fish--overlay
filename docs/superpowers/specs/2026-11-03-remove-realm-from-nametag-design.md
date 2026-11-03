# Design Spec: Bỏ cảnh giới phía sau tên người xem trên đầu cá

## Mục tiêu
Loại bỏ phần hiển thị tên cảnh giới tu tiên (`{fish.tuTien.badge} {fish.tuTien.realm} • `) trên thanh thông tin (nametag pill) bơi theo cá của người xem, chỉ giữ lại kích thước cá theo centimet (`{fish.sizeCm}cm`).

## Hiện trạng
Trong file `src/components/live-overlay.tsx`:
```tsx
<div className={`fish-owner-pill ${isDanger ? "pill-danger" : ""}`}>
  {fish.ownerAvatar ? (
    <img src={fish.ownerAvatar} alt="" className="fish-owner-avatar" />
  ) : (
    <div className="fish-owner-avatar-fallback">
      {fish.ownerName ? fish.ownerName[0].toUpperCase() : "C"}
    </div>
  )}
  <span className="fish-owner-name">{fish.ownerName}</span>
  <span
    className="fish-size-pill tu-tien-tag"
    style={{ borderColor: fish.tuTien.auraColor }}
  >
    {fish.tuTien.badge} {fish.tuTien.realm} • {fish.sizeCm}cm
  </span>
</div>
```
Thanh nametag hiển thị quá dài do chứa cả icon và tên cảnh giới (ví dụ: `🌱 Luyện Khí Kỳ • 20cm`).

## Thiết kế thay đổi
Cập nhật `src/components/live-overlay.tsx`:
- Giữ thẻ `span.fish-size-pill.tu-tien-tag` cùng thuộc tính `style={{ borderColor: fish.tuTien.auraColor }}` để duy trì hiệu ứng viền sáng theo cảnh giới.
- Nội dung hiển thị bên trong thẻ rút gọn thành: `{fish.sizeCm}cm`.
- Hiển thị trực quan: `[Avatar] [Tên người xem] [20cm]`.

## Phạm vi không thay đổi
- Popup chi tiết tu vi khi gõ lệnh `"size"` (`fish.sizeAlertTimer > 0`) vẫn giữ nguyên đầy đủ cảnh giới, danh hiệu, thanh tiến độ độ kiếp và số linh đan.
- Hệ thống âm thanh / TTS thông báo cảnh giới khi gõ size vẫn giữ nguyên.
