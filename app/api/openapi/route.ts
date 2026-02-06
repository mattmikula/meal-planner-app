import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

import { jsonError, logApiError } from "@/lib/api/helpers";

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "docs", "api", "openapi.yaml");
    const spec = await readFile(filePath, "utf8");

    return new NextResponse(spec, {
      status: 200,
      headers: {
        "content-type": "application/yaml; charset=utf-8",
        "cache-control": "no-store"
      }
    });
  } catch (error) {
    logApiError("openapi GET", error);
    return jsonError("Unable to load OpenAPI spec.", 500);
  }
}
