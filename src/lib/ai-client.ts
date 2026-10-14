/**
 * Browser client for /api/ai-convert — never sends API keys.
 */

import type { AiDocOutput } from "./ai-schema";
import type { VerifyResult } from "./ai-verify";
import type { DocType } from "./doc-model";

export interface AiConvertSuccess {
  output: AiDocOutput;
  verification: VerifyResult;
  meta: {
    model: string;
    sourceLength: number;
    generatedAt: string;
  };
}

export interface AiConvertError {
  error: string;
  code: string;
  hint?: string;
  details?: unknown;
  preview?: string;
}

export async function requestAiConvert(params: {
  text: string;
  docType: DocType;
  templateId?: string;
}): Promise<AiConvertSuccess> {
  const res = await fetch("/api/ai-convert", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  const data = await res.json();

  if (!res.ok) {
    const err = data as AiConvertError;
    const msg = err.error || `HTTP ${res.status}`;
    const e = new Error(msg) as Error & { code?: string };
    e.code = err.code;
    throw e;
  }

  return data as AiConvertSuccess;
}
