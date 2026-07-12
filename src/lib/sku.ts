// Gera o SKU de uma variação (cor+tamanho) a partir do SKU base da peça —
// usado como sugestão automática no admin (VariantEditor, ao vivo, ao
// escolher o tamanho) e como fallback no server (saveVariants) quando o
// campo de SKU chega vazio.
// Ex: generateVariantSku("CBA-00", "Preto", "P") -> "CBA-00-PRETO-P"

function stripDiacritics(value: string): string {
  // ̀-ͯ cobre os sinais diacríticos combinantes (acentos, til, etc.)
  // depois de normalize("NFD") separar a letra da marca.
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// Nome completo da cor, normalizado pra SKU — sem abreviar (ex: "Azul
// Marinho" -> "AZUL-MARINHO"), só removendo acento e trocando qualquer
// separador por hífen único.
function colorSlug(colorName: string): string {
  const cleaned = stripDiacritics(colorName)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return cleaned || "COR";
}

export function generateVariantSku(baseSku: string, colorName: string, size: string): string {
  const base = baseSku.trim().toUpperCase() || "SKU";
  const color = colorSlug(colorName || "Cor");
  const sizePart = size.trim().toUpperCase().replace(/\s+/g, "") || "UN";
  return `${base}-${color}-${sizePart}`;
}

// Mesma ideia, sem segmento de cor — usado pro produto "tamanho único" (sem
// variação de cor), onde generateVariantSku produziria um feio "-COR-" no
// meio do SKU. Ex: generateSizeSku("CAM-POLO-AZUL", "P") -> "CAM-POLO-AZUL-P"
export function generateSizeSku(baseSku: string, size: string): string {
  const base = baseSku.trim().toUpperCase() || "SKU";
  const sizePart = size.trim().toUpperCase().replace(/\s+/g, "") || "UN";
  return `${base}-${sizePart}`;
}
