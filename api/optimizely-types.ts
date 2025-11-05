// Optimizely Web Experimentation API Types
// Based on: https://docs.developers.optimizely.com/web-experimentation/reference/overview

export interface OptimizelyProject {
  id: number;
  account_id: number;
  code_revision?: number;
  created: string;
  description?: string;
  is_classic: boolean;
  last_modified: string;
  name: string;
  platform: string;
  project_status: "active" | "archived";
  socket_token?: string;
  status: "active" | "archived";
}

export interface OptimizelyExperiment {
  id: string; // Changed to string to handle large experiment IDs without precision loss
  project_id: number;
  campaign_id: number;
  created: string;
  description?: string;
  earliest?: string;
  latest?: string;
  holdback: number;
  is_classic: boolean;
  last_modified: string;
  name: string;
  status: "not_started" | "running" | "paused" | "archived" | "concluded";
  traffic_allocation: number;
  type: string;
  allocation_policy: string;
  variations: OptimizelyVariation[];
  audience_conditions: string;
  metrics?: OptimizelyMetric[];
  page_ids?: string[]; // Changed to string array to handle large page IDs
  url_targeting?: {
    activation_type: string;
    conditions: string;
    edit_url: string;
    key: string;
    page_id: string; // Changed to string to handle large page IDs
  };
  changes?: any[];
}

export interface OptimizelyVariation {
  variation_id: string; // Changed to string to handle large variation IDs
  name: string;
  weight: number;
  archived: boolean;
  status: string;
  description?: string;
  actions?: OptimizelyAction[];
}

export interface OptimizelyAction {
  id: string; // Changed to string to handle large action IDs
  page_id: string; // Changed to string to handle large page IDs
  type: string;
  selector?: string;
  value?: string;
  attributes?: Record<string, any>;
}

export interface OptimizelyAudience {
  id: number;
  project_id: number;
  archived: boolean;
  conditions: string;
  created: string;
  description?: string;
  is_classic: boolean;
  last_modified: string;
  name: string;
  segmentation: boolean;
}

export interface OptimizelyPage {
  id: number;
  project_id: number;
  archived: boolean;
  category: string;
  conditions: string;
  created: string;
  edit_url: string;
  key?: string;
  last_modified: string;
  name: string;
  page_type: string;
}

export interface OptimizelyEvent {
  id: number;
  project_id: number;
  archived: boolean;
  category: string;
  created: string;
  description?: string;
  edit_url: string;
  event_type: string;
  is_classic: boolean;
  is_editable: boolean;
  key?: string;
  last_modified: string;
  name: string;
}

export interface OptimizelyMetric {
  id: number;
  name: string;
  event_id?: number;
  aggregator: string;
  field?: string;
  scope: string;
  winning_direction: string;
}

export interface OptimizelyExperimentResults {
  experiment_id: number;
  project_id: number;
  status: string;
  results: OptimizelyVariationResults[];
  confidence?: number;
  end_time?: string;
  start_time?: string;
  visitors: number;
}

export interface OptimizelyVariationResults {
  variation_id: string; // Changed to string to handle large variation IDs
  variation_name: string;
  visitors: number;
  conversions: number;
  conversion_rate: number;
  improvement?: number;
  statistical_significance?: number;
}

// Request/Response types for our tools
export interface ListExperimentsParams {
  projectId: string;
  status?: "not_started" | "running" | "paused" | "archived";
  page?: number;
  per_page?: number;
  archived?: boolean;
}
//please lort 22

export interface ListAudiencesParams {
  projectId: string;
  archived?: boolean;
  include_archived?: boolean;
  page?: number;
  per_page?: number;
}

export interface ListPagesParams {
  projectId: string;
  archived?: boolean;
  include_archived?: boolean;
  page?: number;
  per_page?: number;
}

export interface ListEventsParams {
  projectId: string;
  archived?: boolean;
  include_archived?: boolean;
  page?: number;
  per_page?: number;
}

export interface GetExperimentParams {
  projectId: string;
  experimentId?: string;
  experimentName?: string;
}

export interface GetAudienceParams {
  projectId: string;
  audienceId?: string;
  audienceName?: string;
}

export interface GetPageParams {
  projectId: string;
  pageId?: string;
  pageName?: string;
}

export interface GetEventParams {
  projectId: string;
  eventId?: string;
  eventName?: string;
}

export interface GetExperimentResultsParams {
  projectId: string;
  experimentId: string;
}

export interface CreateExperimentParams {
  projectId: string;
  name: string;
  description?: string;
  percentage_included?: number;
  audience_ids?: number[];
  variations?: {
    name: string;
    weight?: number;
  }[];
  // Either url_targeting or page_ids must be provided for web experiments
  url_targeting?: {
    match_type: string; // e.g., "substring", "exact"
    value: string; // the URL or pattern to match
  }[];
  page_ids?: string[];
  // Optional metrics to add to the experiment
  metrics?: {
    event_id: number;
    aggregator?: string; // "unique", "total", etc.
    field?: string; // for revenue metrics
    scope?: string; // "visitor", "session"
    winning_direction?: string; // "increasing", "decreasing"
  }[];
}

// Formatted response types for readable output
export interface FormattedExperimentList {
  project_id: string;
  total_count: number;
  experiments: {
    id: string; // Changed to string to prevent precision loss
    name: string;
    status: string;
    type: string;
    created: string;
    last_modified: string;
    description?: string;
    traffic_allocation: number;
    holdback: number;
    variations_count: number;
    campaign_id: number;
  }[];
}

export interface FormattedExperiment {
  id: string; // Changed to string to prevent precision loss
  name: string;
  description?: string;
  status: string;
  type: string;
  created: string;
  last_modified: string;
  project_id: number;
  traffic_allocation: number;
  holdback: number;
  campaign_id: number;
  allocation_policy: string;
  url_targeting?: {
    activation_type: string;
    conditions: string;
    edit_url: string;
    key: string;
    page_id: string; // Changed to string to handle large page IDs
  };
  variations: {
    id: string; // Changed to string to handle large variation IDs
    name: string;
    weight: number;
    archived: boolean;
    status: string;
    description?: string;
  }[];
  audience_conditions: string;
  metrics_count: number;
  page_ids: string[]; // Changed to string array to handle large page IDs
}

export interface FormattedAudienceList {
  project_id: string;
  total_count: number;
  audiences: {
    id: number;
    name: string;
    archived: boolean;
    created: string;
    last_modified: string;
    description?: string;
  }[];
}

export interface FormattedAudience {
  id: number;
  name: string;
  description?: string;
  archived: boolean;
  created: string;
  last_modified: string;
  project_id: number;
  conditions: string;
  segmentation: boolean;
  is_classic: boolean;
}

export interface FormattedPageList {
  project_id: string;
  total_count: number;
  pages: {
    id: number;
    name: string;
    archived: boolean;
    created: string;
    last_modified: string;
    category: string;
    page_type: string;
  }[];
}

export interface FormattedPage {
  id: number;
  name: string;
  archived: boolean;
  created: string;
  last_modified: string;
  project_id: number;
  category: string;
  page_type: string;
  conditions: string;
  edit_url: string;
  key?: string;
}

export interface FormattedEventList {
  project_id: string;
  total_count: number;
  events: {
    id: number;
    name: string;
    archived: boolean;
    created: string;
    last_modified: string;
    category: string;
    event_type: string;
  }[];
}

export interface FormattedEvent {
  id: number;
  name: string;
  description?: string;
  archived: boolean;
  created: string;
  last_modified: string;
  project_id: number;
  category: string;
  event_type: string;
  edit_url: string;
  is_classic: boolean;
  is_editable: boolean;
  key?: string;
}

export interface FormattedExperimentResults {
  experiment_id: string; // Changed to string to handle large experiment IDs
  experiment_name: string;
  project_id: number;
  status: string;
  start_time?: string;
  end_time?: string;
  total_visitors: number;
  confidence?: number;
  variations: {
    id: string; // Changed to string to handle large variation IDs
    name: string;
    visitors: number;
    conversions: number;
    conversion_rate: number;
    improvement?: number;
    statistical_significance?: number;
    is_winner?: boolean;
  }[];
  summary: {
    has_winner: boolean;
    winning_variation?: string;
    confidence_level?: number;
    total_conversions: number;
    overall_conversion_rate: number;
  };
}

// Project Overview types
export interface ProjectOverviewParams {
  projectId: string;
  include_archived?: boolean;
}

export interface ProjectOverviewSummary {
  project_id: string;
  project_name?: string;
  platform?: string;
  total_experiments: number;
  total_audiences: number;
  total_events: number;
  total_pages: number;
  last_modified?: string;
  experiments_by_status: {
    running: number;
    concluded: number;
    not_started: number;
    archived: number;
    paused?: number;
  };
  insights: string[];
}

export interface EnhancedExperimentSummary {
  id: string;
  name: string;
  status: string;
  type: string;
  traffic_allocation: number;
  variations_count: number;
  metrics_count: number;
  last_modified: string;
  target_url?: string;
  audience_targeting: "everyone" | "targeted";
  has_results: boolean;
}

export interface EnhancedAudienceSummary {
  id: string;
  name: string;
  experiment_usage: number;
  targeting_type: string;
  archived: boolean;
  last_modified: string;
}

export interface EnhancedEventSummary {
  id: string;
  name: string;
  event_type: "click" | "pageview" | "custom";
  category: string;
  archived: boolean;
  target_element?: string;
}

export interface EnhancedPageSummary {
  id: string;
  name: string;
  edit_url: string;
  activation_type: string;
  category: string;
  archived: boolean;
}

export interface FormattedProjectOverview {
  summary: ProjectOverviewSummary;
  experiments: {
    by_status: {
      running: EnhancedExperimentSummary[];
      concluded: EnhancedExperimentSummary[];
      not_started: EnhancedExperimentSummary[];
      archived: EnhancedExperimentSummary[];
      paused?: EnhancedExperimentSummary[];
    };
    popular_targets: string[];
    experiment_types: { [key: string]: number };
  };
  audiences: {
    active: EnhancedAudienceSummary[];
    archived: EnhancedAudienceSummary[];
    targeting_breakdown: { [key: string]: number };
  };
  events: {
    by_type: {
      click: EnhancedEventSummary[];
      pageview: EnhancedEventSummary[];
      custom: EnhancedEventSummary[];
    };
    active_count: number;
    archived_count: number;
  };
  pages: {
    all: EnhancedPageSummary[];
    by_activation: { [key: string]: number };
  };
}

// Error types
export interface OptimizelyAPIError {
  message: string;
  status?: number;
  code?: string;
  details?: any;
}
