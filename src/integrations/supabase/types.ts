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
      map_paths: {
        Row: {
          color: string
          created_at: string
          id: string
          map_id: string
          points: Json
          user_id: string | null
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          map_id: string
          points: Json
          user_id?: string | null
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          map_id?: string
          points?: Json
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "map_paths_map_id_fkey"
            columns: ["map_id"]
            isOneToOne: false
            referencedRelation: "maps"
            referencedColumns: ["id"]
          },
        ]
      }
      map_poi_images: {
        Row: {
          created_at: string
          id: string
          image_url: string
          is_thumbnail: boolean
          poi_id: string
          sort_order: number
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          is_thumbnail?: boolean
          poi_id: string
          sort_order?: number
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          is_thumbnail?: boolean
          poi_id?: string
          sort_order?: number
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "map_poi_images_poi_id_fkey"
            columns: ["poi_id"]
            isOneToOne: false
            referencedRelation: "map_pois"
            referencedColumns: ["id"]
          },
        ]
      }
      map_pois: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          map_id: string
          name: string
          sort_order: number
          updated_at: string
          x: number
          y: number
        }
        Insert: {
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          map_id: string
          name: string
          sort_order?: number
          updated_at?: string
          x: number
          y: number
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          map_id?: string
          name?: string
          sort_order?: number
          updated_at?: string
          x?: number
          y?: number
        }
        Relationships: [
          {
            foreignKeyName: "map_pois_map_id_fkey"
            columns: ["map_id"]
            isOneToOne: false
            referencedRelation: "maps"
            referencedColumns: ["id"]
          },
        ]
      }
      maps: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          image_url: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          image_url: string
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          image_url?: string
          name?: string
        }
        Relationships: []
      }
      match_stats: {
        Row: {
          assists: number
          created_at: string
          damage: number
          id: string
          kills: number
          match_id: string
          player_id: string
        }
        Insert: {
          assists?: number
          created_at?: string
          damage?: number
          id?: string
          kills?: number
          match_id: string
          player_id: string
        }
        Update: {
          assists?: number
          created_at?: string
          damage?: number
          id?: string
          kills?: number
          match_id?: string
          player_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_stats_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_stats_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          created_at: string
          id: string
          match_number: number
          position: number | null
          tournament_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          match_number: number
          position?: number | null
          tournament_id: string
        }
        Update: {
          created_at?: string
          id?: string
          match_number?: number
          position?: number | null
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "matches_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      player_aliases: {
        Row: {
          alias: string
          created_at: string
          id: string
          player_id: string
          updated_at: string
        }
        Insert: {
          alias: string
          created_at?: string
          id?: string
          player_id: string
          updated_at?: string
        }
        Update: {
          alias?: string
          created_at?: string
          id?: string
          player_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_aliases_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      player_invites: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          label: string | null
          token: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string | null
          token: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string | null
          token?: string
        }
        Relationships: []
      }
      players: {
        Row: {
          created_at: string
          id: string
          ign: string
          join_date: string
          photo_url: string | null
          role: string
          status: string
          uid: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          ign: string
          join_date?: string
          photo_url?: string | null
          role: string
          status?: string
          uid?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          ign?: string
          join_date?: string
          photo_url?: string | null
          role?: string
          status?: string
          uid?: string | null
        }
        Relationships: []
      }
      tactical_annotations: {
        Row: {
          color: string
          created_at: string
          id: string
          kind: string
          map_id: string | null
          meta: Json
          player_id: string | null
          poi_image_id: string | null
          points: Json
          scope: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          kind: string
          map_id?: string | null
          meta?: Json
          player_id?: string | null
          poi_image_id?: string | null
          points?: Json
          scope: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          kind?: string
          map_id?: string | null
          meta?: Json
          player_id?: string | null
          poi_image_id?: string | null
          points?: Json
          scope?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tactical_annotations_map_id_fkey"
            columns: ["map_id"]
            isOneToOne: false
            referencedRelation: "maps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tactical_annotations_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tactical_annotations_poi_image_id_fkey"
            columns: ["poi_image_id"]
            isOneToOne: false
            referencedRelation: "map_poi_images"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_achievements: {
        Row: {
          created_at: string
          id: string
          image_url: string
          kind: string
          tournament_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          kind: string
          tournament_id: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          kind?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_achievements_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments: {
        Row: {
          created_at: string
          date: string
          id: string
          mvp_player_id: string | null
          name: string
          num_matches: number
          organizer: string | null
          status: string
        }
        Insert: {
          created_at?: string
          date?: string
          id?: string
          mvp_player_id?: string | null
          name: string
          num_matches?: number
          organizer?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          mvp_player_id?: string | null
          name?: string
          num_matches?: number
          organizer?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournaments_mvp_player_id_fkey"
            columns: ["mvp_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
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
      claim_player_role: { Args: { _token: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "player"
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
      app_role: ["admin", "player"],
    },
  },
} as const
