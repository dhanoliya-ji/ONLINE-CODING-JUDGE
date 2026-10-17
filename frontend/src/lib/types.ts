export type Difficulty = "Easy" | "Medium" | "Hard";
export type LanguageId =
  | "python"
  | "c"
  | "cpp"
  | "java"
  | "javascript"
  | "typescript"
  | "go"
  | "rust"
  | "ruby"
  | "php";

export interface User {
  id: number;
  username: string;
  email: string;
  is_admin: boolean;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface ProblemSummary {
  id: number;
  slug: string;
  title: string;
  difficulty: Difficulty;
  time_limit_ms: number;
  memory_limit_mb: number;
  created_at: string;
  solved_by_me: boolean | null;
  attempted_by_me: boolean | null;
  total_submissions: number | null;
  accepted_submissions: number | null;
  acceptance_rate: number | null;
  tags: { slug: string; name: string }[];
  source: string | null;
  rating: number | null;
}

export interface Problem extends ProblemSummary {
  description: string;
  input_format: string;
  output_format: string;
  constraints: string;
  sample_input: string;
  sample_output: string;
  is_public: boolean;
  sample_test_case_count: number;
  total_test_case_count: number;
  source_url: string | null;
  license: string | null;
  checker: string;
}

export interface TestCasePublic {
  id: number;
  problem_id: number;
  is_sample: boolean;
  order_index: number;
  input_data: string | null;
  expected_output: string | null;
}

export interface TestCaseResult {
  index: number;
  is_sample: boolean;
  passed: boolean;
  verdict: string;
  execution_time_ms: number;
  memory_kb: number;
  input_data: string | null;
  expected_output: string | null;
  actual_output: string | null;
  stderr: string | null;
}

export interface Submission {
  id: number;
  user_id: number;
  problem_id: number;
  contest_id: number | null;
  language: LanguageId;
  status: string;
  verdict: string;
  score: number;
  passed_tests: number;
  total_tests: number;
  execution_time_ms: number;
  memory_kb: number;
  created_at: string;
  execution_time_display: string;
  memory_display: string;
  source_code?: string;
  error_message?: string | null;
  failed_test_index?: number | null;
  problem_title?: string | null;
  problem_slug?: string | null;
  backend?: string | null;
  test_results?: TestCaseResult[];
}

export interface CoachMessage {
  role: "user" | "assistant";
  content: string;
}

export interface CoachStatus {
  available: boolean;
  reason: string | null;
  daily_limit: number;
  remaining_today: number | null;
}

export interface RunResult {
  outcome: string;
  stdout: string;
  stderr: string;
  exit_code: number;
  execution_time_ms: number;
  memory_kb: number;
  compile_output: string | null;
  backend: string;
}

export interface Contest {
  id: number;
  slug: string;
  title: string;
  description: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  penalty_minutes_per_wrong: number;
  state: "Upcoming" | "Running" | "Ended";
  created_at: string;
  problem_count: number;
  participant_count: number;
  is_registered: boolean | null;
  rated: boolean;
  /** The automatically scheduled weekly round. */
  is_auto: boolean;
}

export interface VirtualStatus {
  contest_id: number;
  started_at: string;
  ends_at: string;
  active: boolean;
  entry: LeaderboardEntry;
  virtual_rank: number;
  real_participants: number;
}

export interface DiscussionPost {
  id: number;
  author: string;
  /** null once deleted: the post keeps its place in the thread. */
  body: string | null;
  created_at: string;
  edited: boolean;
  votes: number;
  voted_by_me: boolean;
  mine: boolean;
  replies: DiscussionPost[];
}

export interface ProblemListInfo {
  id: number;
  name: string;
  problem_count: number;
  created_at: string;
}

export interface Editorial {
  problem_id: number;
  body: string;
  author: string;
  created_at: string;
}

export interface BadgeInfo {
  id: string;
  name: string;
  description: string;
  earned: boolean;
  progress: number;
}

export interface RatingPoint {
  contest_id: number;
  contest_title: string;
  date: string;
  rank: number;
  old_rating: number;
  new_rating: number;
}

export interface ContestProblem {
  id: number;
  contest_id: number;
  problem_id: number;
  label: string | null;
  points: number;
  order_index: number;
  problem: ProblemSummary;
}

export interface LeaderboardCell {
  problem_id: number;
  label: string | null;
  solved: boolean;
  attempts: number;
  points: number;
  solved_at_minutes: number | null;
}

export interface LeaderboardEntry {
  rank: number;
  user_id: number;
  username: string;
  solved: number;
  score: number;
  penalty: number;
  problems: LeaderboardCell[];
}

export interface Leaderboard {
  contest_id: number;
  contest_title: string;
  state: string;
  total_participants: number;
  entries: LeaderboardEntry[];
}

export interface Dashboard {
  username: string;
  email: string;
  total_submissions: number;
  accepted_submissions: number;
  acceptance_rate: number;
  problems_solved: number;
  problems_attempted: number;
  contests_participated: number;
  best_contest_rank: number | null;
  verdict_breakdown: { verdict: string; count: number }[];
  difficulty_progress: {
    difficulty: string;
    solved: number;
    total_available: number;
  }[];
  language_usage: {
    language: string;
    submissions: number;
    accepted: number;
  }[];
  recent_submissions: Submission[];
  activity: { date: string; submissions: number; accepted: number }[];
  current_streak: number;
  longest_streak: number;
  tag_progress: { slug: string; name: string; solved: number; total: number }[];
  global_rank: number | null;
  member_since: string | null;
  rating: number | null;
  max_rating: number | null;
  rating_history: RatingPoint[];
  badges: BadgeInfo[];
}

export interface Facets {
  tags: { slug: string; name: string; problem_count: number }[];
  sources: Record<string, number>;
  difficulties: Record<string, number>;
}

export type ProblemSort =
  | "id"
  | "title"
  | "difficulty"
  | "rating"
  | "acceptance"
  | "popular"
  | "newest"
  | "relevance";

export interface ProblemQuery {
  search?: string;
  difficulty?: Difficulty[];
  /** Comma-separated tag slugs; a problem must have all of them. */
  tags?: string;
  source?: string;
  status?: "solved" | "attempted" | "todo";
  sort?: ProblemSort;
  order?: "asc" | "desc";
  min_rating?: number;
  max_rating?: number;
  limit?: number;
  offset?: number;
}

export interface LeaderboardRow {
  rank: number;
  username: string;
  solved: number;
  easy: number;
  medium: number;
  hard: number;
  submissions: number;
  acceptance_rate: number;
}

export interface Health {
  status: string;
  version: string;
  environment: string;
  database: { connected: boolean; dialect?: string; latency_ms?: number };
  execution: {
    configured: string;
    active: string;
    available: boolean;
    rlimits_enforced?: boolean;
    toolchains?: Record<string, boolean>;
    warning?: string;
  };
  languages: string[];
}
