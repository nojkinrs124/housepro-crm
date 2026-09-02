-- Прямая связь операции с объектом: нужна разделу «Управление».
-- До этого объект у платежа доставался только через договор
-- (transactions.contract_id → contracts.property_id), поэтому расходы по
-- объекту без договора — коммуналка, ремонт, разовые работы — ни к какому
-- объекту не относились и в доходность объекта не попадали.
alter table public.accounting_transactions
  add column if not exists property_id uuid references public.properties(id) on delete set null;

comment on column public.accounting_transactions.property_id is
  'Объект, к которому относится операция. Заполняется напрямую либо наследуется от договора.';

create index if not exists idx_accounting_txn_property
  on public.accounting_transactions (property_id);

-- Реестр задач и договоров по объекту читается на каждой карточке управления
create index if not exists idx_tasks_property
  on public.tasks (property_id);

create index if not exists idx_contracts_property
  on public.contracts (property_id);

-- Существующим операциям проставляем объект из их договора
update public.accounting_transactions t
   set property_id = c.property_id
  from public.contracts c
 where t.contract_id = c.id
   and t.property_id is null
   and c.property_id is not null;
