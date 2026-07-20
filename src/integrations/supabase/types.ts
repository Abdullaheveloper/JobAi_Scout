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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      application_answers: {
        Row: {
          answer_text: string | null
          application_id: string
          created_at: string
          id: string
          question_id: string
        }
        Insert: {
          answer_text?: string | null
          application_id: string
          created_at?: string
          id?: string
          question_id: string
        }
        Update: {
          answer_text?: string | null
          application_id?: string
          created_at?: string
          id?: string
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_answers_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "job_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "application_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      application_questions: {
        Row: {
          created_at: string
          display_order: number
          id: string
          is_required: boolean
          job_id: string
          options: Json | null
          question_text: string
          question_type: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          is_required?: boolean
          job_id: string
          options?: Json | null
          question_text: string
          question_type?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          is_required?: boolean
          job_id?: string
          options?: Json | null
          question_text?: string
          question_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_questions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      applied_jobs: {
        Row: {
          applied_at: string
          company: string | null
          created_at: string
          id: string
          job_title: string
          job_url: string
          platform: string | null
          status: string
          user_id: string
        }
        Insert: {
          applied_at?: string
          company?: string | null
          created_at?: string
          id?: string
          job_title: string
          job_url: string
          platform?: string | null
          status?: string
          user_id: string
        }
        Update: {
          applied_at?: string
          company?: string | null
          created_at?: string
          id?: string
          job_title?: string
          job_url?: string
          platform?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      candidate_notes: {
        Row: {
          candidate_id: string
          created_at: string
          id: string
          is_private: boolean
          job_id: string | null
          note_text: string
          recruiter_id: string
          updated_at: string
        }
        Insert: {
          candidate_id: string
          created_at?: string
          id?: string
          is_private?: boolean
          job_id?: string | null
          note_text: string
          recruiter_id: string
          updated_at?: string
        }
        Update: {
          candidate_id?: string
          created_at?: string
          id?: string
          is_private?: boolean
          job_id?: string | null
          note_text?: string
          recruiter_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_notes_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      extension_usage: {
        Row: {
          created_at: string
          email: string | null
          field_count: number
          fields: string[]
          id: string
          page_url: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          field_count?: number
          fields?: string[]
          id?: string
          page_url?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          field_count?: number
          fields?: string[]
          id?: string
          page_url?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      job_preferences: {
        Row: {
          id: string
          user_id: string
          keywords: string[] | null
          skills: string[] | null
          desired_role: string | null
          preferred_locations: string[] | null
          salary_range: string | null
          job_type: string | null
          remote_preference: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          keywords?: string[] | null
          skills?: string[] | null
          desired_role?: string | null
          preferred_locations?: string[] | null
          salary_range?: string | null
          job_type?: string | null
          remote_preference?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          keywords?: string[] | null
          skills?: string[] | null
          desired_role?: string | null
          preferred_locations?: string[] | null
          salary_range?: string | null
          job_type?: string | null
          remote_preference?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      job_scrape_results: {
        Row: {
          adapter_order: number
          created_at: string
          id: string
          job_id: string
          match_explanation: Json
          match_score: number
          published_at: string | null
          scraped_at: string
          session_id: string
          source_result_order: number
          user_id: string
        }
        Insert: {
          adapter_order: number
          created_at?: string
          id?: string
          job_id: string
          match_explanation?: Json
          match_score: number
          published_at?: string | null
          scraped_at?: string
          session_id: string
          source_result_order: number
          user_id: string
        }
        Update: {
          adapter_order?: number
          created_at?: string
          id?: string
          job_id?: string
          match_explanation?: Json
          match_score?: number
          published_at?: string | null
          scraped_at?: string
          session_id?: string
          source_result_order?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_scrape_results_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_scrape_results_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "job_scrape_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      job_scrape_sessions: {
        Row: {
          adapter_errors: Json
          adapter_statuses: Json
          completed_at: string | null
          created_at: string
          current_adapter: string | null
          id: string
          location: string | null
          search_query: string
          session_status: string
          started_at: string
          total_jobs_displayed: number
          total_jobs_saved: number
          total_jobs_scraped: number
          updated_at: string
          user_id: string
        }
        Insert: {
          adapter_errors?: Json
          adapter_statuses?: Json
          completed_at?: string | null
          created_at?: string
          current_adapter?: string | null
          id?: string
          location?: string | null
          search_query: string
          session_status?: string
          started_at?: string
          total_jobs_displayed?: number
          total_jobs_saved?: number
          total_jobs_scraped?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          adapter_errors?: Json
          adapter_statuses?: Json
          completed_at?: string | null
          created_at?: string
          current_adapter?: string | null
          id?: string
          location?: string | null
          search_query?: string
          session_status?: string
          started_at?: string
          total_jobs_displayed?: number
          total_jobs_saved?: number
          total_jobs_scraped?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      recommended_jobs: {
        Row: {
          id: string
          user_id: string
          title: string
          company: string
          company_logo: string | null
          location: string | null
          description: string | null
          salary: string | null
          employment_type: string | null
          experience_required: string | null
          skills_required: string[] | null
          source_portal: string
          source_url: string | null
          match_score: number | null
          match_explanation: Json | null
          posted_date: string | null
          synced_at: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          company: string
          company_logo?: string | null
          location?: string | null
          description?: string | null
          salary?: string | null
          employment_type?: string | null
          experience_required?: string | null
          skills_required?: string[] | null
          source_portal?: string
          source_url?: string | null
          match_score?: number | null
          match_explanation?: Json | null
          posted_date?: string | null
          synced_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          company?: string
          company_logo?: string | null
          location?: string | null
          description?: string | null
          salary?: string | null
          employment_type?: string | null
          experience_required?: string | null
          skills_required?: string[] | null
          source_portal?: string
          source_url?: string | null
          match_score?: number | null
          match_explanation?: Json | null
          posted_date?: string | null
          synced_at?: string
          created_at?: string
        }
        Relationships: []
      }
      scan_history: {
        Row: {
          id: string
          user_id: string
          portal: string
          jobs_found: number | null
          jobs_matched: number | null
          jobs_synced: number | null
          scanned_at: string
        }
        Insert: {
          id?: string
          user_id: string
          portal: string
          jobs_found?: number | null
          jobs_matched?: number | null
          jobs_synced?: number | null
          scanned_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          portal?: string
          jobs_found?: number | null
          jobs_matched?: number | null
          jobs_synced?: number | null
          scanned_at?: string
        }
        Relationships: []
      }
      job_applications: {
        Row: {
          applied_at: string
          cover_letter: string | null
          id: string
          job_id: string
          status: string | null
          user_id: string
        }
        Insert: {
          applied_at?: string
          cover_letter?: string | null
          id?: string
          job_id: string
          status?: string | null
          user_id: string
        }
        Update: {
          applied_at?: string
          cover_letter?: string | null
          id?: string
          job_id?: string
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          collected_at: string | null
          company: string
          company_logo: string | null
          created_at: string
          date_posted: string | null
          description: string | null
          duplicate_key: string | null
          employment_type: string | null
          experience_level: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          job_type: string | null
          job_url: string | null
          last_seen_at: string | null
          location: string | null
          match_explanation: Json | null
          match_score: number | null
          posted_at: string | null
          recruiter_id: string | null
          requirements: string[] | null
          salary_currency: string | null
          salary_max: number | null
          salary_min: number | null
          skills: string[] | null
          source: string | null
          source_job_id: string | null
          source_portal: string | null
          source_url: string | null
          status: string
          title: string
          updated_at: string
          work_mode: string | null
        }
        Insert: {
          collected_at?: string | null
          company: string
          company_logo?: string | null
          created_at?: string
          date_posted?: string | null
          description?: string | null
          duplicate_key?: string | null
          employment_type?: string | null
          experience_level?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          job_type?: string | null
          job_url?: string | null
          last_seen_at?: string | null
          location?: string | null
          match_explanation?: Json | null
          match_score?: number | null
          posted_at?: string | null
          recruiter_id?: string | null
          requirements?: string[] | null
          salary_currency?: string | null
          salary_max?: number | null
          salary_min?: number | null
          skills?: string[] | null
          source?: string | null
          source_job_id?: string | null
          source_portal?: string | null
          source_url?: string | null
          status?: string
          title: string
          updated_at?: string
          work_mode?: string | null
        }
        Update: {
          collected_at?: string | null
          company?: string
          company_logo?: string | null
          created_at?: string
          date_posted?: string | null
          description?: string | null
          duplicate_key?: string | null
          employment_type?: string | null
          experience_level?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          job_type?: string | null
          job_url?: string | null
          last_seen_at?: string | null
          location?: string | null
          match_explanation?: Json | null
          match_score?: number | null
          posted_at?: string | null
          recruiter_id?: string | null
          requirements?: string[] | null
          salary_currency?: string | null
          salary_max?: number | null
          salary_min?: number | null
          skills?: string[] | null
          source?: string | null
          source_job_id?: string | null
          source_portal?: string | null
          source_url?: string | null
          status?: string
          title?: string
          updated_at?: string
          work_mode?: string | null
        }
        Relationships: []
      }
      kb_chunks: {
        Row: {
          chunk_index: number
          content: string
          created_at: string
          embedding: string | null
          id: string
          source_id: string
          title: string | null
          url: string
          user_id: string
        }
        Insert: {
          chunk_index?: number
          content: string
          created_at?: string
          embedding?: string | null
          id?: string
          source_id: string
          title?: string | null
          url: string
          user_id: string
        }
        Update: {
          chunk_index?: number
          content?: string
          created_at?: string
          embedding?: string | null
          id?: string
          source_id?: string
          title?: string | null
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kb_chunks_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "kb_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_sources: {
        Row: {
          created_at: string
          error: string | null
          id: string
          last_crawled_at: string | null
          pages_indexed: number
          status: string
          title: string | null
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          last_crawled_at?: string | null
          pages_indexed?: number
          status?: string
          title?: string | null
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          last_crawled_at?: string | null
          pages_indexed?: number
          status?: string
          title?: string | null
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          created_at: string
          id: string
          is_read: boolean
          job_id: string | null
          receiver_id: string
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_read?: boolean
          job_id?: string | null
          receiver_id: string
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_read?: boolean
          job_id?: string | null
          receiver_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          application_answers: Json
          availability: string | null
          bio: string | null
          certifications: string[] | null
          created_at: string
          current_company: string | null
          cv_summary: string | null
          data_sources: Json | null
          desired_roles: string[] | null
          education: string | null
          email: string | null
          expected_salary: string | null
          experience_years: number | null
          full_name: string | null
          github_url: string | null
          id: string
          languages: string[] | null
          linkedin_url: string | null
          location: string | null
          phone: string | null
          portfolio_url: string | null
          profile_completion: number | null
          resume_url: string | null
          skills: string[] | null
          updated_at: string
          user_id: string
          willing_to_relocate: string | null
          work_authorization: string | null
          work_type: string | null
        }
        Insert: {
          avatar_url?: string | null
          application_answers?: Json
          availability?: string | null
          bio?: string | null
          certifications?: string[] | null
          created_at?: string
          current_company?: string | null
          cv_summary?: string | null
          data_sources?: Json | null
          desired_roles?: string[] | null
          education?: string | null
          email?: string | null
          expected_salary?: string | null
          experience_years?: number | null
          full_name?: string | null
          github_url?: string | null
          id?: string
          languages?: string[] | null
          linkedin_url?: string | null
          location?: string | null
          phone?: string | null
          portfolio_url?: string | null
          profile_completion?: number | null
          resume_url?: string | null
          skills?: string[] | null
          updated_at?: string
          user_id: string
          willing_to_relocate?: string | null
          work_authorization?: string | null
          work_type?: string | null
        }
        Update: {
          avatar_url?: string | null
          application_answers?: Json
          availability?: string | null
          bio?: string | null
          certifications?: string[] | null
          created_at?: string
          current_company?: string | null
          cv_summary?: string | null
          data_sources?: Json | null
          desired_roles?: string[] | null
          education?: string | null
          email?: string | null
          expected_salary?: string | null
          experience_years?: number | null
          full_name?: string | null
          github_url?: string | null
          id?: string
          languages?: string[] | null
          linkedin_url?: string | null
          location?: string | null
          phone?: string | null
          portfolio_url?: string | null
          profile_completion?: number | null
          resume_url?: string | null
          skills?: string[] | null
          updated_at?: string
          user_id?: string
          willing_to_relocate?: string | null
          work_authorization?: string | null
          work_type?: string | null
        }
        Relationships: []
      }
      recruiter_profiles: {
        Row: {
          company_logo_url: string | null
          company_name: string
          created_at: string
          description: string | null
          id: string
          industry: string | null
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          company_logo_url?: string | null
          company_name?: string
          created_at?: string
          description?: string | null
          id?: string
          industry?: string | null
          updated_at?: string
          user_id: string
          website?: string | null
        }
        Update: {
          company_logo_url?: string | null
          company_name?: string
          created_at?: string
          description?: string | null
          id?: string
          industry?: string | null
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: []
      }
      resume_ats_analyses: {
        Row: {
          analysis_status: string
          ats_score: number
          career_level: string
          career_level_estimated: boolean
          created_at: string
          dismissed_at: string | null
          error_message: string | null
          id: string
          keyword_match_score: number
          knowledge_version: string
          profile_id: string
          resume_fingerprint: string
          resume_path: string
          strengths_json: Json
          suggestions_json: Json
          summary: string
          updated_at: string
          user_id: string
        }
        Insert: {
          analysis_status?: string
          ats_score: number
          career_level: string
          career_level_estimated?: boolean
          created_at?: string
          dismissed_at?: string | null
          error_message?: string | null
          id?: string
          keyword_match_score: number
          knowledge_version: string
          profile_id: string
          resume_fingerprint: string
          resume_path: string
          strengths_json?: Json
          suggestions_json?: Json
          summary: string
          updated_at?: string
          user_id: string
        }
        Update: {
          analysis_status?: string
          ats_score?: number
          career_level?: string
          career_level_estimated?: boolean
          created_at?: string
          dismissed_at?: string | null
          error_message?: string | null
          id?: string
          keyword_match_score?: number
          knowledge_version?: string
          profile_id?: string
          resume_fingerprint?: string
          resume_path?: string
          strengths_json?: Json
          suggestions_json?: Json
          summary?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resume_ats_analyses_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_jobs: {
        Row: {
          id: string
          job_id: string | null
          recommended_job_id: string | null
          saved_at: string
          user_id: string
        }
        Insert: {
          id?: string
          job_id?: string | null
          recommended_job_id?: string | null
          saved_at?: string
          user_id: string
        }
        Update: {
          id?: string
          job_id?: string | null
          recommended_job_id?: string | null
          saved_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_jobs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      security_alerts: {
        Row: {
          attempted_email: string | null
          created_at: string
          id: string
          page_url: string | null
          platform: string | null
          user_email: string | null
          user_id: string
        }
        Insert: {
          attempted_email?: string | null
          created_at?: string
          id?: string
          page_url?: string | null
          platform?: string | null
          user_email?: string | null
          user_id: string
        }
        Update: {
          attempted_email?: string | null
          created_at?: string
          id?: string
          page_url?: string | null
          platform?: string | null
          user_email?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      voice_conversations: {
        Row: {
          created_at: string
          id: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      voice_analytics: {
        Row: {
          conversation_id: string | null
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
          session_id: string | null
          user_id: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json | null
          session_id?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          session_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_analytics_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "voice_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "voice_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_search_logs: {
        Row: {
          confidence_score: number | null
          conversation_id: string | null
          created_at: string
          error_message: string | null
          id: string
          language_detected: string | null
          query: string
          response_latency_ms: number | null
          result_count: number | null
          top_similarity: number | null
          user_id: string
          was_successful: boolean
        }
        Insert: {
          confidence_score?: number | null
          conversation_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          language_detected?: string | null
          query: string
          response_latency_ms?: number | null
          result_count?: number | null
          top_similarity?: number | null
          user_id: string
          was_successful?: boolean
        }
        Update: {
          confidence_score?: number | null
          conversation_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          language_detected?: string | null
          query?: string
          response_latency_ms?: number | null
          result_count?: number | null
          top_similarity?: number | null
          user_id?: string
          was_successful?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "voice_search_logs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "voice_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_settings: {
        Row: {
          assistant_enabled: boolean
          confidence_threshold: number
          created_at: string
          default_personality: string
          default_speed: number
          id: string
          preferred_language: string | null
          preferred_personality: string | null
          preferred_speed: number | null
          preferred_voice_id: string | null
          silence_timeout: number
          supported_languages: string[]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          assistant_enabled?: boolean
          confidence_threshold?: number
          created_at?: string
          default_personality?: string
          default_speed?: number
          id?: string
          preferred_language?: string | null
          preferred_personality?: string | null
          preferred_speed?: number | null
          preferred_voice_id?: string | null
          silence_timeout?: number
          supported_languages?: string[]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          assistant_enabled?: boolean
          confidence_threshold?: number
          created_at?: string
          default_personality?: string
          default_speed?: number
          id?: string
          preferred_language?: string | null
          preferred_personality?: string | null
          preferred_speed?: number | null
          preferred_voice_id?: string | null
          silence_timeout?: number
          supported_languages?: string[]
          updated_at?: string
          user_id?: string | null
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
      is_duplicate_recommended_job: {
        Args: {
          p_user_id: string
          p_source_url: string | null
          p_company: string
          p_title: string
        }
        Returns: boolean
      }
      match_kb_chunks: {
        Args: {
          match_count?: number
          match_user_id: string
          query_embedding: string
        }
        Returns: {
          content: string
          id: string
          similarity: number
          title: string
          url: string
        }[]
      }
      get_voice_admin_stats: {
        Args: Record<string, never>
        Returns: Json
      }
      search_scrape_session_jobs: {
        Args: {
          p_job_type?: string | null
          p_limit?: number
          p_location?: string | null
          p_offset?: number
          p_session_id?: string | null
          p_source?: string | null
          p_terms?: string[]
          p_work_mode?: string | null
        }
        Returns: {
          adapter_order: number
          company: string
          created_at: string
          description: string | null
          employment_type: string | null
          id: string
          job_type: string | null
          location: string | null
          match_explanation: Json
          match_score: number
          posted_at: string | null
          recruiter_id: string | null
          salary_currency: string | null
          salary_max: number | null
          salary_min: number | null
          scraped_at: string
          session_id: string
          skills: string[]
          source: string
          source_result_order: number
          source_url: string | null
          title: string
          total_count: number
          work_mode: string | null
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user" | "recruiter"
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
      app_role: ["admin", "user", "recruiter"],
    },
  },
} as const
