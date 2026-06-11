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
      activity_logs: {
        Row: {
          action: string
          created_at: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          ip_address: string | null
          metadata: Json | null
          profile_id: string | null
          tenant_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          profile_id?: string | null
          tenant_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          profile_id?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      agenda_blocked_dates: {
        Row: {
          all_day: boolean
          block_end: string | null
          block_start: string | null
          blocked_date: string
          created_at: string
          id: string
          reason: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          all_day?: boolean
          block_end?: string | null
          block_start?: string | null
          blocked_date: string
          created_at?: string
          id?: string
          reason?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          all_day?: boolean
          block_end?: string | null
          block_start?: string | null
          blocked_date?: string
          created_at?: string
          id?: string
          reason?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agenda_blocked_dates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      agenda_business_hours: {
        Row: {
          close_time: string | null
          created_at: string
          id: string
          is_open: boolean
          lunch_end: string | null
          lunch_start: string | null
          open_time: string | null
          tenant_id: string
          updated_at: string
          weekday: number
        }
        Insert: {
          close_time?: string | null
          created_at?: string
          id?: string
          is_open?: boolean
          lunch_end?: string | null
          lunch_start?: string | null
          open_time?: string | null
          tenant_id: string
          updated_at?: string
          weekday: number
        }
        Update: {
          close_time?: string | null
          created_at?: string
          id?: string
          is_open?: boolean
          lunch_end?: string | null
          lunch_start?: string | null
          open_time?: string | null
          tenant_id?: string
          updated_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "agenda_business_hours_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_config_versions: {
        Row: {
          ai_config_id: string | null
          config_snapshot: Json
          created_at: string | null
          created_by: string | null
          id: string
        }
        Insert: {
          ai_config_id?: string | null
          config_snapshot: Json
          created_at?: string | null
          created_by?: string | null
          id?: string
        }
        Update: {
          ai_config_id?: string | null
          config_snapshot?: Json
          created_at?: string | null
          created_by?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_config_versions_ai_config_id_fkey"
            columns: ["ai_config_id"]
            isOneToOne: false
            referencedRelation: "ai_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_config_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_configs: {
        Row: {
          created_at: string | null
          goal: string | null
          id: string
          knowledge_base: string | null
          knowledge_base_faq: string | null
          lead_expiration_limit: number | null
          model_temperature: number | null
          prompt_system: string | null
          qualification_questions: Json | null
          qualification_threshold: number | null
          rejection_instructions: string | null
          response_delay: number | null
          response_restrictions: string[] | null
          sample_scripts: string | null
          scheduling_link: string | null
          tenant_id: string | null
          training_mode: boolean | null
          triggers: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          goal?: string | null
          id?: string
          knowledge_base?: string | null
          knowledge_base_faq?: string | null
          lead_expiration_limit?: number | null
          model_temperature?: number | null
          prompt_system?: string | null
          qualification_questions?: Json | null
          qualification_threshold?: number | null
          rejection_instructions?: string | null
          response_delay?: number | null
          response_restrictions?: string[] | null
          sample_scripts?: string | null
          scheduling_link?: string | null
          tenant_id?: string | null
          training_mode?: boolean | null
          triggers?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          goal?: string | null
          id?: string
          knowledge_base?: string | null
          knowledge_base_faq?: string | null
          lead_expiration_limit?: number | null
          model_temperature?: number | null
          prompt_system?: string | null
          qualification_questions?: Json | null
          qualification_threshold?: number | null
          rejection_instructions?: string | null
          response_delay?: number | null
          response_restrictions?: string[] | null
          sample_scripts?: string | null
          scheduling_link?: string | null
          tenant_id?: string | null
          training_mode?: boolean | null
          triggers?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_configs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_knowledge_documents: {
        Row: {
          content: string | null
          created_at: string | null
          file_size_bytes: number | null
          file_type: string | null
          file_url: string
          id: string
          name: string
          status: string | null
          tenant_id: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          file_size_bytes?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          name: string
          status?: string | null
          tenant_id?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          file_size_bytes?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          name?: string
          status?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_knowledge_documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          cancellation_reason: string | null
          checkin_at: string | null
          checkout_at: string | null
          created_at: string | null
          end_at: string | null
          id: string
          lead_id: string | null
          lead_name: string | null
          needs_transport: boolean | null
          notes: string | null
          notification_channel: string | null
          origin: string | null
          professional_id: string | null
          propensity_score: number | null
          reminder_sent: boolean | null
          reschedule_count: number | null
          scheduled_at: string
          status: Database["public"]["Enums"]["appointment_status"] | null
          tenant_id: string | null
          type_exam: string | null
          unit_id: string | null
          unit_name: string | null
          updated_at: string | null
          value: number | null
        }
        Insert: {
          cancellation_reason?: string | null
          checkin_at?: string | null
          checkout_at?: string | null
          created_at?: string | null
          end_at?: string | null
          id?: string
          lead_id?: string | null
          lead_name?: string | null
          needs_transport?: boolean | null
          notes?: string | null
          notification_channel?: string | null
          origin?: string | null
          professional_id?: string | null
          propensity_score?: number | null
          reminder_sent?: boolean | null
          reschedule_count?: number | null
          scheduled_at: string
          status?: Database["public"]["Enums"]["appointment_status"] | null
          tenant_id?: string | null
          type_exam?: string | null
          unit_id?: string | null
          unit_name?: string | null
          updated_at?: string | null
          value?: number | null
        }
        Update: {
          cancellation_reason?: string | null
          checkin_at?: string | null
          checkout_at?: string | null
          created_at?: string | null
          end_at?: string | null
          id?: string
          lead_id?: string | null
          lead_name?: string | null
          needs_transport?: boolean | null
          notes?: string | null
          notification_channel?: string | null
          origin?: string | null
          professional_id?: string | null
          propensity_score?: number | null
          reminder_sent?: boolean | null
          reschedule_count?: number | null
          scheduled_at?: string
          status?: Database["public"]["Enums"]["appointment_status"] | null
          tenant_id?: string | null
          type_exam?: string | null
          unit_id?: string | null
          unit_name?: string | null
          updated_at?: string | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string | null
          id: string
          last_message_at: string | null
          lead_id: string | null
          status: Database["public"]["Enums"]["conversation_status"] | null
          tenant_id: string | null
          updated_at: string | null
          whatsapp_chat_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_message_at?: string | null
          lead_id?: string | null
          status?: Database["public"]["Enums"]["conversation_status"] | null
          tenant_id?: string | null
          updated_at?: string | null
          whatsapp_chat_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          last_message_at?: string | null
          lead_id?: string | null
          status?: Database["public"]["Enums"]["conversation_status"] | null
          tenant_id?: string | null
          updated_at?: string | null
          whatsapp_chat_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      conversion_goals: {
        Row: {
          created_at: string | null
          id: string
          max_no_show_rate: number | null
          month: string
          target_appointments: number | null
          target_conversion_rate: number | null
          target_cpa: number | null
          tenant_id: string | null
          unit_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          max_no_show_rate?: number | null
          month: string
          target_appointments?: number | null
          target_conversion_rate?: number | null
          target_cpa?: number | null
          tenant_id?: string | null
          unit_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          max_no_show_rate?: number | null
          month?: string
          target_appointments?: number | null
          target_conversion_rate?: number | null
          target_cpa?: number | null
          tenant_id?: string | null
          unit_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversion_goals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversion_goals_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      global_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string | null
          value?: Json
        }
        Relationships: []
      }
      ia_token_logs: {
        Row: {
          context: string | null
          cost_billed: number | null
          cost_raw: number | null
          cost_usd: number
          created_at: string | null
          id: string
          model: string
          provider: string | null
          tenant_id: string | null
          tokens_input: number | null
          tokens_output: number | null
          used_fallback: boolean
        }
        Insert: {
          context?: string | null
          cost_billed?: number | null
          cost_raw?: number | null
          cost_usd?: number
          created_at?: string | null
          id?: string
          model: string
          provider?: string | null
          tenant_id?: string | null
          tokens_input?: number | null
          tokens_output?: number | null
          used_fallback?: boolean
        }
        Update: {
          context?: string | null
          cost_billed?: number | null
          cost_raw?: number | null
          cost_usd?: number
          created_at?: string | null
          id?: string
          model?: string
          provider?: string | null
          tenant_id?: string | null
          tokens_input?: number | null
          tokens_output?: number | null
          used_fallback?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "ia_token_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      kanban_columns: {
        Row: {
          color: string
          created_at: string
          created_by: string | null
          id: string
          is_system: boolean
          name: string
          position: number
          system_key: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_system?: boolean
          name: string
          position?: number
          system_key?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_system?: boolean
          name?: string
          position?: number
          system_key?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kanban_columns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_consultation_summary: {
        Row: {
          created_at: string
          filled_by: string | null
          frame_recommendation: string | null
          id: string
          lead_id: string
          lens_type: string | null
          needs_glasses: string | null
          no_close_reason: string | null
          no_close_reason_detail: string | null
          od_addition: number | null
          od_axis: number | null
          od_cylindrical: number | null
          od_spherical: number | null
          oe_addition: number | null
          oe_axis: number | null
          oe_cylindrical: number | null
          oe_spherical: number | null
          prescription_valid_until: string | null
          price_range_presented: string | null
          products_shown: string | null
          professional_notes: string | null
          tenant_id: string
          treatments: string[] | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          filled_by?: string | null
          frame_recommendation?: string | null
          id?: string
          lead_id: string
          lens_type?: string | null
          needs_glasses?: string | null
          no_close_reason?: string | null
          no_close_reason_detail?: string | null
          od_addition?: number | null
          od_axis?: number | null
          od_cylindrical?: number | null
          od_spherical?: number | null
          oe_addition?: number | null
          oe_axis?: number | null
          oe_cylindrical?: number | null
          oe_spherical?: number | null
          prescription_valid_until?: string | null
          price_range_presented?: string | null
          products_shown?: string | null
          professional_notes?: string | null
          tenant_id: string
          treatments?: string[] | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          filled_by?: string | null
          frame_recommendation?: string | null
          id?: string
          lead_id?: string
          lens_type?: string | null
          needs_glasses?: string | null
          no_close_reason?: string | null
          no_close_reason_detail?: string | null
          od_addition?: number | null
          od_axis?: number | null
          od_cylindrical?: number | null
          od_spherical?: number | null
          oe_addition?: number | null
          oe_axis?: number | null
          oe_cylindrical?: number | null
          oe_spherical?: number | null
          prescription_valid_until?: string | null
          price_range_presented?: string | null
          products_shown?: string | null
          professional_notes?: string | null
          tenant_id?: string
          treatments?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_consultation_summary_filled_by_fkey"
            columns: ["filled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_consultation_summary_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_consultation_summary_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_followups: {
        Row: {
          channel: string
          created_at: string
          day_offset: number
          error_message: string | null
          id: string
          lead_id: string
          response_at: string | null
          scheduled_at: string
          sent_at: string | null
          status: string
          template_key: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          channel?: string
          created_at?: string
          day_offset: number
          error_message?: string | null
          id?: string
          lead_id: string
          response_at?: string | null
          scheduled_at: string
          sent_at?: string | null
          status?: string
          template_key: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          channel?: string
          created_at?: string
          day_offset?: number
          error_message?: string | null
          id?: string
          lead_id?: string
          response_at?: string | null
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          template_key?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_followups_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_pipeline_history: {
        Row: {
          changed_by: string | null
          created_at: string | null
          duration: string | null
          id: string
          lead_id: string | null
          stage_from: Database["public"]["Enums"]["lead_status"] | null
          stage_to: Database["public"]["Enums"]["lead_status"] | null
        }
        Insert: {
          changed_by?: string | null
          created_at?: string | null
          duration?: string | null
          id?: string
          lead_id?: string | null
          stage_from?: Database["public"]["Enums"]["lead_status"] | null
          stage_to?: Database["public"]["Enums"]["lead_status"] | null
        }
        Update: {
          changed_by?: string | null
          created_at?: string | null
          duration?: string | null
          id?: string
          lead_id?: string | null
          stage_from?: Database["public"]["Enums"]["lead_status"] | null
          stage_to?: Database["public"]["Enums"]["lead_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_pipeline_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_pipeline_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_user_id: string | null
          closed_at: string | null
          created_at: string | null
          custom_column_id: string | null
          email: string | null
          full_name: string
          ia_disqualified_reason: string | null
          ia_interesses: string[] | null
          ia_profile: string | null
          ia_receita_grau: string | null
          ia_receita_validade: string | null
          ia_sentiment: string | null
          ia_sentimento: string | null
          ia_summary: string | null
          ia_tags: string[] | null
          ia_urgencia: string | null
          ia_urgency: string | null
          id: string
          next_contact_at: string | null
          notes: string | null
          payment_method: string | null
          phone: string | null
          priority: string | null
          products_sold: string | null
          sales_value: number | null
          score_ia: number | null
          source: string | null
          source_id: string | null
          status: Database["public"]["Enums"]["lead_status"] | null
          tags: string[] | null
          tenant_id: string | null
          unit_id: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_user_id?: string | null
          closed_at?: string | null
          created_at?: string | null
          custom_column_id?: string | null
          email?: string | null
          full_name: string
          ia_disqualified_reason?: string | null
          ia_interesses?: string[] | null
          ia_profile?: string | null
          ia_receita_grau?: string | null
          ia_receita_validade?: string | null
          ia_sentiment?: string | null
          ia_sentimento?: string | null
          ia_summary?: string | null
          ia_tags?: string[] | null
          ia_urgencia?: string | null
          ia_urgency?: string | null
          id?: string
          next_contact_at?: string | null
          notes?: string | null
          payment_method?: string | null
          phone?: string | null
          priority?: string | null
          products_sold?: string | null
          sales_value?: number | null
          score_ia?: number | null
          source?: string | null
          source_id?: string | null
          status?: Database["public"]["Enums"]["lead_status"] | null
          tags?: string[] | null
          tenant_id?: string | null
          unit_id?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_user_id?: string | null
          closed_at?: string | null
          created_at?: string | null
          custom_column_id?: string | null
          email?: string | null
          full_name?: string
          ia_disqualified_reason?: string | null
          ia_interesses?: string[] | null
          ia_profile?: string | null
          ia_receita_grau?: string | null
          ia_receita_validade?: string | null
          ia_sentiment?: string | null
          ia_sentimento?: string | null
          ia_summary?: string | null
          ia_tags?: string[] | null
          ia_urgencia?: string | null
          ia_urgency?: string | null
          id?: string
          next_contact_at?: string | null
          notes?: string | null
          payment_method?: string | null
          phone?: string | null
          priority?: string | null
          products_sold?: string | null
          sales_value?: number | null
          score_ia?: number | null
          source?: string | null
          source_id?: string | null
          status?: Database["public"]["Enums"]["lead_status"] | null
          tags?: string[] | null
          tenant_id?: string | null
          unit_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_assigned_user_id_fkey"
            columns: ["assigned_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_custom_column_id_fkey"
            columns: ["custom_column_id"]
            isOneToOne: false
            referencedRelation: "kanban_columns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "marketing_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_integrations: {
        Row: {
          api_token: string | null
          created_at: string | null
          event_mapping: Json | null
          id: string
          pixel_id: string | null
          platform: Database["public"]["Enums"]["marketing_platform"]
          status: string | null
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          api_token?: string | null
          created_at?: string | null
          event_mapping?: Json | null
          id?: string
          pixel_id?: string | null
          platform: Database["public"]["Enums"]["marketing_platform"]
          status?: string | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          api_token?: string | null
          created_at?: string | null
          event_mapping?: Json | null
          id?: string
          pixel_id?: string | null
          platform?: Database["public"]["Enums"]["marketing_platform"]
          status?: string | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_integrations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_sources: {
        Row: {
          ad_id: string | null
          created_at: string | null
          id: string
          name: string
          platform: Database["public"]["Enums"]["marketing_platform"] | null
          tenant_id: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          ad_id?: string | null
          created_at?: string | null
          id?: string
          name: string
          platform?: Database["public"]["Enums"]["marketing_platform"] | null
          tenant_id?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          ad_id?: string | null
          created_at?: string | null
          id?: string
          name?: string
          platform?: Database["public"]["Enums"]["marketing_platform"] | null
          tenant_id?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_sources_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_spend: {
        Row: {
          clicks: number | null
          created_at: string | null
          date: string
          id: string
          impressions: number | null
          source_id: string | null
          spend: number
          tenant_id: string | null
        }
        Insert: {
          clicks?: number | null
          created_at?: string | null
          date: string
          id?: string
          impressions?: number | null
          source_id?: string | null
          spend: number
          tenant_id?: string | null
        }
        Update: {
          clicks?: number | null
          created_at?: string | null
          date?: string
          id?: string
          impressions?: number | null
          source_id?: string | null
          spend?: number
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_spend_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "marketing_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_spend_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string | null
          conversation_id: string | null
          created_at: string | null
          direction: Database["public"]["Enums"]["message_direction"]
          ia_transcription: string | null
          id: string
          is_internal: boolean | null
          media_url: string | null
          message_type: string | null
          metadata: Json | null
          tokens_used: number | null
          whatsapp_message_id: string | null
        }
        Insert: {
          content?: string | null
          conversation_id?: string | null
          created_at?: string | null
          direction: Database["public"]["Enums"]["message_direction"]
          ia_transcription?: string | null
          id?: string
          is_internal?: boolean | null
          media_url?: string | null
          message_type?: string | null
          metadata?: Json | null
          tokens_used?: number | null
          whatsapp_message_id?: string | null
        }
        Update: {
          content?: string | null
          conversation_id?: string | null
          created_at?: string | null
          direction?: Database["public"]["Enums"]["message_direction"]
          ia_transcription?: string | null
          id?: string
          is_internal?: boolean | null
          media_url?: string | null
          message_type?: string | null
          metadata?: Json | null
          tokens_used?: number | null
          whatsapp_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          category: Database["public"]["Enums"]["notification_category"]
          email_enabled: boolean | null
          id: string
          in_app_enabled: boolean | null
          profile_id: string | null
          push_enabled: boolean | null
        }
        Insert: {
          category: Database["public"]["Enums"]["notification_category"]
          email_enabled?: boolean | null
          id?: string
          in_app_enabled?: boolean | null
          profile_id?: string | null
          push_enabled?: boolean | null
        }
        Update: {
          category?: Database["public"]["Enums"]["notification_category"]
          email_enabled?: boolean | null
          id?: string
          in_app_enabled?: boolean | null
          profile_id?: string | null
          push_enabled?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          category: Database["public"]["Enums"]["notification_category"]
          created_at: string | null
          id: string
          link: string | null
          message: string
          profile_id: string | null
          read_at: string | null
          tenant_id: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"] | null
        }
        Insert: {
          category: Database["public"]["Enums"]["notification_category"]
          created_at?: string | null
          id?: string
          link?: string | null
          message: string
          profile_id?: string | null
          read_at?: string | null
          tenant_id?: string | null
          title: string
          type?: Database["public"]["Enums"]["notification_type"] | null
        }
        Update: {
          category?: Database["public"]["Enums"]["notification_category"]
          created_at?: string | null
          id?: string
          link?: string | null
          message?: string
          profile_id?: string | null
          read_at?: string | null
          tenant_id?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"] | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          created_at: string | null
          display_name: string
          features: Json | null
          ia_token_quota: number | null
          id: string
          lead_limit: number | null
          name: string
          price_monthly: number | null
          price_yearly: number | null
          updated_at: string | null
          user_limit: number | null
        }
        Insert: {
          created_at?: string | null
          display_name: string
          features?: Json | null
          ia_token_quota?: number | null
          id?: string
          lead_limit?: number | null
          name: string
          price_monthly?: number | null
          price_yearly?: number | null
          updated_at?: string | null
          user_limit?: number | null
        }
        Update: {
          created_at?: string | null
          display_name?: string
          features?: Json | null
          ia_token_quota?: number | null
          id?: string
          lead_limit?: number | null
          name?: string
          price_monthly?: number | null
          price_yearly?: number | null
          updated_at?: string | null
          user_limit?: number | null
        }
        Relationships: []
      }
      professional_performance: {
        Row: {
          conversion_count: number | null
          created_at: string | null
          id: string
          no_show_count: number | null
          profile_id: string | null
          reference_month: string
          revenue_generated: number | null
          tenant_id: string | null
          total_appointments: number | null
          unit_id: string | null
          updated_at: string | null
        }
        Insert: {
          conversion_count?: number | null
          created_at?: string | null
          id?: string
          no_show_count?: number | null
          profile_id?: string | null
          reference_month: string
          revenue_generated?: number | null
          tenant_id?: string | null
          total_appointments?: number | null
          unit_id?: string | null
          updated_at?: string | null
        }
        Update: {
          conversion_count?: number | null
          created_at?: string | null
          id?: string
          no_show_count?: number | null
          profile_id?: string | null
          reference_month?: string
          revenue_generated?: number | null
          tenant_id?: string | null
          total_appointments?: number | null
          unit_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "professional_performance_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_performance_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_performance_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_units: {
        Row: {
          profile_id: string
          unit_id: string
        }
        Insert: {
          profile_id: string
          unit_id: string
        }
        Update: {
          profile_id?: string
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_units_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_units_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          allowed_modules: string[] | null
          avatar_url: string | null
          business_hours: Json | null
          created_at: string | null
          external_crm_id: string | null
          full_name: string | null
          id: string
          last_login_at: string | null
          phone: string | null
          role: Database["public"]["Enums"]["user_role"] | null
          status: string | null
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          allowed_modules?: string[] | null
          avatar_url?: string | null
          business_hours?: Json | null
          created_at?: string | null
          external_crm_id?: string | null
          full_name?: string | null
          id: string
          last_login_at?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          status?: string | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          allowed_modules?: string[] | null
          avatar_url?: string | null
          business_hours?: Json | null
          created_at?: string | null
          external_crm_id?: string | null
          full_name?: string | null
          id?: string
          last_login_at?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          status?: string | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      saas_audit_logs: {
        Row: {
          action_category: string
          action_type: string
          actor_id: string | null
          created_at: string | null
          id: string
          ip_address: string | null
          metadata: Json | null
          severity: Database["public"]["Enums"]["log_severity"] | null
          tenant_id: string | null
          user_agent: string | null
        }
        Insert: {
          action_category: string
          action_type: string
          actor_id?: string | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          severity?: Database["public"]["Enums"]["log_severity"] | null
          tenant_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action_category?: string
          action_type?: string
          actor_id?: string | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          severity?: Database["public"]["Enums"]["log_severity"] | null
          tenant_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "saas_audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saas_audit_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_ai_credentials: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          key_hint: string
          last_used_at: string | null
          model_default: string
          monthly_budget_usd: number
          notes: string | null
          provider: Database["public"]["Enums"]["ai_provider"]
          tenant_id: string
          updated_at: string
          vault_secret_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          key_hint: string
          last_used_at?: string | null
          model_default?: string
          monthly_budget_usd?: number
          notes?: string | null
          provider?: Database["public"]["Enums"]["ai_provider"]
          tenant_id: string
          updated_at?: string
          vault_secret_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          key_hint?: string
          last_used_at?: string | null
          model_default?: string
          monthly_budget_usd?: number
          notes?: string | null
          provider?: Database["public"]["Enums"]["ai_provider"]
          tenant_id?: string
          updated_at?: string
          vault_secret_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_ai_credentials_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          cnpj: string | null
          contato_responsavel: string | null
          created_at: string | null
          ia_token_quota: number | null
          ia_token_used: number | null
          id: string
          limite_usuarios: number | null
          logo_url: string | null
          name: string
          plan: string | null
          settings: Json | null
          slug: string
          status: string | null
          storage_limit_bytes: number | null
          storage_used_bytes: number | null
          total_leads_mes: number | null
          updated_at: string | null
          webhook_url_notificacoes: string | null
          whatsapp_api_token: string | null
        }
        Insert: {
          cnpj?: string | null
          contato_responsavel?: string | null
          created_at?: string | null
          ia_token_quota?: number | null
          ia_token_used?: number | null
          id?: string
          limite_usuarios?: number | null
          logo_url?: string | null
          name: string
          plan?: string | null
          settings?: Json | null
          slug: string
          status?: string | null
          storage_limit_bytes?: number | null
          storage_used_bytes?: number | null
          total_leads_mes?: number | null
          updated_at?: string | null
          webhook_url_notificacoes?: string | null
          whatsapp_api_token?: string | null
        }
        Update: {
          cnpj?: string | null
          contato_responsavel?: string | null
          created_at?: string | null
          ia_token_quota?: number | null
          ia_token_used?: number | null
          id?: string
          limite_usuarios?: number | null
          logo_url?: string | null
          name?: string
          plan?: string | null
          settings?: Json | null
          slug?: string
          status?: string | null
          storage_limit_bytes?: number | null
          storage_used_bytes?: number | null
          total_leads_mes?: number | null
          updated_at?: string | null
          webhook_url_notificacoes?: string | null
          whatsapp_api_token?: string | null
        }
        Relationships: []
      }
      unit_ai_configs: {
        Row: {
          auto_scheduling_enabled: boolean | null
          conversion_target_threshold: number | null
          created_at: string | null
          id: string
          no_show_alert_threshold: number | null
          qualification_threshold_override: number | null
          tenant_id: string | null
          training_mode_override: boolean | null
          unit_id: string | null
          updated_at: string | null
        }
        Insert: {
          auto_scheduling_enabled?: boolean | null
          conversion_target_threshold?: number | null
          created_at?: string | null
          id?: string
          no_show_alert_threshold?: number | null
          qualification_threshold_override?: number | null
          tenant_id?: string | null
          training_mode_override?: boolean | null
          unit_id?: string | null
          updated_at?: string | null
        }
        Update: {
          auto_scheduling_enabled?: boolean | null
          conversion_target_threshold?: number | null
          created_at?: string | null
          id?: string
          no_show_alert_threshold?: number | null
          qualification_threshold_override?: number | null
          tenant_id?: string | null
          training_mode_override?: boolean | null
          unit_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "unit_ai_configs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_ai_configs_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: true
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          address: string | null
          business_hours: Json | null
          created_at: string | null
          id: string
          name: string
          phone: string | null
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          business_hours?: Json | null
          created_at?: string | null
          id?: string
          name: string
          phone?: string | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          business_hours?: Json | null
          created_at?: string | null
          id?: string
          name?: string
          phone?: string | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "units_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_config: {
        Row: {
          business_hours: Json
          connected_name: string | null
          connected_phone: string | null
          created_at: string
          id: string
          instance_token: string
          is_active: boolean
          is_connected: boolean
          tenant_id: string
          timezone: string
          updated_at: string
          webhook_registered: boolean
        }
        Insert: {
          business_hours?: Json
          connected_name?: string | null
          connected_phone?: string | null
          created_at?: string
          id?: string
          instance_token: string
          is_active?: boolean
          is_connected?: boolean
          tenant_id: string
          timezone?: string
          updated_at?: string
          webhook_registered?: boolean
        }
        Update: {
          business_hours?: Json
          connected_name?: string | null
          connected_phone?: string | null
          created_at?: string
          id?: string
          instance_token?: string
          is_active?: boolean
          is_connected?: boolean
          tenant_id?: string
          timezone?: string
          updated_at?: string
          webhook_registered?: boolean
        }
        Relationships: []
      }
      whatsapp_message_logs: {
        Row: {
          error_message: string | null
          id: string
          message_type: string
          recipient_phone: string
          sender_avatar_url: string | null
          sender_name: string | null
          sent_at: string
          status: string
          tenant_id: string
        }
        Insert: {
          error_message?: string | null
          id?: string
          message_type: string
          recipient_phone: string
          sender_avatar_url?: string | null
          sender_name?: string | null
          sent_at?: string
          status: string
          tenant_id: string
        }
        Update: {
          error_message?: string | null
          id?: string
          message_type?: string
          recipient_phone?: string
          sender_avatar_url?: string | null
          sender_name?: string | null
          sent_at?: string
          status?: string
          tenant_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      saas_churn_ltv_stats: {
        Row: {
          churn_rate: number | null
          estimated_ltv: number | null
        }
        Relationships: []
      }
      saas_global_sla: {
        Row: {
          avg_response_time: string | null
        }
        Relationships: []
      }
      saas_ia_roi_daily: {
        Row: {
          log_date: string | null
          net_profit: number | null
          total_cost: number | null
          total_revenue: number | null
        }
        Relationships: []
      }
      saas_ia_usage_summary: {
        Row: {
          net_profit: number | null
          plan: string | null
          tenant_name: string | null
          total_cost_raw: number | null
          total_revenue: number | null
          total_tokens: number | null
        }
        Relationships: []
      }
      saas_mrr_stats: {
        Row: {
          active_tenants: number | null
          churned_tenants_total: number | null
          total_mrr: number | null
        }
        Relationships: []
      }
      tenant_ai_usage_month: {
        Row: {
          fallback_calls: number | null
          provider: string | null
          reference_month: string | null
          tenant_id: string | null
          total_calls: number | null
          total_cost_usd: number | null
          total_tokens: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ia_token_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_ia_usage_safe: {
        Row: {
          context: string | null
          cost_billed: number | null
          created_at: string | null
          id: string | null
          model: string | null
          tenant_id: string | null
          tokens_input: number | null
          tokens_output: number | null
        }
        Insert: {
          context?: string | null
          cost_billed?: number | null
          created_at?: string | null
          id?: string | null
          model?: string | null
          tenant_id?: string | null
          tokens_input?: number | null
          tokens_output?: number | null
        }
        Update: {
          context?: string | null
          cost_billed?: number | null
          created_at?: string | null
          id?: string | null
          model?: string | null
          tenant_id?: string | null
          tokens_input?: number | null
          tokens_output?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ia_token_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      unit_performance_metrics: {
        Row: {
          cancelled_count: number | null
          completed_count: number | null
          estimated_loss: number | null
          no_show_count: number | null
          reference_date: string | null
          total_appointments: number | null
          total_revenue: number | null
          unit_id: string | null
          unit_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      get_active_ai_credential: {
        Args: {
          _provider?: Database["public"]["Enums"]["ai_provider"]
          _tenant_id: string
        }
        Returns: {
          api_key: string
          credential_id: string
          current_month_cost_usd: number
          model_default: string
          monthly_budget_usd: number
        }[]
      }
      get_auth_profile: {
        Args: never
        Returns: {
          id: string
          role: Database["public"]["Enums"]["user_role"]
          status: string
          tenant_id: string
        }[]
      }
      get_current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      get_current_user_tenant: { Args: never; Returns: string }
      get_user_tenant_id: { Args: { _user_id: string }; Returns: string }
      is_super_admin:
        | { Args: never; Returns: boolean }
        | { Args: { _user_id: string }; Returns: boolean }
      is_tenant_admin: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      upsert_ai_credential: {
        Args: {
          _api_key: string
          _model_default?: string
          _monthly_budget_usd?: number
          _provider: Database["public"]["Enums"]["ai_provider"]
          _tenant_id: string
        }
        Returns: string
      }
    }
    Enums: {
      ai_provider: "openai" | "anthropic" | "gemini" | "lovable"
      appointment_status:
        | "pending"
        | "confirmed"
        | "completed"
        | "no_show"
        | "cancelled"
      conversation_status:
        | "open"
        | "waiting_seller"
        | "finished"
        | "automated_ia"
      lead_status:
        | "open"
        | "in_progress"
        | "scheduled"
        | "checked_in"
        | "showed_up"
        | "no_show"
        | "lost"
        | "negotiating"
        | "followup"
      log_severity: "info" | "warning" | "critical"
      marketing_platform: "facebook_ads" | "google_ads" | "tiktok_ads"
      message_direction: "inbound" | "outbound"
      notification_category:
        | "ai_training"
        | "performance"
        | "system_error"
        | "lead_alert"
      notification_type: "in_app" | "email" | "push"
      user_role:
        | "super_admin"
        | "admin"
        | "manager"
        | "seller"
        | "marketing_partner"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      ai_provider: ["openai", "anthropic", "gemini", "lovable"],
      appointment_status: [
        "pending",
        "confirmed",
        "completed",
        "no_show",
        "cancelled",
      ],
      conversation_status: [
        "open",
        "waiting_seller",
        "finished",
        "automated_ia",
      ],
      lead_status: [
        "open",
        "in_progress",
        "scheduled",
        "checked_in",
        "showed_up",
        "no_show",
        "lost",
        "negotiating",
        "followup",
      ],
      log_severity: ["info", "warning", "critical"],
      marketing_platform: ["facebook_ads", "google_ads", "tiktok_ads"],
      message_direction: ["inbound", "outbound"],
      notification_category: [
        "ai_training",
        "performance",
        "system_error",
        "lead_alert",
      ],
      notification_type: ["in_app", "email", "push"],
      user_role: [
        "super_admin",
        "admin",
        "manager",
        "seller",
        "marketing_partner",
      ],
    },
  },
} as const
