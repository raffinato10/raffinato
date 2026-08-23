-- =============================================================================
-- 021_add_flat_shipping_settings.sql
-- Frete fixo por quantidade de itens, igual para todos os clientes (sem
-- depender de CEP nem de transportadora específica — o lojista despacha pela
-- transportadora que estiver mais barata/fácil no momento do envio).
--
-- Editável em Admin > Configurações > Frete.
-- =============================================================================

ALTER TABLE store_settings_public
  ADD COLUMN shipping_flat_threshold_qty  INTEGER       NOT NULL DEFAULT 5,
  ADD COLUMN shipping_flat_price_standard NUMERIC(10,2) NOT NULL DEFAULT 35.00,
  ADD COLUMN shipping_flat_price_above    NUMERIC(10,2) NOT NULL DEFAULT 40.00;

COMMENT ON COLUMN store_settings_public.shipping_flat_threshold_qty IS
  'Até essa quantidade de itens no pedido, cobra shipping_flat_price_standard; acima disso, shipping_flat_price_above.';
COMMENT ON COLUMN store_settings_public.shipping_flat_price_standard IS
  'Valor do frete para pedidos com até shipping_flat_threshold_qty itens.';
COMMENT ON COLUMN store_settings_public.shipping_flat_price_above IS
  'Valor do frete para pedidos acima de shipping_flat_threshold_qty itens.';
