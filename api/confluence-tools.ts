import {
  confluenceClient,
  type ConfluencePage,
  ConfluenceClientError,
} from "./confluence-client";

/**
 * Legacy synchronous markdown to Confluence storage conversion
 * Converts markdown to Confluence storage format (XHTML-based)
 */
function convertMarkdownToConfluenceStorage(markdown: string): string {
  // Clean up problematic characters first
  let result = markdown
    .replace(/–/g, "-") // En-dash to regular dash
    .replace(/—/g, "-") // Em-dash to regular dash
    .replace(/"/g, '"') // Smart quotes to regular quotes
    .replace(/"/g, '"')
    .replace(/'/g, "'")
    .replace(/'/g, "'")
    .replace(/&/g, "and"); // Ampersand to word

  // Process line by line for better control
  const lines = result.split("\n");
  const htmlLines: string[] = [];
  let inList = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Empty line
    if (!line) {
      if (inList) {
        htmlLines.push("</ul>");
        inList = false;
      }
      htmlLines.push(""); // Preserve empty lines for paragraph breaks
      continue;
    }

    // Headers
    if (line.match(/^#{1,3}\s/)) {
      if (inList) {
        htmlLines.push("</ul>");
        inList = false;
      }

      const headerText = line.replace(/^#{1,3}\s*/, "");
      const level = (line.match(/^#+/) || [""])[0].length;

      // Apply formatting to header text
      const formatted = headerText
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/\*([^*]+)\*/g, "<em>$1</em>");

      htmlLines.push(`<h${level}>${formatted}</h${level}>`);
      continue;
    }

    // List items
    if (line.startsWith("- ")) {
      if (!inList) {
        htmlLines.push("<ul>");
        inList = true;
      }

      const itemText = line.substring(2);
      const formatted = itemText
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/\*([^*]+)\*/g, "<em>$1</em>");

      htmlLines.push(`<li>${formatted}</li>`);
      continue;
    }

    // Tables - detect and convert to proper HTML tables
    if (line.includes("|") && !line.match(/^\s*\|?\s*-+\s*\|/)) {
      if (inList) {
        htmlLines.push("</ul>");
        inList = false;
      }

      // Look ahead to see if this is part of a table
      const nextLine = i + 1 < lines.length ? lines[i + 1].trim() : "";
      const isTableHeader =
        nextLine &&
        nextLine.match(/^\|?[\s]*[-:]+[\s]*(\|[\s]*[-:]+[\s]*)*\|?$/);

      if (isTableHeader) {
        // Process the entire table
        const tableResult = processMarkdownTable(lines, i);
        htmlLines.push(tableResult.html);
        i = tableResult.lastIndex; // Skip processed lines
      } else {
        // Single table-like line, treat as text
        const tableText = line.replace(/\|/g, " | ").trim();
        htmlLines.push(`<p>${tableText}</p>`);
      }
      continue;
    }

    // Regular paragraph
    if (inList) {
      htmlLines.push("</ul>");
      inList = false;
    }

    const formatted = line
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>");

    htmlLines.push(`<p>${formatted}</p>`);
  }

  // Close any remaining list
  if (inList) {
    htmlLines.push("</ul>");
  }

  // Join and clean up
  result = htmlLines.join("");

  // Final cleanup
  result = result
    .replace(/<\/p><p>/g, "</p><p>") // Ensure proper paragraph spacing
    .replace(/^<\/p>/, "") // Remove leading closing paragraph
    .replace(/<p>$/, ""); // Remove trailing opening paragraph

  return result;
}

/**
 * Process markdown table and convert to HTML
 */
function processMarkdownTable(
  lines: string[],
  startIndex: number
): { html: string; lastIndex: number } {
  let currentIndex = startIndex;

  // Parse header row
  const headerLine = lines[currentIndex].trim();
  const headerCells = headerLine.split("|").map((h) => h.trim());
  // Remove leading and trailing empty cells (from | at start/end of line)
  let startIdx = 0;
  let endIdx = headerCells.length;
  if (headerCells[0] === "") startIdx = 1;
  if (headerCells[headerCells.length - 1] === "")
    endIdx = headerCells.length - 1;
  const headers = headerCells.slice(startIdx, endIdx);
  currentIndex++;

  // Skip separator row
  currentIndex++;

  // Collect data rows
  const dataRows: string[][] = [];
  while (currentIndex < lines.length) {
    const line = lines[currentIndex].trim();
    if (!line || !line.includes("|")) break;

    const rowCells = line.split("|").map((c) => c.trim());
    let startIdx = 0;
    let endIdx = rowCells.length;
    if (rowCells[0] === "") startIdx = 1;
    if (rowCells[rowCells.length - 1] === "") endIdx = rowCells.length - 1;
    const cells = rowCells.slice(startIdx, endIdx);

    if (cells.length > 0) {
      dataRows.push(cells);
    }
    currentIndex++;
  }

  // Generate HTML table
  let tableHtml = "<table><tbody>";

  // Header row
  if (headers.length > 0) {
    tableHtml += "<tr>";
    headers.forEach((header) => {
      const cleaned = header
        .replace(/–/g, "-")
        .replace(/—/g, "-")
        .replace(/"/g, '"')
        .replace(/"/g, '"')
        .replace(/'/g, "'")
        .replace(/'/g, "'")
        .replace(/&/g, "and");

      const formatted = cleaned
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/\*([^*]+)\*/g, "<em>$1</em>");

      tableHtml += `<th>${formatted}</th>`;
    });
    tableHtml += "</tr>";
  }

  // Data rows
  dataRows.forEach((row) => {
    tableHtml += "<tr>";
    row.forEach((cell) => {
      const cleaned = cell
        .replace(/–/g, "-")
        .replace(/—/g, "-")
        .replace(/"/g, '"')
        .replace(/"/g, '"')
        .replace(/'/g, "'")
        .replace(/'/g, "'")
        .replace(/&/g, "and");

      const formatted = cleaned
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/\*([^*]+)\*/g, "<em>$1</em>");

      tableHtml += `<td>${formatted}</td>`;
    });
    tableHtml += "</tr>";
  });

  tableHtml += "</tbody></table>";

  return {
    html: tableHtml,
    lastIndex: currentIndex - 1,
  };
}

export type ReadConfluencePageParams = {
  pageId?: string;
  spaceId?: string;
  spaceKey?: string;
  title?: string;
};

export type UpdateConfluencePageParams = {
  pageId: string;
  title?: string;
  content: string;
};

export type CreateConfluencePageParams = {
  spaceId?: string;
  spaceKey?: string;
  title: string;
  content: string;
  parentPageId?: string;
};

export type ConfluencePageResult = {
  id: string;
  title: string;
  content: string;
  spaceId: string;
  version: number;
  lastModified?: string;
  url: string;
};

export type CreatePageResult = {
  id: string;
  title: string;
  url: string;
  spaceId: string;
};

export type UpdatePageResult = {
  success: boolean;
  message: string;
  version: number;
};

export async function readConfluencePage(
  params: ReadConfluencePageParams
): Promise<ConfluencePageResult> {
  const { pageId, spaceId, spaceKey, title } = params;

  if (!pageId && !(spaceId && title) && !(spaceKey && title)) {
    throw new Error(
      "Either pageId, or both spaceId and title, or both spaceKey and title are required to read a Confluence page"
    );
  }

  try {
    let page: ConfluencePage;
    let resolvedSpaceId = spaceId;

    // If spaceKey is provided, try to resolve it to spaceId
    if (spaceKey && !spaceId) {
      try {
        resolvedSpaceId = await confluenceClient.getSpaceIdByKey(spaceKey);
      } catch (error) {
        throw new Error(
          `Failed to resolve space key "${spaceKey}" to space ID. You may need to provide the space ID directly. Error: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    }

    if (pageId) {
      page = await confluenceClient.getPageById(pageId);
    } else if (resolvedSpaceId && title) {
      page = await confluenceClient.getPageByTitle(resolvedSpaceId, title);
    } else {
      throw new Error("Invalid parameters: need pageId or spaceId/spaceKey + title");
    }

    // Handle both body.value and body.storage.value formats
    const content = page.body.value || page.body.storage?.value || "";

    return {
      id: page.id,
      title: page.title,
      content: content,
      spaceId: page.spaceId,
      version: page.version.number,
      lastModified: page.version.createdAt,
      url: page._links.webui.startsWith("http")
        ? page._links.webui
        : `${confluenceClient.getBaseUrl()}${page._links.webui}`,
    };
  } catch (error) {
    if (error instanceof ConfluenceClientError) {
      const identifier = pageId
        ? `ID "${pageId}"`
        : `title "${title}" in space "${spaceId || spaceKey}"`;

      if (error.status === 404) {
        throw new Error(
          `Confluence page with ${identifier} not found. This could mean: 1) The page ${
            pageId ? "ID" : "title or space ID/key"
          } is incorrect, 2) The page has been deleted or archived, 3) You don't have permission to view this page or space, or 4) The space doesn't exist. Please verify the ${
            pageId ? "page ID" : "page title and space ID/key"
          } are correct and that you have access to the page. Error details: ${
            error.message
          }`
        );
      } else if (error.status === 401) {
        throw new Error(
          `Authentication failed when accessing Confluence page with ${identifier}. Please check your Confluence credentials (CONFLUENCE_PAT or CONFLUENCE_EMAIL/CONFLUENCE_API_TOKEN) have valid read permissions. Error details: ${error.message}`
        );
      } else if (error.status === 403) {
        throw new Error(
          `Access denied to Confluence page with ${identifier}. Your account may not have permission to view this page or space. Please contact your Confluence administrator or verify you have read access to the space. Error details: ${error.message}`
        );
      }
      throw new Error(
        `Failed to read Confluence page with ${identifier}: ${error.message}`
      );
    }
    throw new Error(
      `Unexpected error reading Confluence page: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

export async function updateConfluencePage(
  params: UpdateConfluencePageParams
): Promise<UpdatePageResult> {
  const { pageId, title, content } = params;

  if (!pageId || typeof pageId !== "string") {
    throw new Error("Page ID is required and must be a string");
  }

  if (!content || typeof content !== "string") {
    throw new Error("Content is required and must be a string");
  }

  try {
    // First, get the existing page to get current version and spaceId
    const existingPage = await confluenceClient.getPageById(pageId);

    const updateData = {
      id: pageId,
      title: title || existingPage.title,
      spaceId: existingPage.spaceId,
      status: existingPage.status || "current",
      version: {
        number: existingPage.version.number + 1,
      },
      body: {
        representation: "storage",
        value: convertMarkdownToConfluenceStorage(content),
      },
    };

    const updatedPage = await confluenceClient.updatePage(pageId, updateData);

    return {
      success: true,
      message: `Page "${updatedPage.title}" updated successfully`,
      version: updatedPage.version.number,
    };
  } catch (error) {
    if (error instanceof ConfluenceClientError) {
      if (error.status === 404) {
        throw new Error(
          `Confluence page with ID "${pageId}" not found for update. This could mean: 1) The page ID is incorrect, 2) The page has been deleted, or 3) You don't have permission to view this page. Please verify the page ID is correct and that the page exists. Error details: ${error.message}`
        );
      } else if (error.status === 401) {
        throw new Error(
          `Authentication failed when updating Confluence page "${pageId}". Please check your Confluence credentials have valid edit permissions. Error details: ${error.message}`
        );
      } else if (error.status === 403) {
        throw new Error(
          `Access denied when updating Confluence page "${pageId}". Your account may not have permission to edit pages in this space. Please contact your Confluence administrator or verify you have edit permissions for this space. Error details: ${error.message}`
        );
      } else if (error.status === 409) {
        throw new Error(
          `Version conflict when updating Confluence page "${pageId}". The page was modified by another user while you were editing it. Please refresh the page, get the latest version, and try your update again. Error details: ${error.message}`
        );
      } else if (error.status === 400) {
        throw new Error(
          `Invalid update data for Confluence page "${pageId}". The content format or other field values may be incorrect. Please check that the content is valid and all required fields are provided. Error details: ${error.message}`
        );
      }
      throw new Error(
        `Failed to update Confluence page "${pageId}": ${error.message}`
      );
    }
    throw new Error(
      `Unexpected error updating Confluence page "${pageId}": ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

export async function createConfluencePage(
  params: CreateConfluencePageParams
): Promise<CreatePageResult> {
  const { spaceId, spaceKey, title, content, parentPageId } = params;

  if (!spaceId && !spaceKey) {
    throw new Error("Either spaceId or spaceKey is required");
  }

  if (!title || typeof title !== "string") {
    throw new Error("Title is required and must be a string");
  }

  if (!content || typeof content !== "string") {
    throw new Error("Content is required and must be a string");
  }

  try {
    let resolvedSpaceId = spaceId;

    // If spaceKey is provided, try to resolve it to spaceId
    if (spaceKey && !spaceId) {
      try {
        resolvedSpaceId = await confluenceClient.getSpaceIdByKey(spaceKey);
      } catch (error) {
        throw new Error(
          `Failed to resolve space key "${spaceKey}" to space ID. You may need to provide the space ID directly. Error: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    }

    if (!resolvedSpaceId) {
      throw new Error("Space ID is required. Could not resolve from space key.");
    }

    const pageData = {
      title,
      spaceId: resolvedSpaceId,
      status: "current",
      body: {
        representation: "storage",
        value: convertMarkdownToConfluenceStorage(content),
      },
      ...(parentPageId && {
        parentId: parentPageId,
      }),
    };

    const result = await confluenceClient.createPage(pageData);

    const baseUrl = confluenceClient.getBaseUrl();
    const webuiUrl = result._links.webui.startsWith("http")
      ? result._links.webui
      : `${baseUrl}${result._links.webui}`;

    return {
      id: result.id,
      title: result.title,
      url: webuiUrl,
      spaceId: result.spaceId,
    };
  } catch (error) {
    if (error instanceof ConfluenceClientError) {
      if (error.status === 400) {
        throw new Error(
          `Invalid data when creating Confluence page "${title}" in space "${spaceId || spaceKey}". This could mean: 1) The space ID/key doesn't exist or you don't have access to it, 2) The page title already exists in this space, 3) The parent page ID is invalid (if provided), or 4) Required fields are missing. Please verify the space ID/key exists, the page title is unique in the space, and all required fields are provided. Error details: ${error.message}`
        );
      } else if (error.status === 401) {
        throw new Error(
          `Authentication failed when creating Confluence page. Please check your Confluence credentials have valid create permissions. Error details: ${error.message}`
        );
      } else if (error.status === 403) {
        throw new Error(
          `Access denied when creating page in space "${spaceId || spaceKey}". Your account may not have permission to create pages in this space. Please contact your Confluence administrator or verify you have create permissions for this space. Error details: ${error.message}`
        );
      }
      throw new Error(
        `Failed to create Confluence page "${title}" in space "${spaceId || spaceKey}": ${error.message}`
      );
    }
    throw new Error(
      `Unexpected error creating Confluence page "${title}" in space "${spaceId || spaceKey}": ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}
