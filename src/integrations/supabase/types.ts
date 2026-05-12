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
      app_settings: {
        Row: {
          id: number
          tracking_mode: string
          updated_at: string
        }
        Insert: {
          id?: number
          tracking_mode?: string
          updated_at?: string
        }
        Update: {
          id?: number
          tracking_mode?: string
          updated_at?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          total_courses: number
          total_depense: number
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          total_courses?: number
          total_depense?: number
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          total_courses?: number
          total_depense?: number
        }
        Relationships: []
      }
      courses: {
        Row: {
          client_id: string | null
          created_at: string
          depart: string | null
          destination: string | null
          id: string
          paiement: string
          prix_final: number | null
          reservation_id: string | null
          status: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          depart?: string | null
          destination?: string | null
          id?: string
          paiement?: string
          prix_final?: number | null
          reservation_id?: string | null
          status?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          depart?: string | null
          destination?: string | null
          id?: string
          paiement?: string
          prix_final?: number | null
          reservation_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      cta_events: {
        Row: {
          created_at: string
          event_type: string
          has_draft: boolean | null
          id: string
          lang: string | null
          page: string | null
          referrer: string | null
          user_agent: string | null
          variant: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          has_draft?: boolean | null
          id?: string
          lang?: string | null
          page?: string | null
          referrer?: string | null
          user_agent?: string | null
          variant?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          has_draft?: boolean | null
          id?: string
          lang?: string | null
          page?: string | null
          referrer?: string | null
          user_agent?: string | null
          variant?: string | null
        }
        Relationships: []
      }
      driver_gps: {
        Row: {
          accuracy: number | null
          destination: string | null
          heading: number | null
          id: string
          is_active: boolean
          latitude: number | null
          longitude: number | null
          prix_estime: string | null
          speed: number | null
          updated_at: string
        }
        Insert: {
          accuracy?: number | null
          destination?: string | null
          heading?: number | null
          id: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          prix_estime?: string | null
          speed?: number | null
          updated_at?: string
        }
        Update: {
          accuracy?: number | null
          destination?: string | null
          heading?: number | null
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          prix_estime?: string | null
          speed?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      driver_location: {
        Row: {
          accuracy: number | null
          heading: number | null
          id: string
          is_online: boolean
          latitude: number
          longitude: number
          speed: number | null
          updated_at: string
        }
        Insert: {
          accuracy?: number | null
          heading?: number | null
          id?: string
          is_online?: boolean
          latitude: number
          longitude: number
          speed?: number | null
          updated_at?: string
        }
        Update: {
          accuracy?: number | null
          heading?: number | null
          id?: string
          is_online?: boolean
          latitude?: number
          longitude?: number
          speed?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      reservations: {
        Row: {
          arrivee: string
          bagages: number
          client_email: string | null
          client_name: string | null
          client_phone: string | null
          created_at: string
          date_course: string | null
          depart: string
          destination: string | null
          distance_km: number | null
          email: string | null
          heure_course: string | null
          id: string
          message: string | null
          nb_passagers: number | null
          nom: string
          passagers: number
          pickup_datetime: string
          prix_estime: number | null
          service_type: string
          source: string | null
          status: string
          tarif_jour: boolean | null
          telephone: string
          tracking_id: string | null
          updated_at: string | null
        }
        Insert: {
          arrivee: string
          bagages?: number
          client_email?: string | null
          client_name?: string | null
          client_phone?: string | null
          created_at?: string
          date_course?: string | null
          depart: string
          destination?: string | null
          distance_km?: number | null
          email?: string | null
          heure_course?: string | null
          id?: string
          message?: string | null
          nb_passagers?: number | null
          nom: string
          passagers?: number
          pickup_datetime: string
          prix_estime?: number | null
          service_type?: string
          source?: string | null
          status?: string
          tarif_jour?: boolean | null
          telephone: string
          tracking_id?: string | null
          updated_at?: string | null
        }
        Update: {
          arrivee?: string
          bagages?: number
          client_email?: string | null
          client_name?: string | null
          client_phone?: string | null
          created_at?: string
          date_course?: string | null
          depart?: string
          destination?: string | null
          distance_km?: number | null
          email?: string | null
          heure_course?: string | null
          id?: string
          message?: string | null
          nb_passagers?: number | null
          nom?: string
          passagers?: number
          pickup_datetime?: string
          prix_estime?: number | null
          service_type?: string
          source?: string | null
          status?: string
          tarif_jour?: boolean | null
          telephone?: string
          tracking_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      reviews: {
        Row: {
          approved: boolean
          created_at: string
          id: string
          name: string
          rating: number
          text: string
        }
        Insert: {
          approved?: boolean
          created_at?: string
          id?: string
          name: string
          rating: number
          text: string
        }
        Update: {
          approved?: boolean
          created_at?: string
          id?: string
          name?: string
          rating?: number
          text?: string
        }
        Relationships: []
      }
      site_analytics: {
        Row: {
          created_at: string
          event: string
          id: string
          session_id: string | null
        }
        Insert: {
          created_at?: string
          event: string
          id?: string
          session_id?: string | null
        }
        Update: {
          created_at?: string
          event?: string
          id?: string
          session_id?: string | null
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
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
          role: Database["public"]["Enums"]["app_role"]
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cancel_reservation_public: { Args: { p_id: string }; Returns: boolean }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_reservation_public: {
        Args: { p_id: string }
        Returns: {
          arrivee: string
          bagages: number
          created_at: string
          depart: string
          email: string
          id: string
          message: string
          nom: string
          passagers: number
          pickup_datetime: string
          service_type: string
          status: string
          telephone: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
    },
  },
} as const
