-- =============================================================================
-- SEED INICIAL — dados de desenvolvimento / homologação
-- IDs fixos para facilitar referências cruzadas e testes
-- NÃO executar em produção
-- =============================================================================

DO $$
DECLARE
  -- Categorias (topo: Masculino/Feminino; subcategorias vinculadas via parent_id)
  cat_masculino     UUID := 'aaaa0001-0000-0000-0000-000000000001';
  cat_feminino      UUID := 'aaaa0001-0000-0000-0000-000000000002';
  cat_camisa_masc   UUID := 'aaaa0001-0000-0000-0000-000000000003';
  cat_polo_masc     UUID := 'aaaa0001-0000-0000-0000-000000000004';
  cat_camisa_fem    UUID := 'aaaa0001-0000-0000-0000-000000000005';
  cat_moletom_fem   UUID := 'aaaa0001-0000-0000-0000-000000000006';

  -- Produtos
  prod_camiseta_masc UUID := 'bbbb0001-0000-0000-0000-000000000001';
  prod_polo_masc     UUID := 'bbbb0001-0000-0000-0000-000000000002';
  prod_camiseta_fem  UUID := 'bbbb0001-0000-0000-0000-000000000003';
  prod_moletom_fem   UUID := 'bbbb0001-0000-0000-0000-000000000004';

  -- Mídias de produto
  media_camiseta_masc_1 UUID := 'cccc0001-0000-0000-0000-000000000001';
  media_camiseta_masc_2 UUID := 'cccc0001-0000-0000-0000-000000000002';
  media_polo_masc_1     UUID := 'cccc0001-0000-0000-0000-000000000003';
  media_camiseta_fem_1  UUID := 'cccc0001-0000-0000-0000-000000000004';
  media_moletom_fem_1   UUID := 'cccc0001-0000-0000-0000-000000000005';

  -- Clientes
  cust_juliana      UUID := 'dddd0001-0000-0000-0000-000000000001';
  cust_ricardo      UUID := 'dddd0001-0000-0000-0000-000000000002';
  cust_amanda       UUID := 'dddd0001-0000-0000-0000-000000000003';
  cust_marcos       UUID := 'dddd0001-0000-0000-0000-000000000004';

  -- Pedidos
  ord_1             UUID := 'eeee0001-0000-0000-0000-000000000001';
  ord_2             UUID := 'eeee0001-0000-0000-0000-000000000002';
  ord_3             UUID := 'eeee0001-0000-0000-0000-000000000003';

  -- Cupons
  coup_bemvindo     UUID := 'ffff0001-0000-0000-0000-000000000001';
  coup_promo15      UUID := 'ffff0001-0000-0000-0000-000000000002';
  coup_fretegratis  UUID := 'ffff0001-0000-0000-0000-000000000003';
  coup_desconto50   UUID := 'ffff0001-0000-0000-0000-000000000004';
  coup_juliana      UUID := 'ffff0001-0000-0000-0000-000000000005';
  coup_blackfriday  UUID := 'ffff0001-0000-0000-0000-000000000006';

  -- Segmentos (buscados por nome)
  seg_vip_id        UUID;
  seg_recorrente_id UUID;

BEGIN

-- =============================================================================
-- CATEGORIAS
-- =============================================================================

INSERT INTO categories (id, parent_id, name, slug, short_description, full_description, icon, image_url, gradient, color_accent, display_order, is_active, is_featured_home) VALUES
  (cat_masculino, NULL, 'MASCULINO', 'masculino',
   'Camisas e Polos',
   'Camisetas e polos masculinas com modelagem premium e tecido de alta qualidade.',
   'Shirt', 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600',
   'from-stone-900 via-neutral-800 to-zinc-900', '#c9a84c', 0, TRUE, TRUE),

  (cat_feminino, NULL, 'FEMININO', 'feminino',
   'Camisas e Moletons',
   'Camisetas e moletons femininos com caimento premium e tecido de alta qualidade.',
   'Heart', 'https://images.unsplash.com/photo-1485462537746-965f33f7f6a7?w=600',
   'from-rose-900 via-neutral-800 to-zinc-900', '#c9a84c', 1, TRUE, TRUE),

  (cat_camisa_masc, cat_masculino, 'Camisa', 'camisa-masculina',
   'Camisetas masculinas premium.', NULL,
   'Shirt', 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600',
   NULL, '#c9a84c', 0, TRUE, FALSE),

  (cat_polo_masc, cat_masculino, 'Polo', 'polo-masculina',
   'Polos masculinas premium.', NULL,
   'Shirt', 'https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=600',
   NULL, '#c9a84c', 1, TRUE, FALSE),

  (cat_camisa_fem, cat_feminino, 'Camisa', 'camisa-feminina',
   'Camisetas femininas premium.', NULL,
   'Shirt', 'https://images.unsplash.com/photo-1485462537746-965f33f7f6a7?w=600',
   NULL, '#c9a84c', 0, TRUE, FALSE),

  (cat_moletom_fem, cat_feminino, 'Moletom', 'moletom-feminino',
   'Moletons femininos premium.', NULL,
   'Heart', 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=600',
   NULL, '#c9a84c', 1, TRUE, FALSE)

ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- PRODUTOS
-- =============================================================================

INSERT INTO products (
  id, name, slug, sku, category_id,
  price_pix, price_card, price_promotional, promotional_active,
  is_active, is_featured,
  short_description, description, benefits, specifications, warnings,
  stock, stock_minimum, availability,
  weight_kg, height_cm, width_cm, length_cm,
  allow_whatsapp
) VALUES

  -- Camiseta Básica Masculina
  (prod_camiseta_masc, 'Camiseta Básica Masculina — Preta', 'camiseta-basica-masculina-preta', 'CAM-MASC-PRETA-001', cat_camisa_masc,
   89.90, 94.90, NULL, FALSE,
   TRUE, TRUE,
   'Camiseta básica masculina 100% algodão, corte premium.',
   'Camiseta masculina confeccionada em algodão penteado de alta gramatura, com modelagem regular e acabamento premium. Conforto e durabilidade para o dia a dia.',
   '100% algodão penteado\nModelagem regular fit\nReforço nas costuras\nNão desbota',
   '[{"label":"Tecido","value":"100% algodão penteado"},{"label":"Tamanhos disponíveis","value":"P, M, G, GG"},{"label":"Modelagem","value":"Regular fit"},{"label":"Cuidados de lavagem","value":"Lavar à máquina, água fria"}]'::jsonb,
   NULL,
   40, 5, 'in_stock',
   0.20, 3, 25, 35,
   TRUE),

  -- Polo Masculina Piquet
  (prod_polo_masc, 'Polo Masculina Piquet — Azul Marinho', 'polo-masculina-piquet-azul-marinho', 'POLO-MASC-AZUL-001', cat_polo_masc,
   139.90, 146.90, 119.90, TRUE,
   TRUE, TRUE,
   'Polo masculina em piquet com gola e punho canelados.',
   'Polo masculina confeccionada em tecido piquet de alta qualidade, com gola e punhos canelados e botões em resina. Visual elegante para o dia a dia ou ocasiões casuais.',
   'Tecido piquet premium\nGola e punho canelados\nBotões em resina\nCaimento confortável',
   '[{"label":"Tecido","value":"Piquet 100% algodão"},{"label":"Tamanhos disponíveis","value":"P, M, G, GG, XG"},{"label":"Modelagem","value":"Slim fit"},{"label":"Cuidados de lavagem","value":"Lavar à máquina, não usar alvejante"}]'::jsonb,
   NULL,
   25, 5, 'in_stock',
   0.25, 3, 25, 35,
   TRUE),

  -- Camiseta Básica Feminina
  (prod_camiseta_fem, 'Camiseta Básica Feminina — Branca', 'camiseta-basica-feminina-branca', 'CAM-FEM-BRANCA-001', cat_camisa_fem,
   84.90, 89.90, NULL, FALSE,
   TRUE, TRUE,
   'Camiseta básica feminina 100% algodão, caimento premium.',
   'Camiseta feminina em algodão penteado com caimento que valoriza o corpo, gola careca e acabamento reforçado. Peça versátil para compor diferentes looks.',
   '100% algodão penteado\nCaimento feminino\nGola careca reforçada\nTecido macio',
   '[{"label":"Tecido","value":"100% algodão penteado"},{"label":"Tamanhos disponíveis","value":"PP, P, M, G, GG"},{"label":"Modelagem","value":"Caimento justo"},{"label":"Cuidados de lavagem","value":"Lavar à máquina, água fria"}]'::jsonb,
   NULL,
   35, 5, 'in_stock',
   0.18, 3, 24, 33,
   TRUE),

  -- Moletom Feminino com Capuz
  (prod_moletom_fem, 'Moletom Feminino com Capuz — Cinza Mescla', 'moletom-feminino-capuz-cinza-mescla', 'MOL-FEM-CINZA-001', cat_moletom_fem,
   189.90, 198.90, NULL, FALSE,
   TRUE, FALSE,
   'Moletom feminino com capuz, flanelado por dentro.',
   'Moletom feminino em moletom flanelado, com capuz forrado e bolso canguru. Quentinho e confortável, ideal para dias mais frios sem perder o estilo.',
   'Flanelado por dentro\nCapuz forrado\nBolso canguru\nPunhos e barra em ribana',
   '[{"label":"Tecido","value":"Moletom flanelado 100% algodão"},{"label":"Tamanhos disponíveis","value":"P, M, G, GG"},{"label":"Modelagem","value":"Caimento solto"},{"label":"Cuidados de lavagem","value":"Lavar à máquina, não usar secadora"}]'::jsonb,
   NULL,
   4, 5, 'low_stock',
   0.45, 5, 30, 40,
   TRUE)

ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- MÍDIAS DOS PRODUTOS
-- =============================================================================

INSERT INTO product_media (id, product_id, type, url, alt_text, display_order, is_main) VALUES
  (media_camiseta_masc_1, prod_camiseta_masc, 'image', 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800', 'Camiseta básica masculina preta', 1, TRUE),
  (media_camiseta_masc_2, prod_camiseta_masc, 'image', 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=800', 'Detalhe da camiseta masculina preta', 2, FALSE),
  (media_polo_masc_1,     prod_polo_masc,     'image', 'https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=800', 'Polo masculina azul marinho',           1, TRUE),
  (media_camiseta_fem_1,  prod_camiseta_fem,  'image', 'https://images.unsplash.com/photo-1485462537746-965f33f7f6a7?w=800', 'Camiseta básica feminina branca',       1, TRUE),
  (media_moletom_fem_1,   prod_moletom_fem,   'image', 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=800', 'Moletom feminino cinza mescla',         1, TRUE)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- CLIENTES
-- =============================================================================

INSERT INTO customers (
  id, name, email, phone, cpf_cnpj,
  street, number, complement, neighborhood, city, state, zip_code,
  is_vip, vip_marked_at,
  total_orders, total_spent, average_ticket, first_order_at, last_order_at,
  created_at, updated_at
) VALUES

  (cust_juliana, 'Juliana Ferreira', 'juliana.ferreira@email.com', '(11) 98765-4321', NULL,
   'Rua das Flores', '142', 'Apto 32', 'Jardim América', 'São Paulo', 'SP', '01410-000',
   TRUE, '2025-01-15T10:00:00Z',
   9, 1979.10, 219.90, '2024-01-20T10:00:00Z', '2025-06-12T10:00:00Z',
   '2024-01-20T10:00:00Z', '2025-06-12T10:00:00Z'),

  (cust_ricardo, 'Ricardo Mendes', 'ricardo.mendes@email.com', '(21) 97654-3210', NULL,
   'Av. Atlântica', '2000', 'Sala 402', 'Copacabana', 'Rio de Janeiro', 'RJ', '22070-010',
   TRUE, '2025-02-01T10:00:00Z',
   7, 1250.20, 178.60, '2024-03-05T10:00:00Z', '2025-06-10T10:00:00Z',
   '2024-03-05T10:00:00Z', '2025-06-10T10:00:00Z'),

  (cust_amanda, 'Amanda Costa', 'amanda.costa@email.com', '(31) 96543-2109', NULL,
   'Rua Pernambuco', '450', NULL, 'Funcionários', 'Belo Horizonte', 'MG', '30130-150',
   FALSE, NULL,
   3, 437.70, 145.90, '2025-01-10T10:00:00Z', '2025-05-28T10:00:00Z',
   '2025-01-10T10:00:00Z', '2025-05-28T10:00:00Z'),

  (cust_marcos, 'Marcos Oliveira', 'marcos.oliveira@email.com', '(51) 95432-1098', NULL,
   'Av. Ipiranga', '6681', 'Bloco B', 'Partenon', 'Porto Alegre', 'RS', '90619-900',
   FALSE, NULL,
   1, 189.90, 189.90, '2025-06-13T10:00:00Z', '2025-06-13T10:00:00Z',
   '2025-06-13T10:00:00Z', '2025-06-13T10:00:00Z')

ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Notas dos clientes
-- ---------------------------------------------------------------------------

INSERT INTO customer_notes (id, customer_id, note, created_by, created_at) VALUES
  ('aa010001-0000-0000-0000-000000000001', cust_juliana,
   'Prefere receber às terças e quintas. Sempre faz pedidos de alto valor.',
   'admin', '2025-03-10T10:00:00Z'),
  ('aa010001-0000-0000-0000-000000000002', cust_juliana,
   'Solicitou cupom exclusivo para próxima compra — enviado em 10/06.',
   'admin', '2025-06-10T10:00:00Z'),
  ('aa010001-0000-0000-0000-000000000003', cust_ricardo,
   'Cliente VIP — prioridade no atendimento. Prefere contato via WhatsApp.',
   'admin', '2025-02-01T10:00:00Z')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Memberships de segmento
-- ---------------------------------------------------------------------------

SELECT id INTO seg_vip_id FROM customer_segments WHERE name = 'VIP' LIMIT 1;
SELECT id INTO seg_recorrente_id FROM customer_segments WHERE name = 'Recorrente' LIMIT 1;

IF seg_vip_id IS NOT NULL AND seg_recorrente_id IS NOT NULL THEN
  INSERT INTO customer_segment_memberships (customer_id, segment_id) VALUES
    (cust_juliana, seg_vip_id),
    (cust_ricardo, seg_vip_id),
    (cust_amanda,  seg_recorrente_id)
  ON CONFLICT DO NOTHING;
END IF;

-- =============================================================================
-- CUPONS
-- =============================================================================

INSERT INTO coupons (
  id, code, description_internal, type, value, is_active,
  start_date, expiration_date, max_uses_total, max_uses_per_customer, min_order_value,
  customer_specific_id, customer_specific_name, uses_count
) VALUES

  (coup_bemvindo, 'BEMVINDO10', 'Cupom de boas-vindas para novos clientes — 10% off',
   'percentage', 10, TRUE,
   '2025-01-01', '2025-12-31', 500, 1, 200.00,
   NULL, NULL, 87),

  (coup_promo15, 'PROMO15', 'Promoção junho — 15% em toda a coleção',
   'percentage', 15, TRUE,
   '2025-06-01', '2025-06-30', 100, 2, 400.00,
   NULL, NULL, 23),

  (coup_fretegratis, 'FRETEGRATIS', 'Frete grátis sem valor mínimo',
   'free_shipping', 0, TRUE,
   NULL, '2025-07-31', NULL, 1, NULL,
   NULL, NULL, 41),

  (coup_desconto50, 'DESCONTO50', 'R$50 de desconto em pedidos acima de R$500',
   'fixed', 50, TRUE,
   NULL, '2025-08-31', NULL, NULL, 500.00,
   NULL, NULL, 15),

  (coup_juliana, 'JULIANA10', 'Cupom exclusivo para Juliana Ferreira — cliente VIP',
   'percentage', 10, TRUE,
   NULL, '2025-07-14', 3, 3, NULL,
   cust_juliana, 'Juliana Ferreira', 1),

  (coup_blackfriday, 'BLACKFRIDAY2024', 'Black Friday 2024 — 20% em tudo',
   'percentage', 20, FALSE,
   '2024-11-29', '2024-11-30', 1000, NULL, NULL,
   NULL, NULL, 234)

ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- PEDIDOS
-- =============================================================================

INSERT INTO orders (
  id, order_number, customer_id, customer_name, customer_phone, customer_email,
  status, payment_status, payment_method, payment_id,
  shipping_street, shipping_number, shipping_complement, shipping_neighborhood,
  shipping_city, shipping_state, shipping_zip_code,
  subtotal, coupon_code, coupon_discount, shipping_value, shipping_service, total,
  created_at, updated_at
) VALUES

  (ord_1, 'ORD-20250614-0001', cust_juliana, 'Juliana Ferreira', '(11) 98765-4321', 'juliana.ferreira@email.com',
   'awaiting_separation', 'confirmed', 'pix', 'mp-pay-001',
   'Rua das Flores', '142', 'Apto 32', 'Jardim América', 'São Paulo', 'SP', '01410-000',
   179.80, 'JULIANA10', 17.98, 28.90, 'SEDEX', 190.72,
   '2025-06-14T09:15:00Z', '2025-06-14T10:00:00Z'),

  (ord_2, 'ORD-20250614-0002', cust_ricardo, 'Ricardo Mendes', '(21) 97654-3210', 'ricardo.mendes@email.com',
   'pending_payment', 'pending', 'pix', NULL,
   'Av. Atlântica', '2000', 'Sala 402', 'Copacabana', 'Rio de Janeiro', 'RJ', '22070-010',
   139.90, NULL, 0, 35.50, 'SEDEX', 175.40,
   '2025-06-14T11:20:00Z', '2025-06-14T11:20:00Z'),

  (ord_3, 'ORD-20250613-0003', cust_amanda, 'Amanda Costa', '(31) 96543-2109', 'amanda.costa@email.com',
   'delivered', 'confirmed', 'pix', 'mp-pay-003',
   'Rua Pernambuco', '450', NULL, 'Funcionários', 'Belo Horizonte', 'MG', '30130-150',
   84.90, 'BEMVINDO10', 8.49, 15.90, 'PAC', 92.31,
   '2025-06-13T15:30:00Z', '2025-06-14T08:00:00Z')

ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Itens dos pedidos
-- ---------------------------------------------------------------------------

INSERT INTO order_items (
  id, order_id, product_id,
  product_name, product_sku, product_image,
  quantity, unit_price_pix, unit_price_card, subtotal
) VALUES

  ('aa020001-0000-0000-0000-000000000001', ord_1, prod_camiseta_masc,
   'Camiseta Básica Masculina — Preta', 'CAM-MASC-PRETA-001',
   'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=200',
   2, 89.90, 94.90, 179.80),

  ('aa020001-0000-0000-0000-000000000002', ord_2, prod_polo_masc,
   'Polo Masculina Piquet — Azul Marinho', 'POLO-MASC-AZUL-001',
   'https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=200',
   1, 139.90, 146.90, 139.90),

  ('aa020001-0000-0000-0000-000000000003', ord_3, prod_camiseta_fem,
   'Camiseta Básica Feminina — Branca', 'CAM-FEM-BRANCA-001',
   'https://images.unsplash.com/photo-1485462537746-965f33f7f6a7?w=200',
   1, 84.90, 89.90, 84.90)

ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Histórico de status dos pedidos
-- ---------------------------------------------------------------------------

INSERT INTO order_status_history (id, order_id, previous_status, new_status, changed_by, created_at) VALUES
  ('aa030001-0000-0000-0000-000000000001', ord_1, NULL,                  'pending_payment',      'system', '2025-06-14T09:15:00Z'),
  ('aa030001-0000-0000-0000-000000000002', ord_1, 'pending_payment',     'payment_confirmed',    'system', '2025-06-14T09:18:00Z'),
  ('aa030001-0000-0000-0000-000000000003', ord_1, 'payment_confirmed',   'awaiting_separation',  'admin',  '2025-06-14T10:00:00Z'),
  ('aa030001-0000-0000-0000-000000000004', ord_2, NULL,                  'pending_payment',      'system', '2025-06-14T11:20:00Z'),
  ('aa030001-0000-0000-0000-000000000005', ord_3, NULL,                  'pending_payment',      'system', '2025-06-13T15:30:00Z'),
  ('aa030001-0000-0000-0000-000000000006', ord_3, 'pending_payment',     'payment_confirmed',    'system', '2025-06-13T15:33:00Z'),
  ('aa030001-0000-0000-0000-000000000007', ord_3, 'payment_confirmed',   'awaiting_separation',  'admin',  '2025-06-13T16:00:00Z'),
  ('aa030001-0000-0000-0000-000000000008', ord_3, 'awaiting_separation', 'shipped',              'admin',  '2025-06-13T18:00:00Z'),
  ('aa030001-0000-0000-0000-000000000009', ord_3, 'shipped',             'delivered',            'system', '2025-06-14T08:00:00Z')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Pagamentos (apenas para pedidos com payment_status = confirmed)
-- ---------------------------------------------------------------------------

INSERT INTO payments (
  id, order_id, method, status, amount, external_id, paid_at
) VALUES
  ('aa040001-0000-0000-0000-000000000001', ord_1, 'pix', 'confirmed', 190.72, 'mp-pay-001', '2025-06-14T09:18:00Z'),
  ('aa040001-0000-0000-0000-000000000002', ord_3, 'pix', 'confirmed', 92.31,  'mp-pay-003', '2025-06-13T15:33:00Z')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Usos de cupom
-- ---------------------------------------------------------------------------

INSERT INTO coupon_usages (id, coupon_id, order_id, customer_email, discount_applied, created_at) VALUES
  ('aa050001-0000-0000-0000-000000000001', coup_juliana,  ord_1, 'juliana.ferreira@email.com', 17.98, '2025-06-14T09:15:00Z'),
  ('aa050001-0000-0000-0000-000000000002', coup_bemvindo, ord_3, 'amanda.costa@email.com',      8.49, '2025-06-13T15:30:00Z')
ON CONFLICT DO NOTHING;

-- =============================================================================
-- NOTIFICAÇÕES INICIAIS (exemplos para o painel)
-- =============================================================================

INSERT INTO notifications (id, type, title, body, data, is_read, created_at) VALUES
  ('aa060001-0000-0000-0000-000000000001',
   'new_order', 'Novo pedido recebido',
   'Pedido ORD-20250614-0001 de Juliana Ferreira — R$ 190,72',
   '{"order_id":"eeee0001-0000-0000-0000-000000000001","order_number":"ORD-20250614-0001"}'::jsonb,
   TRUE, '2025-06-14T09:15:00Z'),

  ('aa060001-0000-0000-0000-000000000002',
   'payment_confirmed', 'Pagamento confirmado',
   'Pedido ORD-20250614-0001 de Juliana Ferreira teve o Pix confirmado.',
   '{"order_id":"eeee0001-0000-0000-0000-000000000001"}'::jsonb,
   TRUE, '2025-06-14T09:18:00Z'),

  ('aa060001-0000-0000-0000-000000000003',
   'new_order', 'Novo pedido recebido',
   'Pedido ORD-20250614-0002 de Ricardo Mendes — R$ 175,40',
   '{"order_id":"eeee0001-0000-0000-0000-000000000002","order_number":"ORD-20250614-0002"}'::jsonb,
   FALSE, '2025-06-14T11:20:00Z'),

  ('aa060001-0000-0000-0000-000000000004',
   'stock_alert', 'Estoque baixo',
   'Produto "Moletom Feminino com Capuz — Cinza Mescla" com 4 unidades (mínimo: 5)',
   '{"product_id":"bbbb0001-0000-0000-0000-000000000004","stock":4}'::jsonb,
   FALSE, '2025-06-14T09:00:00Z')

ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- CORREÇÃO DE MÉTRICAS DOS CLIENTES
-- trg_update_customer_metrics dispara no INSERT de orders e recalcula apenas
-- os pedidos confirmados do seed (1 por cliente), sobrescrevendo os valores
-- históricos seeded. As UPDATEs abaixo restauram o estado demo pretendido.
-- =============================================================================

UPDATE customers SET
  total_orders   = 9,
  total_spent    = 1979.10,
  average_ticket = 219.90,
  first_order_at = '2024-01-20T10:00:00Z',
  last_order_at  = '2025-06-12T10:00:00Z'
WHERE id = cust_juliana;

UPDATE customers SET
  total_orders   = 7,
  total_spent    = 1250.20,
  average_ticket = 178.60,
  first_order_at = '2024-03-05T10:00:00Z',
  last_order_at  = '2025-06-10T10:00:00Z'
WHERE id = cust_ricardo;

UPDATE customers SET
  total_orders   = 3,
  total_spent    = 437.70,
  average_ticket = 145.90,
  first_order_at = '2025-01-10T10:00:00Z',
  last_order_at  = '2025-05-28T10:00:00Z'
WHERE id = cust_amanda;

END $$;
