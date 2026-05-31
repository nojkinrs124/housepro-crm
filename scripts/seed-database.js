#!/usr/bin/env node

/**
 * HousePro CRM - Test Data Loader
 * 
 * Автоматически загружает тестовые данные в Supabase БД
 * 
 * Usage:
 *   npx node scripts/seed-database.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// ============================================================
// CONFIGURATION
// ============================================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables!');
  console.error('Please set:');
  console.error('  - NEXT_PUBLIC_SUPABASE_URL');
  console.error('  - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ============================================================
// HELPERS
// ============================================================

const log = {
  info: (msg) => console.log('ℹ️ ', msg),
  success: (msg) => console.log('✅ ', msg),
  error: (msg) => console.error('❌ ', msg),
  section: (msg) => console.log('\n📋 ' + msg + '\n'),
};

// ============================================================
// TEST DATA
// ============================================================

const testData = {
  users: [
    { id: '00000000-0000-0000-0000-000000000001', email: 'admin@housepro.dev', full_name: 'Администратор', role: 'admin', phone: '+7 (999) 111-11-11', is_active: true },
    { id: '00000000-0000-0000-0000-000000000002', email: 'manager1@housepro.dev', full_name: 'Иван Менеджер', role: 'manager', phone: '+7 (999) 222-22-22', is_active: true },
    { id: '00000000-0000-0000-0000-000000000003', email: 'manager2@housepro.dev', full_name: 'Мария Менеджер', role: 'manager', phone: '+7 (999) 333-33-33', is_active: true },
    { id: '00000000-0000-0000-0000-000000000004', email: 'agent1@housepro.dev', full_name: 'Петр Агент', role: 'agent', phone: '+7 (999) 444-44-44', is_active: true },
    { id: '00000000-0000-0000-0000-000000000005', email: 'agent2@housepro.dev', full_name: 'Анна Агент', role: 'agent', phone: '+7 (999) 555-55-55', is_active: true },
    { id: '00000000-0000-0000-0000-000000000006', email: 'agent3@housepro.dev', full_name: 'Сергей Агент', role: 'agent', phone: '+7 (999) 666-66-66', is_active: true },
    { id: '00000000-0000-0000-0000-000000000007', email: 'accountant@housepro.dev', full_name: 'Ольга Бухгалтер', role: 'accountant', phone: '+7 (999) 777-77-77', is_active: true },
  ],

  owners: [
    { id: '10000000-0000-0000-0000-000000000001', full_name: 'Владимир Васильевич Волков', phone: '+7 (999) 100-01-01', passport: '7700123456', comment: 'VIP собственник, надежный' },
    { id: '10000000-0000-0000-0000-000000000002', full_name: 'Елена Ивановна Иванова', phone: '+7 (999) 100-02-02', passport: '7700234567', comment: 'Хочет продать квартиру срочно' },
    { id: '10000000-0000-0000-0000-000000000003', full_name: 'Геннадий Петрович Петров', phone: '+7 (999) 100-03-03', passport: '7700345678', comment: 'Коммерческое помещение в центре' },
    { id: '10000000-0000-0000-0000-000000000004', full_name: 'Светлана Сергеевна Сергеева', phone: '+7 (999) 100-04-04', passport: '7700456789', comment: 'Несколько объектов в портфеле' },
    { id: '10000000-0000-0000-0000-000000000005', full_name: 'Константин Анатольевич Орлов', phone: '+7 (999) 100-05-05', passport: '7700567890', comment: 'Инвестор, интересуется сдачей' },
  ],

  clients: [
    { id: '20000000-0000-0000-0000-000000000001', full_name: 'Дмитрий Алексеевич Морозов', phone: '+7 (999) 200-01-01', telegram: '@morozov_dima', whatsapp: '+7 (999) 200-01-01', passport: '7700600001', birth_date: '1985-05-15', comment: 'Ищет трехкомнатную в центре', source: 'instagram', status: 'vip', manager_id: '00000000-0000-0000-0000-000000000002' },
    { id: '20000000-0000-0000-0000-000000000002', full_name: 'Юлия Викторовна Петрова', phone: '+7 (999) 200-02-02', telegram: '@yulya_petro', whatsapp: '+7 (999) 200-02-02', passport: '7700600002', birth_date: '1990-08-22', comment: 'Готова к сделке в течение недели', source: 'avito', status: 'vip', manager_id: '00000000-0000-0000-0000-000000000003' },
    { id: '20000000-0000-0000-0000-000000000003', full_name: 'Александр Сергеевич Новиков', phone: '+7 (999) 200-03-03', telegram: '@alex_novo', whatsapp: null, passport: '7700600003', birth_date: '1988-03-10', comment: 'Ищет двушку на юге города', source: 'yandex', status: 'active', manager_id: '00000000-0000-0000-0000-000000000004' },
  ],

  properties: [
    { id: '30000000-0000-0000-0000-000000000001', title: 'Квартира на Старом Арбате', property_type: 'apartment', deal_type: 'rent', address: 'ул. Старый Арбат, д. 25, кв. 100', district: 'Арбатская', price: 150000, deposit: 300000, area: 85, rooms: 3, floor: 5, description: 'Комфортная квартира с видом на Кремль', owner_id: '10000000-0000-0000-0000-000000000001', manager_id: '00000000-0000-0000-0000-000000000002', status: 'available' },
    { id: '30000000-0000-0000-0000-000000000002', title: 'Современная студия в ЦАО', property_type: 'apartment', deal_type: 'rent', address: 'ул. Тверская, д. 10, кв. 50', district: 'Тверская', price: 80000, deposit: 160000, area: 45, rooms: 1, floor: 3, description: 'Студия с евроремонтом, рядом метро', owner_id: '10000000-0000-0000-0000-000000000002', manager_id: '00000000-0000-0000-0000-000000000003', status: 'available' },
  ],

  leads: [
    { id: '40000000-0000-0000-0000-000000000001', full_name: 'Борис Юрьевич Смирнов', phone: '+7 (999) 300-01-01', telegram: null, whatsapp: null, source: 'avito', comment: 'Позвонил, интересуется трешкой', status: 'new', assigned_to: '00000000-0000-0000-0000-000000000004' },
    { id: '40000000-0000-0000-0000-000000000002', full_name: 'Лариса Ильинична Козлова', phone: '+7 (999) 300-02-02', telegram: '@larisa_koz', whatsapp: null, source: 'instagram', comment: 'Прошла консультацию', status: 'contacted', assigned_to: '00000000-0000-0000-0000-000000000005' },
  ],

  deals: [
    { id: '60000000-0000-0000-0000-000000000001', client_id: '20000000-0000-0000-0000-000000000001', owner_id: '10000000-0000-0000-0000-000000000001', property_id: '30000000-0000-0000-0000-000000000001', deal_type: 'rent', amount: 150000, commission: 300000, status: 'completed', manager_id: '00000000-0000-0000-0000-000000000002', notes: 'Успешная сделка, комиссия выплачена' },
  ],

  payments: [
    { id: '70000000-0000-0000-0000-000000000001', amount: 150000, payment_type: 'rent', payment_status: 'paid', payment_date: '2026-01-01', notes: 'Оплачено вовремя' },
    { id: '70000000-0000-0000-0000-000000000002', amount: 150000, payment_type: 'rent', payment_status: 'pending', payment_date: null, notes: 'Ожидается оплата' },
  ],

  tasks: [
    { id: '80000000-0000-0000-0000-000000000001', title: 'Подготовить договор для Морозова', description: 'Необходимо подготовить договор аренды квартиры на Старом Арбате', assigned_to: '00000000-0000-0000-0000-000000000002', created_by: '00000000-0000-0000-0000-000000000001', status: 'todo', priority: 'high', deadline: '2026-06-05' },
  ],
};

// ============================================================
// SEED FUNCTIONS
// ============================================================

async function seedTable(tableName, data) {
  if (!data || data.length === 0) {
    log.info(`Пропускаю ${tableName} - нет данных`);
    return;
  }

  try {
    const { error } = await supabase
      .from(tableName)
      .insert(data);

    if (error) {
      log.error(`${tableName}: ${error.message}`);
      if (error.details) log.error(`  Details: ${error.details}`);
      return false;
    }

    log.success(`${tableName}: загружено ${data.length} записей`);
    return true;
  } catch (err) {
    log.error(`${tableName}: ${err.message}`);
    return false;
  }
}

async function checkTableExists(tableName) {
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(1);

    return !error;
  } catch {
    return false;
  }
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  console.clear();
  console.log('═════════════════════════════════════════');
  console.log('  🌱 HousePro CRM - Database Seeder');
  console.log('═════════════════════════════════════════');
  console.log();

  log.section('1. Проверка подключения');

  try {
    const { data, error } = await supabase.auth.getSession();
    if (!error) {
      log.success('Подключено к Supabase');
    }
  } catch (err) {
    log.error('Не удалось подключиться к Supabase');
    log.error('Проверь переменные окружения');
    process.exit(1);
  }

  log.section('2. Проверка таблиц');

  const tables = ['users', 'owners', 'clients', 'properties', 'leads', 'deals', 'payments', 'tasks'];
  let allTablesExist = true;

  for (const table of tables) {
    const exists = await checkTableExists(table);
    if (exists) {
      log.success(`${table} существует`);
    } else {
      log.error(`${table} не найдена`);
      allTablesExist = false;
    }
  }

  if (!allTablesExist) {
    log.error('Не все таблицы созданы!');
    log.error('Выполни сначала: supabase/schema.sql');
    process.exit(1);
  }

  log.section('3. Загрузка данных');

  let successCount = 0;
  const totalTables = Object.keys(testData).length;

  for (const [tableName, data] of Object.entries(testData)) {
    const success = await seedTable(tableName, data);
    if (success) successCount++;
  }

  log.section('4. Результаты');

  log.success(`Успешно загружено: ${successCount}/${totalTables} таблиц`);

  if (successCount === totalTables) {
    console.log();
    console.log('═════════════════════════════════════════');
    console.log('  ✨ Готово! База данных наполнена');
    console.log('═════════════════════════════════════════');
    console.log();
    log.info('Теперь можешь запустить приложение:');
    console.log('  npm run dev');
    console.log();
    log.info('И открыть в браузере:');
    console.log('  http://localhost:3000');
  }

  process.exit(successCount === totalTables ? 0 : 1);
}

// Run
main();
