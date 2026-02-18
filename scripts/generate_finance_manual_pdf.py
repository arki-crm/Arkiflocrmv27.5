#!/usr/bin/env python3
"""
Finance User Manual PDF Generator
Creates a professionally formatted PDF with:
- Clean professional formatting
- Proper headings and structured sections
- Table of contents with page numbers
- Page numbers
- Clear section separation
"""

import re
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm, mm
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, KeepTogether, ListFlowable, ListItem, Preformatted
)
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import os

# Paths
MANUAL_PATH = "/app/memory/FINANCE_USER_MANUAL.md"
OUTPUT_PATH = "/app/memory/FINANCE_USER_MANUAL.pdf"


class NumberedCanvas(canvas.Canvas):
    """Custom canvas for page numbers and headers."""
    
    def __init__(self, *args, **kwargs):
        canvas.Canvas.__init__(self, *args, **kwargs)
        self._saved_page_states = []
    
    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()
    
    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_number(num_pages)
            canvas.Canvas.showPage(self)
        canvas.Canvas.save(self)
    
    def draw_page_number(self, page_count):
        page_num = self._pageNumber
        # Skip page number on cover page
        if page_num == 1:
            return
        
        self.saveState()
        
        # Header
        self.setFont('Helvetica', 9)
        self.setFillColor(colors.HexColor('#666666'))
        self.drawCentredString(A4[0]/2, A4[1] - 1.2*cm, "Arkiflo Finance Module - User Manual")
        self.setStrokeColor(colors.HexColor('#dddddd'))
        self.line(2*cm, A4[1] - 1.5*cm, A4[0] - 2*cm, A4[1] - 1.5*cm)
        
        # Footer with page number
        self.setFont('Helvetica', 9)
        self.setFillColor(colors.HexColor('#666666'))
        self.drawCentredString(A4[0]/2, 1.5*cm, f"Page {page_num} of {page_count}")
        
        # Confidential notice
        self.setFont('Helvetica', 8)
        self.setFillColor(colors.HexColor('#999999'))
        self.drawRightString(A4[0] - 2*cm, 1.5*cm, "Confidential - Internal Use Only")
        
        self.restoreState()


def get_styles():
    """Create custom paragraph styles."""
    styles = getSampleStyleSheet()
    
    # Title style
    styles.add(ParagraphStyle(
        name='DocTitle',
        parent=styles['Title'],
        fontSize=28,
        leading=34,
        textColor=colors.HexColor('#1a365d'),
        alignment=TA_CENTER,
        spaceAfter=10,
    ))
    
    # Subtitle style
    styles.add(ParagraphStyle(
        name='DocSubtitle',
        parent=styles['Normal'],
        fontSize=14,
        leading=18,
        textColor=colors.HexColor('#4a5568'),
        alignment=TA_CENTER,
        spaceAfter=40,
    ))
    
    # H1 - Chapter style
    styles.add(ParagraphStyle(
        name='ChapterTitle',
        parent=styles['Heading1'],
        fontSize=22,
        leading=26,
        textColor=colors.HexColor('#1a365d'),
        spaceBefore=30,
        spaceAfter=15,
        borderColor=colors.HexColor('#2c5282'),
        borderWidth=2,
        borderPadding=8,
    ))
    
    # H2 - Section style
    styles.add(ParagraphStyle(
        name='SectionTitle',
        parent=styles['Heading2'],
        fontSize=16,
        leading=20,
        textColor=colors.HexColor('#2c5282'),
        spaceBefore=20,
        spaceAfter=10,
        leftIndent=10,
        borderColor=colors.HexColor('#4299e1'),
        borderWidth=3,
        borderPadding=5,
    ))
    
    # H3 - Subsection style
    styles.add(ParagraphStyle(
        name='SubsectionTitle',
        parent=styles['Heading3'],
        fontSize=13,
        leading=16,
        textColor=colors.HexColor('#2d3748'),
        spaceBefore=15,
        spaceAfter=8,
    ))
    
    # H4 style
    styles.add(ParagraphStyle(
        name='H4Title',
        parent=styles['Heading4'],
        fontSize=11,
        leading=14,
        textColor=colors.HexColor('#4a5568'),
        spaceBefore=10,
        spaceAfter=6,
        fontName='Helvetica-Bold',
    ))
    
    # Body text
    styles.add(ParagraphStyle(
        name='CustomBody',
        parent=styles['Normal'],
        fontSize=11,
        leading=15,
        textColor=colors.HexColor('#333333'),
        alignment=TA_JUSTIFY,
        spaceAfter=8,
    ))
    
    # Code block style
    styles.add(ParagraphStyle(
        name='CodeBlock',
        parent=styles['Code'],
        fontSize=9,
        leading=12,
        fontName='Courier',
        backColor=colors.HexColor('#f7fafc'),
        borderColor=colors.HexColor('#e2e8f0'),
        borderWidth=1,
        borderPadding=10,
        leftIndent=10,
        spaceAfter=10,
        spaceBefore=10,
    ))
    
    # Inline code
    styles.add(ParagraphStyle(
        name='InlineCode',
        parent=styles['Normal'],
        fontSize=10,
        fontName='Courier',
        backColor=colors.HexColor('#edf2f7'),
    ))
    
    # List item style
    styles.add(ParagraphStyle(
        name='ListItem',
        parent=styles['Normal'],
        fontSize=11,
        leading=14,
        textColor=colors.HexColor('#333333'),
        leftIndent=20,
        spaceAfter=4,
    ))
    
    # Table header style
    styles.add(ParagraphStyle(
        name='TableHeader',
        parent=styles['Normal'],
        fontSize=10,
        leading=12,
        textColor=colors.white,
        fontName='Helvetica-Bold',
    ))
    
    # Table cell style
    styles.add(ParagraphStyle(
        name='TableCell',
        parent=styles['Normal'],
        fontSize=10,
        leading=12,
        textColor=colors.HexColor('#333333'),
    ))
    
    # Important note
    styles.add(ParagraphStyle(
        name='Important',
        parent=styles['Normal'],
        fontSize=11,
        leading=14,
        textColor=colors.HexColor('#744210'),
        backColor=colors.HexColor('#fffaf0'),
        borderColor=colors.HexColor('#ed8936'),
        borderWidth=1,
        borderPadding=10,
        leftIndent=10,
        spaceAfter=10,
        spaceBefore=10,
    ))
    
    # Metadata style (version info)
    styles.add(ParagraphStyle(
        name='Metadata',
        parent=styles['Normal'],
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#4a5568'),
        alignment=TA_CENTER,
        spaceAfter=5,
    ))
    
    return styles


def parse_markdown(md_content):
    """Parse markdown and return structured content."""
    lines = md_content.split('\n')
    elements = []
    current_code_block = None
    current_table = None
    in_code_block = False
    
    i = 0
    while i < len(lines):
        line = lines[i]
        
        # Code block handling
        if line.strip().startswith('```'):
            if in_code_block:
                # End code block
                elements.append(('code', '\n'.join(current_code_block)))
                current_code_block = None
                in_code_block = False
            else:
                # Start code block
                in_code_block = True
                current_code_block = []
            i += 1
            continue
        
        if in_code_block:
            current_code_block.append(line)
            i += 1
            continue
        
        # Table handling
        if '|' in line and not line.strip().startswith('#'):
            table_lines = []
            while i < len(lines) and '|' in lines[i]:
                table_lines.append(lines[i])
                i += 1
            if table_lines:
                elements.append(('table', table_lines))
            continue
        
        # Headers
        if line.startswith('# '):
            elements.append(('h1', line[2:].strip()))
        elif line.startswith('## '):
            elements.append(('h2', line[3:].strip()))
        elif line.startswith('### '):
            elements.append(('h3', line[4:].strip()))
        elif line.startswith('#### '):
            elements.append(('h4', line[5:].strip()))
        # Horizontal rule
        elif line.strip() == '---':
            elements.append(('hr', None))
        # List items
        elif line.strip().startswith('- ') or line.strip().startswith('* '):
            list_items = []
            while i < len(lines) and (lines[i].strip().startswith('- ') or lines[i].strip().startswith('* ') or (lines[i].strip() and lines[i].startswith('  '))):
                list_items.append(lines[i].strip().lstrip('-* '))
                i += 1
            if list_items:
                elements.append(('list', list_items))
            continue
        # Numbered list
        elif re.match(r'^\d+\.', line.strip()):
            list_items = []
            while i < len(lines) and (re.match(r'^\d+\.', lines[i].strip()) or (lines[i].strip() and lines[i].startswith('  '))):
                item = re.sub(r'^\d+\.\s*', '', lines[i].strip())
                list_items.append(item)
                i += 1
            if list_items:
                elements.append(('numlist', list_items))
            continue
        # Regular paragraph
        elif line.strip():
            # Collect consecutive non-empty lines
            para_lines = [line.strip()]
            i += 1
            while i < len(lines) and lines[i].strip() and not lines[i].startswith('#') and not lines[i].strip().startswith('|') and not lines[i].strip().startswith('-') and not lines[i].strip().startswith('*') and not re.match(r'^\d+\.', lines[i].strip()) and lines[i].strip() != '---' and not lines[i].strip().startswith('```'):
                para_lines.append(lines[i].strip())
                i += 1
            elements.append(('p', ' '.join(para_lines)))
            continue
        
        i += 1
    
    return elements


def format_text(text):
    """Convert markdown inline formatting to reportlab markup."""
    # Bold
    text = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', text)
    # Italic
    text = re.sub(r'\*(.+?)\*', r'<i>\1</i>', text)
    # Inline code
    text = re.sub(r'`([^`]+)`', r'<font name="Courier" size="9" backColor="#edf2f7">\1</font>', text)
    # Links - just show text
    text = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', text)
    # Escape special chars
    text = text.replace('&', '&amp;')
    text = text.replace('<b>', '<<<B>>>').replace('</b>', '<<<EB>>>')
    text = text.replace('<i>', '<<<I>>>').replace('</i>', '<<<EI>>>')
    text = text.replace('<font', '<<<FONT').replace('</font>', '<<<EFONT>>>')
    text = text.replace('<', '&lt;').replace('>', '&gt;')
    text = text.replace('<<<B>>>', '<b>').replace('<<<EB>>>', '</b>')
    text = text.replace('<<<I>>>', '<i>').replace('<<<EI>>>', '</i>')
    text = text.replace('<<<FONT', '<font').replace('<<<EFONT>>>', '</font>')
    return text


def parse_table(table_lines):
    """Parse markdown table into data structure."""
    rows = []
    for line in table_lines:
        # Skip separator lines
        if re.match(r'^[\|\-\:\s]+$', line):
            continue
        cells = [c.strip() for c in line.split('|')]
        cells = [c for c in cells if c]  # Remove empty cells from edges
        if cells:
            rows.append(cells)
    return rows


def create_table(data, styles):
    """Create a styled table from data."""
    if not data:
        return None
    
    # Format cells
    formatted_data = []
    for i, row in enumerate(data):
        formatted_row = []
        for cell in row:
            if i == 0:
                formatted_row.append(Paragraph(format_text(cell), styles['TableHeader']))
            else:
                formatted_row.append(Paragraph(format_text(cell), styles['TableCell']))
        formatted_data.append(formatted_row)
    
    # Calculate column widths
    num_cols = max(len(row) for row in formatted_data)
    col_width = (A4[0] - 4*cm) / num_cols
    col_widths = [col_width] * num_cols
    
    table = Table(formatted_data, colWidths=col_widths, repeatRows=1)
    
    # Style
    style = TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2c5282')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('ALIGN', (0, 0), (-1, 0), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f7fafc')]),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
    ])
    table.setStyle(style)
    
    return table


def build_pdf(md_content, output_path):
    """Build PDF from parsed markdown content."""
    styles = get_styles()
    elements_data = parse_markdown(md_content)
    story = []
    
    is_first_h1 = True
    is_toc = False
    
    for elem_type, content in elements_data:
        if elem_type == 'h1':
            # Check if this is title or TOC
            if is_first_h1:
                story.append(Spacer(1, 2*cm))
                story.append(Paragraph(format_text(content), styles['DocTitle']))
                story.append(Spacer(1, 0.5*cm))
                # Add decorative line
                is_first_h1 = False
            elif content == 'Table of Contents':
                is_toc = True
                story.append(PageBreak())
                story.append(Paragraph(format_text(content), styles['ChapterTitle']))
            else:
                is_toc = False
                story.append(PageBreak())
                story.append(Paragraph(format_text(content), styles['ChapterTitle']))
        
        elif elem_type == 'h2':
            if is_first_h1:
                # This is the subtitle
                story.append(Paragraph(format_text(content), styles['DocSubtitle']))
                is_first_h1 = False
            else:
                story.append(Paragraph(format_text(content), styles['SectionTitle']))
        
        elif elem_type == 'h3':
            story.append(Paragraph(format_text(content), styles['SubsectionTitle']))
        
        elif elem_type == 'h4':
            story.append(Paragraph(format_text(content), styles['H4Title']))
        
        elif elem_type == 'p':
            # Check for metadata patterns
            if content.startswith('**Version:**') or content.startswith('**Last Updated:**') or content.startswith('**Audience:**'):
                story.append(Paragraph(format_text(content), styles['Metadata']))
            # Check for important notes
            elif content.startswith('**IMPORTANT:**') or content.startswith('IMPORTANT:'):
                story.append(Paragraph(format_text(content), styles['Important']))
            else:
                story.append(Paragraph(format_text(content), styles['BodyText']))
        
        elif elem_type == 'code':
            # Clean up code and preserve formatting
            code_text = content.replace('<', '&lt;').replace('>', '&gt;')
            code_text = code_text.replace('\t', '    ')
            story.append(Preformatted(code_text, styles['CodeBlock']))
        
        elif elem_type == 'table':
            table_data = parse_table(content)
            table = create_table(table_data, styles)
            if table:
                story.append(Spacer(1, 5*mm))
                story.append(table)
                story.append(Spacer(1, 5*mm))
        
        elif elem_type == 'list':
            for item in content:
                story.append(Paragraph(f"• {format_text(item)}", styles['ListItem']))
        
        elif elem_type == 'numlist':
            for idx, item in enumerate(content, 1):
                story.append(Paragraph(f"{idx}. {format_text(item)}", styles['ListItem']))
        
        elif elem_type == 'hr':
            story.append(Spacer(1, 10*mm))
    
    # Build PDF
    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        leftMargin=2*cm,
        rightMargin=2*cm,
        topMargin=2.5*cm,
        bottomMargin=2.5*cm,
        title="Finance Module User Manual",
        author="Arkiflo System",
        subject="Complete Operator Training Guide for Arkiflo Finance System"
    )
    
    doc.build(story, canvasmaker=NumberedCanvas)
    return output_path


def main():
    """Main function."""
    print("=" * 60)
    print("FINANCE USER MANUAL PDF GENERATOR")
    print("=" * 60)
    
    if not os.path.exists(MANUAL_PATH):
        print(f"❌ Error: Source file not found: {MANUAL_PATH}")
        return False
    
    print(f"📖 Reading markdown from: {MANUAL_PATH}")
    with open(MANUAL_PATH, 'r', encoding='utf-8') as f:
        md_content = f.read()
    print(f"   ✓ Read {len(md_content):,} characters")
    
    print(f"📄 Generating PDF: {OUTPUT_PATH}")
    build_pdf(md_content, OUTPUT_PATH)
    
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
