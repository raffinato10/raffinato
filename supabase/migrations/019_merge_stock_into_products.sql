-- =============================================================================
-- 019_merge_stock_into_products.sql
-- Remove a área separada "Estoque" (stock_items) e a camada de curadoria de
-- cores (product_colors/product_color_images) criadas em 015/016. A partir
-- de agora todo produto é sempre dono direto das suas variações (cor) e
-- tamanhos — nunca mais existe "peça de estoque" nem "produto vinculado".
--
-- Fonte de verdade única, daqui pra frente: products → product_variants
-- (cor) → product_variant_sizes (tamanho + estoque). Nada muda na forma
-- dessas duas últimas tabelas nem no trigger de baixa/devolução de estoque
-- (record_inventory_movement) — ele já decrementa product_variant_sizes por
-- id, independente de quem é o dono da variante. Pedidos e histórico de
-- estoque (inventory_movements) são preservados integralmente.
--
-- Passo a passo (idempotente — seguro rodar mais de uma vez):
--   1. Reparenta as variantes de peças vinculadas (stock_item_id) para o
--      produto vinculado (product_id), preservando a ordem/seleção da
--      curadoria (product_colors) quando existir.
--   2. Copia para product_variant_media as imagens que o produto tinha
--      adicionado por conta própria na curadoria (product_color_images com
--      source='upload') — as com source='stock' já são o mesmo arquivo que
--      product_variant_media, não precisam ser copiadas de novo.
--   3. Remove variantes de peças que NUNCA foram vinculadas a nenhum
--      produto (não há pedido possível referenciando-as — o checkout só
--      aceita variant_size_id de uma peça através de um produto vinculado).
--   4. Derruba a dualidade de dono (product_id OU stock_item_id) — a partir
--      daqui product_id é sempre obrigatório.
--   5. Remove as tabelas/colunas que deixaram de ter uso: stock_items,
--      product_colors, product_color_images, products.stock_item_id,
--      product_variants.stock_item_id.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Reparenta variantes vinculadas a uma peça para o produto vinculado,
--    aplicando a ordem de exibição da curadoria (product_colors) quando
--    existir, e apagando (via is_active=false) as cores que a curadoria
--    tinha deixado de fora — nunca perde o estoque, só deixa de exibir,
--    igual ao comportamento de "cor inativa" que já existia.
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  reparented_count INTEGER;
  orphan_count INTEGER;
BEGIN
  -- Aplica a ordem de exibição escolhida na curadoria (product_colors) —
  -- garante que a cor marcada como principal continue sendo a primeira
  -- (mesma regra de ordenação usada por attachStockItemVariants no código).
  UPDATE product_variants v
  SET display_order = ranked.new_order
  FROM (
    SELECT
      pc.variant_id,
      ROW_NUMBER() OVER (
        PARTITION BY pc.product_id
        ORDER BY pc.is_main DESC, pc.display_order ASC
      ) - 1 AS new_order
    FROM product_colors pc
  ) AS ranked
  WHERE v.id = ranked.variant_id;

  -- Reparenta: dono passa a ser o produto (product_id), nunca mais a peça.
  -- Cores que não têm linha em product_colors (fora da curadoria escolhida
  -- pelo admin) ficam inativas — preserva o estoque histórico sem exibi-las.
  UPDATE product_variants v
  SET
    product_id = p.id,
    stock_item_id = NULL,
    is_active = v.is_active AND EXISTS (
      SELECT 1 FROM product_colors pc WHERE pc.variant_id = v.id AND pc.product_id = p.id
    )
  FROM products p
  WHERE v.stock_item_id IS NOT NULL
    AND p.stock_item_id = v.stock_item_id;

  GET DIAGNOSTICS reparented_count = ROW_COUNT;
  RAISE NOTICE '019_merge_stock_into_products: % variante(s) reparentada(s) de stock_items para products.', reparented_count;

  -- Variantes de peças que nunca foram vinculadas a nenhum produto — sem
  -- produto, sem pedido possível (o checkout só aceita variant_size_id de
  -- uma peça através do product_id.stock_item_id do produto vinculado).
  -- Seguro remover: o ON DELETE CASCADE limpa media/sizes dessas variantes.
  SELECT COUNT(*) INTO orphan_count FROM product_variants WHERE stock_item_id IS NOT NULL;
  IF orphan_count > 0 THEN
    RAISE NOTICE '019_merge_stock_into_products: removendo % variante(s) de peça(s) nunca vinculada(s) a um produto.', orphan_count;
    DELETE FROM product_variants WHERE stock_item_id IS NOT NULL;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 2. Copia pro "acervo" oficial da variante (product_variant_media) as
--    imagens que o produto tinha adicionado por conta própria na curadoria
--    (source='upload') e que ainda não existem lá — nunca marca como
--    principal/hover (evita violar os índices únicos parciais); a ordem de
--    exibição continua depois das imagens que já existiam.
-- -----------------------------------------------------------------------------

INSERT INTO product_variant_media (variant_id, url, storage_path, is_main, is_hover, display_order)
SELECT
  pc.variant_id,
  pci.url,
  pci.storage_path,
  FALSE,
  FALSE,
  COALESCE((SELECT MAX(m.display_order) + 1 FROM product_variant_media m WHERE m.variant_id = pc.variant_id), 0)
    + ROW_NUMBER() OVER (PARTITION BY pc.variant_id ORDER BY pci.display_order) - 1
FROM product_color_images pci
JOIN product_colors pc ON pc.id = pci.product_color_id
WHERE pci.source = 'upload'
  AND NOT EXISTS (
    SELECT 1 FROM product_variant_media m WHERE m.variant_id = pc.variant_id AND m.url = pci.url
  );

-- -----------------------------------------------------------------------------
-- 3. Remove a dualidade de dono — product_id passa a ser sempre obrigatório.
-- -----------------------------------------------------------------------------

ALTER TABLE product_variants DROP CONSTRAINT IF EXISTS product_variants_owner_check;

ALTER TABLE product_variants ALTER COLUMN product_id SET NOT NULL;

-- Policies simplificadas — sem o branch "dono = peça" (pré-015_stock_items).
-- Precisa rodar antes do DROP COLUMN stock_item_id abaixo: as policies
-- antigas (pré-019) dependem dessa coluna e bloqueiam a remoção.
DROP POLICY IF EXISTS "variantes ativas são públicas" ON product_variants;
DROP POLICY IF EXISTS "variantes de produtos ativos são públicas" ON product_variants;
CREATE POLICY "variantes de produtos ativos são públicas"
  ON product_variants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = product_variants.product_id AND (p.is_active = TRUE OR is_admin())
    )
  );

DROP POLICY IF EXISTS "mídias de variantes ativas são públicas" ON product_variant_media;
DROP POLICY IF EXISTS "mídias de variantes de produtos ativos são públicas" ON product_variant_media;
CREATE POLICY "mídias de variantes de produtos ativos são públicas"
  ON product_variant_media FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM product_variants v
      JOIN products p ON p.id = v.product_id
      WHERE v.id = product_variant_media.variant_id AND (p.is_active = TRUE OR is_admin())
    )
  );

DROP POLICY IF EXISTS "tamanhos de variantes ativas são públicos" ON product_variant_sizes;
DROP POLICY IF EXISTS "tamanhos de variantes de produtos ativos são públicos" ON product_variant_sizes;
CREATE POLICY "tamanhos de variantes de produtos ativos são públicos"
  ON product_variant_sizes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM product_variants v
      JOIN products p ON p.id = v.product_id
      WHERE v.id = product_variant_sizes.variant_id AND (p.is_active = TRUE OR is_admin())
    )
  );

DROP INDEX IF EXISTS idx_product_variants_stock_item;
ALTER TABLE product_variants DROP COLUMN IF EXISTS stock_item_id;

-- -----------------------------------------------------------------------------
-- 4. Remove a curadoria (product_colors/product_color_images) — sem mais
--    utilidade: a ordem/seleção já foi aplicada no passo 1, e as imagens
--    "upload" já foram copiadas no passo 2.
-- -----------------------------------------------------------------------------

DROP TABLE IF EXISTS product_color_images;
DROP TABLE IF EXISTS product_colors;

-- -----------------------------------------------------------------------------
-- 5. Remove o vínculo produto → peça e a tabela de peças.
-- -----------------------------------------------------------------------------

ALTER TABLE products DROP CONSTRAINT IF EXISTS products_stock_item_unique;
ALTER TABLE products DROP COLUMN IF EXISTS stock_item_id;

DROP TABLE IF EXISTS stock_items;

COMMENT ON TABLE product_variants IS 'Uma cor de um produto — sempre pertence diretamente a um produto (product_id). Fonte de verdade de estoque: product_variants (cor) → product_variant_sizes (tamanho + quantidade).';
