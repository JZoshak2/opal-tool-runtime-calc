import { mdToPdf } from 'md-to-pdf';
import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import chromium from '@sparticuz/chromium';

type GeneratePdfParams = {
  markdown: string;
  filename?: string;
};

export async function generatePdfFromMarkdown(
  params: GeneratePdfParams
): Promise<{ pdfUrl: string; expiresAt: string }> {
  const { markdown, filename } = params;
  
  const pdfFilename = filename ? `${filename}.pdf` : `document-${randomUUID()}.pdf`;
  const tempDir = '/tmp';
  const outputPath = path.join(tempDir, pdfFilename);
  
  try {
    console.log('Starting PDF generation...');
    
    // Configure Chromium for Vercel
    const executablePath = await chromium.executablePath();
    console.log('Chromium executable path:', executablePath);
    
    // Read the Optimizely SVG logo
    // Use a workaround for __dirname in serverless environments
    const logoPath = path.join(process.cwd(), 'api', 'assets', 'optimizely_logo.svg');
    // Fallback: try reading from current directory if the above doesn't work
    let logoSvg: string;
    try {
      logoSvg = await fs.readFile(logoPath, 'utf8');
    } catch (error) {
      // If logo file doesn't exist, use an empty string or a default SVG
      console.warn('Could not read logo file, using default');
      logoSvg = ''; // You can add a default SVG here if needed
    }

    // Create custom CSS for professional document styling
    const customCSS = `
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
        line-height: 1.6;
        color: #333;
        margin: 0;
        padding: 20px;
      }
      .optimizely-header {
        display: flex;
        align-items: center;
        padding: 20px 0 30px 0;
        margin-bottom: 30px;
        border-bottom: 2px solid #eee;
      }
      .optimizely-header svg {
        height: 40px;
        width: auto;
      }
      h1, h2, h3, h4, h5, h6 {
        color: #1a1a1a;
        margin-top: 24px;
        margin-bottom: 12px;
      }
      h1 { font-size: 28px; }
      h2 { font-size: 24px; }
      h3 { font-size: 20px; }
      h4 { font-size: 18px; }
      p { margin-bottom: 12px; }
      code {
        background: #f5f5f5;
        padding: 2px 6px;
        border-radius: 3px;
        font-family: 'Monaco', 'Courier New', monospace;
        font-size: 0.9em;
      }
      pre {
        background: #f5f5f5;
        padding: 16px;
        border-radius: 6px;
        overflow-x: auto;
        margin: 16px 0;
      }
      pre code {
        background: none;
        padding: 0;
      }
      ul, ol { padding-left: 24px; margin-bottom: 12px; }
      li { margin-bottom: 6px; }
      strong { font-weight: 600; }
      em { font-style: italic; }
      blockquote {
        border-left: 4px solid #ddd;
        margin: 16px 0;
        padding-left: 16px;
        color: #666;
      }
      table {
        border-collapse: collapse;
        width: 100%;
        margin: 16px 0;
      }
      th, td {
        border: 1px solid #ddd;
        padding: 8px;
        text-align: left;
      }
      th {
        background-color: #f5f5f5;
        font-weight: 600;
      }
    `;

    // Prepend the Optimizely header to the markdown content
    const markdownWithHeader = `
<div class="optimizely-header">
  ${logoSvg}
</div>

${markdown}`;

    const pdf = await mdToPdf(
      { content: markdownWithHeader },
      {
        launch_options: {
          executablePath: executablePath || undefined,
          args: chromium.args,
          headless: true,
        },
        pdf_options: {
          format: 'A4',
          margin: {
            top: '15mm',
            right: '15mm',
            bottom: '20mm',
            left: '15mm'
          }
        },
        css: customCSS,
        marked_options: {
          headerIds: false,
          mangle: false
        }
      }
    );

    if (!pdf?.content) {
      console.error('PDF generation returned no content');
      throw new Error('Failed to generate PDF content');
    }

    console.log('PDF generated successfully, writing to file...');
    await fs.writeFile(outputPath, pdf.content);
    console.log('PDF written to:', outputPath);

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    // Use environment variable for base URL, fallback to Vercel URL pattern
    const baseUrl = process.env.BASE_URL || process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'http://localhost:3000';
    
    const fullPdfUrl = `${baseUrl}/pdfs/${pdfFilename}`;
    console.log('Generated PDF URL:', fullPdfUrl);

    return {
      pdfUrl: fullPdfUrl,
      expiresAt: expiresAt.toISOString()
    };
  } catch (error) {
    console.error('PDF generation error:', error);
    throw new Error(`PDF generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function cleanupExpiredPdfs(): Promise<void> {
  try {
    const tempDir = '/tmp';
    const files = await fs.readdir(tempDir);
    const pdfFiles = files.filter((file: string) => file.endsWith('.pdf') && file.includes('document-'));
    
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);
    
    for (const file of pdfFiles) {
      const filePath = path.join(tempDir, file);
      try {
        const stats = await fs.stat(filePath);
        if (stats.mtime < oneHourAgo) {
          await fs.unlink(filePath);
        }
      } catch (error) {
        // File might already be deleted, continue
      }
    }
  } catch (error) {
    // Cleanup is best effort, don't throw
  }
}