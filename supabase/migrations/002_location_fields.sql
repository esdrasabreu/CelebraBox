-- Migration: 002_location_fields.sql
-- Adiciona colunas opcionais para o modelo desacoplado de localização
-- Seguro para execução no Supabase SQL Editor: não altera nem remove colunas existentes.

ALTER TABLE event_details 
  ADD COLUMN IF NOT EXISTS location_street TEXT,
  ADD COLUMN IF NOT EXISTS location_number TEXT,
  ADD COLUMN IF NOT EXISTS location_complement TEXT,
  ADD COLUMN IF NOT EXISTS location_neighborhood TEXT,
  ADD COLUMN IF NOT EXISTS location_postal_code TEXT,
  ADD COLUMN IF NOT EXISTS location_country TEXT DEFAULT 'Brasil',
  ADD COLUMN IF NOT EXISTS location_latitude NUMERIC,
  ADD COLUMN IF NOT EXISTS location_longitude NUMERIC,
  ADD COLUMN IF NOT EXISTS location_provider TEXT DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS location_provider_place_id TEXT;
