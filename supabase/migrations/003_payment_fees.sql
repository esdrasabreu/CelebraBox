-- Migration: 003_payment_fees.sql
-- Adiciona suporte a repasse de taxas do Mercado Pago e Pix Direto sem taxa

ALTER TABLE payment_settings
  ADD COLUMN IF NOT EXISTS pass_fees_to_buyer BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS pix_fee_percent NUMERIC DEFAULT 0.99,
  ADD COLUMN IF NOT EXISTS card_fee_percent NUMERIC DEFAULT 4.98,
  ADD COLUMN IF NOT EXISTS enable_manual_pix BOOLEAN DEFAULT FALSE;

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS gift_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_id TEXT,
  ADD COLUMN IF NOT EXISTS external_reference TEXT;

-- RPC segura para visitantes públicos lerem apenas configurações não-sensíveis (sem expor gateway_access_token)
CREATE OR REPLACE FUNCTION get_public_payment_config(host_id_param UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'gatewayProvider', gateway_provider,
    'receiverName', receiver_name,
    'passFeesToBuyer', COALESCE(pass_fees_to_buyer, TRUE),
    'pixFeePercent', COALESCE(pix_fee_percent, 0.99),
    'cardFeePercent', COALESCE(card_fee_percent, 4.98),
    'enableManualPix', COALESCE(enable_manual_pix, FALSE),
    'pixKeyType', CASE WHEN COALESCE(enable_manual_pix, FALSE) THEN pix_key_type ELSE NULL END,
    'pixKey', CASE WHEN COALESCE(enable_manual_pix, FALSE) THEN pix_key ELSE NULL END,
    'city', CASE WHEN COALESCE(enable_manual_pix, FALSE) THEN city ELSE NULL END
  )
  INTO result
  FROM payment_settings
  WHERE host_id = host_id_param;

  RETURN result;
END;
$$;
