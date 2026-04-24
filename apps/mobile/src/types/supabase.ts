export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.5';
  };
  public: {
    Tables: {
      book_highlights: {
        Row: {
          ai_definition: string | null;
          book_id: string | null;
          context: string | null;
          created_at: string | null;
          display_order: number | null;
          explanation: string | null;
          id: string;
          section_order: number | null;
          type: string;
          word: string;
        };
        Insert: {
          ai_definition?: string | null;
          book_id?: string | null;
          context?: string | null;
          created_at?: string | null;
          display_order?: number | null;
          explanation?: string | null;
          id?: string;
          section_order?: number | null;
          type: string;
          word: string;
        };
        Update: {
          ai_definition?: string | null;
          book_id?: string | null;
          context?: string | null;
          created_at?: string | null;
          display_order?: number | null;
          explanation?: string | null;
          id?: string;
          section_order?: number | null;
          type?: string;
          word?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'book_highlights_book_id_fkey';
            columns: ['book_id'];
            isOneToOne: false;
            referencedRelation: 'books';
            referencedColumns: ['id'];
          },
        ];
      };
      book_sections: {
        Row: {
          book_id: string;
          created_at: string | null;
          estimated_pages: number | null;
          id: string;
          plain_text: string;
          section_order: number;
          summary: string | null;
          title: string | null;
          word_count: number | null;
        };
        Insert: {
          book_id: string;
          created_at?: string | null;
          estimated_pages?: number | null;
          id?: string;
          plain_text: string;
          section_order: number;
          summary?: string | null;
          title?: string | null;
          word_count?: number | null;
        };
        Update: {
          book_id?: string;
          created_at?: string | null;
          estimated_pages?: number | null;
          id?: string;
          plain_text?: string;
          section_order?: number;
          summary?: string | null;
          title?: string | null;
          word_count?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'book_sections_book_id_fkey';
            columns: ['book_id'];
            isOneToOne: false;
            referencedRelation: 'books';
            referencedColumns: ['id'];
          },
        ];
      };
      bookmarks: {
        Row: {
          book_id: string | null;
          created_at: string | null;
          fact_id: string | null;
          id: string;
          note: string | null;
          user_id: string | null;
        };
        Insert: {
          book_id?: string | null;
          created_at?: string | null;
          fact_id?: string | null;
          id?: string;
          note?: string | null;
          user_id?: string | null;
        };
        Update: {
          book_id?: string | null;
          created_at?: string | null;
          fact_id?: string | null;
          id?: string;
          note?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'bookmarks_book_id_fkey';
            columns: ['book_id'];
            isOneToOne: false;
            referencedRelation: 'books';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'bookmarks_fact_id_fkey';
            columns: ['fact_id'];
            isOneToOne: false;
            referencedRelation: 'facts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'bookmarks_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      books: {
        Row: {
          access_tier: string;
          author: string;
          category: string | null;
          cover_url: string | null;
          created_at: string | null;
          description: string | null;
          epub_url: string | null;
          id: string;
          is_premium: boolean | null;
          language: string | null;
          source_format: string | null;
          source_storage_bucket: string | null;
          source_storage_path: string | null;
          source_type: string | null;
          title: string;
          total_pages: number | null;
          total_sections: number | null;
        };
        Insert: {
          access_tier?: string;
          author: string;
          category?: string | null;
          cover_url?: string | null;
          created_at?: string | null;
          description?: string | null;
          epub_url?: string | null;
          id?: string;
          is_premium?: boolean | null;
          language?: string | null;
          source_format?: string | null;
          source_storage_bucket?: string | null;
          source_storage_path?: string | null;
          source_type?: string | null;
          title: string;
          total_pages?: number | null;
          total_sections?: number | null;
        };
        Update: {
          access_tier?: string;
          author?: string;
          category?: string | null;
          cover_url?: string | null;
          created_at?: string | null;
          description?: string | null;
          epub_url?: string | null;
          id?: string;
          is_premium?: boolean | null;
          language?: string | null;
          source_format?: string | null;
          source_storage_bucket?: string | null;
          source_storage_path?: string | null;
          source_type?: string | null;
          title?: string;
          total_pages?: number | null;
          total_sections?: number | null;
        };
        Relationships: [];
      };
      chat_sessions: {
        Row: {
          context_id: string | null;
          context_type: string | null;
          created_at: string | null;
          id: string;
          messages: Json | null;
          user_id: string | null;
        };
        Insert: {
          context_id?: string | null;
          context_type?: string | null;
          created_at?: string | null;
          id?: string;
          messages?: Json | null;
          user_id?: string | null;
        };
        Update: {
          context_id?: string | null;
          context_type?: string | null;
          created_at?: string | null;
          id?: string;
          messages?: Json | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'chat_sessions_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      facts: {
        Row: {
          category: string;
          content: string;
          created_at: string | null;
          id: string;
          media_url: string | null;
          published_at: string | null;
          read_time_sq: number | null;
          source_label: string | null;
          source_url: string | null;
          tags: string[] | null;
          title: string;
          visual_key: string | null;
          verified: boolean | null;
        };
        Insert: {
          category: string;
          content: string;
          created_at?: string | null;
          id?: string;
          media_url?: string | null;
          published_at?: string | null;
          read_time_sq?: number | null;
          source_label?: string | null;
          source_url?: string | null;
          tags?: string[] | null;
          title: string;
          visual_key?: string | null;
          verified?: boolean | null;
        };
        Update: {
          category?: string;
          content?: string;
          created_at?: string | null;
          id?: string;
          media_url?: string | null;
          published_at?: string | null;
          read_time_sq?: number | null;
          source_label?: string | null;
          source_url?: string | null;
          tags?: string[] | null;
          title?: string;
          visual_key?: string | null;
          verified?: boolean | null;
        };
        Relationships: [];
      };
      reading_progress: {
        Row: {
          book_id: string | null;
          completed: boolean | null;
          current_page: number | null;
          id: string;
          last_read_at: string | null;
          user_id: string | null;
        };
        Insert: {
          book_id?: string | null;
          completed?: boolean | null;
          current_page?: number | null;
          id?: string;
          last_read_at?: string | null;
          user_id?: string | null;
        };
        Update: {
          book_id?: string | null;
          completed?: boolean | null;
          current_page?: number | null;
          id?: string;
          last_read_at?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'reading_progress_book_id_fkey';
            columns: ['book_id'];
            isOneToOne: false;
            referencedRelation: 'books';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reading_progress_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      user_activity: {
        Row: {
          ai_queries: number | null;
          date: string | null;
          facts_read: number | null;
          id: string;
          pages_read: number | null;
          user_id: string | null;
        };
        Insert: {
          ai_queries?: number | null;
          date?: string | null;
          facts_read?: number | null;
          id?: string;
          pages_read?: number | null;
          user_id?: string | null;
        };
        Update: {
          ai_queries?: number | null;
          date?: string | null;
          facts_read?: number | null;
          id?: string;
          pages_read?: number | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'user_activity_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      users: {
        Row: {
          avatar_url: string | null;
          created_at: string | null;
          daily_goal_type: string | null;
          daily_goal_value: number | null;
          display_name: string | null;
          email: string | null;
          id: string;
          interests: string[] | null;
          notifications_enabled: boolean | null;
          plan: string | null;
          streak_days: number | null;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string | null;
          daily_goal_type?: string | null;
          daily_goal_value?: number | null;
          display_name?: string | null;
          email?: string | null;
          id: string;
          interests?: string[] | null;
          notifications_enabled?: boolean | null;
          plan?: string | null;
          streak_days?: number | null;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string | null;
          daily_goal_type?: string | null;
          daily_goal_value?: number | null;
          display_name?: string | null;
          email?: string | null;
          id?: string;
          interests?: string[] | null;
          notifications_enabled?: boolean | null;
          plan?: string | null;
          streak_days?: number | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
