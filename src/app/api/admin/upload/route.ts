import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB
const BUCKET = "product-images";

// ---------------------------------------------------------------------------
// Guard — requer sessão admin válida
// ---------------------------------------------------------------------------

async function getAdminUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const service = createServiceClient();
  const { data: profile } = await service
    .from("admin_profiles")
    .select("id")
    .eq("id", user.id)
    .single();

  return profile ? user : null;
}

// ---------------------------------------------------------------------------
// POST /api/admin/upload — assina uma URL de upload direto para
// product-images/{productId}/{name}. O arquivo NUNCA passa por esta function:
// ela só autoriza o caminho; o navegador sobe o arquivo direto pro Storage
// com o token retornado (ver src/lib/upload-client.ts). Isso evita o limite
// de ~4.5 MB no corpo de requisições de Serverless Functions da Vercel, que
// ficava abaixo do limite de 5 MB que o próprio app anunciava pro usuário.
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  let body: { productId?: string; fileName?: string; contentType?: string; fileSize?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { productId, fileName, contentType, fileSize } = body;

  if (!productId || !fileName || !contentType) {
    return NextResponse.json(
      { error: "Campos obrigatórios: productId, fileName, contentType" },
      { status: 400 }
    );
  }

  if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
    return NextResponse.json(
      { error: "Tipo não permitido. Use JPEG, PNG ou WEBP." },
      { status: 400 }
    );
  }

  if (typeof fileSize === "number" && fileSize > MAX_IMAGE_SIZE) {
    return NextResponse.json(
      { error: "Arquivo muito grande. Máximo: 5 MB." },
      { status: 400 }
    );
  }

  // Sanitiza productId (deve ser UUID)
  if (!/^[0-9a-f-]{36}$/i.test(productId)) {
    return NextResponse.json(
      { error: "productId inválido" },
      { status: 400 }
    );
  }

  const ext = fileName.split(".").pop()?.toLowerCase() ?? "jpg";
  const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const storagePath = `${productId}/${uniqueName}`;

  const service = createServiceClient();

  const { data, error: signError } = await service.storage
    .from(BUCKET)
    .createSignedUploadUrl(storagePath);

  if (signError || !data) {
    return NextResponse.json({ error: signError?.message ?? "Erro ao preparar upload" }, { status: 500 });
  }

  const {
    data: { publicUrl },
  } = service.storage.from(BUCKET).getPublicUrl(storagePath);

  return NextResponse.json({ token: data.token, path: storagePath, publicUrl });
}

// ---------------------------------------------------------------------------
// DELETE /api/admin/upload?path=xxx — remove arquivo órfão do storage
// ---------------------------------------------------------------------------

export async function DELETE(request: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const storagePath = request.nextUrl.searchParams.get("path");
  if (!storagePath) {
    return NextResponse.json({ error: "path é obrigatório" }, { status: 400 });
  }

  // Bloqueia path traversal
  if (storagePath.includes("..")) {
    return NextResponse.json({ error: "path inválido" }, { status: 400 });
  }

  const service = createServiceClient();
  const { error } = await service.storage.from(BUCKET).remove([storagePath]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
