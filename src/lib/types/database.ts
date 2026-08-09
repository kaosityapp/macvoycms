export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      admins: {
        Row: { created_at: string; user_id: string }
        Insert: { created_at?: string; user_id: string }
        Update: { created_at?: string; user_id?: string }
        Relationships: []
      }
      announcement_reads: {
        Row: {
          announcement_id: string
          family_account_id: string
          id: string
          read_at: string
        }
        Insert: {
          announcement_id: string
          family_account_id: string
          id?: string
          read_at?: string
        }
        Update: {
          announcement_id?: string
          family_account_id?: string
          id?: string
          read_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_reads_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_reads_family_account_id_fkey"
            columns: ["family_account_id"]
            isOneToOne: false
            referencedRelation: "family_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          audience_ref: Json
          audience_type: Database["public"]["Enums"]["audience_type"]
          body: string
          created_at: string
          id: string
          loops_message_id: string | null
          sender: string
          sent_at: string | null
          subject: string
          updated_at: string
        }
        Insert: {
          audience_ref?: Json
          audience_type: Database["public"]["Enums"]["audience_type"]
          body: string
          created_at?: string
          id?: string
          loops_message_id?: string | null
          sender?: string
          sent_at?: string | null
          subject: string
          updated_at?: string
        }
        Update: {
          audience_ref?: Json
          audience_type?: Database["public"]["Enums"]["audience_type"]
          body?: string
          created_at?: string
          id?: string
          loops_message_id?: string | null
          sender?: string
          sent_at?: string | null
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      class_sessions: {
        Row: {
          class_id: string
          created_at: string
          end_time: string
          id: string
          location_id: string
          note: string | null
          session_date: string
          start_time: string
          status: string
          updated_at: string
        }
        Insert: {
          class_id: string
          created_at?: string
          end_time: string
          id?: string
          location_id: string
          note?: string | null
          session_date: string
          start_time: string
          status?: string
          updated_at?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          end_time?: string
          id?: string
          location_id?: string
          note?: string | null
          session_date?: string
          start_time?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_sessions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_sessions_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          age_max: number | null
          age_min: number | null
          created_at: string
          day_of_week: string
          end_date: string | null
          end_time: string
          hourly_rate: number | null
          id: string
          is_private: boolean
          level: string
          location_id: string
          name: string
          season_id: string
          shoe_type: string
          start_date: string | null
          start_time: string
          total_sessions: number | null
          updated_at: string
        }
        Insert: {
          age_max?: number | null
          age_min?: number | null
          created_at?: string
          day_of_week: string
          end_date?: string | null
          end_time: string
          hourly_rate?: number | null
          id?: string
          is_private?: boolean
          level: string
          location_id: string
          name: string
          season_id: string
          shoe_type: string
          start_date?: string | null
          start_time: string
          total_sessions?: number | null
          updated_at?: string
        }
        Update: {
          age_max?: number | null
          age_min?: number | null
          created_at?: string
          day_of_week?: string
          end_date?: string | null
          end_time?: string
          hourly_rate?: number | null
          id?: string
          is_private?: boolean
          level?: string
          location_id?: string
          name?: string
          season_id?: string
          shoe_type?: string
          start_date?: string | null
          start_time?: string
          total_sessions?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      consents: {
        Row: {
          agreed_at: string
          created_at: string
          family_member_id: string
          id: string
          policy_text_snapshot: string
          type: Database["public"]["Enums"]["consent_type"]
        }
        Insert: {
          agreed_at?: string
          created_at?: string
          family_member_id: string
          id?: string
          policy_text_snapshot: string
          type: Database["public"]["Enums"]["consent_type"]
        }
        Update: {
          agreed_at?: string
          created_at?: string
          family_member_id?: string
          id?: string
          policy_text_snapshot?: string
          type?: Database["public"]["Enums"]["consent_type"]
        }
        Relationships: [
          {
            foreignKeyName: "consents_family_member_id_fkey"
            columns: ["family_member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollments: {
        Row: {
          class_id: string
          created_at: string
          enrolled_at: string
          family_member_id: string
          id: string
          status: string
          updated_at: string
        }
        Insert: {
          class_id: string
          created_at?: string
          enrolled_at?: string
          family_member_id: string
          id?: string
          status?: string
          updated_at?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          enrolled_at?: string
          family_member_id?: string
          id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_family_member_id_fkey"
            columns: ["family_member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
        ]
      }
      family_accounts: {
        Row: {
          auth_user_id: string | null
          created_at: string
          id: string
          parent1_email: string
          parent1_name: string
          parent1_phone: string | null
          parent2_email: string | null
          parent2_name: string | null
          parent2_phone: string | null
          referral_source: Database["public"]["Enums"]["referral_source"] | null
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string
          id?: string
          parent1_email: string
          parent1_name: string
          parent1_phone?: string | null
          parent2_email?: string | null
          parent2_name?: string | null
          parent2_phone?: string | null
          referral_source?: Database["public"]["Enums"]["referral_source"] | null
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string
          id?: string
          parent1_email?: string
          parent1_name?: string
          parent1_phone?: string | null
          parent2_email?: string | null
          parent2_name?: string | null
          parent2_phone?: string | null
          referral_source?: Database["public"]["Enums"]["referral_source"] | null
          updated_at?: string
        }
        Relationships: []
      }
      family_members: {
        Row: {
          address: string | null
          birthday: string | null
          created_at: string
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          emergency_contact_relationship: string | null
          family_account_id: string
          first_name: string
          gender: string | null
          id: string
          last_name: string
          medical_notes: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          birthday?: string | null
          created_at?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relationship?: string | null
          family_account_id: string
          first_name: string
          gender?: string | null
          id?: string
          last_name: string
          medical_notes?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          birthday?: string | null
          created_at?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relationship?: string | null
          family_account_id?: string
          first_name?: string
          gender?: string | null
          id?: string
          last_name?: string
          medical_notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_members_family_account_id_fkey"
            columns: ["family_account_id"]
            isOneToOne: false
            referencedRelation: "family_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          address: string | null
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          amount: number
          created_at: string
          family_member_id: string
          id: string
          item_type: string
        }
        Insert: {
          amount: number
          created_at?: string
          family_member_id: string
          id?: string
          item_type: string
        }
        Update: {
          amount?: number
          created_at?: string
          family_member_id?: string
          id?: string
          item_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_items_family_member_id_fkey"
            columns: ["family_member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_plans: {
        Row: {
          created_at: string
          family_member_id: string
          helcim_subscription_id: string | null
          id: string
          installment_schedule: Json
          plan_type: string
          status: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          family_member_id: string
          helcim_subscription_id?: string | null
          id?: string
          installment_schedule?: Json
          plan_type: string
          status?: string
          total_amount: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          family_member_id?: string
          helcim_subscription_id?: string | null
          id?: string
          installment_schedule?: Json
          plan_type?: string
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_plans_family_member_id_fkey"
            columns: ["family_member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          category: string
          created_at: string
          family_member_id: string
          helcim_transaction_id: string | null
          id: string
          late_fee_amount: number | null
          late_fee_applied_at: string | null
          paid_at: string | null
          payment_plan_id: string | null
        }
        Insert: {
          amount: number
          category?: string
          created_at?: string
          family_member_id: string
          helcim_transaction_id?: string | null
          id?: string
          late_fee_amount?: number | null
          late_fee_applied_at?: string | null
          paid_at?: string | null
          payment_plan_id?: string | null
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          family_member_id?: string
          helcim_transaction_id?: string | null
          id?: string
          late_fee_amount?: number | null
          late_fee_applied_at?: string | null
          paid_at?: string | null
          payment_plan_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_family_member_id_fkey"
            columns: ["family_member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_payment_plan_id_fkey"
            columns: ["payment_plan_id"]
            isOneToOne: false
            referencedRelation: "payment_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_card: {
        Row: {
          created_at: string
          duration_minutes: number
          id: string
          price: number
          season_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          duration_minutes: number
          id?: string
          price: number
          season_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          duration_minutes?: number
          id?: string
          price?: number
          season_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rate_card_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      seasons: {
        Row: {
          created_at: string
          end_date: string
          id: string
          name: string
          start_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          name: string
          start_date: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          name?: string
          start_date?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      announcement_targets_account: {
        Args: { a_id: string; fa_id: string }
        Returns: boolean
      }
      class_duration_minutes: {
        Args: { c: Database["public"]["Tables"]["classes"]["Row"] }
        Returns: number
      }
      current_family_account_id: { Args: never; Returns: string }
      generate_class_sessions: {
        Args: { p_from?: string; p_season_id: string }
        Returns: number
      }
      is_admin: { Args: never; Returns: boolean }
      owns_family_member: { Args: { fm_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "parent"
      audience_type: "all" | "location" | "class" | "individual"
      consent_type:
        | "liability"
        | "media"
        | "code_of_conduct"
        | "attire"
        | "costume_rental"
        | "fee_cancellation"
      referral_source:
        | "internet_search"
        | "social_media"
        | "local_irish_club"
        | "word_of_mouth"
        | "returning_dancer"
        | "restyling_transfer"
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
      app_role: ["admin", "parent"],
      audience_type: ["all", "location", "class", "individual"],
      consent_type: [
        "liability",
        "media",
        "code_of_conduct",
        "attire",
        "costume_rental",
        "fee_cancellation",
      ],
      referral_source: [
        "internet_search",
        "social_media",
        "local_irish_club",
        "word_of_mouth",
        "returning_dancer",
        "restyling_transfer",
      ],
    },
  },
} as const

// ---------------------------------------------------------------------------
// Convenience aliases used across the app (kept when regenerating types).
// Regenerate the block above with: npm run db:types
// ---------------------------------------------------------------------------
export type ReferralSource = Database["public"]["Enums"]["referral_source"]
export type ConsentType = Database["public"]["Enums"]["consent_type"]
export type AudienceType = Database["public"]["Enums"]["audience_type"]
