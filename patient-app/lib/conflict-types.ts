export type VerdictOverall = 'safe' | 'caution' | 'avoid' | 'hard_no' | 'unknown';

export type ConflictHit = {
  ingredient_a?: string;
  ingredient_b?: string;
  severity?: string;
  verdict?: string;
  notes?: string;
  spacing_hours?: number | null;
  interaction_type?: string;
  reason_codes?: string[];
};

export type ContraindicationAlert = {
  type?: string;
  severity?: string;
  title?: string;
  message?: string;
  ingredient?: string;
};

export type ProductStatus = {
  shelf_product_id: string;
  product_name?: string;
  status: 'safe' | 'conflict' | 'unknown' | 'watch' | 'hard_no';
  usage_time?: string;
  note?: string;
};

export type RoutineStepState = {
  label: string;
  sub?: string;
  state: 'done' | 'warn' | 'todo' | 'skip';
  usage_time?: string;
  product_name?: string;
};

export type EvaluateResult = {
  success?: boolean;
  overall: VerdictOverall;
  hard_no?: boolean;
  acrylate_free_verified?: boolean;
  safe_mode?: { active?: boolean; ambient_copy?: string | null };
  compatibility_score: number;
  barrier_friction_index: number;
  barrier_label?: string;
  conflicts: ConflictHit[];
  spacing_notes?: Array<{ message: string; spacing_hours?: number }>;
  contraindication_alerts?: ContraindicationAlert[];
  suggested_split?: { am?: string[]; pm?: string[] } | null;
  suggested_fix?: { title?: string; message?: string; suggested_split?: { am?: string[]; pm?: string[] } | null };
  evidence_snippets?: Array<{ id?: string; title?: string; body?: string }>;
  graph_unavailable?: boolean;
  lineup_hash?: string;
  product_statuses?: ProductStatus[];
  profile_complete?: boolean;
  partial_verdict?: boolean;
  hero_title?: string;
  hero_subtitle?: string;
  highlight_product_id?: string;
  routine_step_states?: RoutineStepState[];
};

export type BioProfile = {
  conditions: string[];
  prescriptions: string[];
  sensitivity?: string;
  fitzpatrick?: string | null;
  zip?: string | null;
  procedure_date?: string | null;
  procedure_type?: string | null;
  procedure_recovery_days?: number | null;
  budget_band?: string | null;
  climate_zone?: string | null;
  profile_complete?: boolean;
};

export type VerdictHistoryDay = {
  date: string;
  barrier_friction_index: number | null;
  overall: VerdictOverall | null;
};

export type BarrierInsight = {
  dip_date?: string;
  drop_points?: number;
  pattern_count?: number;
  title?: string;
  message?: string;
} | null;

export type ProductInsight = {
  title?: string;
  message?: string;
  barrier_note?: string | null;
  routine_note?: string | null;
  skin_note?: string | null;
  severity?: 'info' | 'watch' | 'caution';
};
