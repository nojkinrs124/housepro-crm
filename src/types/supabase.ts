export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      accounting_categories: {
        Row: {
          code: string | null
          color: string
          created_at: string | null
          created_by: string | null
          icon: string
          id: string
          is_system: boolean
          name: string
          organization_id: string
          sort_order: number
          type: string
        }
        Insert: {
          code?: string | null
          color?: string
          created_at?: string | null
          created_by?: string | null
          icon?: string
          id?: string
          is_system?: boolean
          name: string
          organization_id: string
          sort_order?: number
          type: string
        }
        Update: {
          code?: string | null
          color?: string
          created_at?: string | null
          created_by?: string | null
          icon?: string
          id?: string
          is_system?: boolean
          name?: string
          organization_id?: string
          sort_order?: number
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_recurring_rules: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string | null
          created_by: string | null
          day_of_month: number | null
          employee_id: string | null
          end_date: string | null
          frequency: string
          id: string
          is_active: boolean
          last_generated_date: string | null
          name: string
          notes: string | null
          organization_id: string | null
          start_date: string
          type: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string | null
          created_by?: string | null
          day_of_month?: number | null
          employee_id?: string | null
          end_date?: string | null
          frequency: string
          id?: string
          is_active?: boolean
          last_generated_date?: string | null
          name: string
          notes?: string | null
          organization_id?: string | null
          start_date: string
          type: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string | null
          created_by?: string | null
          day_of_month?: number | null
          employee_id?: string | null
          end_date?: string | null
          frequency?: string
          id?: string
          is_active?: boolean
          last_generated_date?: string | null
          name?: string
          notes?: string | null
          organization_id?: string | null
          start_date?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_recurring_rules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "accounting_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_recurring_rules_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_recurring_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_transactions: {
        Row: {
          amount: number
          bank_document_number: string | null
          borne_by: string | null
          category_id: string | null
          contact_id: string | null
          contract_id: string | null
          created_at: string | null
          created_by: string | null
          date: string
          deal_id: string | null
          description: string | null
          due_date: string | null
          employee_id: string | null
          engagement_id: string | null
          id: string
          legacy_payment_id: string | null
          organization_id: string
          overdue_notified_at: string | null
          paid_at: string | null
          payment_external_id: string | null
          payment_method: string | null
          payment_provider: string | null
          payment_url: string | null
          period_end: string | null
          period_start: string | null
          property_id: string | null
          recurring_rule_id: string | null
          reminder_sent_at: string | null
          schedule_seq: number | null
          status: string
          type: string
        }
        Insert: {
          amount: number
          bank_document_number?: string | null
          borne_by?: string | null
          category_id?: string | null
          contact_id?: string | null
          contract_id?: string | null
          created_at?: string | null
          created_by?: string | null
          date: string
          deal_id?: string | null
          description?: string | null
          due_date?: string | null
          employee_id?: string | null
          engagement_id?: string | null
          id?: string
          legacy_payment_id?: string | null
          organization_id: string
          overdue_notified_at?: string | null
          paid_at?: string | null
          payment_external_id?: string | null
          payment_method?: string | null
          payment_provider?: string | null
          payment_url?: string | null
          period_end?: string | null
          period_start?: string | null
          property_id?: string | null
          recurring_rule_id?: string | null
          reminder_sent_at?: string | null
          schedule_seq?: number | null
          status?: string
          type: string
        }
        Update: {
          amount?: number
          bank_document_number?: string | null
          borne_by?: string | null
          category_id?: string | null
          contact_id?: string | null
          contract_id?: string | null
          created_at?: string | null
          created_by?: string | null
          date?: string
          deal_id?: string | null
          description?: string | null
          due_date?: string | null
          employee_id?: string | null
          engagement_id?: string | null
          id?: string
          legacy_payment_id?: string | null
          organization_id?: string
          overdue_notified_at?: string | null
          paid_at?: string | null
          payment_external_id?: string | null
          payment_method?: string | null
          payment_provider?: string | null
          payment_url?: string | null
          period_end?: string | null
          period_start?: string | null
          property_id?: string | null
          recurring_rule_id?: string | null
          reminder_sent_at?: string | null
          schedule_seq?: number | null
          status?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "accounting_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_transactions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_transactions_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_transactions_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_transactions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_transactions_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "management_engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_transactions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_transactions_recurring_rule_id_fkey"
            columns: ["recurring_rule_id"]
            isOneToOne: false
            referencedRelation: "accounting_recurring_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          created_at: string | null
          created_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          organization_id: string
          scopes: string[]
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          organization_id: string
          scopes?: string[]
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          organization_id?: string
          scopes?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          changes: Json | null
          created_at: string | null
          entity_id: string | null
          entity_label: string | null
          entity_type: string
          id: string
          organization_id: string
          user_id: string | null
        }
        Insert: {
          action: string
          changes?: Json | null
          created_at?: string | null
          entity_id?: string | null
          entity_label?: string | null
          entity_type: string
          id?: string
          organization_id: string
          user_id?: string | null
        }
        Update: {
          action?: string
          changes?: Json | null
          created_at?: string | null
          entity_id?: string | null
          entity_label?: string | null
          entity_type?: string
          id?: string
          organization_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      avito_settings: {
        Row: {
          access_token: string | null
          avito_user_id: string | null
          client_id: string | null
          client_secret: string | null
          contact_phone: string | null
          created_at: string
          feed_token: string
          id: string
          is_enabled: boolean
          last_sync_error: string | null
          last_synced_at: string | null
          organization_id: string
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          avito_user_id?: string | null
          client_id?: string | null
          client_secret?: string | null
          contact_phone?: string | null
          created_at?: string
          feed_token?: string
          id?: string
          is_enabled?: boolean
          last_sync_error?: string | null
          last_synced_at?: string | null
          organization_id: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          avito_user_id?: string | null
          client_id?: string | null
          client_secret?: string | null
          contact_phone?: string | null
          created_at?: string
          feed_token?: string
          id?: string
          is_enabled?: boolean
          last_sync_error?: string | null
          last_synced_at?: string | null
          organization_id?: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "avito_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_allowed_users: {
        Row: {
          created_at: string
          label: string | null
          organization_id: string
          telegram_user_id: string
        }
        Insert: {
          created_at?: string
          label?: string | null
          organization_id: string
          telegram_user_id: string
        }
        Update: {
          created_at?: string
          label?: string | null
          organization_id?: string
          telegram_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_allowed_users_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_conversations: {
        Row: {
          messages: Json
          organization_id: string
          telegram_chat_id: string
          updated_at: string
        }
        Insert: {
          messages?: Json
          organization_id: string
          telegram_chat_id: string
          updated_at?: string
        }
        Update: {
          messages?: Json
          organization_id?: string
          telegram_chat_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_menu_state: {
        Row: {
          current_screen: string
          menu_message_id: number | null
          organization_id: string
          telegram_chat_id: string
          updated_at: string
        }
        Insert: {
          current_screen?: string
          menu_message_id?: number | null
          organization_id: string
          telegram_chat_id: string
          updated_at?: string
        }
        Update: {
          current_screen?: string
          menu_message_id?: number | null
          organization_id?: string
          telegram_chat_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_menu_state_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_pending_actions: {
        Row: {
          action_type: string
          batch_id: string
          created_at: string
          expires_at: string
          id: string
          organization_id: string
          payload: Json
          status: string
          summary_text: string
          telegram_chat_id: string
          telegram_user_id: string | null
        }
        Insert: {
          action_type: string
          batch_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          organization_id: string
          payload: Json
          status?: string
          summary_text: string
          telegram_chat_id: string
          telegram_user_id?: string | null
        }
        Update: {
          action_type?: string
          batch_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          organization_id?: string
          payload?: Json
          status?: string
          summary_text?: string
          telegram_chat_id?: string
          telegram_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bot_pending_actions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_bot_settings: {
        Row: {
          admin_telegram_user_id: string | null
          admin_telegram_username: string | null
          awaiting_intent: string | null
          awaiting_intent_user_id: string | null
          channel_chat_id: string | null
          organization_id: string
          schedule_paused: boolean
          style_prompt: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          admin_telegram_user_id?: string | null
          admin_telegram_username?: string | null
          awaiting_intent?: string | null
          awaiting_intent_user_id?: string | null
          channel_chat_id?: string | null
          organization_id: string
          schedule_paused?: boolean
          style_prompt?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          admin_telegram_user_id?: string | null
          admin_telegram_username?: string | null
          awaiting_intent?: string | null
          awaiting_intent_user_id?: string | null
          channel_chat_id?: string | null
          organization_id?: string
          schedule_paused?: boolean
          style_prompt?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_bot_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_integrations: {
        Row: {
          created_at: string
          credentials: Json
          id: string
          is_active: boolean
          kind: string
          organization_id: string
          provider: string
          updated_at: string
          webhook_secret: string | null
        }
        Insert: {
          created_at?: string
          credentials?: Json
          id?: string
          is_active?: boolean
          kind: string
          organization_id: string
          provider: string
          updated_at?: string
          webhook_secret?: string | null
        }
        Update: {
          created_at?: string
          credentials?: Json
          id?: string
          is_active?: boolean
          kind?: string
          organization_id?: string
          provider?: string
          updated_at?: string
          webhook_secret?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "channel_integrations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_link_clicks: {
        Row: {
          clicked_at: string
          code: string
          id: string
          referer: string | null
          user_agent: string | null
        }
        Insert: {
          clicked_at?: string
          code: string
          id?: string
          referer?: string | null
          user_agent?: string | null
        }
        Update: {
          clicked_at?: string
          code?: string
          id?: string
          referer?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "channel_link_clicks_code_fkey"
            columns: ["code"]
            isOneToOne: false
            referencedRelation: "channel_links"
            referencedColumns: ["code"]
          },
        ]
      }
      channel_links: {
        Row: {
          code: string
          created_at: string
          destination_url: string
          label: string | null
          organization_id: string
          post_id: string | null
        }
        Insert: {
          code: string
          created_at?: string
          destination_url: string
          label?: string | null
          organization_id: string
          post_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          destination_url?: string
          label?: string | null
          organization_id?: string
          post_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "channel_links_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_links_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "channel_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_posts: {
        Row: {
          channel_message_id: number | null
          created_at: string
          cta_type: string
          draft_text: string | null
          final_text: string | null
          id: string
          image_url: string | null
          organization_id: string
          published_at: string | null
          reaction_count: number
          review_message_id: number | null
          rubric: string
          rubric_id: string | null
          schedule_id: string | null
          scheduled_for: string | null
          source_input: string | null
          status: string
          updated_at: string
        }
        Insert: {
          channel_message_id?: number | null
          created_at?: string
          cta_type?: string
          draft_text?: string | null
          final_text?: string | null
          id?: string
          image_url?: string | null
          organization_id: string
          published_at?: string | null
          reaction_count?: number
          review_message_id?: number | null
          rubric: string
          rubric_id?: string | null
          schedule_id?: string | null
          scheduled_for?: string | null
          source_input?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          channel_message_id?: number | null
          created_at?: string
          cta_type?: string
          draft_text?: string | null
          final_text?: string | null
          id?: string
          image_url?: string | null
          organization_id?: string
          published_at?: string | null
          reaction_count?: number
          review_message_id?: number | null
          rubric?: string
          rubric_id?: string | null
          schedule_id?: string | null
          scheduled_for?: string | null
          source_input?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_posts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_posts_rubric_id_fkey"
            columns: ["rubric_id"]
            isOneToOne: false
            referencedRelation: "channel_rubrics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_posts_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "channel_schedule"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_rubrics: {
        Row: {
          active: boolean
          created_at: string
          id: string
          image_style_override: string | null
          input_prompt: string | null
          key: string
          label: string
          organization_id: string
          prompt_template: string
          requires_input: boolean
          sort_order: number
          updated_at: string
          use_web_search: boolean
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          image_style_override?: string | null
          input_prompt?: string | null
          key: string
          label: string
          organization_id: string
          prompt_template: string
          requires_input?: boolean
          sort_order?: number
          updated_at?: string
          use_web_search?: boolean
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          image_style_override?: string | null
          input_prompt?: string | null
          key?: string
          label?: string
          organization_id?: string
          prompt_template?: string
          requires_input?: boolean
          sort_order?: number
          updated_at?: string
          use_web_search?: boolean
        }
        Relationships: []
      }
      channel_schedule: {
        Row: {
          created_at: string
          day_key: string
          enabled: boolean
          id: string
          organization_id: string
          rubric_id: string
          send_time_local: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          day_key: string
          enabled?: boolean
          id?: string
          organization_id: string
          rubric_id: string
          send_time_local: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_key?: string
          enabled?: boolean
          id?: string
          organization_id?: string
          rubric_id?: string
          send_time_local?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_schedule_rubric_id_fkey"
            columns: ["rubric_id"]
            isOneToOne: false
            referencedRelation: "channel_rubrics"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_weekly_stats: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          posts_published: number
          subscriber_count_end: number | null
          subscriber_count_start: number | null
          top_post_id: string | null
          total_clicks: number
          total_reactions: number
          week_start: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          posts_published?: number
          subscriber_count_end?: number | null
          subscriber_count_start?: number | null
          top_post_id?: string | null
          total_clicks?: number
          total_reactions?: number
          week_start: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          posts_published?: number
          subscriber_count_end?: number | null
          subscriber_count_start?: number | null
          top_post_id?: string | null
          total_clicks?: number
          total_reactions?: number
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_weekly_stats_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_weekly_stats_top_post_id_fkey"
            columns: ["top_post_id"]
            isOneToOne: false
            referencedRelation: "channel_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_items: {
        Row: {
          added_at: string | null
          agent_note: string | null
          collection_id: string
          property_id: string
          sort_order: number | null
        }
        Insert: {
          added_at?: string | null
          agent_note?: string | null
          collection_id: string
          property_id: string
          sort_order?: number | null
        }
        Update: {
          added_at?: string | null
          agent_note?: string | null
          collection_id?: string
          property_id?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "collection_items_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "property_collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_items_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      communications: {
        Row: {
          body: string | null
          channel: string
          contact_id: string | null
          counterparty_phone: string | null
          created_at: string
          deal_id: string | null
          direction: string
          duration_sec: number | null
          external_id: string | null
          from_number: string | null
          id: string
          lead_id: string | null
          occurred_at: string
          organization_id: string
          property_id: string | null
          provider: string | null
          recording_url: string | null
          status: string | null
          subject: string | null
          to_number: string | null
          user_id: string | null
        }
        Insert: {
          body?: string | null
          channel: string
          contact_id?: string | null
          counterparty_phone?: string | null
          created_at?: string
          deal_id?: string | null
          direction?: string
          duration_sec?: number | null
          external_id?: string | null
          from_number?: string | null
          id?: string
          lead_id?: string | null
          occurred_at?: string
          organization_id: string
          property_id?: string | null
          provider?: string | null
          recording_url?: string | null
          status?: string | null
          subject?: string | null
          to_number?: string | null
          user_id?: string | null
        }
        Update: {
          body?: string | null
          channel?: string
          contact_id?: string | null
          counterparty_phone?: string | null
          created_at?: string
          deal_id?: string | null
          direction?: string
          duration_sec?: number | null
          external_id?: string | null
          from_number?: string | null
          id?: string
          lead_id?: string | null
          occurred_at?: string
          organization_id?: string
          property_id?: string | null
          provider?: string | null
          recording_url?: string | null
          status?: string | null
          subject?: string | null
          to_number?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "communications_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communications_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communications_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communications_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      company_settings: {
        Row: {
          address: string | null
          bank_account: string | null
          bank_name: string | null
          bik: string | null
          corr_account: string | null
          created_at: string | null
          description: string | null
          email: string | null
          id: string
          inn: string | null
          is_default: boolean
          kpp: string | null
          legal_form: string
          logo_url: string | null
          name: string | null
          ogrn: string | null
          organization_id: string | null
          passport_department_code: string | null
          passport_issued_by: string | null
          passport_issued_date: string | null
          passport_number: string | null
          passport_series: string | null
          phone: string | null
          signatory_basis: string | null
          signatory_name: string | null
          signatory_position: string | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          bank_account?: string | null
          bank_name?: string | null
          bik?: string | null
          corr_account?: string | null
          created_at?: string | null
          description?: string | null
          email?: string | null
          id?: string
          inn?: string | null
          is_default?: boolean
          kpp?: string | null
          legal_form?: string
          logo_url?: string | null
          name?: string | null
          ogrn?: string | null
          organization_id?: string | null
          passport_department_code?: string | null
          passport_issued_by?: string | null
          passport_issued_date?: string | null
          passport_number?: string | null
          passport_series?: string | null
          phone?: string | null
          signatory_basis?: string | null
          signatory_name?: string | null
          signatory_position?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          bank_account?: string | null
          bank_name?: string | null
          bik?: string | null
          corr_account?: string | null
          created_at?: string | null
          description?: string | null
          email?: string | null
          id?: string
          inn?: string | null
          is_default?: boolean
          kpp?: string | null
          legal_form?: string
          logo_url?: string | null
          name?: string | null
          ogrn?: string | null
          organization_id?: string | null
          passport_department_code?: string | null
          passport_issued_by?: string | null
          passport_issued_date?: string | null
          passport_number?: string | null
          passport_series?: string | null
          phone?: string | null
          signatory_basis?: string | null
          signatory_name?: string | null
          signatory_position?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_representatives: {
        Row: {
          basis_details: string | null
          basis_type: string | null
          contact_id: string
          created_at: string | null
          email: string | null
          full_name: string
          id: string
          is_primary: boolean | null
          phone: string | null
          position: string | null
        }
        Insert: {
          basis_details?: string | null
          basis_type?: string | null
          contact_id: string
          created_at?: string | null
          email?: string | null
          full_name: string
          id?: string
          is_primary?: boolean | null
          phone?: string | null
          position?: string | null
        }
        Update: {
          basis_details?: string | null
          basis_type?: string | null
          contact_id?: string
          created_at?: string | null
          email?: string | null
          full_name?: string
          id?: string
          is_primary?: boolean | null
          phone?: string | null
          position?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_representatives_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          apartment: string | null
          bank_account: string | null
          bank_name: string | null
          bik: string | null
          birth_date: string | null
          building: string | null
          city: string | null
          client_type: string
          comment: string | null
          company_name: string | null
          consent_pd_at: string | null
          consent_pd_version: string | null
          consent_revoked_at: string | null
          consent_source: string | null
          corr_account: string | null
          counterparty_check: Json | null
          counterparty_checked_at: string | null
          country: string | null
          created_at: string | null
          email: string | null
          full_name: string
          house_number: string | null
          id: string
          inn: string | null
          kpp: string | null
          legal_address: string | null
          manager_id: string | null
          merged_into: string | null
          ogrn: string | null
          organization_id: string
          passport: string | null
          passport_department_code: string | null
          passport_issued_by: string | null
          passport_issued_date: string | null
          passport_number: string | null
          passport_series: string | null
          phone: string | null
          region: string | null
          role: string
          source: string | null
          status: string | null
          street: string | null
          telegram: string | null
          updated_at: string | null
          whatsapp: string | null
        }
        Insert: {
          apartment?: string | null
          bank_account?: string | null
          bank_name?: string | null
          bik?: string | null
          birth_date?: string | null
          building?: string | null
          city?: string | null
          client_type?: string
          comment?: string | null
          company_name?: string | null
          consent_pd_at?: string | null
          consent_pd_version?: string | null
          consent_revoked_at?: string | null
          consent_source?: string | null
          corr_account?: string | null
          counterparty_check?: Json | null
          counterparty_checked_at?: string | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          full_name: string
          house_number?: string | null
          id?: string
          inn?: string | null
          kpp?: string | null
          legal_address?: string | null
          manager_id?: string | null
          merged_into?: string | null
          ogrn?: string | null
          organization_id: string
          passport?: string | null
          passport_department_code?: string | null
          passport_issued_by?: string | null
          passport_issued_date?: string | null
          passport_number?: string | null
          passport_series?: string | null
          phone?: string | null
          region?: string | null
          role?: string
          source?: string | null
          status?: string | null
          street?: string | null
          telegram?: string | null
          updated_at?: string | null
          whatsapp?: string | null
        }
        Update: {
          apartment?: string | null
          bank_account?: string | null
          bank_name?: string | null
          bik?: string | null
          birth_date?: string | null
          building?: string | null
          city?: string | null
          client_type?: string
          comment?: string | null
          company_name?: string | null
          consent_pd_at?: string | null
          consent_pd_version?: string | null
          consent_revoked_at?: string | null
          consent_source?: string | null
          corr_account?: string | null
          counterparty_check?: Json | null
          counterparty_checked_at?: string | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string
          house_number?: string | null
          id?: string
          inn?: string | null
          kpp?: string | null
          legal_address?: string | null
          manager_id?: string | null
          merged_into?: string | null
          ogrn?: string | null
          organization_id?: string
          passport?: string | null
          passport_department_code?: string | null
          passport_issued_by?: string | null
          passport_issued_date?: string | null
          passport_number?: string | null
          passport_series?: string | null
          phone?: string | null
          region?: string | null
          role?: string
          source?: string | null
          status?: string | null
          street?: string | null
          telegram?: string | null
          updated_at?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_merged_into_fkey"
            columns: ["merged_into"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_signatures: {
        Row: {
          code_attempts: number
          code_expires_at: string | null
          code_hash: string | null
          code_sent_at: string | null
          consent_version: string | null
          contract_id: string
          created_at: string
          created_by: string | null
          declined_reason: string | null
          document_sha256: string | null
          document_url: string | null
          expires_at: string
          external_id: string | null
          external_package_id: string | null
          id: string
          opened_at: string | null
          organization_id: string
          provider: string
          provider_status: string | null
          sign_token: string
          sign_url: string | null
          signed_at: string | null
          signed_document_url: string | null
          signer_contact_id: string | null
          signer_email: string | null
          signer_ip: string | null
          signer_name: string | null
          signer_phone: string | null
          signer_user_agent: string | null
          status: string
        }
        Insert: {
          code_attempts?: number
          code_expires_at?: string | null
          code_hash?: string | null
          code_sent_at?: string | null
          consent_version?: string | null
          contract_id: string
          created_at?: string
          created_by?: string | null
          declined_reason?: string | null
          document_sha256?: string | null
          document_url?: string | null
          expires_at?: string
          external_id?: string | null
          external_package_id?: string | null
          id?: string
          opened_at?: string | null
          organization_id: string
          provider?: string
          provider_status?: string | null
          sign_token: string
          sign_url?: string | null
          signed_at?: string | null
          signed_document_url?: string | null
          signer_contact_id?: string | null
          signer_email?: string | null
          signer_ip?: string | null
          signer_name?: string | null
          signer_phone?: string | null
          signer_user_agent?: string | null
          status?: string
        }
        Update: {
          code_attempts?: number
          code_expires_at?: string | null
          code_hash?: string | null
          code_sent_at?: string | null
          consent_version?: string | null
          contract_id?: string
          created_at?: string
          created_by?: string | null
          declined_reason?: string | null
          document_sha256?: string | null
          document_url?: string | null
          expires_at?: string
          external_id?: string | null
          external_package_id?: string | null
          id?: string
          opened_at?: string | null
          organization_id?: string
          provider?: string
          provider_status?: string | null
          sign_token?: string
          sign_url?: string | null
          signed_at?: string | null
          signed_document_url?: string | null
          signer_contact_id?: string | null
          signer_email?: string | null
          signer_ip?: string | null
          signer_name?: string | null
          signer_phone?: string | null
          signer_user_agent?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_signatures_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_signatures_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_signatures_signer_contact_id_fkey"
            columns: ["signer_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_versions: {
        Row: {
          contract_id: string | null
          created_at: string | null
          created_by: string | null
          docx_url: string | null
          id: string
          note: string | null
          pdf_url: string | null
          version: number
          version_data: Json | null
        }
        Insert: {
          contract_id?: string | null
          created_at?: string | null
          created_by?: string | null
          docx_url?: string | null
          id?: string
          note?: string | null
          pdf_url?: string | null
          version?: number
          version_data?: Json | null
        }
        Update: {
          contract_id?: string | null
          created_at?: string | null
          created_by?: string | null
          docx_url?: string | null
          id?: string
          note?: string | null
          pdf_url?: string | null
          version?: number
          version_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_versions_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          amount: number | null
          base_contract_id: string | null
          client_contact_id: string | null
          client_id: string | null
          client_representative_id: string | null
          company_profile_id: string | null
          contract_number: string | null
          contract_type: string
          contract_type_data: Json
          created_at: string | null
          deal_id: string | null
          deposit: number | null
          end_date: string | null
          generated_docx_url: string | null
          generated_pdf_url: string | null
          id: string
          indexation_percent: number | null
          indexation_period_months: number | null
          manager_id: string | null
          notes: string | null
          organization_id: string
          owner_contact_id: string | null
          owner_fixed_amount: number | null
          owner_id: string | null
          owner_payout_day: number | null
          owner_representative_id: string | null
          plan_id: string | null
          plan_rate: number | null
          property_id: string | null
          settlement_scheme: string | null
          start_date: string | null
          status: string
        }
        Insert: {
          amount?: number | null
          base_contract_id?: string | null
          client_contact_id?: string | null
          client_id?: string | null
          client_representative_id?: string | null
          company_profile_id?: string | null
          contract_number?: string | null
          contract_type: string
          contract_type_data?: Json
          created_at?: string | null
          deal_id?: string | null
          deposit?: number | null
          end_date?: string | null
          generated_docx_url?: string | null
          generated_pdf_url?: string | null
          id?: string
          indexation_percent?: number | null
          indexation_period_months?: number | null
          manager_id?: string | null
          notes?: string | null
          organization_id: string
          owner_contact_id?: string | null
          owner_fixed_amount?: number | null
          owner_id?: string | null
          owner_payout_day?: number | null
          owner_representative_id?: string | null
          plan_id?: string | null
          plan_rate?: number | null
          property_id?: string | null
          settlement_scheme?: string | null
          start_date?: string | null
          status?: string
        }
        Update: {
          amount?: number | null
          base_contract_id?: string | null
          client_contact_id?: string | null
          client_id?: string | null
          client_representative_id?: string | null
          company_profile_id?: string | null
          contract_number?: string | null
          contract_type?: string
          contract_type_data?: Json
          created_at?: string | null
          deal_id?: string | null
          deposit?: number | null
          end_date?: string | null
          generated_docx_url?: string | null
          generated_pdf_url?: string | null
          id?: string
          indexation_percent?: number | null
          indexation_period_months?: number | null
          manager_id?: string | null
          notes?: string | null
          organization_id?: string
          owner_contact_id?: string | null
          owner_fixed_amount?: number | null
          owner_id?: string | null
          owner_payout_day?: number | null
          owner_representative_id?: string | null
          plan_id?: string | null
          plan_rate?: number | null
          property_id?: string | null
          settlement_scheme?: string | null
          start_date?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_base_contract_id_fkey"
            columns: ["base_contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_client_contact_id_fkey"
            columns: ["client_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_client_representative_id_fkey"
            columns: ["client_representative_id"]
            isOneToOne: false
            referencedRelation: "contact_representatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_company_profile_id_fkey"
            columns: ["company_profile_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_owner_contact_id_fkey"
            columns: ["owner_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_owner_representative_id_fkey"
            columns: ["owner_representative_id"]
            isOneToOne: false
            referencedRelation: "contact_representatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "service_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          deal_id: string
          id: string
          organization_id: string | null
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          deal_id: string
          id?: string
          organization_id?: string | null
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          deal_id?: string
          id?: string
          organization_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_comments_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_comments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          advance_amount: number | null
          amount: number | null
          bank_approval_date: string | null
          bank_name: string | null
          bargain_amount: number | null
          client_contact_id: string | null
          client_id: string | null
          client_representative_id: string | null
          commission: number | null
          created_at: string | null
          deal_number: number | null
          deal_type: string
          down_payment: number | null
          expected_close_date: string | null
          id: string
          lead_id: string | null
          manager_id: string | null
          needs_review: boolean
          notes: string | null
          organization_id: string
          owner_contact_id: string | null
          owner_id: string | null
          owner_representative_id: string | null
          payment_method: string | null
          plan_id: string | null
          property_id: string | null
          source: string | null
          stage_progress: Json
          status: string
          updated_at: string | null
        }
        Insert: {
          advance_amount?: number | null
          amount?: number | null
          bank_approval_date?: string | null
          bank_name?: string | null
          bargain_amount?: number | null
          client_contact_id?: string | null
          client_id?: string | null
          client_representative_id?: string | null
          commission?: number | null
          created_at?: string | null
          deal_number?: number | null
          deal_type?: string
          down_payment?: number | null
          expected_close_date?: string | null
          id?: string
          lead_id?: string | null
          manager_id?: string | null
          needs_review?: boolean
          notes?: string | null
          organization_id: string
          owner_contact_id?: string | null
          owner_id?: string | null
          owner_representative_id?: string | null
          payment_method?: string | null
          plan_id?: string | null
          property_id?: string | null
          source?: string | null
          stage_progress?: Json
          status?: string
          updated_at?: string | null
        }
        Update: {
          advance_amount?: number | null
          amount?: number | null
          bank_approval_date?: string | null
          bank_name?: string | null
          bargain_amount?: number | null
          client_contact_id?: string | null
          client_id?: string | null
          client_representative_id?: string | null
          commission?: number | null
          created_at?: string | null
          deal_number?: number | null
          deal_type?: string
          down_payment?: number | null
          expected_close_date?: string | null
          id?: string
          lead_id?: string | null
          manager_id?: string | null
          needs_review?: boolean
          notes?: string | null
          organization_id?: string
          owner_contact_id?: string | null
          owner_id?: string | null
          owner_representative_id?: string | null
          payment_method?: string | null
          plan_id?: string | null
          property_id?: string | null
          source?: string | null
          stage_progress?: Json
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_client_contact_id_fkey"
            columns: ["client_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_client_representative_id_fkey"
            columns: ["client_representative_id"]
            isOneToOne: false
            referencedRelation: "contact_representatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_owner_contact_id_fkey"
            columns: ["owner_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_owner_representative_id_fkey"
            columns: ["owner_representative_id"]
            isOneToOne: false
            referencedRelation: "contact_representatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "service_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      document_templates: {
        Row: {
          created_at: string | null
          created_by: string | null
          file_url: string
          id: string
          name: string
          organization_id: string | null
          storage_path: string | null
          template_type: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          file_url: string
          id?: string
          name: string
          organization_id?: string | null
          storage_path?: string | null
          template_type: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          file_url?: string
          id?: string
          name?: string
          organization_id?: string | null
          storage_path?: string | null
          template_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_log: {
        Row: {
          created_at: string
          entity_id: string | null
          entity_type: string | null
          error: string | null
          id: string
          kind: string
          organization_id: string
          provider: string | null
          provider_message_id: string | null
          recipient: string
          status: string
          subject: string
        }
        Insert: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          error?: string | null
          id?: string
          kind: string
          organization_id: string
          provider?: string | null
          provider_message_id?: string | null
          recipient: string
          status?: string
          subject: string
        }
        Update: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          error?: string | null
          id?: string
          kind?: string
          organization_id?: string
          provider?: string | null
          provider_message_id?: string | null
          recipient?: string
          status?: string
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_targets: {
        Row: {
          commission_target: number | null
          created_at: string
          created_by: string | null
          deals_target: number | null
          id: string
          note: string | null
          organization_id: string
          period_month: string
          revenue_target: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          commission_target?: number | null
          created_at?: string
          created_by?: string | null
          deals_target?: number | null
          id?: string
          note?: string | null
          organization_id: string
          period_month: string
          revenue_target?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          commission_target?: number | null
          created_at?: string
          created_by?: string | null
          deals_target?: number | null
          id?: string
          note?: string | null
          organization_id?: string
          period_month?: string
          revenue_target?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_targets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      files: {
        Row: {
          client_id: string | null
          contract_id: string | null
          created_at: string | null
          deal_id: string | null
          file_name: string | null
          file_type: string | null
          file_url: string | null
          id: string
          organization_id: string | null
          property_id: string | null
          uploaded_by: string | null
        }
        Insert: {
          client_id?: string | null
          contract_id?: string | null
          created_at?: string | null
          deal_id?: string | null
          file_name?: string | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          organization_id?: string | null
          property_id?: string | null
          uploaded_by?: string | null
        }
        Update: {
          client_id?: string | null
          contract_id?: string | null
          created_at?: string | null
          deal_id?: string | null
          file_name?: string | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          organization_id?: string | null
          property_id?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "files_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_articles: {
        Row: {
          body: string
          category: string
          created_at: string
          created_by: string | null
          id: string
          is_published: boolean
          organization_id: string
          review_period_months: number
          reviewed_at: string | null
          reviewed_by: string | null
          slug: string
          sort_order: number
          source_hash: string | null
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          body?: string
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_published?: boolean
          organization_id: string
          review_period_months?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          slug: string
          sort_order?: number
          source_hash?: string | null
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_published?: boolean
          organization_id?: string
          review_period_months?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          slug?: string
          sort_order?: number
          source_hash?: string | null
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_articles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_articles_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_activities: {
        Row: {
          content: string | null
          created_at: string | null
          id: string
          lead_id: string
          organization_id: string | null
          result: string | null
          scheduled_at: string | null
          type: string
          user_id: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          id?: string
          lead_id: string
          organization_id?: string | null
          result?: string | null
          scheduled_at?: string | null
          type: string
          user_id?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          id?: string
          lead_id?: string
          organization_id?: string | null
          result?: string | null
          scheduled_at?: string | null
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_activities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_activities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          area_max: number | null
          area_min: number | null
          assigned_to: string | null
          budget_max: number | null
          budget_min: number | null
          comment: string | null
          consent_pd_at: string | null
          consent_pd_version: string | null
          consent_revoked_at: string | null
          consent_source: string | null
          created_at: string | null
          deal_type: string | null
          district: string | null
          email: string | null
          full_name: string | null
          id: string
          next_contact_at: string | null
          organization_id: string
          phone: string | null
          property_id: string | null
          property_type: string | null
          rooms: number | null
          source: string | null
          status: string
          telegram: string | null
          updated_at: string | null
          whatsapp: string | null
        }
        Insert: {
          area_max?: number | null
          area_min?: number | null
          assigned_to?: string | null
          budget_max?: number | null
          budget_min?: number | null
          comment?: string | null
          consent_pd_at?: string | null
          consent_pd_version?: string | null
          consent_revoked_at?: string | null
          consent_source?: string | null
          created_at?: string | null
          deal_type?: string | null
          district?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          next_contact_at?: string | null
          organization_id: string
          phone?: string | null
          property_id?: string | null
          property_type?: string | null
          rooms?: number | null
          source?: string | null
          status?: string
          telegram?: string | null
          updated_at?: string | null
          whatsapp?: string | null
        }
        Update: {
          area_max?: number | null
          area_min?: number | null
          assigned_to?: string | null
          budget_max?: number | null
          budget_min?: number | null
          comment?: string | null
          consent_pd_at?: string | null
          consent_pd_version?: string | null
          consent_revoked_at?: string | null
          consent_source?: string | null
          created_at?: string | null
          deal_type?: string | null
          district?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          next_contact_at?: string | null
          organization_id?: string
          phone?: string | null
          property_id?: string | null
          property_type?: string | null
          rooms?: number | null
          source?: string | null
          status?: string
          telegram?: string | null
          updated_at?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      logs: {
        Row: {
          action: string
          created_at: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          new_data: Json | null
          old_data: Json | null
          organization_id: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          organization_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          organization_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      management_engagements: {
        Row: {
          contract_id: string | null
          created_at: string
          deal_id: string | null
          ended_at: string | null
          id: string
          notes: string | null
          organization_id: string
          owner_contact_id: string | null
          owner_fixed_amount: number | null
          owner_payout_day: number | null
          plan_id: string | null
          property_id: string
          rate: number | null
          repair_limit: number | null
          settlement_scheme: string | null
          started_at: string
          status: string
          updated_at: string
        }
        Insert: {
          contract_id?: string | null
          created_at?: string
          deal_id?: string | null
          ended_at?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          owner_contact_id?: string | null
          owner_fixed_amount?: number | null
          owner_payout_day?: number | null
          plan_id?: string | null
          property_id: string
          rate?: number | null
          repair_limit?: number | null
          settlement_scheme?: string | null
          started_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          contract_id?: string | null
          created_at?: string
          deal_id?: string | null
          ended_at?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          owner_contact_id?: string | null
          owner_fixed_amount?: number | null
          owner_payout_day?: number | null
          plan_id?: string | null
          property_id?: string
          rate?: number | null
          repair_limit?: number | null
          settlement_scheme?: string | null
          started_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "management_engagements_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "management_engagements_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "management_engagements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "management_engagements_owner_contact_id_fkey"
            columns: ["owner_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "management_engagements_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "service_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "management_engagements_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      management_regulations: {
        Row: {
          code: string
          created_at: string
          day_of_month: number | null
          description: string | null
          id: string
          is_active: boolean
          lead_days: number
          organization_id: string
          period: string
          plan_id: string | null
          priority: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          day_of_month?: number | null
          description?: string | null
          id?: string
          is_active?: boolean
          lead_days?: number
          organization_id: string
          period: string
          plan_id?: string | null
          priority?: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          day_of_month?: number | null
          description?: string | null
          id?: string
          is_active?: boolean
          lead_days?: number
          organization_id?: string
          period?: string
          plan_id?: string | null
          priority?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "management_regulations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "management_regulations_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "service_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      meter_readings: {
        Row: {
          amount: number | null
          consumption: number | null
          created_at: string
          created_by: string | null
          id: string
          meter_id: string
          note: string | null
          organization_id: string
          reading_date: string
          source: string
          value: number
        }
        Insert: {
          amount?: number | null
          consumption?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          meter_id: string
          note?: string | null
          organization_id: string
          reading_date?: string
          source?: string
          value: number
        }
        Update: {
          amount?: number | null
          consumption?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          meter_id?: string
          note?: string | null
          organization_id?: string
          reading_date?: string
          source?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "meter_readings_meter_id_fkey"
            columns: ["meter_id"]
            isOneToOne: false
            referencedRelation: "utility_meters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meter_readings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          is_read: boolean | null
          organization_id: string | null
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean | null
          organization_id?: string | null
          title: string
          type: string
          user_id?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean | null
          organization_id?: string | null
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string | null
          is_active: boolean
          organization_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          is_active?: boolean
          organization_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          is_active?: boolean
          organization_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean
          name: string
          onboarding_completed: boolean
          plan: string
          slug: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_status: string | null
          trial_ends_at: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean
          name: string
          onboarding_completed?: boolean
          plan?: string
          slug: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean
          name?: string
          onboarding_completed?: boolean
          plan?: string
          slug?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          contract_id: string | null
          created_at: string | null
          created_by: string | null
          due_date: string | null
          id: string
          notes: string | null
          organization_id: string | null
          payment_date: string | null
          payment_status: string | null
          payment_type: string | null
        }
        Insert: {
          amount: number
          contract_id?: string | null
          created_at?: string | null
          created_by?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          organization_id?: string | null
          payment_date?: string | null
          payment_status?: string | null
          payment_type?: string | null
        }
        Update: {
          amount?: number
          contract_id?: string | null
          created_at?: string | null
          created_by?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          organization_id?: string | null
          payment_date?: string | null
          payment_status?: string | null
          payment_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_access: {
        Row: {
          contact_id: string
          contract_id: string | null
          engagement_id: string | null
          granted_at: string
          granted_by: string | null
          id: string
          last_login_at: string | null
          organization_id: string
          phone: string
          property_id: string | null
          revoked_at: string | null
          role: string
        }
        Insert: {
          contact_id: string
          contract_id?: string | null
          engagement_id?: string | null
          granted_at?: string
          granted_by?: string | null
          id?: string
          last_login_at?: string | null
          organization_id: string
          phone: string
          property_id?: string | null
          revoked_at?: string | null
          role: string
        }
        Update: {
          contact_id?: string
          contract_id?: string | null
          engagement_id?: string | null
          granted_at?: string
          granted_by?: string | null
          id?: string
          last_login_at?: string | null
          organization_id?: string
          phone?: string
          property_id?: string | null
          revoked_at?: string | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_access_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_access_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_access_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "management_engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_access_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_access_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_access_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_otp: {
        Row: {
          attempts: number
          channel: string
          code_hash: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          issued_by: string | null
          organization_id: string
          phone: string
          token: string
        }
        Insert: {
          attempts?: number
          channel: string
          code_hash: string
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          issued_by?: string | null
          organization_id: string
          phone: string
          token: string
        }
        Update: {
          attempts?: number
          channel?: string
          code_hash?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          issued_by?: string | null
          organization_id?: string
          phone?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_otp_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_otp_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      properties: {
        Row: {
          address: string
          area: number | null
          avito_ad_id: string | null
          avito_error: string | null
          avito_publish: boolean
          avito_status: string | null
          avito_synced_at: string | null
          cadastral_number: string | null
          ceiling_height: number | null
          created_at: string | null
          deal_type: string
          deposit: number | null
          description: string | null
          district: string | null
          encumbrances: string | null
          fias_id: string | null
          floor: number | null
          has_elevator: boolean | null
          has_internet: boolean | null
          has_parking: boolean | null
          has_tv: boolean | null
          heating_type: string | null
          house_type: string | null
          id: string
          kitchen_area: number | null
          land_area: number | null
          latitude: number | null
          living_area: number | null
          longitude: number | null
          management_fee: number | null
          manager_id: string | null
          metro: string | null
          organization_id: string
          owner_id: string | null
          ownership_basis: string | null
          photo_urls: string[] | null
          price: number | null
          property_type: string
          rooms: number | null
          site_publish: boolean
          status: string
          title: string
          total_floors: number | null
          updated_at: string | null
          utilities_included: string | null
          video_url: string | null
          wall_material: string | null
          water_supply_type: string | null
          year_built: number | null
        }
        Insert: {
          address: string
          area?: number | null
          avito_ad_id?: string | null
          avito_error?: string | null
          avito_publish?: boolean
          avito_status?: string | null
          avito_synced_at?: string | null
          cadastral_number?: string | null
          ceiling_height?: number | null
          created_at?: string | null
          deal_type: string
          deposit?: number | null
          description?: string | null
          district?: string | null
          encumbrances?: string | null
          fias_id?: string | null
          floor?: number | null
          has_elevator?: boolean | null
          has_internet?: boolean | null
          has_parking?: boolean | null
          has_tv?: boolean | null
          heating_type?: string | null
          house_type?: string | null
          id?: string
          kitchen_area?: number | null
          land_area?: number | null
          latitude?: number | null
          living_area?: number | null
          longitude?: number | null
          management_fee?: number | null
          manager_id?: string | null
          metro?: string | null
          organization_id: string
          owner_id?: string | null
          ownership_basis?: string | null
          photo_urls?: string[] | null
          price?: number | null
          property_type: string
          rooms?: number | null
          site_publish?: boolean
          status?: string
          title: string
          total_floors?: number | null
          updated_at?: string | null
          utilities_included?: string | null
          video_url?: string | null
          wall_material?: string | null
          water_supply_type?: string | null
          year_built?: number | null
        }
        Update: {
          address?: string
          area?: number | null
          avito_ad_id?: string | null
          avito_error?: string | null
          avito_publish?: boolean
          avito_status?: string | null
          avito_synced_at?: string | null
          cadastral_number?: string | null
          ceiling_height?: number | null
          created_at?: string | null
          deal_type?: string
          deposit?: number | null
          description?: string | null
          district?: string | null
          encumbrances?: string | null
          fias_id?: string | null
          floor?: number | null
          has_elevator?: boolean | null
          has_internet?: boolean | null
          has_parking?: boolean | null
          has_tv?: boolean | null
          heating_type?: string | null
          house_type?: string | null
          id?: string
          kitchen_area?: number | null
          land_area?: number | null
          latitude?: number | null
          living_area?: number | null
          longitude?: number | null
          management_fee?: number | null
          manager_id?: string | null
          metro?: string | null
          organization_id?: string
          owner_id?: string | null
          ownership_basis?: string | null
          photo_urls?: string[] | null
          price?: number | null
          property_type?: string
          rooms?: number | null
          site_publish?: boolean
          status?: string
          title?: string
          total_floors?: number | null
          updated_at?: string | null
          utilities_included?: string | null
          video_url?: string | null
          wall_material?: string | null
          water_supply_type?: string | null
          year_built?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_owner_contact_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      property_collections: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          is_public: boolean | null
          lead_id: string | null
          organization_id: string
          share_token: string | null
          title: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_public?: boolean | null
          lead_id?: string | null
          organization_id: string
          share_token?: string | null
          title: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_public?: boolean | null
          lead_id?: string | null
          organization_id?: string
          share_token?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_collections_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_collections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      property_handovers: {
        Row: {
          completed_at: string | null
          condition_note: string | null
          created_at: string
          created_by: string | null
          documents: Json
          engagement_id: string
          id: string
          inventory: Json
          keys_count: number | null
          organization_id: string
          photo_urls: string[] | null
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          condition_note?: string | null
          created_at?: string
          created_by?: string | null
          documents?: Json
          engagement_id: string
          id?: string
          inventory?: Json
          keys_count?: number | null
          organization_id: string
          photo_urls?: string[] | null
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          condition_note?: string | null
          created_at?: string
          created_by?: string | null
          documents?: Json
          engagement_id?: string
          id?: string
          inventory?: Json
          keys_count?: number | null
          organization_id?: string
          photo_urls?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_handovers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_handovers_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "management_engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_handovers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      service_plans: {
        Row: {
          charge_type: string
          code: string
          created_at: string
          directions: string[]
          id: string
          is_active: boolean
          obligations: Json
          organization_id: string
          rate: number | null
          repair_limit: number | null
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          charge_type: string
          code: string
          created_at?: string
          directions?: string[]
          id?: string
          is_active?: boolean
          obligations?: Json
          organization_id: string
          rate?: number | null
          repair_limit?: number | null
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          charge_type?: string
          code?: string
          created_at?: string
          directions?: string[]
          id?: string
          is_active?: boolean
          obligations?: Json
          organization_id?: string
          rate?: number | null
          repair_limit?: number | null
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_plans_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      service_requests: {
        Row: {
          category: string
          closed_at: string | null
          contact_id: string
          created_at: string
          description: string
          engagement_id: string | null
          id: string
          organization_id: string
          photo_urls: string[] | null
          property_id: string
          reject_reason: string | null
          status: string
          task_id: string | null
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          category: string
          closed_at?: string | null
          contact_id: string
          created_at?: string
          description: string
          engagement_id?: string | null
          id?: string
          organization_id: string
          photo_urls?: string[] | null
          property_id: string
          reject_reason?: string | null
          status?: string
          task_id?: string | null
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          closed_at?: string | null
          contact_id?: string
          created_at?: string
          description?: string
          engagement_id?: string | null
          id?: string
          organization_id?: string
          photo_urls?: string[] | null
          property_id?: string
          reject_reason?: string | null
          status?: string
          task_id?: string | null
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_requests_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "management_engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "accounting_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      showings: {
        Row: {
          agent_id: string | null
          contact_id: string | null
          created_at: string | null
          created_by: string | null
          deal_id: string | null
          duration_min: number | null
          feedback: string | null
          id: string
          lead_id: string | null
          next_step: string | null
          organization_id: string
          property_id: string | null
          result: string | null
          scheduled_at: string
          status: string
          updated_at: string | null
        }
        Insert: {
          agent_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deal_id?: string | null
          duration_min?: number | null
          feedback?: string | null
          id?: string
          lead_id?: string | null
          next_step?: string | null
          organization_id: string
          property_id?: string | null
          result?: string | null
          scheduled_at: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          agent_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deal_id?: string | null
          duration_min?: number | null
          feedback?: string | null
          id?: string
          lead_id?: string | null
          next_step?: string | null
          organization_id?: string
          property_id?: string | null
          result?: string | null
          scheduled_at?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "showings_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "showings_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "showings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "showings_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "showings_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "showings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "showings_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          contact_id: string | null
          contract_id: string | null
          created_at: string | null
          created_by: string | null
          deadline: string | null
          deal_id: string | null
          description: string | null
          due_date: string | null
          engagement_id: string | null
          id: string
          lead_id: string | null
          organization_id: string
          owner_id: string | null
          payment_id: string | null
          priority: string
          property_id: string | null
          regulation_code: string | null
          status: string
          title: string
        }
        Insert: {
          assigned_to?: string | null
          contact_id?: string | null
          contract_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deadline?: string | null
          deal_id?: string | null
          description?: string | null
          due_date?: string | null
          engagement_id?: string | null
          id?: string
          lead_id?: string | null
          organization_id: string
          owner_id?: string | null
          payment_id?: string | null
          priority?: string
          property_id?: string | null
          regulation_code?: string | null
          status?: string
          title: string
        }
        Update: {
          assigned_to?: string | null
          contact_id?: string | null
          contract_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deadline?: string | null
          deal_id?: string | null
          description?: string | null
          due_date?: string | null
          engagement_id?: string | null
          id?: string
          lead_id?: string | null
          organization_id?: string
          owner_id?: string | null
          payment_id?: string | null
          priority?: string
          property_id?: string | null
          regulation_code?: string | null
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "management_engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string
          full_name: string
          ical_token: string | null
          id: string
          is_active: boolean | null
          last_sign_in_at: string | null
          organization_id: string | null
          phone: string | null
          phone_extension: string | null
          role: string
          settings: Json | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email: string
          full_name?: string
          ical_token?: string | null
          id: string
          is_active?: boolean | null
          last_sign_in_at?: string | null
          organization_id?: string | null
          phone?: string | null
          phone_extension?: string | null
          role?: string
          settings?: Json | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          full_name?: string
          ical_token?: string | null
          id?: string
          is_active?: boolean | null
          last_sign_in_at?: string | null
          organization_id?: string | null
          phone?: string | null
          phone_extension?: string | null
          role?: string
          settings?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "users_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      utility_meters: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          kind: string
          organization_id: string
          property_id: string
          serial_number: string | null
          tariff: number | null
          title: string | null
          unit: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          kind: string
          organization_id: string
          property_id: string
          serial_number?: string | null
          tariff?: number | null
          title?: string | null
          unit?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          kind?: string
          organization_id?: string
          property_id?: string
          serial_number?: string | null
          tariff?: number | null
          title?: string | null
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "utility_meters_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "utility_meters_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_endpoints: {
        Row: {
          created_at: string | null
          created_by: string | null
          events: string[]
          id: string
          is_active: boolean | null
          organization_id: string
          secret: string
          url: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          events?: string[]
          id?: string
          is_active?: boolean | null
          organization_id: string
          secret: string
          url: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          events?: string[]
          id?: string
          is_active?: boolean | null
          organization_id?: string
          secret?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_endpoints_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      public_company_contacts: {
        Row: {
          address: string | null
          email: string | null
          inn: string | null
          legal_form: string | null
          name: string | null
          ogrn: string | null
          phone: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          email?: string | null
          inn?: string | null
          legal_form?: string | null
          name?: string | null
          ogrn?: string | null
          phone?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          email?: string | null
          inn?: string | null
          legal_form?: string | null
          name?: string | null
          ogrn?: string | null
          phone?: string | null
          website?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      check_expiring_contracts: { Args: never; Returns: undefined }
      check_overdue_payments: { Args: never; Returns: undefined }
      get_avito_feed_contact_phone: {
        Args: { p_token: string }
        Returns: string
      }
      get_avito_feed_properties: {
        Args: { p_token: string }
        Returns: {
          address: string
          area: number | null
          avito_ad_id: string | null
          avito_error: string | null
          avito_publish: boolean
          avito_status: string | null
          avito_synced_at: string | null
          cadastral_number: string | null
          ceiling_height: number | null
          created_at: string | null
          deal_type: string
          deposit: number | null
          description: string | null
          district: string | null
          encumbrances: string | null
          fias_id: string | null
          floor: number | null
          has_elevator: boolean | null
          has_internet: boolean | null
          has_parking: boolean | null
          has_tv: boolean | null
          heating_type: string | null
          house_type: string | null
          id: string
          kitchen_area: number | null
          land_area: number | null
          latitude: number | null
          living_area: number | null
          longitude: number | null
          management_fee: number | null
          manager_id: string | null
          metro: string | null
          organization_id: string
          owner_id: string | null
          ownership_basis: string | null
          photo_urls: string[] | null
          price: number | null
          property_type: string
          rooms: number | null
          site_publish: boolean
          status: string
          title: string
          total_floors: number | null
          updated_at: string | null
          utilities_included: string | null
          video_url: string | null
          wall_material: string | null
          water_supply_type: string | null
          year_built: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "properties"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_user_org_id: { Args: never; Returns: string }
      import_client_request: {
        Args: { p_contact: Json; p_lead: Json; p_org_id: string }
        Returns: Json
      }
      import_property_extract: {
        Args: { p_org_id: string; p_owner?: Json; p_property: Json }
        Returns: Json
      }
      import_rental_contract: {
        Args: {
          p_deal: Json
          p_org_id: string
          p_owner: Json
          p_property: Json
          p_tenant: Json
        }
        Returns: Json
      }
      is_org_admin: { Args: never; Returns: boolean }
      normalize_phone_digits: { Args: { phone: string }; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
