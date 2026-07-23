"use client";

// Upload de imagens de produto direto do navegador para o Supabase Storage.
//
// Antes, o arquivo inteiro ia dentro do corpo de um POST para uma Route
// Handler (/api/admin/upload), que por sua vez repassava pro Storage. Isso
// esbarra num limite rígido da Vercel de ~4.5 MB no corpo de requisições de
// Serverless Functions — abaixo do limite de 5 MB que o próprio app anuncia
// pro usuário, então qualquer foto nessa faixa falhava sempre, de forma
// determinística (não era instabilidade de rede: a requisição nem chegava a
// ser registrada na função).
//
// Fix: a Route Handler agora só devolve uma URL assinada de upload (uma
// chamada pequena, sem o arquivo); o arquivo em si vai direto do navegador
// pro Storage, sem passar pela function — sem limite de 4.5 MB no caminho.

import { createClient } from "@/lib/supabase/client";

const BUCKET = "product-images";

export interface UploadResult {
  url: string;
  storagePath: string;
}

export async function uploadProductImage(file: File, productId: string): Promise<UploadResult> {
  const signRes = await fetch("/api/admin/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      productId,
      fileName: file.name,
      contentType: file.type,
      fileSize: file.size,
    }),
  });

  const signJson = await signRes.json();
  if (!signRes.ok) {
    throw new Error(signJson.error ?? "Erro ao preparar upload");
  }

  const { token, path, publicUrl } = signJson as { token: string; path: string; publicUrl: string };

  const supabase = createClient();
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .uploadToSignedUrl(path, token, file, { contentType: file.type });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  return { url: publicUrl, storagePath: path };
}
