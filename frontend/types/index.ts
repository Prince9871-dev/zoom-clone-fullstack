export interface User {
  id: number;
  email: string;
  full_name: string;
  avatar_url: string | null;
  created_at: string;
}

export interface Participant {
  id: number;
  meeting_id: number;
  display_name: string;
  joined_at: string;
  left_at: string | null;
  is_host: boolean;
}

export interface Meeting {
  id: number;
  meeting_id: string;
  title: string;
  description: string | null;
  host_name: string;
  invite_link: string;
  scheduled_at: string;
  duration_minutes: number;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
  participants: Participant[];
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}
