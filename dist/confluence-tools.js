"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readConfluencePage = readConfluencePage;
exports.updateConfluencePage = updateConfluencePage;
exports.createConfluencePage = createConfluencePage;
const confluence_client_1 = require("./confluence-client");
const FEATURE_FLAG_CONFIG = {
    flagKey: "three_variation_feature_flag",
    projectId: "29212200329", // Feature Experimentation Demo project
    userId: "default-user",
};
/**
 * Get the current feature flag value
 * In a real implementation, this would call your Optimizely SDK
 * For now, we'll use a simple environment variable or default
 */
async function getFeatureMode() {
    // TODO: Replace with actual Optimizely SDK call
    // const featureMode = optimizelyClient.getVariableValue(
    //   FEATURE_FLAG_CONFIG.flagKey,
    //   'feature_mode',
    //   FEATURE_FLAG_CONFIG.userId
    // );
    // For now, use environment variable or default to "on"
    const envMode = process.env.CONFLUENCE_FEATURE_MODE;
    return envMode || "on";
}
/**
 * Enhanced table processing with feature flag variations
 */
function processMarkdownTableEnhanced(lines, startIndex, mode) {
    let currentIndex = startIndex;
    // Parse header row
    const headerLine = lines[currentIndex].trim();
    const headerCells = headerLine.split("|").map((h) => h.trim());
    // Remove leading and trailing empty cells (from | at start/end of line)
    // but preserve empty cells in the middle
    let startIdx = 0;
    let endIdx = headerCells.length;
    if (headerCells[0] === "")
        startIdx = 1;
    if (headerCells[headerCells.length - 1] === "")
        endIdx = headerCells.length - 1;
    const headers = headerCells.slice(startIdx, endIdx);
    currentIndex++;
    // Skip separator row
    currentIndex++;
    // Collect data rows
    const dataRows = [];
    while (currentIndex < lines.length) {
        const line = lines[currentIndex].trim();
        if (!line || !line.includes("|"))
            break;
        const rowCells = line.split("|").map((c) => c.trim());
        // Remove leading and trailing empty cells (from | at start/end of line)
        // but preserve empty cells in the middle
        let startIdx = 0;
        let endIdx = rowCells.length;
        if (rowCells[0] === "")
            startIdx = 1;
        if (rowCells[rowCells.length - 1] === "")
            endIdx = rowCells.length - 1;
        const cells = rowCells.slice(startIdx, endIdx);
        if (cells.length > 0) {
            dataRows.push(cells);
        }
        currentIndex++;
    }
    // Generate HTML table with feature flag variations
    let tableHtml = "";
    switch (mode) {
        case "on":
            // Original behavior - basic table
            tableHtml = "<table><tbody>";
            break;
        case "variation_1":
            // Enhanced table with CSS classes and better structure
            tableHtml = '<table class="confluence-table enhanced-table"><thead>';
            break;
        case "variation_2":
            // Advanced table with responsive design and additional attributes
            tableHtml =
                '<table class="confluence-table advanced-table" data-sortable="true" data-responsive="true"><thead>';
            break;
        default:
            // Fallback to original
            tableHtml = "<table><tbody>";
    }
    // Header row processing based on variation
    if (headers.length > 0) {
        const headerTag = mode === "variation_1" || mode === "variation_2" ? "thead" : "tbody";
        if (mode !== "on" && headerTag === "thead") {
            // Already added thead tag above for variations 1 & 2
        }
        tableHtml += "<tr>";
        headers.forEach((header, index) => {
            const cleaned = header
                .replace(/–/g, "-")
                .replace(/—/g, "-")
                .replace(/"/g, '"')
                .replace(/"/g, '"')
                .replace(/'/g, "'")
                .replace(/'/g, "'")
                .replace(/&/g, "and");
            let formatted = cleaned
                .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
                .replace(/\*([^*]+)\*/g, "<em>$1</em>");
            // Add enhanced attributes based on variation
            let cellTag = "th";
            let cellAttributes = "";
            switch (mode) {
                case "variation_1":
                    cellAttributes = ` class="header-cell" data-column="${index}"`;
                    break;
                case "variation_2":
                    cellAttributes = ` class="header-cell sortable" data-column="${index}" data-type="text" role="columnheader" tabindex="0"`;
                    break;
            }
            tableHtml += `<${cellTag}${cellAttributes}>${formatted}</${cellTag}>`;
        });
        tableHtml += "</tr>";
        // Close thead and start tbody for enhanced variations
        if (mode === "variation_1" || mode === "variation_2") {
            tableHtml += "</thead><tbody>";
        }
    }
    // Data rows processing
    dataRows.forEach((row, rowIndex) => {
        let rowAttributes = "";
        // Add row attributes based on variation
        switch (mode) {
            case "variation_1":
                rowAttributes = ` class="data-row" data-row="${rowIndex}"`;
                break;
            case "variation_2":
                rowAttributes = ` class="data-row interactive-row" data-row="${rowIndex}" role="row"`;
                break;
        }
        tableHtml += `<tr${rowAttributes}>`;
        row.forEach((cell, cellIndex) => {
            const cleaned = cell
                .replace(/–/g, "-")
                .replace(/—/g, "-")
                .replace(/"/g, '"')
                .replace(/"/g, '"')
                .replace(/'/g, "'")
                .replace(/'/g, "'")
                .replace(/&/g, "and");
            let formatted = cleaned
                .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
                .replace(/\*([^*]+)\*/g, "<em>$1</em>");
            // Add cell attributes based on variation
            let cellAttributes = "";
            switch (mode) {
                case "variation_1":
                    cellAttributes = ` class="data-cell" data-column="${cellIndex}"`;
                    break;
                case "variation_2":
                    cellAttributes = ` class="data-cell interactive-cell" data-column="${cellIndex}" role="gridcell"`;
                    break;
            }
            tableHtml += `<td${cellAttributes}>${formatted}</td>`;
        });
        tableHtml += "</tr>";
    });
    tableHtml += "</tbody></table>";
    return {
        html: tableHtml,
        lastIndex: currentIndex - 1,
    };
}
/**
 * Enhanced markdown to Confluence storage conversion with feature flag support
 */
async function convertMarkdownToConfluenceStorageEnhanced(markdown) {
    // Get feature flag mode
    const featureMode = await getFeatureMode();
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
    const htmlLines = [];
    let inList = false;
    // Add feature flag specific metadata comment
    if (featureMode !== "off") {
        htmlLines.push(`<!-- Generated with feature flag: ${FEATURE_FLAG_CONFIG.flagKey}, mode: ${featureMode} -->`);
    }
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
        // Headers with enhanced formatting based on feature flag
        if (line.match(/^#{1,3}\s/)) {
            if (inList) {
                htmlLines.push("</ul>");
                inList = false;
            }
            const headerText = line.replace(/^#{1,3}\s*/, "");
            const level = (line.match(/^#+/) || [""])[0].length;
            // Apply formatting to header text
            let formatted = headerText
                .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
                .replace(/\*([^*]+)\*/g, "<em>$1</em>");
            // Add feature flag specific header enhancements
            let headerAttributes = "";
            switch (featureMode) {
                case "variation_1":
                    headerAttributes = ` class="enhanced-header" data-level="${level}"`;
                    break;
                case "variation_2":
                    headerAttributes = ` class="advanced-header" data-level="${level}" data-section="true"`;
                    break;
            }
            htmlLines.push(`<h${level}${headerAttributes}>${formatted}</h${level}>`);
            continue;
        }
        // List items with enhanced attributes
        if (line.startsWith("- ")) {
            if (!inList) {
                const listAttributes = featureMode === "variation_2"
                    ? ' class="advanced-list" data-type="bullet"'
                    : "";
                htmlLines.push(`<ul${listAttributes}>`);
                inList = true;
            }
            const itemText = line.substring(2);
            let formatted = itemText
                .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
                .replace(/\*([^*]+)\*/g, "<em>$1</em>");
            const listItemAttributes = featureMode === "variation_2" ? ' class="advanced-list-item"' : "";
            htmlLines.push(`<li${listItemAttributes}>${formatted}</li>`);
            continue;
        }
        // Enhanced table processing with feature flag
        if (line.includes("|") && !line.match(/^\s*\|?\s*-+\s*\|/)) {
            if (inList) {
                htmlLines.push("</ul>");
                inList = false;
            }
            // Look ahead to see if this is part of a table
            const nextLine = i + 1 < lines.length ? lines[i + 1].trim() : "";
            const isTableHeader = nextLine &&
                nextLine.match(/^\|?[\s]*[-:]+[\s]*(\|[\s]*[-:]+[\s]*)*\|?$/);
            if (isTableHeader) {
                // Process the entire table with feature flag mode
                const tableResult = processMarkdownTableEnhanced(lines, i, featureMode);
                htmlLines.push(tableResult.html);
                i = tableResult.lastIndex; // Skip processed lines
            }
            else {
                // Single table-like line, treat as text with enhanced formatting
                const tableText = line.replace(/\|/g, " | ").trim();
                const paragraphAttributes = featureMode === "variation_2" ? ' class="table-like-text"' : "";
                htmlLines.push(`<p${paragraphAttributes}>${tableText}</p>`);
            }
            continue;
        }
        // Regular paragraph with enhanced attributes
        if (inList) {
            htmlLines.push("</ul>");
            inList = false;
        }
        let formatted = line
            .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
            .replace(/\*([^*]+)\*/g, "<em>$1</em>");
        const paragraphAttributes = featureMode === "variation_1"
            ? ' class="enhanced-paragraph"'
            : featureMode === "variation_2"
                ? ' class="advanced-paragraph"'
                : "";
        htmlLines.push(`<p${paragraphAttributes}>${formatted}</p>`);
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
 * Legacy synchronous markdown to Confluence storage conversion (backwards compatibility)
 * @deprecated Use convertMarkdownToConfluenceStorageEnhanced for feature flag support
 */
function convertMarkdownToConfluenceStorage(markdown) {
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
    const htmlLines = [];
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
            const isTableHeader = nextLine &&
                nextLine.match(/^\|?[\s]*[-:]+[\s]*(\|[\s]*[-:]+[\s]*)*\|?$/);
            if (isTableHeader) {
                // Process the entire table (legacy mode)
                const tableResult = processMarkdownTableEnhanced(lines, i, "on");
                htmlLines.push(tableResult.html);
                i = tableResult.lastIndex; // Skip processed lines
            }
            else {
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
async function readConfluencePage(params) {
    const { pageId, spaceKey, title } = params;
    if (!pageId && !(spaceKey && title)) {
        throw new Error("Either pageId or both spaceKey and title are required to read a Confluence page");
    }
    try {
        let page;
        if (pageId) {
            page = await confluence_client_1.confluenceClient.getPageById(pageId);
        }
        else {
            page = await confluence_client_1.confluenceClient.getPageByTitle(spaceKey.toUpperCase(), title);
        }
        return {
            id: page.id,
            title: page.title,
            content: page.body.storage.value,
            spaceKey: page.space.key,
            spaceName: page.space.name,
            version: page.version.number,
            lastModified: page.version.when,
            lastModifiedBy: page.version.by.displayName,
            url: `https://confluence.sso.episerver.net${page._links.webui}`,
        };
    }
    catch (error) {
        if (error instanceof confluence_client_1.ConfluenceClientError) {
            const identifier = pageId
                ? `ID "${pageId}"`
                : `title "${title}" in space "${spaceKey}"`;
            if (error.status === 404) {
                throw new Error(`Confluence page with ${identifier} not found. This could mean: 1) The page ${pageId ? "ID" : "title or space key"} is incorrect, 2) The page has been deleted or archived, 3) You don't have permission to view this page or space, or 4) The space doesn't exist. Please verify the ${pageId ? "page ID" : "page title and space key"} are correct and that you have access to the page. Error details: ${error.message}`);
            }
            else if (error.status === 401) {
                throw new Error(`Authentication failed when accessing Confluence page with ${identifier}. Please check your CONFLUENCE_PAT environment variable contains a valid Personal Access Token with read permissions. Error details: ${error.message}`);
            }
            else if (error.status === 403) {
                throw new Error(`Access denied to Confluence page with ${identifier}. Your account may not have permission to view this page or space. Please contact your Confluence administrator or verify you have read access to the space. Error details: ${error.message}`);
            }
            throw new Error(`Failed to read Confluence page with ${identifier}: ${error.message}`);
        }
        throw new Error(`Unexpected error reading Confluence page: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
}
async function updateConfluencePage(params) {
    const { pageId, title, content } = params;
    if (!pageId || typeof pageId !== "string") {
        throw new Error("Page ID is required and must be a string");
    }
    if (!content || typeof content !== "string") {
        throw new Error("Content is required and must be a string");
    }
    try {
        const existingPage = await confluence_client_1.confluenceClient.getPageById(pageId);
        const updateData = {
            version: {
                number: existingPage.version.number + 1,
            },
            title: title || existingPage.title,
            type: existingPage.type,
            body: {
                storage: {
                    value: await convertMarkdownToConfluenceStorageEnhanced(content),
                    representation: "storage",
                },
            },
        };
        const updatedPage = await confluence_client_1.confluenceClient.updatePage(pageId, updateData);
        return {
            success: true,
            message: `Page "${updatedPage.title}" updated successfully`,
            version: updatedPage.version.number,
        };
    }
    catch (error) {
        if (error instanceof confluence_client_1.ConfluenceClientError) {
            if (error.status === 404) {
                throw new Error(`Confluence page with ID "${pageId}" not found for update. This could mean: 1) The page ID is incorrect, 2) The page has been deleted, or 3) You don't have permission to view this page. Please verify the page ID is correct and that the page exists. Error details: ${error.message}`);
            }
            else if (error.status === 401) {
                throw new Error(`Authentication failed when updating Confluence page "${pageId}". Please check your CONFLUENCE_PAT environment variable contains a valid Personal Access Token with edit permissions. Error details: ${error.message}`);
            }
            else if (error.status === 403) {
                throw new Error(`Access denied when updating Confluence page "${pageId}". Your account may not have permission to edit pages in this space. Please contact your Confluence administrator or verify you have edit permissions for this space. Error details: ${error.message}`);
            }
            else if (error.status === 409) {
                throw new Error(`Version conflict when updating Confluence page "${pageId}". The page was modified by another user while you were editing it. Please refresh the page, get the latest version, and try your update again. Error details: ${error.message}`);
            }
            else if (error.status === 400) {
                throw new Error(`Invalid update data for Confluence page "${pageId}". The content format or other field values may be incorrect. Please check that the content is valid and all required fields are provided. Error details: ${error.message}`);
            }
            throw new Error(`Failed to update Confluence page "${pageId}": ${error.message}`);
        }
        throw new Error(`Unexpected error updating Confluence page "${pageId}": ${error instanceof Error ? error.message : "Unknown error"}`);
    }
}
async function createConfluencePage(params) {
    const { spaceKey, title, content, parentPageId } = params;
    if (!spaceKey || typeof spaceKey !== "string") {
        throw new Error("Space key is required and must be a string");
    }
    if (!title || typeof title !== "string") {
        throw new Error("Title is required and must be a string");
    }
    if (!content || typeof content !== "string") {
        throw new Error("Content is required and must be a string");
    }
    try {
        const pageData = {
            type: "page",
            title,
            space: {
                key: spaceKey.toUpperCase(),
            },
            body: {
                storage: {
                    value: await convertMarkdownToConfluenceStorageEnhanced(content),
                    representation: "storage",
                },
            },
            ...(parentPageId && {
                ancestors: [
                    {
                        id: parentPageId,
                    },
                ],
            }),
        };
        const result = await confluence_client_1.confluenceClient.createPage(pageData);
        return {
            id: result.id,
            title: result.title,
            url: `https://confluence.sso.episerver.net${result._links.webui}`,
            spaceKey: result.space.key,
        };
    }
    catch (error) {
        if (error instanceof confluence_client_1.ConfluenceClientError) {
            if (error.status === 400) {
                throw new Error(`Invalid data when creating Confluence page "${title}" in space "${spaceKey}". This could mean: 1) The space key "${spaceKey}" doesn't exist or you don't have access to it, 2) The page title already exists in this space, 3) The parent page ID is invalid (if provided), or 4) Required fields are missing. Please verify the space key exists, the page title is unique in the space, and all required fields are provided. Error details: ${error.message}`);
            }
            else if (error.status === 401) {
                throw new Error(`Authentication failed when creating Confluence page. Please check your CONFLUENCE_PAT environment variable contains a valid Personal Access Token with create permissions. Error details: ${error.message}`);
            }
            else if (error.status === 403) {
                throw new Error(`Access denied when creating page in space "${spaceKey}". Your account may not have permission to create pages in this space. Please contact your Confluence administrator or verify you have create permissions for this space. Error details: ${error.message}`);
            }
            throw new Error(`Failed to create Confluence page "${title}" in space "${spaceKey}": ${error.message}`);
        }
        throw new Error(`Unexpected error creating Confluence page "${title}" in space "${spaceKey}": ${error instanceof Error ? error.message : "Unknown error"}`);
    }
}
/**
 * FEATURE FLAG IMPLEMENTATION NOTES:
 * ==================================
 *
 * This module implements the "three_variation_feature_flag" with three different
 * markdown processing behaviors:
 *
 * 1. "on" (Default): Standard table processing with basic HTML structure
 *    - Simple <table><tbody> structure
 *    - Basic cell formatting with bold/italic support
 *    - Clean character replacement (quotes, dashes, etc.)
 *
 * 2. "variation_1" (Enhanced): Improved structure and CSS classes
 *    - Proper <table><thead><tbody> structure
 *    - CSS classes for styling: "enhanced-table", "header-cell", "data-cell"
 *    - Data attributes for column/row identification
 *    - Enhanced paragraph classes: "enhanced-paragraph"
 *    - Improved header attributes with data-level
 *
 * 3. "variation_2" (Advanced): Full accessibility and interactive features
 *    - Advanced table with sortable/responsive attributes
 *    - ARIA roles and accessibility features (role="columnheader", "gridcell", etc.)
 *    - Tabindex support for keyboard navigation
 *    - Advanced CSS classes: "advanced-table", "sortable", "interactive-row"
 *    - Rich data attributes for JavaScript interaction
 *    - Advanced list styling with data-type attributes
 *
 * Environment Variable Override:
 * Set CONFLUENCE_FEATURE_MODE to "on", "variation_1", "variation_2", or "off"
 * to override the flag behavior during development/testing.
 *
 * Example usage:
 * export CONFLUENCE_FEATURE_MODE="variation_2"
 *
 * Integration with Optimizely:
 * The getFeatureMode() function should be replaced with actual Optimizely SDK
 * integration to fetch the flag value based on user context.
 */
