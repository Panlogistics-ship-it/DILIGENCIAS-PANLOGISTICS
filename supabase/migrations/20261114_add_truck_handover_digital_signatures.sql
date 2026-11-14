-- Firmas digitales para cierre del control semanal del Hino AT8811.
-- Compatible con bases existentes: no modifica ni elimina registros.
alter table public.truck_handover_records
  add column if not exists delivered_signature_path text,
  add column if not exists received_signature_path text;
