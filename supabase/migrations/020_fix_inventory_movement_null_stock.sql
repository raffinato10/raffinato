-- =============================================================================
-- 020_fix_inventory_movement_null_stock.sql
-- Corrige record_inventory_movement(): produtos com track_stock = FALSE têm
-- stock = NULL por design (estoque não controlado). O trigger não tratava
-- esse caso e tentava gravar quantity_before/quantity_after NULL em
-- inventory_movements, violando a constraint NOT NULL — isso travava a
-- confirmação de QUALQUER pedido pago que incluísse um produto sem controle
-- de estoque (orders.payment_status nunca chegava a 'confirmed').
--
-- Fix: os dois loops (baixa na confirmação, devolução no cancelamento) agora
-- só consideram itens cujo produto tem track_stock = TRUE, e pulam
-- defensivamente se o estoque ainda assim vier nulo.
-- =============================================================================

CREATE OR REPLACE FUNCTION record_inventory_movement()
RETURNS TRIGGER AS $$
DECLARE
  item RECORD;
  stock_before INTEGER;
BEGIN
  -- Só age quando status muda para 'payment_confirmed'
  IF NEW.payment_status = 'confirmed' AND (OLD.payment_status IS DISTINCT FROM 'confirmed') THEN
    FOR item IN
      SELECT oi.product_id, oi.quantity
      FROM order_items oi
      JOIN products p ON p.id = oi.product_id
      WHERE oi.order_id = NEW.id AND oi.product_id IS NOT NULL AND p.track_stock = TRUE
    LOOP
      SELECT stock INTO stock_before FROM products WHERE id = item.product_id;
      IF stock_before IS NULL THEN
        CONTINUE;
      END IF;

      UPDATE products
      SET stock = GREATEST(0, stock - item.quantity),
          updated_at = NOW()
      WHERE id = item.product_id;

      INSERT INTO inventory_movements (
        product_id, type, quantity_change,
        quantity_before, quantity_after,
        order_id, created_by
      ) VALUES (
        item.product_id,
        'sale',
        -item.quantity,
        stock_before,
        GREATEST(0, stock_before - item.quantity),
        NEW.id,
        'system'
      );
    END LOOP;
  END IF;

  -- Devolve estoque quando pedido é cancelado a partir de 'confirmed'
  IF NEW.payment_status != 'confirmed' AND OLD.payment_status = 'confirmed' AND NEW.status = 'cancelled' THEN
    FOR item IN
      SELECT oi.product_id, oi.quantity
      FROM order_items oi
      JOIN products p ON p.id = oi.product_id
      WHERE oi.order_id = NEW.id AND oi.product_id IS NOT NULL AND p.track_stock = TRUE
    LOOP
      SELECT stock INTO stock_before FROM products WHERE id = item.product_id;
      IF stock_before IS NULL THEN
        CONTINUE;
      END IF;

      UPDATE products
      SET stock = stock + item.quantity,
          updated_at = NOW()
      WHERE id = item.product_id;

      INSERT INTO inventory_movements (
        product_id, type, quantity_change,
        quantity_before, quantity_after,
        order_id, created_by
      ) VALUES (
        item.product_id,
        'cancelled_return',
        item.quantity,
        stock_before,
        stock_before + item.quantity,
        NEW.id,
        'system'
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;
