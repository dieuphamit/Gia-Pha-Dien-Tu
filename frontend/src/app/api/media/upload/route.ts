import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getServiceClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
}

async function getAuthUser(req: NextRequest) {
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return null;
    const { data: { user } } = await getServiceClient().auth.getUser(token);
    return user;
}

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const DOC_TYPES = ['application/pdf'];
const ALLOWED_TYPES = [...IMAGE_TYPES, ...DOC_TYPES];
const MAX_DOC_SIZE = 50 * 1024 * 1024;  // 50MB (fixed)

export async function POST(req: NextRequest) {
    // 1. Xác thực
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });

    const sc = getServiceClient();

    // 2. Kiểm tra role uploader (admin/editor được duyệt ngay)
    const { data: uploaderProfile } = await sc
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();
    const isAdminOrEditor = uploaderProfile?.role === 'admin' || uploaderProfile?.role === 'editor';

    // 3. Đọc giới hạn từ app_settings
    const { data: settingsRows } = await sc
        .from('app_settings')
        .select('key, value')
        .in('key', ['media_upload_limit', 'media_max_image_size_mb']);
    const settingsMap: Record<string, string> = {};
    (settingsRows ?? []).forEach((r: { key: string; value: string }) => { settingsMap[r.key] = r.value; });
    const uploadLimit = parseInt(settingsMap['media_upload_limit'] ?? '5', 10);
    const maxImageSizeMb = parseInt(settingsMap['media_max_image_size_mb'] ?? '5', 10);
    const MAX_IMAGE_SIZE_DYNAMIC = maxImageSizeMb * 1024 * 1024;

    // 4. Đếm số media hiện tại của user (chỉ PENDING + PUBLISHED, không đếm đã xóa)
    // Admin/editor không bị giới hạn quota
    const { count: currentCount } = await sc
        .from('media')
        .select('id', { count: 'exact', head: true })
        .eq('uploader_id', user.id)
        .in('state', ['PENDING', 'PUBLISHED']);

    if (!isAdminOrEditor && (currentCount ?? 0) >= uploadLimit) {
        return NextResponse.json(
            { error: `Bạn đã đạt giới hạn ${uploadLimit} file. Xóa bớt file cũ để tải lên thêm.` },
            { status: 400 }
        );
    }

    // 5. Đọc form data
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const title = formData.get('title') as string | null;
    const description = formData.get('description') as string | null;
    const linkedPerson = formData.get('linked_person') as string | null;

    if (!file) return NextResponse.json({ error: 'Không có file' }, { status: 400 });

    // 6. Validate loại file
    if (!ALLOWED_TYPES.includes(file.type)) {
        return NextResponse.json(
            { error: 'Loại file không được hỗ trợ. Chỉ chấp nhận: JPG, PNG, WebP, GIF, PDF' },
            { status: 400 }
        );
    }

    const isImage = IMAGE_TYPES.includes(file.type);
    const maxSize = isImage ? MAX_IMAGE_SIZE_DYNAMIC : MAX_DOC_SIZE;

    // 6. Validate kích thước
    if (file.size > maxSize) {
        const limit = isImage ? `${maxImageSizeMb}MB` : '50MB';
        return NextResponse.json({ error: `File quá lớn. Giới hạn: ${limit}` }, { status: 400 });
    }

    // 7. Upload lên Supabase Storage
    const timestamp = Date.now();
    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${user.id}/${timestamp}_${safeFileName}`;

    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadError } = await sc.storage
        .from('media')
        .upload(storagePath, arrayBuffer, {
            contentType: file.type,
            upsert: false,
        });

    if (uploadError) {
        return NextResponse.json({ error: `Upload thất bại: ${uploadError.message}` }, { status: 500 });
    }

    // 8. Lấy public URL
    const { data: { publicUrl } } = sc.storage
        .from('media')
        .getPublicUrl(storagePath);

    // Admin/editor uploads are immediately published; member uploads need review
    const uploadedState = isAdminOrEditor ? 'PUBLISHED' : 'PENDING';

    // 9. Tạo record trong DB
    const { data: mediaRecord, error: dbError } = await sc
        .from('media')
        .insert({
            file_name: file.name,
            mime_type: file.type,
            file_size: file.size,
            state: uploadedState,
            uploader_id: user.id,
            storage_path: storagePath,
            storage_url: publicUrl,
            media_type: isImage ? 'IMAGE' : 'DOCUMENT',
            title: title || null,
            description: description || null,
            linked_person: linkedPerson || null,
        })
        .select('id, storage_url, media_type')
        .single();

    if (dbError) {
        // Cleanup file nếu DB fail
        await sc.storage.from('media').remove([storagePath]);
        return NextResponse.json({ error: `Lưu DB thất bại: ${dbError.message}` }, { status: 500 });
    }

    // Auto-set avatar: admin/editor upload → PUBLISHED + linked_person + person has no avatar yet
    if (uploadedState === 'PUBLISHED' && linkedPerson && isImage) {
        const { data: person } = await sc
            .from('people')
            .select('avatar_url')
            .eq('handle', linkedPerson)
            .maybeSingle();
        if (person && !person.avatar_url) {
            await sc
                .from('people')
                .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
                .eq('handle', linkedPerson);
        }
    }

    return NextResponse.json({
        ok: true,
        id: mediaRecord.id,
        storage_url: mediaRecord.storage_url,
        media_type: mediaRecord.media_type,
        state: uploadedState,
        quota: { used: (currentCount ?? 0) + 1, limit: uploadLimit },
    });
}
