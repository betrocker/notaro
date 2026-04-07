export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      clients: {
        Row: {
          address: string | null;
          created_at: string | null;
          id: string;
          name: string | null;
          note: string | null;
          phone: string | null;
          user_id: string | null;
        };
        Insert: {
          address?: string | null;
          created_at?: string | null;
          id?: string;
          name?: string | null;
          note?: string | null;
          phone?: string | null;
          user_id?: string | null;
        };
        Update: {
          address?: string | null;
          created_at?: string | null;
          id?: string;
          name?: string | null;
          note?: string | null;
          phone?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "clients_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      expenses: {
        Row: {
          amount: number | null;
          created_at: string | null;
          id: string;
          job_id: string | null;
          title: string | null;
        };
        Insert: {
          amount?: number | null;
          created_at?: string | null;
          id?: string;
          job_id?: string | null;
          title?: string | null;
        };
        Update: {
          amount?: number | null;
          created_at?: string | null;
          id?: string;
          job_id?: string | null;
          title?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "expenses_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
        ];
      };
      invoices: {
        Row: {
          created_at: string;
          id: string;
          invoice_number: string;
          issued_at: string;
          job_id: string | null;
          sequence_number: number;
          user_id: string | null;
          year: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          invoice_number: string;
          issued_at?: string;
          job_id?: string | null;
          sequence_number: number;
          user_id?: string | null;
          year: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          invoice_number?: string;
          issued_at?: string;
          job_id?: string | null;
          sequence_number?: number;
          user_id?: string | null;
          year?: number;
        };
        Relationships: [
          {
            foreignKeyName: "invoices_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoices_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      job_images: {
        Row: {
          created_at: string | null;
          id: string;
          image_url: string | null;
          job_id: string | null;
          kind: string;
          storage_path: string | null;
          user_id: string | null;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          image_url?: string | null;
          job_id?: string | null;
          kind?: string;
          storage_path?: string | null;
          user_id?: string | null;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          image_url?: string | null;
          job_id?: string | null;
          kind?: string;
          storage_path?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "job_images_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "job_images_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      job_invoice_items: {
        Row: {
          created_at: string;
          id: string;
          job_id: string;
          position: number;
          quantity: number;
          title: string;
          total: number;
          unit: string | null;
          unit_price: number;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          job_id: string;
          position?: number;
          quantity?: number;
          title: string;
          total?: number;
          unit?: string | null;
          unit_price?: number;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          job_id?: string;
          position?: number;
          quantity?: number;
          title?: string;
          total?: number;
          unit?: string | null;
          unit_price?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "job_invoice_items_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "job_invoice_items_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      jobs: {
        Row: {
          archived_at: string | null;
          client_id: string | null;
          completed_at: string | null;
          created_at: string | null;
          description: string | null;
          id: string;
          price: number | null;
          scheduled_date: string | null;
          status: string | null;
          title: string | null;
          user_id: string | null;
        };
        Insert: {
          archived_at?: string | null;
          client_id?: string | null;
          completed_at?: string | null;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          price?: number | null;
          scheduled_date?: string | null;
          status?: string | null;
          title?: string | null;
          user_id?: string | null;
        };
        Update: {
          archived_at?: string | null;
          client_id?: string | null;
          completed_at?: string | null;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          price?: number | null;
          scheduled_date?: string | null;
          status?: string | null;
          title?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "jobs_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "jobs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      payments: {
        Row: {
          amount: number | null;
          id: string;
          job_id: string | null;
          note: string | null;
          payment_date: string | null;
        };
        Insert: {
          amount?: number | null;
          id?: string;
          job_id?: string | null;
          note?: string | null;
          payment_date?: string | null;
        };
        Update: {
          amount?: number | null;
          id?: string;
          job_id?: string | null;
          note?: string | null;
          payment_date?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "payments_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
        ];
      };
      projects: {
        Row: {
          created_at: string | null;
          id: string;
          name: string | null;
          note: string | null;
          user_id: string | null;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          name?: string | null;
          note?: string | null;
          user_id?: string | null;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          name?: string | null;
          note?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "projects_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      users: {
        Row: {
          created_at: string | null;
          email: string | null;
          id: string;
          name: string | null;
          phone: string | null;
          trial_ends_at: string | null;
          trial_started_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          email?: string | null;
          id?: string;
          name?: string | null;
          phone?: string | null;
          trial_ends_at?: string | null;
          trial_started_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          email?: string | null;
          id?: string;
          name?: string | null;
          phone?: string | null;
          trial_ends_at?: string | null;
          trial_started_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
