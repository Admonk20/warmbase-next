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
      ab_tests: {
        Row: {
          created_at: string
          id: string
          name: string
          opens_a: number
          opens_b: number
          replies_a: number
          replies_b: number
          sends_a: number
          sends_b: number
          user_id: string
          variant_a: string
          variant_b: string
          winner: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          opens_a?: number
          opens_b?: number
          replies_a?: number
          replies_b?: number
          sends_a?: number
          sends_b?: number
          user_id: string
          variant_a: string
          variant_b: string
          winner?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          opens_a?: number
          opens_b?: number
          replies_a?: number
          replies_b?: number
          sends_a?: number
          sends_b?: number
          user_id?: string
          variant_a?: string
          variant_b?: string
          winner?: string | null
        }
        Relationships: []
      }
      campaigns: {
        Row: {
          created_at: string
          description: string | null
          id: string
          meeting_count: number
          name: string
          open_count: number
          reply_count: number
          sent_count: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          meeting_count?: number
          name: string
          open_count?: number
          reply_count?: number
          sent_count?: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          meeting_count?: number
          name?: string
          open_count?: number
          reply_count?: number
          sent_count?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      deliverability_checks: {
        Row: {
          dkim: boolean
          dmarc: boolean
          domains: boolean
          inboxes: number
          limits: boolean
          reply: boolean
          spf: boolean
          start_date: string
          unsub: boolean
          updated_at: string
          user_id: string
          warmup: boolean
        }
        Insert: {
          dkim?: boolean
          dmarc?: boolean
          domains?: boolean
          inboxes?: number
          limits?: boolean
          reply?: boolean
          spf?: boolean
          start_date?: string
          unsub?: boolean
          updated_at?: string
          user_id: string
          warmup?: boolean
        }
        Update: {
          dkim?: boolean
          dmarc?: boolean
          domains?: boolean
          inboxes?: number
          limits?: boolean
          reply?: boolean
          spf?: boolean
          start_date?: string
          unsub?: boolean
          updated_at?: string
          user_id?: string
          warmup?: boolean
        }
        Relationships: []
      }
      email_events: {
        Row: {
          campaign_id: string | null
          event_type: Database["public"]["Enums"]["email_event_type"]
          id: string
          lead_id: string | null
          metadata: Json | null
          occurred_at: string
          reason: string | null
          subject: string | null
          user_id: string
        }
        Insert: {
          campaign_id?: string | null
          event_type: Database["public"]["Enums"]["email_event_type"]
          id?: string
          lead_id?: string | null
          metadata?: Json | null
          occurred_at?: string
          reason?: string | null
          subject?: string | null
          user_id: string
        }
        Update: {
          campaign_id?: string | null
          event_type?: Database["public"]["Enums"]["email_event_type"]
          id?: string
          lead_id?: string | null
          metadata?: Json | null
          occurred_at?: string
          reason?: string | null
          subject?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      email_snippets: {
        Row: {
          body: string
          created_at: string
          description: string | null
          id: string
          shortcode: string
          updated_at: string
          use_count: number
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          description?: string | null
          id?: string
          shortcode: string
          updated_at?: string
          use_count?: number
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          description?: string | null
          id?: string
          shortcode?: string
          updated_at?: string
          use_count?: number
          user_id?: string
        }
        Relationships: []
      }
      email_unsub_tokens: {
        Row: {
          created_at: string
          email: string
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          token: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      lead_notes: {
        Row: {
          body: string
          created_at: string
          id: string
          lead_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          lead_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          lead_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_notes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          company: string | null
          confidence: string | null
          contact: string
          created_at: string
          email: string | null
          engagement_score: number
          id: string
          last_emailed_at: string | null
          last_engaged_at: string | null
          linkedin_url: string | null
          merged_into_id: string | null
          niche: string | null
          notes: string | null
          phone: string | null
          replied_at: string | null
          seq_step: number
          source: string | null
          status: Database["public"]["Enums"]["lead_status"]
          temperature: Database["public"]["Enums"]["lead_temp"]
          timezone: string | null
          title: string | null
          updated_at: string
          user_id: string
          value: number | null
        }
        Insert: {
          company?: string | null
          confidence?: string | null
          contact: string
          created_at?: string
          email?: string | null
          engagement_score?: number
          id?: string
          last_emailed_at?: string | null
          last_engaged_at?: string | null
          linkedin_url?: string | null
          merged_into_id?: string | null
          niche?: string | null
          notes?: string | null
          phone?: string | null
          replied_at?: string | null
          seq_step?: number
          source?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          temperature?: Database["public"]["Enums"]["lead_temp"]
          timezone?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
          value?: number | null
        }
        Update: {
          company?: string | null
          confidence?: string | null
          contact?: string
          created_at?: string
          email?: string | null
          engagement_score?: number
          id?: string
          last_emailed_at?: string | null
          last_engaged_at?: string | null
          linkedin_url?: string | null
          merged_into_id?: string | null
          niche?: string | null
          notes?: string | null
          phone?: string | null
          replied_at?: string | null
          seq_step?: number
          source?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          temperature?: Database["public"]["Enums"]["lead_temp"]
          timezone?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
          value?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company: string | null
          created_at: string
          full_name: string | null
          id: string
          title: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      sequence_steps: {
        Row: {
          ab_test_id: string | null
          body: string
          created_at: string
          delay_days: number
          id: string
          sequence_id: string
          step_order: number
          subject: string
          subject_b: string | null
          user_id: string
        }
        Insert: {
          ab_test_id?: string | null
          body: string
          created_at?: string
          delay_days?: number
          id?: string
          sequence_id: string
          step_order: number
          subject: string
          subject_b?: string | null
          user_id: string
        }
        Update: {
          ab_test_id?: string | null
          body?: string
          created_at?: string
          delay_days?: number
          id?: string
          sequence_id?: string
          step_order?: number
          subject?: string
          subject_b?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sequence_steps_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      sequences: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sourcing_findings: {
        Row: {
          company: string | null
          contact: string | null
          created_at: string
          email: string | null
          id: string
          lead_id: string | null
          linkedin_url: string | null
          niche: string | null
          payload: Json
          run_id: string
          score: number
          source_url: string | null
          summary: string | null
          title: string | null
          user_id: string
        }
        Insert: {
          company?: string | null
          contact?: string | null
          created_at?: string
          email?: string | null
          id?: string
          lead_id?: string | null
          linkedin_url?: string | null
          niche?: string | null
          payload?: Json
          run_id: string
          score?: number
          source_url?: string | null
          summary?: string | null
          title?: string | null
          user_id: string
        }
        Update: {
          company?: string | null
          contact?: string | null
          created_at?: string
          email?: string | null
          id?: string
          lead_id?: string | null
          linkedin_url?: string | null
          niche?: string | null
          payload?: Json
          run_id?: string
          score?: number
          source_url?: string | null
          summary?: string | null
          title?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sourcing_findings_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "sourcing_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      sourcing_runs: {
        Row: {
          attempt_count: number
          created_at: string
          cursor: Json
          error: string | null
          icp: Json
          id: string
          last_run_at: string | null
          max_findings: number
          status: string
          step: string | null
          totals: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          cursor?: Json
          error?: string | null
          icp?: Json
          id?: string
          last_run_at?: string | null
          max_findings?: number
          status?: string
          step?: string | null
          totals?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          attempt_count?: number
          created_at?: string
          cursor?: Json
          error?: string | null
          icp?: Json
          id?: string
          last_run_at?: string | null
          max_findings?: number
          status?: string
          step?: string | null
          totals?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      suppressions: {
        Row: {
          created_at: string
          email: string
          id: string
          reason: string
          source: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          reason?: string
          source?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          reason?: string
          source?: string | null
          user_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          completed_at: string | null
          created_at: string
          due_at: string | null
          id: string
          lead_id: string | null
          notes: string | null
          priority: number
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          due_at?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          priority?: number
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          due_at?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          priority?: number
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      templates: {
        Row: {
          body: string
          created_at: string
          id: string
          name: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          name: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          name?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      unsubscribes: {
        Row: {
          created_at: string
          email: string
          id: string
          reason: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          reason?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_api_keys: {
        Row: {
          created_at: string
          id: string
          label: string | null
          provider: string
          user_id: string
          value_enc: string
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string | null
          provider: string
          user_id: string
          value_enc: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string | null
          provider?: string
          user_id?: string
          value_enc?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_smtp_settings: {
        Row: {
          created_at: string
          daily_cap: number
          from_email: string
          from_name: string | null
          host: string
          id: string
          imap_enabled: boolean
          imap_host: string | null
          imap_last_uid: number
          imap_password_enc: string | null
          imap_port: number | null
          imap_username: string | null
          last_error: string | null
          last_reset_date: string
          password_enc: string
          port: number
          reply_to: string | null
          secure: boolean
          sent_today: number
          updated_at: string
          user_id: string
          username: string
          verified_at: string | null
          warmup_day: number
          warmup_enabled: boolean
        }
        Insert: {
          created_at?: string
          daily_cap?: number
          from_email: string
          from_name?: string | null
          host: string
          id?: string
          imap_enabled?: boolean
          imap_host?: string | null
          imap_last_uid?: number
          imap_password_enc?: string | null
          imap_port?: number | null
          imap_username?: string | null
          last_error?: string | null
          last_reset_date?: string
          password_enc: string
          port?: number
          reply_to?: string | null
          secure?: boolean
          sent_today?: number
          updated_at?: string
          user_id: string
          username: string
          verified_at?: string | null
          warmup_day?: number
          warmup_enabled?: boolean
        }
        Update: {
          created_at?: string
          daily_cap?: number
          from_email?: string
          from_name?: string | null
          host?: string
          id?: string
          imap_enabled?: boolean
          imap_host?: string | null
          imap_last_uid?: number
          imap_password_enc?: string | null
          imap_port?: number | null
          imap_username?: string | null
          last_error?: string | null
          last_reset_date?: string
          password_enc?: string
          port?: number
          reply_to?: string | null
          secure?: boolean
          sent_today?: number
          updated_at?: string
          user_id?: string
          username?: string
          verified_at?: string | null
          warmup_day?: number
          warmup_enabled?: boolean
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      email_event_type:
        | "sent"
        | "opened"
        | "clicked"
        | "bounced"
        | "replied"
        | "unsubscribed"
        | "complained"
        | "failed"
      lead_status: "new" | "contacted" | "engaged" | "meeting" | "won" | "lost"
      lead_temp: "cold" | "warm" | "hot"
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
      app_role: ["admin", "user"],
      email_event_type: [
        "sent",
        "opened",
        "clicked",
        "bounced",
        "replied",
        "unsubscribed",
        "complained",
        "failed",
      ],
      lead_status: ["new", "contacted", "engaged", "meeting", "won", "lost"],
      lead_temp: ["cold", "warm", "hot"],
    },
  },
} as const
