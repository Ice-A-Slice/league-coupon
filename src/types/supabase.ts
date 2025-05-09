export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      betting_round_fixtures: {
        Row: {
          betting_round_id: number
          created_at: string
          fixture_id: number
        }
        Insert: {
          betting_round_id: number
          created_at?: string
          fixture_id: number
        }
        Update: {
          betting_round_id?: number
          created_at?: string
          fixture_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "betting_round_fixtures_betting_round_id_fkey"
            columns: ["betting_round_id"]
            isOneToOne: false
            referencedRelation: "betting_rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "betting_round_fixtures_fixture_id_fkey"
            columns: ["fixture_id"]
            isOneToOne: false
            referencedRelation: "fixtures"
            referencedColumns: ["id"]
          },
        ]
      }
      betting_rounds: {
        Row: {
          competition_id: number
          created_at: string
          earliest_fixture_kickoff: string | null
          id: number
          latest_fixture_kickoff: string | null
          name: string
          scored_at: string | null
          status: Database["public"]["Enums"]["betting_round_status"]
          updated_at: string
        }
        Insert: {
          competition_id: number
          created_at?: string
          earliest_fixture_kickoff?: string | null
          id?: number
          latest_fixture_kickoff?: string | null
          name: string
          scored_at?: string | null
          status?: Database["public"]["Enums"]["betting_round_status"]
          updated_at?: string
        }
        Update: {
          competition_id?: number
          created_at?: string
          earliest_fixture_kickoff?: string | null
          id?: number
          latest_fixture_kickoff?: string | null
          name?: string
          scored_at?: string | null
          status?: Database["public"]["Enums"]["betting_round_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "betting_rounds_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
        ]
      }
      competitions: {
        Row: {
          api_league_id: number
          country_name: string | null
          created_at: string | null
          id: number
          logo_url: string | null
          name: string
          type: string | null
        }
        Insert: {
          api_league_id: number
          country_name?: string | null
          created_at?: string | null
          id?: number
          logo_url?: string | null
          name: string
          type?: string | null
        }
        Update: {
          api_league_id?: number
          country_name?: string | null
          created_at?: string | null
          id?: number
          logo_url?: string | null
          name?: string
          type?: string | null
        }
        Relationships: []
      }
      fixtures: {
        Row: {
          api_fixture_id: number
          away_goals: number | null
          away_goals_ht: number | null
          away_team_id: number
          created_at: string | null
          home_goals: number | null
          home_goals_ht: number | null
          home_team_id: number
          id: number
          kickoff: string
          last_api_update: string | null
          referee: string | null
          result: string | null
          round_id: number
          status_long: string | null
          status_short: string
          venue_city: string | null
          venue_name: string | null
        }
        Insert: {
          api_fixture_id: number
          away_goals?: number | null
          away_goals_ht?: number | null
          away_team_id: number
          created_at?: string | null
          home_goals?: number | null
          home_goals_ht?: number | null
          home_team_id: number
          id?: number
          kickoff: string
          last_api_update?: string | null
          referee?: string | null
          result?: string | null
          round_id: number
          status_long?: string | null
          status_short: string
          venue_city?: string | null
          venue_name?: string | null
        }
        Update: {
          api_fixture_id?: number
          away_goals?: number | null
          away_goals_ht?: number | null
          away_team_id?: number
          created_at?: string | null
          home_goals?: number | null
          home_goals_ht?: number | null
          home_team_id?: number
          id?: number
          kickoff?: string
          last_api_update?: string | null
          referee?: string | null
          result?: string | null
          round_id?: number
          status_long?: string | null
          status_short?: string
          venue_city?: string | null
          venue_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fixtures_away_team_id_fkey"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixtures_home_team_id_fkey"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixtures_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      player_statistics: {
        Row: {
          created_at: string
          id: number
          player_id: number
          season_id: number
          team_id: number
        }
        Insert: {
          created_at?: string
          id?: number
          player_id: number
          season_id: number
          team_id: number
        }
        Update: {
          created_at?: string
          id?: number
          player_id?: number
          season_id?: number
          team_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "player_statistics_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_statistics_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_statistics_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          age: number | null
          api_player_id: number
          created_at: string
          firstname: string | null
          height: string | null
          id: number
          injured: boolean | null
          last_api_update: string | null
          lastname: string | null
          name: string | null
          nationality: string | null
          photo_url: string | null
          weight: string | null
        }
        Insert: {
          age?: number | null
          api_player_id: number
          created_at?: string
          firstname?: string | null
          height?: string | null
          id?: number
          injured?: boolean | null
          last_api_update?: string | null
          lastname?: string | null
          name?: string | null
          nationality?: string | null
          photo_url?: string | null
          weight?: string | null
        }
        Update: {
          age?: number | null
          api_player_id?: number
          created_at?: string
          firstname?: string | null
          height?: string | null
          id?: number
          injured?: boolean | null
          last_api_update?: string | null
          lastname?: string | null
          name?: string | null
          nationality?: string | null
          photo_url?: string | null
          weight?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      rounds: {
        Row: {
          created_at: string | null
          custom_deadline: string | null
          id: number
          name: string
          season_id: number
          status: string | null
        }
        Insert: {
          created_at?: string | null
          custom_deadline?: string | null
          id?: number
          name: string
          season_id: number
          status?: string | null
        }
        Update: {
          created_at?: string | null
          custom_deadline?: string | null
          id?: number
          name?: string
          season_id?: number
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rounds_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      seasons: {
        Row: {
          api_season_year: number
          competition_id: number
          coverage_json: Json | null
          created_at: string | null
          end_date: string | null
          id: number
          is_current: boolean | null
          name: string | null
          start_date: string | null
        }
        Insert: {
          api_season_year: number
          competition_id: number
          coverage_json?: Json | null
          created_at?: string | null
          end_date?: string | null
          id?: number
          is_current?: boolean | null
          name?: string | null
          start_date?: string | null
        }
        Update: {
          api_season_year?: number
          competition_id?: number
          coverage_json?: Json | null
          created_at?: string | null
          end_date?: string | null
          id?: number
          is_current?: boolean | null
          name?: string | null
          start_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seasons_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          api_team_id: number
          code: string | null
          country: string | null
          created_at: string | null
          founded: number | null
          id: number
          logo_url: string | null
          name: string
          national: boolean | null
        }
        Insert: {
          api_team_id: number
          code?: string | null
          country?: string | null
          created_at?: string | null
          founded?: number | null
          id?: number
          logo_url?: string | null
          name: string
          national?: boolean | null
        }
        Update: {
          api_team_id?: number
          code?: string | null
          country?: string | null
          created_at?: string | null
          founded?: number | null
          id?: number
          logo_url?: string | null
          name?: string
          national?: boolean | null
        }
        Relationships: []
      }
      user_bets: {
        Row: {
          betting_round_id: number | null
          created_at: string
          fixture_id: number
          id: string
          points_awarded: number | null
          prediction: Database["public"]["Enums"]["prediction_type"]
          submitted_at: string
          user_id: string
        }
        Insert: {
          betting_round_id?: number | null
          created_at?: string
          fixture_id: number
          id?: string
          points_awarded?: number | null
          prediction: Database["public"]["Enums"]["prediction_type"]
          submitted_at?: string
          user_id: string
        }
        Update: {
          betting_round_id?: number | null
          created_at?: string
          fixture_id?: number
          id?: string
          points_awarded?: number | null
          prediction?: Database["public"]["Enums"]["prediction_type"]
          submitted_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_bets_betting_round_id_fkey"
            columns: ["betting_round_id"]
            isOneToOne: false
            referencedRelation: "betting_rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_bets_fixture_id_fkey"
            columns: ["fixture_id"]
            isOneToOne: false
            referencedRelation: "fixtures"
            referencedColumns: ["id"]
          },
        ]
      }
      user_round_dynamic_points: {
        Row: {
          betting_round_id: number
          created_at: string
          dynamic_points: number
          id: number
          question_1_correct: boolean
          question_2_correct: boolean
          question_3_correct: boolean
          question_4_correct: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          betting_round_id: number
          created_at?: string
          dynamic_points?: number
          id?: number
          question_1_correct?: boolean
          question_2_correct?: boolean
          question_3_correct?: boolean
          question_4_correct?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          betting_round_id?: number
          created_at?: string
          dynamic_points?: number
          id?: number
          question_1_correct?: boolean
          question_2_correct?: boolean
          question_3_correct?: boolean
          question_4_correct?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_round_dynamic_points_betting_round_id_fkey"
            columns: ["betting_round_id"]
            isOneToOne: false
            referencedRelation: "betting_rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      user_season_answers: {
        Row: {
          answered_player_id: number | null
          answered_team_id: number | null
          created_at: string
          id: string
          question_type: string
          season_id: number
          updated_at: string
          user_id: string
        }
        Insert: {
          answered_player_id?: number | null
          answered_team_id?: number | null
          created_at?: string
          id?: string
          question_type: string
          season_id: number
          updated_at?: string
          user_id: string
        }
        Update: {
          answered_player_id?: number | null
          answered_team_id?: number | null
          created_at?: string
          id?: string
          question_type?: string
          season_id?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_season_answers_answered_player_id_fkey"
            columns: ["answered_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_season_answers_answered_team_id_fkey"
            columns: ["answered_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_season_answers_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_total_points: {
        Args: Record<PropertyKey, never>
        Returns: {
          user_id: string
          total_points: number
        }[]
      }
      handle_dynamic_points_update: {
        Args: { p_round_id: number; p_dynamic_point_updates: Json }
        Returns: undefined
      }
      handle_round_scoring: {
        Args: { p_betting_round_id: number; p_bet_updates: Json }
        Returns: undefined
      }
    }
    Enums: {
      betting_round_status: "open" | "closed" | "scoring" | "scored"
      prediction_type: "1" | "X" | "2"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      betting_round_status: ["open", "closed", "scoring", "scored"],
      prediction_type: ["1", "X", "2"],
    },
  },
} as const
