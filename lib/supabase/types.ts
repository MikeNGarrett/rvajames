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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      activities: {
        Row: {
          created_at: string
          id: string
          min_age: number
          name: string
          requires_swim: boolean
          slug: string
          surface_type: Database["public"]["Enums"]["surface_type"]
        }
        Insert: {
          created_at?: string
          id?: string
          min_age?: number
          name: string
          requires_swim?: boolean
          slug: string
          surface_type: Database["public"]["Enums"]["surface_type"]
        }
        Update: {
          created_at?: string
          id?: string
          min_age?: number
          name?: string
          requires_swim?: boolean
          slug?: string
          surface_type?: Database["public"]["Enums"]["surface_type"]
        }
        Relationships: []
      }
      advisories: {
        Row: {
          body: string
          created_at: string
          effective_from: string
          effective_to: string | null
          headline: string
          id: string
          kind: Database["public"]["Enums"]["advisory_kind"]
          location_ids: string[]
          severity: Database["public"]["Enums"]["advisory_severity"]
          source: string
          source_id: string | null
        }
        Insert: {
          body?: string
          created_at?: string
          effective_from: string
          effective_to?: string | null
          headline: string
          id?: string
          kind: Database["public"]["Enums"]["advisory_kind"]
          location_ids?: string[]
          severity: Database["public"]["Enums"]["advisory_severity"]
          source: string
          source_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          headline?: string
          id?: string
          kind?: Database["public"]["Enums"]["advisory_kind"]
          location_ids?: string[]
          severity?: Database["public"]["Enums"]["advisory_severity"]
          source?: string
          source_id?: string | null
        }
        Relationships: []
      }
      ai_interpretations: {
        Row: {
          age_bucket: Database["public"]["Enums"]["age_bucket"]
          body_md: string
          cost_usd: number
          created_at: string
          date: string
          id: string
          location_id: string
          model: string
          prep_items: Json
          prompt_hash: string
          tokens_in: number
          tokens_out: number
        }
        Insert: {
          age_bucket: Database["public"]["Enums"]["age_bucket"]
          body_md: string
          cost_usd?: number
          created_at?: string
          date: string
          id?: string
          location_id: string
          model: string
          prep_items?: Json
          prompt_hash: string
          tokens_in?: number
          tokens_out?: number
        }
        Update: {
          age_bucket?: Database["public"]["Enums"]["age_bucket"]
          body_md?: string
          cost_usd?: number
          created_at?: string
          date?: string
          id?: string
          location_id?: string
          model?: string
          prep_items?: Json
          prompt_hash?: string
          tokens_in?: number
          tokens_out?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_interpretations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      conditions_snapshots: {
        Row: {
          air_temp_f: number | null
          discharge_cfs: number | null
          fetched_at: string
          gage_ft: number | null
          id: string
          location_id: string
          payload: Json
          precip_in: number | null
          source: string
          water_temp_f: number | null
        }
        Insert: {
          air_temp_f?: number | null
          discharge_cfs?: number | null
          fetched_at?: string
          gage_ft?: number | null
          id?: string
          location_id: string
          payload?: Json
          precip_in?: number | null
          source: string
          water_temp_f?: number | null
        }
        Update: {
          air_temp_f?: number | null
          discharge_cfs?: number | null
          fetched_at?: string
          gage_ft?: number | null
          id?: string
          location_id?: string
          payload?: Json
          precip_in?: number | null
          source?: string
          water_temp_f?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "conditions_snapshots_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      ingestion_runs: {
        Row: {
          error: string | null
          finished_at: string | null
          id: string
          ok: boolean | null
          rows_written: number
          source: string
          started_at: string
        }
        Insert: {
          error?: string | null
          finished_at?: string | null
          id?: string
          ok?: boolean | null
          rows_written?: number
          source: string
          started_at?: string
        }
        Update: {
          error?: string | null
          finished_at?: string | null
          id?: string
          ok?: boolean | null
          rows_written?: number
          source?: string
          started_at?: string
        }
        Relationships: []
      }
      location_activities: {
        Row: {
          activity_id: string
          location_id: string
        }
        Insert: {
          activity_id: string
          location_id: string
        }
        Update: {
          activity_id?: string
          location_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_activities_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "location_activities_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      location_resources: {
        Row: {
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["resource_kind"]
          location_id: string
          sort_order: number
          title: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["resource_kind"]
          location_id: string
          sort_order?: number
          title: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["resource_kind"]
          location_id?: string
          sort_order?: number
          title?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_resources_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      location_status: {
        Row: {
          affects: string | null
          created_at: string
          created_by: string
          effective_from: string
          effective_to: string | null
          id: string
          kind: Database["public"]["Enums"]["location_status_kind"]
          location_id: string
          next_review_at: string | null
          reason: string
          source: string
          source_url: string | null
          state: Database["public"]["Enums"]["location_status_state"]
          updated_at: string
        }
        Insert: {
          affects?: string | null
          created_at?: string
          created_by?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          kind: Database["public"]["Enums"]["location_status_kind"]
          location_id: string
          next_review_at?: string | null
          reason: string
          source: string
          source_url?: string | null
          state?: Database["public"]["Enums"]["location_status_state"]
          updated_at?: string
        }
        Update: {
          affects?: string | null
          created_at?: string
          created_by?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["location_status_kind"]
          location_id?: string
          next_review_at?: string | null
          reason?: string
          source?: string
          source_url?: string | null
          state?: Database["public"]["Enums"]["location_status_state"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_status_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          created_at: string
          id: string
          jra_site_id: string | null
          kind: Database["public"]["Enums"]["location_kind"]
          lat: number
          lng: number
          name: string
          nws_grid: string | null
          slug: string
          tags: string[]
          usgs_station_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          jra_site_id?: string | null
          kind?: Database["public"]["Enums"]["location_kind"]
          lat: number
          lng: number
          name: string
          nws_grid?: string | null
          slug: string
          tags?: string[]
          usgs_station_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          jra_site_id?: string | null
          kind?: Database["public"]["Enums"]["location_kind"]
          lat?: number
          lng?: number
          name?: string
          nws_grid?: string | null
          slug?: string
          tags?: string[]
          usgs_station_id?: string | null
        }
        Relationships: []
      }
      metro_summaries: {
        Row: {
          activities: Json | null
          age_bucket: Database["public"]["Enums"]["age_bucket"]
          best_bets: Json
          body_md: string
          cost_usd: number
          created_at: string
          date: string
          headline: string
          id: string
          model: string
          prompt_hash: string
          rapids_class: string | null
          rapids_note: string | null
          tokens_in: number
          tokens_out: number
          top_concerns: Json
        }
        Insert: {
          activities?: Json | null
          age_bucket: Database["public"]["Enums"]["age_bucket"]
          best_bets?: Json
          body_md: string
          cost_usd?: number
          created_at?: string
          date: string
          headline?: string
          id?: string
          model: string
          prompt_hash: string
          rapids_class?: string | null
          rapids_note?: string | null
          tokens_in?: number
          tokens_out?: number
          top_concerns?: Json
        }
        Update: {
          activities?: Json | null
          age_bucket?: Database["public"]["Enums"]["age_bucket"]
          best_bets?: Json
          body_md?: string
          cost_usd?: number
          created_at?: string
          date?: string
          headline?: string
          id?: string
          model?: string
          prompt_hash?: string
          rapids_class?: string | null
          rapids_note?: string | null
          tokens_in?: number
          tokens_out?: number
          top_concerns?: Json
        }
        Relationships: []
      }
      usgs_percentiles: {
        Row: {
          day_nu: number
          day_of_year: number
          fetched_at: string
          id: string
          month_nu: number
          p10: number | null
          p25: number | null
          p50: number | null
          p75: number | null
          p90: number | null
          parameter_cd: string
          record_count: number | null
          station_id: string
        }
        Insert: {
          day_nu: number
          day_of_year: number
          fetched_at?: string
          id?: string
          month_nu: number
          p10?: number | null
          p25?: number | null
          p50?: number | null
          p75?: number | null
          p90?: number | null
          parameter_cd: string
          record_count?: number | null
          station_id: string
        }
        Update: {
          day_nu?: number
          day_of_year?: number
          fetched_at?: string
          id?: string
          month_nu?: number
          p10?: number | null
          p25?: number | null
          p50?: number | null
          p75?: number | null
          p90?: number | null
          parameter_cd?: string
          record_count?: number | null
          station_id?: string
        }
        Relationships: []
      }
      water_quality_readings: {
        Row: {
          air_temp_f: number | null
          collected_at: string
          conductivity: number | null
          ecoli_average: number | null
          ecoli_cfu_per_100ml: number | null
          enterococci_average: number | null
          enterococci_cfu_per_100ml: number | null
          fetched_at: string
          id: string
          latitude: number | null
          longitude: number | null
          organization: string | null
          raw_payload: Json | null
          salinity: number | null
          site_conditions: string | null
          station_code: string | null
          station_global_id: string
          station_name: string
          turbidity: number | null
          water_temp_f: number | null
        }
        Insert: {
          air_temp_f?: number | null
          collected_at: string
          conductivity?: number | null
          ecoli_average?: number | null
          ecoli_cfu_per_100ml?: number | null
          enterococci_average?: number | null
          enterococci_cfu_per_100ml?: number | null
          fetched_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          organization?: string | null
          raw_payload?: Json | null
          salinity?: number | null
          site_conditions?: string | null
          station_code?: string | null
          station_global_id: string
          station_name: string
          turbidity?: number | null
          water_temp_f?: number | null
        }
        Update: {
          air_temp_f?: number | null
          collected_at?: string
          conductivity?: number | null
          ecoli_average?: number | null
          ecoli_cfu_per_100ml?: number | null
          enterococci_average?: number | null
          enterococci_cfu_per_100ml?: number | null
          fetched_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          organization?: string | null
          raw_payload?: Json | null
          salinity?: number | null
          site_conditions?: string | null
          station_code?: string | null
          station_global_id?: string
          station_name?: string
          turbidity?: number | null
          water_temp_f?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      advisory_kind:
        | "flood_watch"
        | "flood_warning"
        | "flood_advisory"
        | "cso_overflow"
        | "water_quality"
        | "swim_closure"
        | "general"
      advisory_severity: "low" | "moderate" | "high" | "extreme"
      age_bucket: "0-2" | "3-5" | "6-9" | "10-13" | "14+" | "none"
      location_kind: "gauge" | "access_point"
      location_status_kind:
        | "open"
        | "restricted"
        | "closed"
        | "closed_indefinite"
      location_status_state: "draft" | "active" | "expired"
      resource_kind: "official" | "parks" | "safety" | "community"
      surface_type: "water" | "rock" | "trail" | "mixed"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      advisory_kind: [
        "flood_watch",
        "flood_warning",
        "flood_advisory",
        "cso_overflow",
        "water_quality",
        "swim_closure",
        "general",
      ],
      advisory_severity: ["low", "moderate", "high", "extreme"],
      age_bucket: ["0-2", "3-5", "6-9", "10-13", "14+", "none"],
      location_kind: ["gauge", "access_point"],
      location_status_kind: [
        "open",
        "restricted",
        "closed",
        "closed_indefinite",
      ],
      location_status_state: ["draft", "active", "expired"],
      resource_kind: ["official", "parks", "safety", "community"],
      surface_type: ["water", "rock", "trail", "mixed"],
    },
  },
} as const
