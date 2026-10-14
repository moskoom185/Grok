/**
 * Document CRUD via TanStack Start server functions.
 *
 * Authorization model:
 * - Server reads the HttpOnly cookie `sop_owner_session`
 * - If missing, server issues a new one
 * - Every query is filtered by that session id
 * - Client-supplied owner ids are ignored for authorization
 */

import { createServerFn } from "@tanstack/react-start";
import { getCookie, setCookie } from "@tanstack/react-start/server";
import {
  type DocContent,
  type DocType,
  type DocumentRow,
  createEmptyDocContent,
} from "./doc-model";
import {
  OWNER_COOKIE_NAME,
  generateOwnerSessionId,
  ownerCookieOptions,
} from "./owner";
import { getServerSupabase } from "./supabase.server";

const memoryStore = new Map<string, DocumentRow>();

function ensureOwnerSession(): string {
  let sessionId = getCookie(OWNER_COOKIE_NAME);
  if (!sessionId || sessionId.length < 32) {
    sessionId = generateOwnerSessionId();
    setCookie(OWNER_COOKIE_NAME, sessionId, ownerCookieOptions());
  }
  return sessionId;
}

export const listDocs = createServerFn({ method: "GET" }).handler(async () => {
  const ownerId = ensureOwnerSession();
  const sb = getServerSupabase();

  if (!sb) {
    return Array.from(memoryStore.values())
      .filter((d) => d.owner_session_id === ownerId)
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }

  const { data, error } = await sb
    .from("documents")
    .select("id, title, doc_type, template, created_at, updated_at")
    .eq("owner_session_id", ownerId)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(`listDocs failed: ${error.message}`);
  return data ?? [];
});

export const getDoc = createServerFn({ method: "GET" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const ownerId = ensureOwnerSession();
    const sb = getServerSupabase();

    if (!sb) {
      const row = memoryStore.get(data.id);
      if (!row || row.owner_session_id !== ownerId) return null;
      return row;
    }

    const { data: row, error } = await sb
      .from("documents")
      .select("*")
      .eq("id", data.id)
      .eq("owner_session_id", ownerId)
      .maybeSingle();

    if (error) throw new Error(`getDoc failed: ${error.message}`);
    return row as DocumentRow | null;
  });

export const createDoc = createServerFn({ method: "POST" })
  .validator(
    (data: { title?: string; docType: DocType; templateId: string }) => data,
  )
  .handler(async ({ data }) => {
    const ownerId = ensureOwnerSession();
    const now = new Date().toISOString();
    const content = createEmptyDocContent(
      data.docType,
      data.templateId,
      data.title ?? "เอกสารใหม่",
    );

    const sb = getServerSupabase();

    if (!sb) {
      const id = crypto.randomUUID();
      const row: DocumentRow = {
        id,
        owner_session_id: ownerId,
        title: content.meta.title,
        doc_type: data.docType,
        template: data.templateId,
        content,
        created_at: now,
        updated_at: now,
      };
      memoryStore.set(id, row);
      return row;
    }

    const { data: row, error } = await sb
      .from("documents")
      .insert({
        owner_session_id: ownerId,
        title: content.meta.title,
        doc_type: data.docType,
        template: data.templateId,
        content,
      })
      .select()
      .single();

    if (error) throw new Error(`createDoc failed: ${error.message}`);
    return row as DocumentRow;
  });

export const saveDoc = createServerFn({ method: "POST" })
  .validator((data: { id: string; content: DocContent; title?: string }) => data)
  .handler(async ({ data }) => {
    const ownerId = ensureOwnerSession();
    const now = new Date().toISOString();
    const title = data.title ?? data.content.meta.title;
    data.content.meta.updatedAt = now;
    data.content.meta.title = title;

    const sb = getServerSupabase();

    if (!sb) {
      const existing = memoryStore.get(data.id);
      if (!existing || existing.owner_session_id !== ownerId) {
        throw new Error("Document not found or access denied");
      }
      const updated: DocumentRow = {
        ...existing,
        title,
        content: data.content,
        updated_at: now,
      };
      memoryStore.set(data.id, updated);
      return updated;
    }

    const { data: row, error } = await sb
      .from("documents")
      .update({
        title,
        content: data.content,
        updated_at: now,
      })
      .eq("id", data.id)
      .eq("owner_session_id", ownerId)
      .select()
      .single();

    if (error) throw new Error(`saveDoc failed: ${error.message}`);
    return row as DocumentRow;
  });

export const deleteDoc = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const ownerId = ensureOwnerSession();
    const sb = getServerSupabase();

    if (!sb) {
      const existing = memoryStore.get(data.id);
      if (!existing || existing.owner_session_id !== ownerId) {
        throw new Error("Document not found or access denied");
      }
      memoryStore.delete(data.id);
      return { success: true };
    }

    const { error } = await sb
      .from("documents")
      .delete()
      .eq("id", data.id)
      .eq("owner_session_id", ownerId);

    if (error) throw new Error(`deleteDoc failed: ${error.message}`);
    return { success: true };
  });

export const duplicateDoc = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const ownerId = ensureOwnerSession();
    const sb = getServerSupabase();
    const now = new Date().toISOString();

    if (!sb) {
      const existing = memoryStore.get(data.id);
      if (!existing || existing.owner_session_id !== ownerId) {
        throw new Error("Document not found or access denied");
      }
      const newId = crypto.randomUUID();
      const content = structuredClone(existing.content);
      content.meta.title = `${existing.title} (สำเนา)`;
      content.meta.updatedAt = now;
      content.meta.createdAt = now;
      const row: DocumentRow = {
        id: newId,
        owner_session_id: ownerId,
        title: content.meta.title,
        doc_type: existing.doc_type,
        template: existing.template,
        content,
        created_at: now,
        updated_at: now,
      };
      memoryStore.set(newId, row);
      return row;
    }

    const { data: existing, error: getErr } = await sb
      .from("documents")
      .select("*")
      .eq("id", data.id)
      .eq("owner_session_id", ownerId)
      .single();

    if (getErr || !existing) throw new Error("Document not found or access denied");

    const content = structuredClone(existing.content) as DocContent;
    content.meta.title = `${existing.title} (สำเนา)`;
    content.meta.updatedAt = now;
    content.meta.createdAt = now;

    const { data: row, error } = await sb
      .from("documents")
      .insert({
        owner_session_id: ownerId,
        title: content.meta.title,
        doc_type: existing.doc_type,
        template: existing.template,
        content,
      })
      .select()
      .single();

    if (error) throw new Error(`duplicateDoc failed: ${error.message}`);
    return row as DocumentRow;
  });

/** Phase 9: import a previously exported .project.json as a new document */
export const importDoc = createServerFn({ method: "POST" })
  .validator((data: { content: DocContent; title?: string }) => data)
  .handler(async ({ data }) => {
    const ownerId = ensureOwnerSession();
    const now = new Date().toISOString();
    const content = structuredClone(data.content);
    if (!content.meta || !content.steps || !content.pages) {
      throw new Error("ไฟล์โปรเจกต์ไม่ถูกต้อง (ต้องมี meta/steps/pages)");
    }
    content.meta.title =
      data.title ?? content.meta.title ?? "เอกสารนำเข้า";
    content.meta.createdAt = now;
    content.meta.updatedAt = now;
    if (!content.images) content.images = [];
    if (!content.objects) content.objects = [];
    if (!content.warnings) content.warnings = [];

    const docType = content.meta.docType;
    const templateId = content.meta.templateId;
    const sb = getServerSupabase();

    if (!sb) {
      const id = crypto.randomUUID();
      const row: DocumentRow = {
        id,
        owner_session_id: ownerId,
        title: content.meta.title,
        doc_type: docType,
        template: templateId,
        content,
        created_at: now,
        updated_at: now,
      };
      memoryStore.set(id, row);
      return row;
    }

    const { data: row, error } = await sb
      .from("documents")
      .insert({
        owner_session_id: ownerId,
        title: content.meta.title,
        doc_type: docType,
        template: templateId,
        content,
      })
      .select()
      .single();

    if (error) throw new Error(`importDoc failed: ${error.message}`);
    return row as DocumentRow;
  });
