-- =============================================================================
-- 022_shipping_tiers.sql
-- Substitui os 3 campos fixos de frete (limite único + 2 preços) por uma
-- tabela de faixas — o lojista pode ter quantas faixas quiser
-- (ex.: 1-3 peças = R$30, 4-6 = R$50, 7-10 = R$100, ...).
--
-- Regra de aplicação (ver src/lib/shipping.ts): a faixa cuja [min_qty,
-- max_qty] contém a quantidade total de itens do pedido. max_qty NULL =
-- sem limite superior (útil pra última faixa, "10 ou mais"). Se a
-- quantidade não cair em nenhuma faixa (ex.: acima da maior definida sem
-- faixa aberta), usa o preço da faixa de maior min_qty como fallback —
-- o checkout nunca fica sem valor de frete.
-- =============================================================================

ALTER TABLE store_settings_public
  DROP COLUMN IF EXISTS shipping_flat_threshold_qty,
  DROP COLUMN IF EXISTS shipping_flat_price_standard,
  DROP COLUMN IF EXISTS shipping_flat_price_above;

CREATE TABLE shipping_tiers (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  min_qty    INTEGER     NOT NULL CHECK (min_qty >= 1),
  max_qty    INTEGER     CHECK (max_qty IS NULL OR max_qty >= min_qty),
  price      NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_shipping_tiers_min_qty ON shipping_tiers (min_qty);

ALTER TABLE shipping_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "faixas de frete são visíveis a todos"
  ON shipping_tiers FOR SELECT
  USING (TRUE);

CREATE POLICY "apenas admins gerenciam faixas de frete"
  ON shipping_tiers FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

INSERT INTO shipping_tiers (min_qty, max_qty, price) VALUES
  (1, 3,    30.00),
  (4, 6,    50.00),
  (7, 10,   100.00);
