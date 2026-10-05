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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      antivirus_scan_results: {
        Row: {
          analysis_result: Json | null
          created_at: string
          files_scanned: number | null
          id: string
          scan_date: string
          scan_type: string
          session_id: string | null
          threat_details: Json | null
          threats_detected: number | null
        }
        Insert: {
          analysis_result?: Json | null
          created_at?: string
          files_scanned?: number | null
          id?: string
          scan_date?: string
          scan_type?: string
          session_id?: string | null
          threat_details?: Json | null
          threats_detected?: number | null
        }
        Update: {
          analysis_result?: Json | null
          created_at?: string
          files_scanned?: number | null
          id?: string
          scan_date?: string
          scan_type?: string
          session_id?: string | null
          threat_details?: Json | null
          threats_detected?: number | null
        }
        Relationships: []
      }
      app_permission_results: {
        Row: {
          analysis_result: Json | null
          app_name: string
          created_at: string
          id: string
          permissions: Json | null
          risk_level: string | null
          scan_date: string
          session_id: string | null
          suspicious_permissions: string[] | null
        }
        Insert: {
          analysis_result?: Json | null
          app_name: string
          created_at?: string
          id?: string
          permissions?: Json | null
          risk_level?: string | null
          scan_date?: string
          session_id?: string | null
          suspicious_permissions?: string[] | null
        }
        Update: {
          analysis_result?: Json | null
          app_name?: string
          created_at?: string
          id?: string
          permissions?: Json | null
          risk_level?: string | null
          scan_date?: string
          session_id?: string | null
          suspicious_permissions?: string[] | null
        }
        Relationships: []
      }
      banking_apps: {
        Row: {
          created_at: string
          display_name: string
          enabled: boolean
          id: string
          package_name: string
          session_id: string | null
        }
        Insert: {
          created_at?: string
          display_name: string
          enabled?: boolean
          id?: string
          package_name: string
          session_id?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string
          enabled?: boolean
          id?: string
          package_name?: string
          session_id?: string | null
        }
        Relationships: []
      }
      cyber_help_resources: {
        Row: {
          category: string
          created_at: string
          description: string | null
          email: string | null
          id: string
          phone: string | null
          title: string
          website: string | null
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          email?: string | null
          id?: string
          phone?: string | null
          title: string
          website?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          email?: string | null
          id?: string
          phone?: string | null
          title?: string
          website?: string | null
        }
        Relationships: []
      }
      cyber_news_cache: {
        Row: {
          country: string | null
          created_at: string
          id: string
          published_at: string | null
          region: string
          severity: string
          source: string | null
          summary: string | null
          title: string
          url: string | null
        }
        Insert: {
          country?: string | null
          created_at?: string
          id?: string
          published_at?: string | null
          region?: string
          severity?: string
          source?: string | null
          summary?: string | null
          title: string
          url?: string | null
        }
        Update: {
          country?: string | null
          created_at?: string
          id?: string
          published_at?: string | null
          region?: string
          severity?: string
          source?: string | null
          summary?: string | null
          title?: string
          url?: string | null
        }
        Relationships: []
      }
      cyber_news_queries: {
        Row: {
          created_at: string
          id: string
          query: string
          session_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          query: string
          session_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          query?: string
          session_id?: string | null
        }
        Relationships: []
      }
      data_breach_results: {
        Row: {
          analysis_result: Json | null
          breach_details: Json | null
          breaches_found: number | null
          created_at: string
          email_checked: string | null
          id: string
          scan_date: string
          scan_type: string
          session_id: string | null
        }
        Insert: {
          analysis_result?: Json | null
          breach_details?: Json | null
          breaches_found?: number | null
          created_at?: string
          email_checked?: string | null
          id?: string
          scan_date?: string
          scan_type?: string
          session_id?: string | null
        }
        Update: {
          analysis_result?: Json | null
          breach_details?: Json | null
          breaches_found?: number | null
          created_at?: string
          email_checked?: string | null
          id?: string
          scan_date?: string
          scan_type?: string
          session_id?: string | null
        }
        Relationships: []
      }
      firewall_scan_results: {
        Row: {
          analysis_result: Json | null
          blocked_attempts: number | null
          created_at: string
          id: string
          open_ports: number[] | null
          ports_scanned: Json | null
          scan_date: string
          scan_type: string
          session_id: string | null
          threat_level: string | null
        }
        Insert: {
          analysis_result?: Json | null
          blocked_attempts?: number | null
          created_at?: string
          id?: string
          open_ports?: number[] | null
          ports_scanned?: Json | null
          scan_date?: string
          scan_type?: string
          session_id?: string | null
          threat_level?: string | null
        }
        Update: {
          analysis_result?: Json | null
          blocked_attempts?: number | null
          created_at?: string
          id?: string
          open_ports?: number[] | null
          ports_scanned?: Json | null
          scan_date?: string
          scan_type?: string
          session_id?: string | null
          threat_level?: string | null
        }
        Relationships: []
      }
      ip_scan_results: {
        Row: {
          analysis_result: Json | null
          country: string | null
          created_at: string
          id: string
          ip_address: string
          is_malicious: boolean | null
          isp: string | null
          scan_date: string
          scan_type: string
          session_id: string | null
          threat_level: string | null
        }
        Insert: {
          analysis_result?: Json | null
          country?: string | null
          created_at?: string
          id?: string
          ip_address: string
          is_malicious?: boolean | null
          isp?: string | null
          scan_date?: string
          scan_type?: string
          session_id?: string | null
          threat_level?: string | null
        }
        Update: {
          analysis_result?: Json | null
          country?: string | null
          created_at?: string
          id?: string
          ip_address?: string
          is_malicious?: boolean | null
          isp?: string | null
          scan_date?: string
          scan_type?: string
          session_id?: string | null
          threat_level?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      qr_scan_results: {
        Row: {
          analysis_result: Json | null
          created_at: string
          id: string
          qr_content: string
          scan_date: string
          scan_type: string
          session_id: string | null
          threat_level: string | null
        }
        Insert: {
          analysis_result?: Json | null
          created_at?: string
          id?: string
          qr_content: string
          scan_date?: string
          scan_type?: string
          session_id?: string | null
          threat_level?: string | null
        }
        Update: {
          analysis_result?: Json | null
          created_at?: string
          id?: string
          qr_content?: string
          scan_date?: string
          scan_type?: string
          session_id?: string | null
          threat_level?: string | null
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          created_at: string
          request_count: number
          session_id: string
          window_start: string
        }
        Insert: {
          created_at?: string
          request_count?: number
          session_id: string
          window_start?: string
        }
        Update: {
          created_at?: string
          request_count?: number
          session_id?: string
          window_start?: string
        }
        Relationships: []
      }
      rfid_cards: {
        Row: {
          created_at: string
          id: string
          owner: string | null
          session_id: string | null
          uid: string
        }
        Insert: {
          created_at?: string
          id?: string
          owner?: string | null
          session_id?: string | null
          uid: string
        }
        Update: {
          created_at?: string
          id?: string
          owner?: string | null
          session_id?: string | null
          uid?: string
        }
        Relationships: []
      }
      secure_sessions: {
        Row: {
          app_name: string
          created_at: string
          duration_seconds: number | null
          expires_at: string | null
          id: string
          package_name: string | null
          rfid_uid: string | null
          session_id: string | null
          started_at: string
          verification_status: string
        }
        Insert: {
          app_name: string
          created_at?: string
          duration_seconds?: number | null
          expires_at?: string | null
          id?: string
          package_name?: string | null
          rfid_uid?: string | null
          session_id?: string | null
          started_at?: string
          verification_status?: string
        }
        Update: {
          app_name?: string
          created_at?: string
          duration_seconds?: number | null
          expires_at?: string | null
          id?: string
          package_name?: string | null
          rfid_uid?: string | null
          session_id?: string | null
          started_at?: string
          verification_status?: string
        }
        Relationships: []
      }
      security_threats: {
        Row: {
          content: string | null
          created_at: string
          id: string
          session_id: string | null
          severity: string
          type: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          session_id?: string | null
          severity?: string
          type: string
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          session_id?: string | null
          severity?: string
          type?: string
        }
        Relationships: []
      }
      virus_scan_results: {
        Row: {
          analysis_result: Json | null
          created_at: string
          file_hash: string | null
          file_name: string | null
          id: string
          scan_date: string
          scan_type: string
          session_id: string | null
          threat_level: string | null
          virus_detected: boolean | null
          virus_names: string[] | null
        }
        Insert: {
          analysis_result?: Json | null
          created_at?: string
          file_hash?: string | null
          file_name?: string | null
          id?: string
          scan_date?: string
          scan_type?: string
          session_id?: string | null
          threat_level?: string | null
          virus_detected?: boolean | null
          virus_names?: string[] | null
        }
        Update: {
          analysis_result?: Json | null
          created_at?: string
          file_hash?: string | null
          file_name?: string | null
          id?: string
          scan_date?: string
          scan_type?: string
          session_id?: string | null
          threat_level?: string | null
          virus_detected?: boolean | null
          virus_names?: string[] | null
        }
        Relationships: []
      }
      website_scan_results: {
        Row: {
          analysis_result: Json | null
          created_at: string
          id: string
          malware_detected: boolean | null
          phishing_detected: boolean | null
          scan_date: string
          scan_type: string
          session_id: string | null
          threat_level: string | null
          website_url: string
        }
        Insert: {
          analysis_result?: Json | null
          created_at?: string
          id?: string
          malware_detected?: boolean | null
          phishing_detected?: boolean | null
          scan_date?: string
          scan_type?: string
          session_id?: string | null
          threat_level?: string | null
          website_url: string
        }
        Update: {
          analysis_result?: Json | null
          created_at?: string
          id?: string
          malware_detected?: boolean | null
          phishing_detected?: boolean | null
          scan_date?: string
          scan_type?: string
          session_id?: string | null
          threat_level?: string | null
          website_url?: string
        }
        Relationships: []
      }
      wifi_scan_results: {
        Row: {
          analysis_result: Json | null
          created_at: string
          id: string
          network_name: string
          scan_date: string
          scan_type: string | null
          security_type: string | null
          session_id: string | null
          signal_strength: number | null
          threat_level: string | null
          vulnerabilities: Json | null
        }
        Insert: {
          analysis_result?: Json | null
          created_at?: string
          id?: string
          network_name: string
          scan_date?: string
          scan_type?: string | null
          security_type?: string | null
          session_id?: string | null
          signal_strength?: number | null
          threat_level?: string | null
          vulnerabilities?: Json | null
        }
        Update: {
          analysis_result?: Json | null
          created_at?: string
          id?: string
          network_name?: string
          scan_date?: string
          scan_type?: string | null
          security_type?: string | null
          session_id?: string | null
          signal_strength?: number | null
          threat_level?: string | null
          vulnerabilities?: Json | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      set_session_id: { Args: { session_id: string }; Returns: undefined }
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
    Enums: {},
  },
} as const
