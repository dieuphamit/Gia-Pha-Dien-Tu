# PRD — Quản lý Hình ảnh & Tài liệu
**Gia Phả Điện Tử** · v1.0 · 2026-02-26

---

## 1. Tổng quan

Hệ thống cần một module quản lý hình ảnh và tài liệu (PDF, Word, ảnh gia phả...) với:

- **Chi phí thấp**: Dùng **Supabase Storage** (free tier: 1 GB miễn phí, 50 GB/$25/tháng)
- **Deploy dễ**: Không cần server riêng, không cần S3, không cần CDN cấu hình phức tạp — tích hợp sẵn trong Supabase đang dùng
- **Tích hợp chặt**: Kết nối hình ảnh với hồ sơ thành viên, sự kiện, bài viết

### Vấn đề hiện tại
Trang `/media` hiện tại chỉ lưu **metadata** (tên file, kích thước, mime_type) nhưng **không upload file thực sự** — file chưa được lưu đâu cả.

---

## 2. Phân tích Giải pháp Lưu trữ

| Giải pháp | Chi phí | Độ phức tạp | Phù hợp |
|---|---|---|---|
| **Supabase Storage** ✅ | Free 1GB, ~$0.021/GB sau | Thấp (đã tích hợp) | ⭐⭐⭐⭐⭐ |
| AWS S3 | ~$0.023/GB | Trung bình (IAM, policy) | ⭐⭐⭐ |
| Cloudflare R2 | Free 10GB | Trung bình (Workers) | ⭐⭐⭐⭐ |
| Google Drive API | Free 15GB | Cao (OAuth2 phức tạp) | ⭐⭐ |
| Self-hosted MinIO | Miễn phí | Cao (cần server) | ⭐⭐ |

**Kết luận**: Dùng **Supabase Storage** — không cần cấu hình thêm, RLS tích hợp sẵn, CDN tự động qua URL công khai.

---

## 3. User Personas

| Persona | Vai trò | Nhu cầu |
|---|---|---|
| **Admin** | Quản trị viên | Duyệt/xóa media, quản lý toàn bộ thư viện, bật/tắt tính năng |
| **Editor** | Biên tập viên | Upload ảnh, tự duyệt ảnh của mình, gắn ảnh vào hồ sơ |
| **Member** | Thành viên | Xem thư viện, upload (cần chờ duyệt) |

> **Lưu ý**: Hệ thống **yêu cầu đăng nhập** — không có guest/anonymous access. Chưa đăng nhập sẽ bị redirect về trang đăng nhập.

---

## 4. User Stories

### MVP

```
US-01: Là member, tôi muốn upload ảnh từ máy tính để chia sẻ với gia đình
US-02: Là admin/editor, tôi muốn duyệt ảnh trước khi hiển thị công khai
US-03: Là admin/editor, tôi muốn gắn ảnh vào hồ sơ thành viên
US-04: Là member, tôi muốn xem gallery ảnh gia đình với thumbnail đẹp
US-05: Là admin, tôi muốn xóa ảnh vi phạm hoặc không phù hợp
US-06: Là user, tôi muốn tìm kiếm ảnh theo tên hoặc lọc theo loại file
```

### Post-MVP

```
US-07: Là editor, tôi muốn upload tài liệu PDF (gia phả scan, giấy tờ lịch sử)
US-08: Là member, tôi muốn xem ảnh của một thành viên cụ thể trên trang hồ sơ
US-09: Là admin, tôi muốn đặt ảnh đại diện cho thành viên từ thư viện
```

---

## 5. Tính năng MVP

### 5.1 Upload File Thực sự
- Upload ảnh (JPG, PNG, WebP, GIF) và PDF
- Giới hạn: 10MB/file (ảnh), 50MB/file (tài liệu)
- Lưu vào Supabase Storage bucket `media`
- Lưu path và public URL vào DB

### 5.2 Thư viện Media (Gallery View)
- Grid layout với thumbnail ảnh thực
- Preview bằng lightbox khi click
- Badge trạng thái: Chờ duyệt / Đã duyệt / Từ chối
- Phân trang (20 items/trang)
- Tìm kiếm theo tên file, lọc theo loại (ảnh/PDF)

### 5.3 Phân quyền
- **Chưa đăng nhập**: Redirect về trang `/login` — không xem được bất cứ gì
- **Member**: Xem tất cả media `PUBLISHED` + ảnh của chính mình, upload (→ `PENDING`)
- **Editor**: Upload + tự duyệt ảnh của mình + duyệt/từ chối ảnh của member
- **Admin**: Full control (duyệt, từ chối, xóa bất kỳ, bật/tắt tính năng)

### 5.4 Gắn Media vào Hồ sơ
- Chọn ảnh từ thư viện để gắn vào `people.avatar_url`
- Xem danh sách ảnh liên quan đến 1 thành viên

---

## 6. Yêu cầu Kỹ thuật

### Database Changes
```sql
-- Thêm vào bảng media:
storage_path    TEXT,     -- path trong Supabase Storage
storage_url     TEXT,     -- public URL để hiển thị
thumbnail_url   TEXT,     -- URL thumbnail (auto-resize)
linked_person   TEXT,     -- FK → people.handle (optional)
media_type      TEXT DEFAULT 'IMAGE'  -- IMAGE | DOCUMENT
```

### Supabase Storage
- Bucket: `media` (public)
- Path structure: `/{user_id}/{year}/{filename}`
- RLS: authenticated có thể upload, public có thể đọc ảnh PUBLISHED

### API Routes (Next.js)
- `POST /api/media/upload` — Upload file + tạo record DB
- `DELETE /api/media/[id]` — Xóa file khỏi Storage + DB
- `PATCH /api/media/[id]/approve` — Duyệt media

---

## 7. Non-functional Requirements

| Yêu cầu | Tiêu chí |
|---|---|
| **Chi phí** | < $5/tháng với 1GB storage |
| **Performance** | Thumbnail load < 1s, CDN tự động của Supabase |
| **Security** | Bắt buộc đăng nhập, RLS Supabase, không expose service key client-side |
| **Scalability** | Supabase paid plan khi vượt 1GB |

---

## 8. Timeline Ước tính

| Milestone | Nội dung | Effort |
|---|---|---|
| **M1** (1 ngày) | Setup Supabase Storage + migration DB | 4h |
| **M2** (1 ngày) | Upload thực sự + Gallery UI với thumbnail | 6h |
| **M3** (0.5 ngày) | Phân quyền, approve/reject flow | 3h |
| **M4** (0.5 ngày) | Gắn ảnh vào hồ sơ thành viên | 3h |
| **Tổng** | | **~3 ngày** |
