# SOP / WI / OPL Studio

เว็บแอปสร้างเอกสาร **SOP / WI / OPL** จากไฟล์ต้นฉบับ (Excel, Word, PDF, รูป, ข้อความ) พร้อมติดตามแหล่งที่มา ตรวจทาน AI และส่งออก PNG / PDF / JSON / ZIP

## Features (Phase 2–6)
- Document model + templates (12)
- Owner session แบบไม่มี login (HttpOnly cookie)
- CRUD เอกสาร (Supabase หรือ memory fallback)
- นำเข้า Excel / Word / ข้อความ (+ ข้อจำกัด PDF/รูป)
- AI จัดโครงสร้าง + หน้าตรวจทาน (ห้ามแต่งตัวเลข/ขั้นตอนที่ไม่มีในต้นฉบับ)
- Editor แก้ขั้นตอน / หน้า / ข้อความบนกระดาษ
- Export PNG, PDF (print), JSON, ZIP

## Quick start
See [DEPLOY.md](./DEPLOY.md) for environment variables and Vercel.

```sh
bun install
bun run dev
```

## Stack
TanStack Start · React · TypeScript · Tailwind · Supabase (optional)

## Integrity rules
- ไม่แต่งตัวเลข / ขั้นตอน / ข้อกำหนดความปลอดภัยที่ไม่มีในต้นฉบับ
- ไม่ใช้ภาพ AI แทนภาพจริงจากต้นฉบับ
- แยก extracted / AI / user_confirmed ชัดเจน
