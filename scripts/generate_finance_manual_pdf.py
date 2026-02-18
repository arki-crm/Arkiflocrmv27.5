#!/usr/bin/env python3
"""
Finance User Manual PDF Generator
Converts the Markdown manual to a professionally formatted PDF with:
- Clean professional formatting
- Proper headings and structured sections
- Table of contents
- Page numbers
- Clear section separation
"""

import markdown
from weasyprint import HTML, CSS
from weasyprint.text.fonts import FontConfiguration
import os

# Paths
MANUAL_PATH = "/app/memory/FINANCE_USER_MANUAL.md"
OUTPUT_PATH = "/app/memory/FINANCE_USER_MANUAL.pdf"

# Professional CSS styling
CSS_STYLES = """
@page {
    size: A4;
    margin: 2.5cm 2cm 3cm 2cm;
    
    @top-center {
        content: "Arkiflo Finance Module - User Manual";
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        font-size: 9pt;
        color: #666;
        border-bottom: 1px solid #ddd;
        padding-bottom: 5mm;
    }
    
    @bottom-center {
        content: "Page " counter(page) " of " counter(pages);
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        font-size: 9pt;
        color: #666;
    }
    
    @bottom-right {
        content: "Confidential - Internal Use Only";
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        font-size: 8pt;
        color: #999;
    }
}

@page:first {
    @top-center {
        content: "";
        border-bottom: none;
    }
}

* {
    box-sizing: border-box;
}

body {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    font-size: 11pt;
    line-height: 1.6;
    color: #333;
    max-width: 100%;
}

/* Title Page Styling */
h1:first-of-type {
    font-size: 28pt;
    color: #1a365d;
    text-align: center;
    margin-top: 3cm;
    margin-bottom: 0.5cm;
    border-bottom: 3px solid #2c5282;
    padding-bottom: 0.5cm;
    page-break-after: avoid;
}

h1:first-of-type + h2:first-of-type {
    text-align: center;
    font-size: 14pt;
    color: #4a5568;
    font-weight: normal;
    margin-bottom: 2cm;
}

/* Main Headings - Chapter Level */
h1 {
    font-size: 22pt;
    color: #1a365d;
    border-bottom: 2px solid #2c5282;
    padding-bottom: 8px;
    margin-top: 1.5cm;
    margin-bottom: 0.8cm;
    page-break-before: always;
    page-break-after: avoid;
}

/* First h1 (title) should not page break before */
h1:first-of-type {
    page-break-before: avoid;
}

/* Section Headings */
h2 {
    font-size: 16pt;
    color: #2c5282;
    border-left: 4px solid #4299e1;
    padding-left: 12px;
    margin-top: 1cm;
    margin-bottom: 0.5cm;
    page-break-after: avoid;
}

/* Subsection Headings */
h3 {
    font-size: 13pt;
    color: #2d3748;
    margin-top: 0.8cm;
    margin-bottom: 0.4cm;
    page-break-after: avoid;
}

h4 {
    font-size: 11pt;
    color: #4a5568;
    font-weight: 600;
    margin-top: 0.5cm;
    margin-bottom: 0.3cm;
}

/* Paragraphs */
p {
    margin-bottom: 0.4cm;
    text-align: justify;
    orphans: 3;
    widows: 3;
}

/* Strong/Bold Text */
strong {
    color: #1a365d;
}

/* Tables */
table {
    width: 100%;
    border-collapse: collapse;
    margin: 0.5cm 0;
    font-size: 10pt;
    page-break-inside: avoid;
}

thead {
    background-color: #2c5282;
    color: white;
}

th {
    padding: 10px 12px;
    text-align: left;
    font-weight: 600;
    border: 1px solid #2c5282;
}

td {
    padding: 8px 12px;
    border: 1px solid #e2e8f0;
    vertical-align: top;
}

tbody tr:nth-child(even) {
    background-color: #f7fafc;
}

tbody tr:hover {
    background-color: #edf2f7;
}

/* Code Blocks */
pre {
    background-color: #f7fafc;
    border: 1px solid #e2e8f0;
    border-left: 4px solid #4299e1;
    padding: 12px 15px;
    font-family: 'Consolas', 'Monaco', monospace;
    font-size: 9.5pt;
    line-height: 1.5;
    overflow-x: auto;
    margin: 0.5cm 0;
    border-radius: 4px;
    page-break-inside: avoid;
}

code {
    font-family: 'Consolas', 'Monaco', monospace;
    background-color: #edf2f7;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 9.5pt;
}

pre code {
    background-color: transparent;
    padding: 0;
}

/* Lists */
ul, ol {
    margin: 0.4cm 0;
    padding-left: 1.2cm;
}

li {
    margin-bottom: 0.2cm;
}

/* Nested lists */
li ul, li ol {
    margin-top: 0.2cm;
    margin-bottom: 0.2cm;
}

/* Horizontal Rules - Section Separators */
hr {
    border: none;
    border-top: 2px solid #e2e8f0;
    margin: 1cm 0;
}

/* Blockquotes for important notes */
blockquote {
    border-left: 4px solid #ed8936;
    background-color: #fffaf0;
    padding: 10px 15px;
    margin: 0.5cm 0;
    font-style: italic;
    color: #744210;
}

/* Links */
a {
    color: #2c5282;
    text-decoration: none;
}

/* Table of Contents specific styling */
h1#table-of-contents {
    page-break-before: avoid;
}

/* Status indicators in tables */
td:contains("✅"), td:contains("❌"), td:contains("⏳"), td:contains("⚠️") {
    text-align: center;
}

/* Version info styling */
p:first-of-type strong:first-child {
    color: #2c5282;
}

/* Emoji handling */
.emoji {
    font-style: normal;
}

/* Print optimization */
@media print {
    body {
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
    }
}
"""


def read_markdown_file(filepath):
    """Read and return markdown content from file."""
    with open(filepath, 'r', encoding='utf-8') as f:
        return f.read()


def convert_md_to_html(md_content):
    """Convert markdown to HTML with extensions."""
    md = markdown.Markdown(
        extensions=[
            'tables',
            'fenced_code',
            'codehilite',
            'toc',
            'nl2br',
            'sane_lists',
        ],
        extension_configs={
            'codehilite': {
                'css_class': 'highlight',
                'guess_lang': False,
            },
            'toc': {
                'title': 'Table of Contents',
                'toc_depth': 3,
            },
        }
    )
    
    html_content = md.convert(md_content)
    return html_content


def create_pdf(html_content, output_path):
    """Generate PDF from HTML content with professional styling."""
    font_config = FontConfiguration()
    
    # Wrap HTML in proper document structure
    full_html = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>Finance Module User Manual</title>
    </head>
    <body>
        {html_content}
    </body>
    </html>
    """
    
    # Generate PDF
    html_doc = HTML(string=full_html)
    css = CSS(string=CSS_STYLES, font_config=font_config)
    
    html_doc.write_pdf(output_path, stylesheets=[css], font_config=font_config)
    
    return output_path


def main():
    """Main function to generate the PDF."""
    print("=" * 60)
    print("FINANCE USER MANUAL PDF GENERATOR")
    print("=" * 60)
    
    # Check if source file exists
    if not os.path.exists(MANUAL_PATH):
        print(f"❌ Error: Source file not found: {MANUAL_PATH}")
        return False
    
    print(f"📖 Reading markdown from: {MANUAL_PATH}")
    md_content = read_markdown_file(MANUAL_PATH)
    print(f"   ✓ Read {len(md_content):,} characters")
    
    print("🔄 Converting Markdown to HTML...")
    html_content = convert_md_to_html(md_content)
    print(f"   ✓ Generated {len(html_content):,} characters of HTML")
    
    print(f"📄 Generating PDF: {OUTPUT_PATH}")
    create_pdf(html_content, OUTPUT_PATH)
    
    # Verify output
    if os.path.exists(OUTPUT_PATH):
        file_size = os.path.getsize(OUTPUT_PATH)
        print(f"   ✓ PDF created successfully!")
        print(f"   ✓ File size: {file_size:,} bytes ({file_size/1024:.1f} KB)")
        print("=" * 60)
        print(f"✅ SUCCESS: PDF saved to {OUTPUT_PATH}")
        print("=" * 60)
        return True
    else:
        print("❌ Error: PDF file was not created")
        return False


if __name__ == "__main__":
    main()
