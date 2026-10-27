-- Fix: sem IP identificado (nem cf-connecting-ip nem x-forwarded-for) não pode cair num limite
-- compartilhado por todo mundo sem IP. Pula só a checagem por IP; o limite por formulário continua.

create or replace function public.respostas_limitar() returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_ip text;
begin
  if not public.chamada_anonima() then return new; end if;
  v_ip := public.ip_da_requisicao();
  if (v_ip is not null and public.limite_estourou('resposta:ip:' || v_ip, 20))
     or public.limite_estourou('resposta:formulario:' || new.formulario_id, 600) then
    raise exception 'muitos envios, tente de novo em instantes' using errcode = 'VT429';
  end if;
  return new;
end $$;

create or replace function public.eventos_limitar() returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_ip text;
begin
  if public.chamada_anonima() then
    v_ip := public.ip_da_requisicao();
    if v_ip is not null and public.limite_estourou('evento:ip:' || v_ip, 300) then
      return null;
    end if;
  end if;
  return new;
end $$;
