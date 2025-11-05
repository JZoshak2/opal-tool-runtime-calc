import {
  getOptimizelyClient,
  OptimizelyClientError,
} from "./optimizely-client";
import type {
  ListExperimentsParams,
  ListAudiencesParams,
  ListPagesParams,
  ListEventsParams,
  GetExperimentParams,
  GetAudienceParams,
  GetPageParams,
  GetEventParams,
  GetExperimentResultsParams,
  CreateExperimentParams,
  FormattedExperimentList,
  FormattedExperiment,
  FormattedAudienceList,
  FormattedAudience,
  FormattedPageList,
  FormattedPage,
  FormattedEventList,
  FormattedEvent,
  FormattedExperimentResults,
  OptimizelyExperiment,
  OptimizelyAudience,
  OptimizelyPage,
  OptimizelyEvent,
  OptimizelyExperimentResults,
  ProjectOverviewParams,
  FormattedProjectOverview,
  ProjectOverviewSummary,
  EnhancedExperimentSummary,
  EnhancedAudienceSummary,
  EnhancedEventSummary,
  EnhancedPageSummary,
} from "./optimizely-types";

/**
 * Utility function to format dates for better readability
 */
function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleString();
}

/**
 * Utility function to safely get project ID as string
 */
function getProjectId(params: { projectId: string }): string {
  if (!params.projectId || typeof params.projectId !== "string") {
    throw new Error("Project ID is required and must be a string");
  }
  return params.projectId;
}

/**
 * Helper function to resolve entity name to ID by searching through list results
 */
async function resolveEntityByName<
  T extends { id: string | number; name: string }
>(
  entityName: string,
  listFunction: () => Promise<T[]>,
  entityType: string
): Promise<string | number> {
  const entities = await listFunction();
  const matches = entities.filter(
    (entity) => entity.name.toLowerCase() === entityName.toLowerCase()
  );

  if (matches.length === 0) {
    throw new Error(
      `No ${entityType} found with name "${entityName}". Please check the name or use the list_${entityType}s tool to see available ${entityType}s.`
    );
  }

  if (matches.length > 1) {
    const matchNames = matches
      .map((m) => `"${m.name}" (ID: ${m.id})`)
      .join(", ");
    throw new Error(
      `Multiple ${entityType}s found with name "${entityName}": ${matchNames}. Please use the specific ID instead.`
    );
  }

  return matches[0].id;
}

/**
 * List Experiments Tool
 * Returns a formatted list of experiments in a project
 */
export async function listExperiments(
  params: ListExperimentsParams
): Promise<FormattedExperimentList> {
  const projectId = getProjectId(params);
  const client = getOptimizelyClient();

  try {
    // First verify the project exists and is accessible
    console.log(
      `DEBUG: Attempting to list experiments for project ${projectId}`
    );
    try {
      const project = await client.getProject(projectId);
      console.log(
        `DEBUG: Project validation successful - ${project.name} (platform: ${project.platform}, status: ${project.status})`
      );
    } catch (projectError) {
      console.log(`DEBUG: Project validation failed:`, projectError);
      // Continue anyway - the project endpoint might have different permissions
    }

    const excludeArchived = params.excludeArchived ?? true; // Default to true if not specified
    const requestedPerPage = params.per_page || 50;
    const requestedPage = params.page || 1;
    
    let allExperiments: OptimizelyExperiment[] = [];
    let currentPage = requestedPage;
    let hasMorePages = true;
    const maxPagesToFetch = 10; // Safety limit to prevent infinite loops
    
    // If excluding archived and no specific page requested, fetch multiple pages to get enough non-archived experiments
    if (excludeArchived && !params.page) {
      console.log(
        `DEBUG: Fetching multiple pages to collect non-archived experiments (target: ${requestedPerPage} experiments)`
      );
      
      let nonArchivedCount = 0;
      
      while (nonArchivedCount < requestedPerPage && hasMorePages && currentPage <= maxPagesToFetch) {
        console.log(`DEBUG: Fetching page ${currentPage}...`);
        const pageExperiments = await client.listExperiments(projectId, {
          page: currentPage,
          per_page: 100, // Use max per_page to minimize API calls
        });
        
        if (pageExperiments.length === 0) {
          hasMorePages = false;
        } else {
          allExperiments = allExperiments.concat(pageExperiments);
          // Count non-archived experiments by checking the new ones we just added
          const newNonArchived = pageExperiments.filter((exp) => exp.status !== "archived").length;
          nonArchivedCount += newNonArchived;
          currentPage++;
        }
      }
      
      // Filter out archived experiments
      const nonArchivedExperiments = allExperiments.filter((exp) => exp.status !== "archived");
      
      // Limit to requested number
      const experiments = nonArchivedExperiments.slice(0, requestedPerPage);
      
      console.log(
        `DEBUG: Fetched ${allExperiments.length} total experiments across ${currentPage - 1} pages, filtered to ${nonArchivedExperiments.length} non-archived, returning ${experiments.length}`
      );
      
      return {
        project_id: projectId,
        total_count: experiments.length,
        experiments: experiments.map((exp) => ({
          id: String(exp.id),
          name: exp.name,
          status: exp.status,
          type: exp.type,
          created: formatDate(exp.created),
          last_modified: formatDate(exp.last_modified),
          description: exp.description,
          traffic_allocation: exp.traffic_allocation,
          holdback: exp.holdback,
          variations_count: exp.variations?.length || 0,
          campaign_id: exp.campaign_id,
        })),
      };
    } else {
      // For specific page requests or when including archived, use normal pagination
      console.log(
        `DEBUG: Making request to: /experiments?project_id=${projectId}&per_page=${requestedPerPage}&page=${requestedPage}`
      );
      
      const listOptions: {
        page?: number;
        per_page?: number;
      } = {
        page: requestedPage,
        per_page: requestedPerPage,
      };
      
      const fetchedExperiments = await client.listExperiments(projectId, listOptions);
      
      // Filter out archived experiments if requested
      const experiments = excludeArchived
        ? fetchedExperiments.filter((exp) => exp.status !== "archived")
        : fetchedExperiments;
      
      console.log(
        `DEBUG: Fetched ${fetchedExperiments.length} total experiments, ${excludeArchived ? `filtered to ${experiments.length} non-archived` : "showing all"}`
      );
      
      return {
        project_id: projectId,
        total_count: experiments.length,
        experiments: experiments.map((exp) => ({
          id: String(exp.id),
          name: exp.name,
          status: exp.status,
          type: exp.type,
          created: formatDate(exp.created),
          last_modified: formatDate(exp.last_modified),
          description: exp.description,
          traffic_allocation: exp.traffic_allocation,
          holdback: exp.holdback,
          variations_count: exp.variations?.length || 0,
          campaign_id: exp.campaign_id,
        })),
      };
    }
  } catch (error) {
    if (error instanceof OptimizelyClientError) {
      // Provide more specific error messages based on status code
      if (error.status === 400) {
        throw new Error(
          `Bad request when listing experiments for project ${projectId}. This could indicate: 1) The project ID format is incorrect (should be a numeric string), 2) The project ID doesn't exist, 3) Your API token doesn't have access to this project, or 4) Required parameters are missing or malformed. Please verify the project ID is correct and that your API token has the necessary permissions. API Error: ${
            error.message
          } ${error.details ? `(${JSON.stringify(error.details)})` : ""}`
        );
      } else if (error.status === 404) {
        throw new Error(
          `No experiments found for project ${projectId}. This could mean: 1) The project doesn't have any experiments created yet, 2) The experiments might be organized as campaigns instead, or 3) The experiments endpoint is not available for this project type. The project exists and is accessible (platform: web, active status), but the experiments endpoint returned 404. You may need to create experiments first in the Optimizely Web interface, or this project might use a different API structure.`
        );
      } else if (error.status === 401) {
        throw new Error(
          `Authentication failed. Please check your OPTIMIZELY_API_TOKEN.`
        );
      } else if (error.status === 403) {
        throw new Error(
          `Access forbidden to project ${projectId}. Your API token may not have the required permissions.`
        );
      }
      throw new Error(`Failed to list experiments: ${error.message}`);
    }
    throw new Error(
      `Unexpected error listing experiments: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

/**
 * Get Experiment Tool
 * Returns detailed information about a specific experiment
 */
export async function getExperiment(
  params: GetExperimentParams
): Promise<FormattedExperiment> {
  const projectId = getProjectId(params);
  const { experimentId, experimentName } = params;

  // Validate that either ID or name is provided, but not both
  if (!experimentId && !experimentName) {
    throw new Error("Either experimentId or experimentName is required");
  }
  if (experimentId && experimentName) {
    throw new Error(
      "Please provide either experimentId or experimentName, not both"
    );
  }

  const client = getOptimizelyClient();

  let resolvedExperimentId: string;

  if (experimentName) {
    // Resolve name to ID using the list function
    const resolvedId = await resolveEntityByName(
      experimentName,
      () => client.listExperiments(projectId, { per_page: 100 }),
      "experiment"
    );
    resolvedExperimentId = String(resolvedId);
  } else {
    resolvedExperimentId = experimentId!;
  }

  try {
    console.log(
      `DEBUG: Getting experiment ${resolvedExperimentId} from project ${projectId}`
    );
    const experiment = await client.getExperiment(
      projectId,
      resolvedExperimentId
    );

    return {
      id: String(experiment.id), // Ensure experiment ID is string
      name: experiment.name,
      description: experiment.description,
      status: experiment.status,
      type: experiment.type,
      created: formatDate(experiment.created),
      last_modified: formatDate(experiment.last_modified),
      project_id: experiment.project_id,
      traffic_allocation: experiment.traffic_allocation,
      holdback: experiment.holdback,
      campaign_id: experiment.campaign_id,
      allocation_policy: experiment.allocation_policy,
      url_targeting: experiment.url_targeting,
      variations:
        experiment.variations?.map((variation) => ({
          id: variation.variation_id,
          name: variation.name,
          weight: variation.weight,
          archived: variation.archived,
          status: variation.status,
          description: variation.description,
        })) || [],
      audience_conditions: experiment.audience_conditions,
      metrics_count: experiment.metrics?.length || 0,
      page_ids: experiment.page_ids || [],
    };
  } catch (error) {
    if (error instanceof OptimizelyClientError) {
      // Provide more specific error messages based on status code
      if (error.status === 404) {
        const identifier = experimentName
          ? `name '${experimentName}'`
          : `ID '${resolvedExperimentId}'`;
        throw new Error(
          `Experiment with ${identifier} not found in project ${projectId}. This could mean: 1) The experiment ${
            experimentName ? "name" : "ID"
          } is incorrect or doesn't exist, 2) The experiment has been archived or deleted, 3) Your API token doesn't have access to this specific experiment, or 4) The experiment might be in a different project. Please verify the experiment ${
            experimentName ? "name" : "ID"
          } is correct and that it exists in project ${projectId}. API Error: ${
            error.message
          } ${error.details ? `(${JSON.stringify(error.details)})` : ""}`
        );
      } else if (error.status === 401) {
        const identifier = experimentName
          ? `name '${experimentName}'`
          : `ID '${resolvedExperimentId}'`;
        throw new Error(
          `Authentication failed when getting experiment with ${identifier}. Please check your OPTIMIZELY_API_TOKEN.`
        );
      } else if (error.status === 403) {
        const identifier = experimentName
          ? `name '${experimentName}'`
          : `ID '${resolvedExperimentId}'`;
        throw new Error(
          `Access forbidden to experiment with ${identifier} in project ${projectId}. Your API token may not have the required permissions.`
        );
      }
      throw new Error(`Failed to get experiment: ${error.message}`);
    }
    throw new Error(
      `Unexpected error getting experiment: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

/**
 * List Audiences Tool
 * Returns a formatted list of audiences in a project
 */
export async function listAudiences(
  params: ListAudiencesParams
): Promise<FormattedAudienceList> {
  const projectId = getProjectId(params);
  const client = getOptimizelyClient();

  try {
    const audiences = await client.listAudiences(projectId, {
      page: params.page,
      per_page: params.per_page || 50,
      // Removed include_classic parameter to match API format
    });

    // Always exclude archived audiences
    const filteredAudiences = audiences.filter((aud) => !aud.archived);

    return {
      project_id: projectId,
      total_count: filteredAudiences.length,
      audiences: filteredAudiences.map((aud) => ({
        id: aud.id,
        name: aud.name,
        archived: aud.archived,
        created: formatDate(aud.created),
        last_modified: formatDate(aud.last_modified),
        description: aud.description,
      })),
    };
  } catch (error) {
    if (error instanceof OptimizelyClientError) {
      // Provide more specific error messages based on status code
      if (error.status === 400) {
        throw new Error(
          `Bad request when listing audiences for project ${projectId}. This could indicate: 1) The project ID format is incorrect, 2) The project ID doesn't exist, 3) Your API token doesn't have access to this project, or 4) Required parameters are missing or malformed. Please verify the project ID is correct and that your API token has the necessary permissions. API Error: ${
            error.message
          } ${error.details ? `(${JSON.stringify(error.details)})` : ""}`
        );
      } else if (error.status === 404) {
        throw new Error(
          `No audiences found for project ${projectId}. The project exists but the audiences endpoint returned 404. You may need to create audiences first in the Optimizely Web interface.`
        );
      } else if (error.status === 401) {
        throw new Error(
          `Authentication failed. Please check your OPTIMIZELY_API_TOKEN.`
        );
      } else if (error.status === 403) {
        throw new Error(
          `Access forbidden to project ${projectId}. Your API token may not have the required permissions.`
        );
      }
      throw new Error(`Failed to list audiences: ${error.message}`);
    }
    throw new Error(
      `Unexpected error listing audiences: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

/**
 * Get Audience Tool
 * Returns detailed information about a specific audience
 */
export async function getAudience(
  params: GetAudienceParams
): Promise<FormattedAudience> {
  const projectId = getProjectId(params);
  const { audienceId, audienceName } = params;

  // Validate that either ID or name is provided, but not both
  if (!audienceId && !audienceName) {
    throw new Error("Either audienceId or audienceName is required");
  }
  if (audienceId && audienceName) {
    throw new Error(
      "Please provide either audienceId or audienceName, not both"
    );
  }

  const client = getOptimizelyClient();

  let resolvedAudienceId: string;

  if (audienceName) {
    // Resolve name to ID using the list function
    const resolvedId = await resolveEntityByName(
      audienceName,
      () => client.listAudiences(projectId, { per_page: 100 }),
      "audience"
    );
    resolvedAudienceId = String(resolvedId);
  } else {
    resolvedAudienceId = audienceId!;
  }

  try {
    const audience = await client.getAudience(projectId, resolvedAudienceId);

    return {
      id: audience.id,
      name: audience.name,
      description: audience.description,
      archived: audience.archived,
      created: formatDate(audience.created),
      last_modified: formatDate(audience.last_modified),
      project_id: audience.project_id,
      conditions: audience.conditions,
      segmentation: audience.segmentation,
      is_classic: audience.is_classic,
    };
  } catch (error) {
    if (error instanceof OptimizelyClientError) {
      // Provide more specific error messages based on status code
      if (error.status === 404) {
        const identifier = audienceName
          ? `name '${audienceName}'`
          : `ID '${resolvedAudienceId}'`;
        throw new Error(
          `Audience with ${identifier} not found in project ${projectId}. This could mean: 1) The audience ${
            audienceName ? "name" : "ID"
          } is incorrect or doesn't exist, 2) The audience has been archived or deleted, 3) Your API token doesn't have access to this specific audience, or 4) The audience might be in a different project. Please verify the audience ${
            audienceName ? "name" : "ID"
          } is correct and that it exists in project ${projectId}. API Error: ${
            error.message
          } ${error.details ? `(${JSON.stringify(error.details)})` : ""}`
        );
      } else if (error.status === 401) {
        const identifier = audienceName
          ? `name '${audienceName}'`
          : `ID '${resolvedAudienceId}'`;
        throw new Error(
          `Authentication failed when getting audience with ${identifier}. Please check your OPTIMIZELY_API_TOKEN.`
        );
      } else if (error.status === 403) {
        const identifier = audienceName
          ? `name '${audienceName}'`
          : `ID '${resolvedAudienceId}'`;
        throw new Error(
          `Access forbidden to audience with ${identifier} in project ${projectId}. Your API token may not have the required permissions.`
        );
      }
      throw new Error(`Failed to get audience: ${error.message}`);
    }
    throw new Error(
      `Unexpected error getting audience: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

/**
 * List Pages Tool
 * Returns a formatted list of pages in a project
 */
export async function listPages(
  params: ListPagesParams
): Promise<FormattedPageList> {
  const projectId = getProjectId(params);
  const client = getOptimizelyClient();

  try {
    const pages = await client.listPages(projectId, {
      page: params.page,
      per_page: params.per_page || 50,
      // Removed include_classic parameter to match API format
    });

    // Always exclude archived pages
    const filteredPages = pages.filter((page) => !page.archived);

    return {
      project_id: projectId,
      total_count: filteredPages.length,
      pages: filteredPages.map((page) => ({
        id: page.id,
        name: page.name,
        archived: page.archived,
        created: formatDate(page.created),
        last_modified: formatDate(page.last_modified),
        category: page.category,
        page_type: page.page_type,
      })),
    };
  } catch (error) {
    if (error instanceof OptimizelyClientError) {
      // Provide more specific error messages based on status code
      if (error.status === 400) {
        throw new Error(
          `Bad request when listing pages for project ${projectId}. This could indicate: 1) The project ID format is incorrect, 2) The project ID doesn't exist, 3) Your API token doesn't have access to this project, or 4) Required parameters are missing or malformed. Please verify the project ID is correct and that your API token has the necessary permissions. API Error: ${
            error.message
          } ${error.details ? `(${JSON.stringify(error.details)})` : ""}`
        );
      } else if (error.status === 404) {
        throw new Error(
          `No pages found for project ${projectId}. The project exists but the pages endpoint returned 404. You may need to create pages first in the Optimizely Web interface.`
        );
      } else if (error.status === 401) {
        throw new Error(
          `Authentication failed. Please check your OPTIMIZELY_API_TOKEN.`
        );
      } else if (error.status === 403) {
        throw new Error(
          `Access forbidden to project ${projectId}. Your API token may not have the required permissions.`
        );
      }
      throw new Error(`Failed to list pages: ${error.message}`);
    }
    throw new Error(
      `Unexpected error listing pages: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

/**
 * Get Page Tool
 * Returns detailed information about a specific page
 */
export async function getPage(params: GetPageParams): Promise<FormattedPage> {
  const projectId = getProjectId(params);
  const { pageId, pageName } = params;

  // Validate that either ID or name is provided, but not both
  if (!pageId && !pageName) {
    throw new Error("Either pageId or pageName is required");
  }
  if (pageId && pageName) {
    throw new Error("Please provide either pageId or pageName, not both");
  }

  const client = getOptimizelyClient();

  let resolvedPageId: string;

  if (pageName) {
    // Resolve name to ID using the list function
    const resolvedId = await resolveEntityByName(
      pageName,
      () => client.listPages(projectId, { per_page: 100 }),
      "page"
    );
    resolvedPageId = String(resolvedId);
  } else {
    resolvedPageId = pageId!;
  }

  try {
    const page = await client.getPage(projectId, resolvedPageId);

    return {
      id: page.id,
      name: page.name,
      archived: page.archived,
      created: formatDate(page.created),
      last_modified: formatDate(page.last_modified),
      project_id: page.project_id,
      category: page.category,
      page_type: page.page_type,
      conditions: page.conditions,
      edit_url: page.edit_url,
      key: page.key,
    };
  } catch (error) {
    if (error instanceof OptimizelyClientError) {
      // Provide more specific error messages based on status code
      if (error.status === 404) {
        const identifier = pageName
          ? `name '${pageName}'`
          : `ID '${resolvedPageId}'`;
        throw new Error(
          `Page with ${identifier} not found in project ${projectId}. This could mean: 1) The page ${
            pageName ? "name" : "ID"
          } is incorrect or doesn't exist, 2) The page has been archived or deleted, 3) Your API token doesn't have access to this specific page, or 4) The page might be in a different project. Please verify the page ${
            pageName ? "name" : "ID"
          } is correct and that it exists in project ${projectId}. API Error: ${
            error.message
          } ${error.details ? `(${JSON.stringify(error.details)})` : ""}`
        );
      } else if (error.status === 401) {
        const identifier = pageName
          ? `name '${pageName}'`
          : `ID '${resolvedPageId}'`;
        throw new Error(
          `Authentication failed when getting page with ${identifier}. Please check your OPTIMIZELY_API_TOKEN.`
        );
      } else if (error.status === 403) {
        const identifier = pageName
          ? `name '${pageName}'`
          : `ID '${resolvedPageId}'`;
        throw new Error(
          `Access forbidden to page with ${identifier} in project ${projectId}. Your API token may not have the required permissions.`
        );
      }
      throw new Error(`Failed to get page: ${error.message}`);
    }
    throw new Error(
      `Unexpected error getting page: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

/**
 * List Events Tool
 * Returns a formatted list of events in a project
 */
export async function listEvents(
  params: ListEventsParams
): Promise<FormattedEventList> {
  const projectId = getProjectId(params);
  const client = getOptimizelyClient();

  try {
    console.log(`DEBUG: listEvents called with params:`, params);
    
    const events = await client.listEvents(projectId, {
      page: params.page,
      per_page: params.per_page || 50,
      // Removed include_classic parameter to match API format
    });

    console.log(`DEBUG: Raw events from API (${events.length} total):`, JSON.stringify(events, null, 2));

    // Always exclude archived events
    const filteredEvents = events.filter((event) => !event.archived);

    console.log(`DEBUG: Filtered events (${filteredEvents.length} after filtering):`, JSON.stringify(filteredEvents, null, 2));

    const result = {
      project_id: projectId,
      total_count: filteredEvents.length,
      events: filteredEvents.map((event) => ({
        id: event.id,
        name: event.name,
        archived: event.archived,
        created: formatDate(event.created),
        last_modified: formatDate(event.last_modified),
        category: event.category,
        event_type: event.event_type,
      })),
    };

    console.log(`DEBUG: Final formatted result:`, JSON.stringify(result, null, 2));

    return result;
  } catch (error) {
    if (error instanceof OptimizelyClientError) {
      // Provide more specific error messages based on status code
      if (error.status === 400) {
        throw new Error(
          `Bad request when listing events for project ${projectId}. This could indicate: 1) The project ID format is incorrect, 2) The project ID doesn't exist, 3) Your API token doesn't have access to this project, or 4) Required parameters are missing or malformed. Please verify the project ID is correct and that your API token has the necessary permissions. API Error: ${
            error.message
          } ${error.details ? `(${JSON.stringify(error.details)})` : ""}`
        );
      } else if (error.status === 404) {
        throw new Error(
          `No events found for project ${projectId}. The project exists but the events endpoint returned 404. You may need to create events first in the Optimizely Web interface.`
        );
      } else if (error.status === 401) {
        throw new Error(
          `Authentication failed. Please check your OPTIMIZELY_API_TOKEN.`
        );
      } else if (error.status === 403) {
        throw new Error(
          `Access forbidden to project ${projectId}. Your API token may not have the required permissions.`
        );
      }
      throw new Error(`Failed to list events: ${error.message}`);
    }
    throw new Error(
      `Unexpected error listing events: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

/**
 * Get Event Tool
 * Returns detailed information about a specific event
 */
export async function getEvent(
  params: GetEventParams
): Promise<FormattedEvent> {
  const projectId = getProjectId(params);
  const { eventId, eventName } = params;

  // Validate that either ID or name is provided, but not both
  if (!eventId && !eventName) {
    throw new Error("Either eventId or eventName is required");
  }
  if (eventId && eventName) {
    throw new Error("Please provide either eventId or eventName, not both");
  }

  const client = getOptimizelyClient();

  let resolvedEventId: string;

  if (eventName) {
    // Resolve name to ID using the list function
    const resolvedId = await resolveEntityByName(
      eventName,
      () => client.listEvents(projectId, { per_page: 100 }),
      "event"
    );
    resolvedEventId = String(resolvedId);
  } else {
    resolvedEventId = eventId!;
  }

  try {
    const event = await client.getEvent(projectId, resolvedEventId);

    return {
      id: event.id,
      name: event.name,
      description: event.description,
      archived: event.archived,
      created: formatDate(event.created),
      last_modified: formatDate(event.last_modified),
      project_id: event.project_id,
      category: event.category,
      event_type: event.event_type,
      edit_url: event.edit_url,
      is_classic: event.is_classic,
      is_editable: event.is_editable,
      key: event.key,
    };
  } catch (error) {
    if (error instanceof OptimizelyClientError) {
      // Provide more specific error messages based on status code
      if (error.status === 404) {
        const identifier = eventName
          ? `name '${eventName}'`
          : `ID '${resolvedEventId}'`;
        throw new Error(
          `Event with ${identifier} not found in project ${projectId}. This could mean: 1) The event ${
            eventName ? "name" : "ID"
          } is incorrect or doesn't exist, 2) The event has been archived or deleted, 3) Your API token doesn't have access to this specific event, or 4) The event might be in a different project. Please verify the event ${
            eventName ? "name" : "ID"
          } is correct and that it exists in project ${projectId}. API Error: ${
            error.message
          } ${error.details ? `(${JSON.stringify(error.details)})` : ""}`
        );
      } else if (error.status === 401) {
        const identifier = eventName
          ? `name '${eventName}'`
          : `ID '${resolvedEventId}'`;
        throw new Error(
          `Authentication failed when getting event with ${identifier}. Please check your OPTIMIZELY_API_TOKEN.`
        );
      } else if (error.status === 403) {
        const identifier = eventName
          ? `name '${eventName}'`
          : `ID '${resolvedEventId}'`;
        throw new Error(
          `Access forbidden to event with ${identifier} in project ${projectId}. Your API token may not have the required permissions.`
        );
      }
      throw new Error(`Failed to get event: ${error.message}`);
    }
    throw new Error(
      `Unexpected error getting event: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

/**
 * Get Experiment Results Tool
 * Returns formatted experiment results with statistical analysis
 */
export async function getExperimentResults(
  params: GetExperimentResultsParams
): Promise<FormattedExperimentResults> {
  const projectId = getProjectId(params);
  const { experimentId } = params;

  if (!experimentId || typeof experimentId !== "string") {
    throw new Error("Experiment ID is required and must be a string");
  }

  const client = getOptimizelyClient();

  try {
    // Get both experiment details and results
    const [experiment, results] = await Promise.all([
      client.getExperiment(projectId, experimentId),
      client.getExperimentResults(projectId, experimentId),
    ]);

    // Calculate summary statistics
    const totalConversions =
      results.results?.reduce(
        (sum, variation) => sum + (variation.conversions || 0),
        0
      ) || 0;
    const overallConversionRate =
      results.visitors > 0 ? (totalConversions / results.visitors) * 100 : 0;

    // Find winning variation (highest conversion rate with statistical significance)
    const winningVariation = results.results?.find(
      (v) => v.statistical_significance && v.statistical_significance >= 95
    );

    return {
      experiment_id: experimentId, // Keep as string to prevent precision loss
      experiment_name: experiment.name,
      project_id: parseInt(projectId),
      status: results.status,
      start_time: results.start_time
        ? formatDate(results.start_time)
        : undefined,
      end_time: results.end_time ? formatDate(results.end_time) : undefined,
      total_visitors: results.visitors,
      confidence: results.confidence,
      variations:
        results.results?.map((variation) => ({
          id: variation.variation_id, // Already a string type
          name: variation.variation_name,
          visitors: variation.visitors,
          conversions: variation.conversions,
          conversion_rate: Math.round(variation.conversion_rate * 10000) / 100, // Convert to percentage with 2 decimals
          improvement: variation.improvement
            ? Math.round(variation.improvement * 10000) / 100
            : undefined,
          statistical_significance: variation.statistical_significance
            ? Math.round(variation.statistical_significance * 100) / 100
            : undefined,
          is_winner: winningVariation
            ? variation.variation_id === winningVariation.variation_id
            : false,
        })) || [],
      summary: {
        has_winner: !!winningVariation,
        winning_variation: winningVariation?.variation_name,
        confidence_level: winningVariation?.statistical_significance,
        total_conversions: totalConversions,
        overall_conversion_rate: Math.round(overallConversionRate * 100) / 100,
      },
    };
  } catch (error) {
    if (error instanceof OptimizelyClientError) {
      throw new Error(`Failed to get experiment results: ${error.message}`);
    }
    throw new Error(
      `Unexpected error getting experiment results: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

/**
 * Create Experiment Tool
 * Creates a new experiment in the specified project
 */
export async function createExperiment(
  params: CreateExperimentParams & {
    audience_conditions?: string | any;
    variations?: any;
    url_targeting?: any;
    page_ids?: any;
    metrics?: any;
    holdback?: number;
  }
): Promise<{
  success: boolean;
  experiment: FormattedExperiment;
  experiment_url: string;
  message: string;
}> {
  const projectId = getProjectId(params);
  const { name, description, holdback } = params;

  // Handle parameters that can be either objects (new) or JSON strings (legacy)
  let audience_conditions: any | undefined;
  let variations: { name: string; weight?: number }[] | undefined;
  let url_targeting: any | undefined;
  let page_ids: number[] | undefined;
  let metrics: any[] | undefined;

  // Handle audience_conditions
  if (params.audience_conditions) {
    if (typeof params.audience_conditions === "string") {
      // Legacy JSON string format or simple "everyone"
      if (params.audience_conditions === "everyone") {
        audience_conditions = "everyone";
      } else {
        try {
          audience_conditions = JSON.parse(params.audience_conditions);
        } catch (error) {
          throw new Error("Invalid audience_conditions JSON format");
        }
      }
    } else {
      // New object format
      audience_conditions = params.audience_conditions;
    }
  }

  // Handle variations
  if (params.variations) {
    if (typeof params.variations === "string") {
      // Legacy JSON string format
      try {
        variations = JSON.parse(params.variations);
      } catch (error) {
        throw new Error("Invalid variations JSON format");
      }
    } else {
      // New object format
      variations = params.variations;
    }
  }

  // Handle url_targeting
  if (params.url_targeting) {
    if (typeof params.url_targeting === "string") {
      // Legacy JSON string format
      try {
        url_targeting = JSON.parse(params.url_targeting);
      } catch (error) {
        throw new Error("Invalid url_targeting JSON format");
      }
    } else {
      // New object format
      url_targeting = params.url_targeting;
    }

    // Ensure conditions is a JSON string for the API
    if (
      url_targeting.conditions &&
      typeof url_targeting.conditions !== "string"
    ) {
      console.log(
        "DEBUG: Converting conditions from:",
        typeof url_targeting.conditions,
        url_targeting.conditions
      );
      url_targeting.conditions = JSON.stringify(url_targeting.conditions);
      console.log(
        "DEBUG: Converted conditions to:",
        typeof url_targeting.conditions,
        url_targeting.conditions
      );
    }
  }

  // Handle page_ids
  if (params.page_ids) {
    if (typeof params.page_ids === "string") {
      // Legacy JSON string format
      try {
        page_ids = JSON.parse(params.page_ids);
      } catch (error) {
        throw new Error("Invalid page_ids JSON format");
      }
    } else {
      // New object format
      page_ids = params.page_ids;
    }
  }

  // Handle metrics
  if (params.metrics) {
    if (typeof params.metrics === "string") {
      // Legacy JSON string format
      try {
        metrics = JSON.parse(params.metrics);
      } catch (error) {
        throw new Error("Invalid metrics JSON format");
      }
    } else {
      // New object format
      metrics = params.metrics;
    }
  }

  if (!name || typeof name !== "string") {
    throw new Error("Experiment name is required and must be a string");
  }

  // Validate that either url_targeting or page_ids is provided
  if (!url_targeting && !page_ids) {
    throw new Error(
      "Either url_targeting or page_ids must be provided for web experiments. Please specify where the experiment should run."
    );
  }

  // Additional validation for url_targeting
  if (url_targeting && !url_targeting.edit_url) {
    throw new Error("url_targeting must include edit_url field");
  }

  // Validate variations weights sum to 100
  if (variations && variations.length > 0) {
    const totalWeight = variations.reduce((sum, v) => sum + (v.weight || 0), 0);
    if (totalWeight !== 100) {
      console.log(
        `DEBUG: Variation weights sum to ${totalWeight}, adjusting to equal distribution`
      );
      // Auto-adjust weights to equal distribution
      const equalWeight = 100 / variations.length;
      variations = variations.map((v) => ({ ...v, weight: equalWeight }));
    }
  }

  // Validate metrics have required fields
  if (metrics && metrics.length > 0) {
    for (const metric of metrics) {
      if (!metric.event_id || typeof metric.event_id !== "number") {
        throw new Error(
          `Invalid metric: event_id must be a number, got ${typeof metric.event_id}`
        );
      }
      if (!metric.aggregator) {
        throw new Error(`Invalid metric: aggregator is required`);
      }
      if (!metric.scope) {
        throw new Error(`Invalid metric: scope is required`);
      }
      if (!metric.winning_direction) {
        throw new Error(`Invalid metric: winning_direction is required`);
      }
    }
  }

  const client = getOptimizelyClient();

  try {
    // Prepare experiment data for API - simplified payload based on API docs
    const experimentData: any = {
      name,
      description:
        description ||
        `Experiment created via Opal on ${new Date().toLocaleDateString()}`,
      audience_conditions: audience_conditions || "everyone",
      variations: variations?.map((variation, index) => {
        const percentageWeight =
          variation.weight || 100 / (variations?.length || 1);
        const basisPointWeight = percentageWeight * 100;
        console.log(
          `DEBUG: Converting variation "${variation.name}" weight from ${percentageWeight}% to ${basisPointWeight} basis points`
        );
        return {
          name: variation.name,
          weight: basisPointWeight,
        };
      }) || [
        { name: "Original", weight: 5000 }, // 50% = 5000 basis points
        { name: "Variation 1", weight: 5000 }, // 50% = 5000 basis points
      ],
    };

    // Add holdback if provided
    if (holdback !== undefined) {
      experimentData.holdback = holdback;
    }

    // Add targeting configuration - use the correct API field name "url_targeting"
    if (url_targeting) {
      experimentData.url_targeting = url_targeting;
    }

    if (page_ids) {
      // Ensure page_ids are integers (convert strings if needed for backward compatibility)
      experimentData.page_ids = page_ids.map((id: any) =>
        typeof id === "string" ? parseInt(id, 10) : id
      );
    }

    if (metrics) {
      experimentData.metrics = metrics;
    }

    console.log(
      "DEBUG: Sending experiment data to API:",
      JSON.stringify(experimentData, null, 2)
    );

    // Try a minimal payload first to test API connectivity
    console.log("DEBUG: Attempting to create experiment with full payload...");

    const experiment = await client.createExperiment(projectId, experimentData);

    // Format the response using the same structure as getExperiment
    const formattedExperiment: FormattedExperiment = {
      id: experiment.id,
      name: experiment.name,
      description: experiment.description,
      status: experiment.status,
      type: experiment.type,
      created: formatDate(experiment.created),
      last_modified: formatDate(experiment.last_modified),
      project_id: experiment.project_id,
      traffic_allocation: experiment.traffic_allocation,
      holdback: experiment.holdback,
      campaign_id: experiment.campaign_id,
      allocation_policy: experiment.allocation_policy,
      url_targeting: experiment.url_targeting,
      variations:
        experiment.variations?.map((variation) => ({
          id: variation.variation_id,
          name: variation.name,
          weight: variation.weight,
          archived: variation.archived,
          status: variation.status,
          description: variation.description,
        })) || [],
      audience_conditions: experiment.audience_conditions,
      metrics_count: experiment.metrics?.length || 0,
      page_ids: experiment.page_ids || [],
    };

    // Generate experiment link for Optimizely UI
    const experimentLink = `https://app.optimizely.com/v2/projects/${projectId}/experiments/${experiment.id}`;

    // Generate informative message about what was included
    const audienceInfo =
      audience_conditions && audience_conditions !== "everyone"
        ? `with custom audience conditions`
        : "targeting everyone";

    const metricsInfo =
      metrics && metrics.length > 0
        ? `with ${metrics.length} metric(s) configured`
        : "with no metrics (add metrics in Optimizely UI)";

    return {
      success: true,
      experiment: formattedExperiment,
      experiment_url: experimentLink,
      message: `Experiment "${name}" created successfully with ID ${experiment.id}, ${audienceInfo}, ${metricsInfo}. View in Optimizely: ${experimentLink}`,
    };
  } catch (error) {
    if (error instanceof OptimizelyClientError) {
      throw new Error(`Failed to create experiment: ${error.message}`);
    }
    throw new Error(
      `Unexpected error creating experiment: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

/**
 * Test function to create a minimal experiment - for debugging API issues
 */
export async function createMinimalExperiment(projectId: string): Promise<any> {
  const client = getOptimizelyClient();

  const minimalPayload = {
    name: `Test Experiment ${Date.now()}`,
    description: "Minimal test experiment for debugging",
    audience_conditions: "everyone",
    url_targeting: {
      edit_url: "https://example.com",
      conditions: JSON.stringify([
        "and",
        { type: "url", match_type: "exact", value: "https://example.com" },
      ]),
    },
    variations: [
      { name: "Control", weight: 5000 },
      { name: "Treatment", weight: 5000 },
    ],
  };

  console.log(
    "DEBUG: Creating minimal test experiment with payload:",
    JSON.stringify(minimalPayload, null, 2)
  );

  try {
    const experiment = await client.createExperiment(projectId, minimalPayload);
    console.log(
      "DEBUG: Minimal experiment created successfully:",
      experiment.id
    );
    return experiment;
  } catch (error) {
    console.log("DEBUG: Minimal experiment creation failed:", error);
    throw error;
  }
}

/**
 * Helper function to extract target URL from experiment
 */
function extractTargetUrl(
  experiment: OptimizelyExperiment
): string | undefined {
  return experiment.url_targeting?.edit_url;
}

/**
 * Helper function to determine audience targeting type
 */
function getAudienceTargeting(
  audienceConditions: string
): "everyone" | "targeted" {
  return audienceConditions === "everyone" || audienceConditions === ""
    ? "everyone"
    : "targeted";
}

/**
 * Helper function to categorize event type
 */
function categorizeEventType(
  eventType: string
): "click" | "pageview" | "custom" {
  if (eventType === "click") return "click";
  if (eventType === "pageview") return "pageview";
  return "custom";
}

/**
 * Helper function to extract click target element
 */
function extractTargetElement(event: OptimizelyEvent): string | undefined {
  // If the event has config and selector, return it
  if ((event as any).config?.selector) {
    return (event as any).config.selector;
  }
  return undefined;
}

/**
 * Helper function to determine audience targeting type from conditions
 */
function determineTargetingType(conditions: any): string {
  if (typeof conditions === "string") {
    if (conditions === "everyone" || conditions === "") return "everyone";
    return "targeted";
  }

  if (Array.isArray(conditions)) {
    // Look for location, browser, campaign conditions
    const condStr = JSON.stringify(conditions);
    if (condStr.includes("location")) return "location-based";
    if (condStr.includes("browser")) return "browser-based";
    if (condStr.includes("campaign")) return "campaign-based";
    return "custom";
  }

  return "unknown";
}

/**
 * Helper function to count audience usage in experiments
 */
function countAudienceUsage(
  audienceId: string,
  experiments: OptimizelyExperiment[]
): number {
  return experiments.filter(
    (exp) =>
      exp.audience_conditions && exp.audience_conditions.includes(audienceId)
  ).length;
}

/**
 * Helper function to generate project insights
 */
function generateInsights(
  experiments: OptimizelyExperiment[],
  audiences: OptimizelyAudience[],
  events: OptimizelyEvent[]
): string[] {
  const insights: string[] = [];

  // Experiment insights
  const runningExps = experiments.filter((exp) => exp.status === "running");
  const concludedExps = experiments.filter((exp) => exp.status === "concluded");
  const notStartedExps = experiments.filter(
    (exp) => exp.status === "not_started"
  );

  if (runningExps.length > 0) {
    insights.push(
      `${runningExps.length} experiment${
        runningExps.length === 1 ? "" : "s"
      } currently running`
    );
  }

  if (concludedExps.length > 0) {
    insights.push(
      `${concludedExps.length} experiment${
        concludedExps.length === 1 ? "" : "s"
      } completed with results`
    );
  }

  if (notStartedExps.length > 5) {
    insights.push(`${notStartedExps.length} experiments ready to launch`);
  }

  // Audience insights
  const locationAudiences = audiences.filter((aud) =>
    JSON.stringify(aud.conditions).includes("location")
  );
  if (locationAudiences.length > 0) {
    insights.push(
      `Location-based targeting configured for ${
        locationAudiences.length
      } audience${locationAudiences.length === 1 ? "" : "s"}`
    );
  }

  // Event insights
  const clickEvents = events.filter((evt) => evt.event_type === "click");
  if (clickEvents.length > 0) {
    insights.push(
      `${clickEvents.length} click event${
        clickEvents.length === 1 ? "" : "s"
      } configured for tracking`
    );
  }

  // Popular domains
  const domains = experiments
    .map((exp) => extractTargetUrl(exp))
    .filter(Boolean)
    .map((url) => {
      try {
        return new URL(url!).hostname;
      } catch {
        return url;
      }
    });

  const uniqueDomains = [...new Set(domains)];
  if (uniqueDomains.length > 1) {
    insights.push(`Testing across ${uniqueDomains.length} different domains`);
  }

  return insights;
}

/**
 * Project Overview Tool
 * Returns a comprehensive overview of all entities in a project with rich formatting
 */
export async function getProjectOverview(
  params: ProjectOverviewParams
): Promise<FormattedProjectOverview> {
  const projectId = getProjectId(params);
  const client = getOptimizelyClient();

  try {
    console.log(
      `DEBUG: Getting comprehensive overview for project ${projectId}`
    );

    // Fetch all entity types in parallel for better performance
    const [rawExperiments, rawAudiences, rawEvents, rawPages] = await Promise.all([
      client.listExperiments(projectId, { per_page: 100 }),
      client.listAudiences(projectId, { per_page: 100 }),
      client.listEvents(projectId, { per_page: 100 }),
      client.listPages(projectId, { per_page: 100 }).catch(() => []), // Pages might not exist for all projects
    ]);

    // Apply archived filtering if include_archived is not explicitly true
    const experiments = rawExperiments;
    const audiences = params.include_archived ? rawAudiences : rawAudiences.filter((aud) => !aud.archived);
    const events = params.include_archived ? rawEvents : rawEvents.filter((event) => !event.archived);
    const pages = params.include_archived ? rawPages : rawPages.filter((page) => !page.archived);

    console.log(
      `DEBUG: Retrieved ${experiments.length} experiments, ${audiences.length} audiences, ${events.length} events, ${pages.length} pages`
    );

    // Process experiments with enhanced metadata
    const enhancedExperiments: EnhancedExperimentSummary[] = experiments.map(
      (exp) => ({
        id: String(exp.id),
        name: exp.name,
        status: exp.status,
        type: exp.type,
        traffic_allocation: exp.traffic_allocation,
        variations_count: exp.variations?.length || 0,
        metrics_count: exp.metrics?.length || 0,
        last_modified: formatDate(exp.last_modified),
        target_url: extractTargetUrl(exp),
        audience_targeting: getAudienceTargeting(exp.audience_conditions),
        has_results: exp.status === "concluded" || exp.status === "running",
      })
    );

    // Group experiments by status
    const experimentsByStatus = {
      running: enhancedExperiments.filter((exp) => exp.status === "running"),
      concluded: enhancedExperiments.filter(
        (exp) => exp.status === "concluded"
      ),
      not_started: enhancedExperiments.filter(
        (exp) => exp.status === "not_started"
      ),
      archived: enhancedExperiments.filter((exp) => exp.status === "archived"),
      paused: enhancedExperiments.filter((exp) => exp.status === "paused"),
    };

    // Calculate experiment types
    const experimentTypes: { [key: string]: number } = {};
    experiments.forEach((exp) => {
      experimentTypes[exp.type] = (experimentTypes[exp.type] || 0) + 1;
    });

    // Extract popular target domains
    const popularTargets = [
      ...new Set(
        enhancedExperiments
          .map((exp) => exp.target_url)
          .filter((url): url is string => Boolean(url))
          .map((url) => {
            try {
              return new URL(url).hostname;
            } catch {
              return url;
            }
          })
      ),
    ].slice(0, 5); // Top 5 domains

    // Process audiences with enhanced metadata
    const enhancedAudiences: EnhancedAudienceSummary[] = audiences.map(
      (aud) => ({
        id: String(aud.id),
        name: aud.name,
        experiment_usage: countAudienceUsage(String(aud.id), experiments),
        targeting_type: determineTargetingType(aud.conditions),
        archived: aud.archived,
        last_modified: formatDate(aud.last_modified),
      })
    );

    // Group audiences by archived status
    const activeAudiences = enhancedAudiences.filter((aud) => !aud.archived);
    const archivedAudiences = enhancedAudiences.filter((aud) => aud.archived);

    // Calculate targeting breakdown
    const targetingBreakdown: { [key: string]: number } = {};
    enhancedAudiences.forEach((aud) => {
      targetingBreakdown[aud.targeting_type] =
        (targetingBreakdown[aud.targeting_type] || 0) + 1;
    });

    // Process events with enhanced metadata
    const enhancedEvents: EnhancedEventSummary[] = events.map((evt) => ({
      id: String(evt.id),
      name: evt.name,
      event_type: categorizeEventType(evt.event_type),
      category: evt.category,
      archived: evt.archived,
      target_element: extractTargetElement(evt),
    }));

    // Group events by type
    const eventsByType = {
      click: enhancedEvents.filter((evt) => evt.event_type === "click"),
      pageview: enhancedEvents.filter((evt) => evt.event_type === "pageview"),
      custom: enhancedEvents.filter((evt) => evt.event_type === "custom"),
    };

    // Process pages with enhanced metadata
    const enhancedPages: EnhancedPageSummary[] = pages.map((page) => ({
      id: String(page.id),
      name: page.name,
      edit_url: page.edit_url,
      activation_type: (page as any).activation_type || "unknown",
      category: page.category,
      archived: page.archived,
    }));

    // Calculate page activation breakdown
    const pageActivationBreakdown: { [key: string]: number } = {};
    enhancedPages.forEach((page) => {
      pageActivationBreakdown[page.activation_type] =
        (pageActivationBreakdown[page.activation_type] || 0) + 1;
    });

    // Generate insights
    const insights = generateInsights(experiments, audiences, events);

    // Build comprehensive summary
    const summary: ProjectOverviewSummary = {
      project_id: projectId,
      total_experiments: experiments.length,
      total_audiences: audiences.length,
      total_events: events.length,
      total_pages: pages.length,
      experiments_by_status: {
        running: experimentsByStatus.running.length,
        concluded: experimentsByStatus.concluded.length,
        not_started: experimentsByStatus.not_started.length,
        archived: experimentsByStatus.archived.length,
        paused: experimentsByStatus.paused.length,
      },
      insights,
    };

    return {
      summary,
      experiments: {
        by_status: experimentsByStatus,
        popular_targets: popularTargets,
        experiment_types: experimentTypes,
      },
      audiences: {
        active: activeAudiences,
        archived: archivedAudiences,
        targeting_breakdown: targetingBreakdown,
      },
      events: {
        by_type: eventsByType,
        active_count: enhancedEvents.filter((evt) => !evt.archived).length,
        archived_count: enhancedEvents.filter((evt) => evt.archived).length,
      },
      pages: {
        all: enhancedPages,
        by_activation: pageActivationBreakdown,
      },
    };
  } catch (error) {
    if (error instanceof OptimizelyClientError) {
      throw new Error(`Failed to get project overview: ${error.message}`);
    }
    throw new Error(
      `Unexpected error getting project overview: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}
