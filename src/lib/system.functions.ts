/**
 * Phase 8 — lightweight system status (no secrets exposed).
 */

import { createServerFn } from "@tanstack/react-start";
import { getServerSupabase } from "./supabase.server";

export const getStorageStatus = createServerFn({ method: "GET" }).handler(
  async () => {
    const sb = getServerSupabase();
    const hasAiKey = Boolean(
      process.env.LOVABLE_API_KEY || process.env.OPENAI_API_KEY,
    );
    return {
      storage: sb ? ("supabase" as const) : ("memory" as const),
      aiConfigured: hasAiKey,
      note: sb
        ? "เอกสารถูกเก็บในฐานข้อมูล (ตาม session cookie)"
        : "ยังไม่ตั้งค่า Supabase — ใช้หน่วยความจำชั่วคราว (รีสตาร์ทเซิร์ฟเวอร์แล้วข้อมูลหาย)",
    };
  },
);
