export type ChatMessage = {
  id: string;
  role: string;
  body: string;
  created_at?: string;
  pending?: boolean;
};

export type MatchItem = {
  rank: number;
  reason: string;
  source_quote: string;
  section: string;
  title: string;
  study_id: string;
  selected: boolean;
};
