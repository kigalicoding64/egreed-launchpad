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
      deployments: {
        Row: {
          branch: string
          build_logs: string | null
          commit_hash: string | null
          commit_message: string | null
          created_at: string
          deploy_url: string | null
          finished_at: string | null
          github_event: string | null
          id: string
          progress: number
          project_id: string
          status: Database["public"]["Enums"]["deployment_status"]
          triggered_by: string
          updated_at: string
          user_id: string
        }
        Insert: {
          branch?: string
          build_logs?: string | null
          commit_hash?: string | null
          commit_message?: string | null
          created_at?: string
          deploy_url?: string | null
          finished_at?: string | null
          github_event?: string | null
          id?: string
          progress?: number
          project_id: string
          status?: Database["public"]["Enums"]["deployment_status"]
          triggered_by?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          branch?: string
          build_logs?: string | null
          commit_hash?: string | null
          commit_message?: string | null
          created_at?: string
          deploy_url?: string | null
          finished_at?: string | null
          github_event?: string | null
          id?: string
          progress?: number
          project_id?: string
          status?: Database["public"]["Enums"]["deployment_status"]
          triggered_by?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deployments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      domains: {
        Row: {
          cloudflare_record_id: string | null
          created_at: string
          dns_status: Database["public"]["Enums"]["dns_status"]
          dns_target: string | null
          dns_type: string
          full_domain: string
          id: string
          is_primary: boolean
          last_checked_at: string | null
          project_id: string
          ssl_expires_at: string | null
          ssl_provisioned_at: string | null
          ssl_renewed_at: string | null
          ssl_status: Database["public"]["Enums"]["ssl_status"]
          subdomain: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cloudflare_record_id?: string | null
          created_at?: string
          dns_status?: Database["public"]["Enums"]["dns_status"]
          dns_target?: string | null
          dns_type?: string
          full_domain: string
          id?: string
          is_primary?: boolean
          last_checked_at?: string | null
          project_id: string
          ssl_expires_at?: string | null
          ssl_provisioned_at?: string | null
          ssl_renewed_at?: string | null
          ssl_status?: Database["public"]["Enums"]["ssl_status"]
          subdomain: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cloudflare_record_id?: string | null
          created_at?: string
          dns_status?: Database["public"]["Enums"]["dns_status"]
          dns_target?: string | null
          dns_type?: string
          full_domain?: string
          id?: string
          is_primary?: boolean
          last_checked_at?: string | null
          project_id?: string
          ssl_expires_at?: string | null
          ssl_provisioned_at?: string | null
          ssl_renewed_at?: string | null
          ssl_status?: Database["public"]["Enums"]["ssl_status"]
          subdomain?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "domains_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      env_vars: {
        Row: {
          created_at: string
          id: string
          key: string
          project_id: string
          target: Database["public"]["Enums"]["env_target"]
          updated_at: string
          user_id: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          project_id: string
          target?: Database["public"]["Enums"]["env_target"]
          updated_at?: string
          user_id: string
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          project_id?: string
          target?: Database["public"]["Enums"]["env_target"]
          updated_at?: string
          user_id?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "env_vars_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      github_connections: {
        Row: {
          account_type: string
          avatar_url: string | null
          connected_at: string
          github_user_id: string | null
          github_username: string
          id: string
          installation_id: string | null
          user_id: string
        }
        Insert: {
          account_type?: string
          avatar_url?: string | null
          connected_at?: string
          github_user_id?: string | null
          github_username: string
          id?: string
          installation_id?: string | null
          user_id: string
        }
        Update: {
          account_type?: string
          avatar_url?: string | null
          connected_at?: string
          github_user_id?: string | null
          github_username?: string
          id?: string
          installation_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          id: string
          name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      project_files: {
        Row: {
          content: string
          created_at: string
          id: string
          origin: string
          path: string
          project_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          origin?: string
          path: string
          project_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          origin?: string
          path?: string
          project_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_files_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          auto_deploy: boolean
          branch: string
          build_command: string | null
          created_at: string
          domain: string | null
          framework: string
          id: string
          name: string
          repository_name: string
          repository_url: string
          source_type: string
          status: Database["public"]["Enums"]["project_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_deploy?: boolean
          branch?: string
          build_command?: string | null
          created_at?: string
          domain?: string | null
          framework?: string
          id?: string
          name: string
          repository_name: string
          repository_url: string
          source_type?: string
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_deploy?: boolean
          branch?: string
          build_command?: string | null
          created_at?: string
          domain?: string | null
          framework?: string
          id?: string
          name?: string
          repository_name?: string
          repository_url?: string
          source_type?: string
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
          user_id?: string
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
      webhook_events: {
        Row: {
          created_at: string
          delivery_id: string | null
          error: string | null
          event_type: string
          id: string
          payload: Json | null
          processed: boolean
          project_id: string | null
          provider: string
          signature_valid: boolean
          user_id: string | null
        }
        Insert: {
          created_at?: string
          delivery_id?: string | null
          error?: string | null
          event_type: string
          id?: string
          payload?: Json | null
          processed?: boolean
          project_id?: string | null
          provider?: string
          signature_valid?: boolean
          user_id?: string | null
        }
        Update: {
          created_at?: string
          delivery_id?: string | null
          error?: string | null
          event_type?: string
          id?: string
          payload?: Json | null
          processed?: boolean
          project_id?: string | null
          provider?: string
          signature_valid?: boolean
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
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
      app_role: "admin" | "member"
      deployment_status:
        | "queued"
        | "building"
        | "deploying"
        | "online"
        | "failed"
        | "canceled"
      dns_status: "pending" | "active" | "failed"
      env_target: "production" | "preview" | "development"
      project_status:
        | "queued"
        | "building"
        | "deploying"
        | "online"
        | "failed"
        | "paused"
      ssl_status: "pending" | "active" | "failed"
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
    Enums: {
      app_role: ["admin", "member"],
      deployment_status: [
        "queued",
        "building",
        "deploying",
        "online",
        "failed",
        "canceled",
      ],
      dns_status: ["pending", "active", "failed"],
      env_target: ["production", "preview", "development"],
      project_status: [
        "queued",
        "building",
        "deploying",
        "online",
        "failed",
        "paused",
      ],
      ssl_status: ["pending", "active", "failed"],
    },
  },
} as const
