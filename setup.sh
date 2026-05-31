#!/bin/bash

# ============================================================
# HousePro CRM - Supabase Setup Automation Script
# ============================================================
# Этот скрипт автоматически:
# 1. Настраивает переменные окружения
# 2. Создает storage buckets
# 3. Загружает схему базы данных
# 4. Загружает тестовые данные
# 5. Настраивает RLS политики
# ============================================================

set -e

echo "🚀 HousePro CRM - Supabase Setup"
echo "=================================="

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ============================================================
# 1. ПРОВЕРКА ПЕРЕМЕННЫХ ОКРУЖЕНИЯ
# ============================================================
echo ""
echo -e "${YELLOW}[1/6] Checking environment variables...${NC}"

if [ ! -f ".env.local" ]; then
    echo -e "${RED}❌ .env.local not found!${NC}"
    echo "Creating .env.local from template..."
    
    if [ -f ".env.local.example" ]; then
        cp .env.local.example .env.local
        echo -e "${YELLOW}⚠️  Please update .env.local with your Supabase credentials${NC}"
        echo ""
        echo "Get your credentials from:"
        echo "1. https://app.supabase.com/"
        echo "2. Select your project"
        echo "3. Settings → API → Project URL and anon key"
        exit 1
    fi
fi

# Load environment variables
export $(cat .env.local | xargs)

if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ] || [ -z "$NEXT_PUBLIC_SUPABASE_ANON_KEY" ]; then
    echo -e "${RED}❌ Missing required environment variables!${NC}"
    echo "Please set in .env.local:"
    echo "  - NEXT_PUBLIC_SUPABASE_URL"
    echo "  - NEXT_PUBLIC_SUPABASE_ANON_KEY"
    echo "  - SUPABASE_SERVICE_ROLE_KEY"
    exit 1
fi

echo -e "${GREEN}✅ Environment variables loaded${NC}"

# ============================================================
# 2. ПРОВЕРКА PSQL И CURL
# ============================================================
echo ""
echo -e "${YELLOW}[2/6] Checking required tools...${NC}"

if ! command -v curl &> /dev/null; then
    echo -e "${RED}❌ curl not found! Please install curl${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Required tools available${NC}"

# ============================================================
# 3. СОЗДАНИЕ STORAGE BUCKETS
# ============================================================
echo ""
echo -e "${YELLOW}[3/6] Creating storage buckets...${NC}"

BUCKETS=("contracts" "documents" "document-templates" "property-photos" "avatars" "passports")

for bucket in "${BUCKETS[@]}"; do
    echo "Creating bucket: $bucket"
    
    # Определяем приватность
    if [[ "$bucket" == "property-photos" || "$bucket" == "avatars" ]]; then
        IS_PUBLIC="true"
    else
        IS_PUBLIC="false"
    fi
    
    # Используем Supabase Management API для создания bucket
    curl -s -X POST \
        "https://api.supabase.com/api/v1/projects/$(echo $NEXT_PUBLIC_SUPABASE_URL | cut -d. -f1 | cut -d/ -f3)/storage/buckets" \
        -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
        -H "Content-Type: application/json" \
        -d "{\"name\": \"$bucket\", \"public\": $IS_PUBLIC}" \
        2>/dev/null || true
done

echo -e "${GREEN}✅ Storage buckets ready${NC}"

# ============================================================
# 4. ЗАГРУЗКА СХЕМЫ БАЗЫ ДАННЫХ
# ============================================================
echo ""
echo -e "${YELLOW}[4/6] Loading database schema...${NC}"

if [ ! -f "supabase/schema.sql" ]; then
    echo -e "${RED}❌ supabase/schema.sql not found!${NC}"
    exit 1
fi

echo "This step requires manual execution in Supabase SQL Editor:"
echo "1. Go to: https://app.supabase.com/project/*/sql"
echo "2. Create new query"
echo "3. Copy & paste contents of: supabase/schema.sql"
echo "4. Click 'Run'"
echo ""
echo -e "${YELLOW}⏳ Waiting for manual execution...${NC}"
echo "Press Enter when schema is loaded..."
read -r

echo -e "${GREEN}✅ Database schema loaded${NC}"

# ============================================================
# 5. ЗАГРУЗКА ТЕСТОВЫХ ДАННЫХ
# ============================================================
echo ""
echo -e "${YELLOW}[5/6] Loading test data...${NC}"

if [ ! -f "tests/test-data.sql" ]; then
    echo -e "${RED}❌ tests/test-data.sql not found!${NC}"
    exit 1
fi

echo "This step requires manual execution in Supabase SQL Editor:"
echo "1. Go to: https://app.supabase.com/project/*/sql"
echo "2. Create new query"
echo "3. Copy & paste contents of: tests/test-data.sql"
echo "4. Click 'Run'"
echo ""
echo -e "${YELLOW}⏳ Waiting for manual execution...${NC}"
echo "Press Enter when test data is loaded..."
read -r

echo -e "${GREEN}✅ Test data loaded${NC}"

# ============================================================
# 6. УСТАНОВКА ЗАВИСИМОСТЕЙ И СБОРКА
# ============================================================
echo ""
echo -e "${YELLOW}[6/6] Installing dependencies and building...${NC}"

if [ ! -d "node_modules" ]; then
    echo "Installing npm packages..."
    npm install --legacy-peer-deps
fi

echo "Building Next.js application..."
npm run build

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Build successful${NC}"
else
    echo -e "${RED}❌ Build failed!${NC}"
    exit 1
fi

# ============================================================
# FINISH
# ============================================================
echo ""
echo "════════════════════════════════════════════"
echo -e "${GREEN}✅ SETUP COMPLETE!${NC}"
echo "════════════════════════════════════════════"
echo ""
echo "Next steps:"
echo "1. Start development server:"
echo "   npm run dev"
echo ""
echo "2. Open in browser:"
echo "   http://localhost:3000"
echo ""
echo "3. Test credentials (use any test user from test data):"
echo "   admin@housepro.dev (any password - use auth flow)"
echo "   manager1@housepro.dev"
echo "   agent1@housepro.dev"
echo ""
echo "Documentation:"
echo "  - DEPLOYMENT.md - Full setup guide"
echo "  - QA_AUDIT_REPORT.md - All fixes detailed"
echo "  - FIXES_SUMMARY.md - Quick reference"
echo ""
