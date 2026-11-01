#!/usr/bin/env python3
"""Generate a Korean review PDF from the committed questionnaire Markdown."""
from pathlib import Path
import re
from xml.sax.saxutils import escape
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, KeepTogether
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.pagesizes import A4

root = Path(__file__).resolve().parents[1]
source = root / "docs/questionnaire-review-v1.2.0.md"
output = root / "docs/questionnaire-review-v1.2.0.pdf"
font = next((p for p in [
    Path("/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"),
    Path("/usr/share/fonts/truetype/nanum/NanumGothic.ttf"),
    Path("/usr/share/fonts/truetype/nanum/NanumBarunGothic.ttf"),
] if p.exists()), None)
if font is None:
    raise SystemExit("Korean font missing; install fonts-nanum or fonts-noto-cjk")
pdfmetrics.registerFont(TTFont("Korean", str(font), subfontIndex=0))
styles = {
 "title": ParagraphStyle("T",fontName="Korean",fontSize=19,leading=27,spaceAfter=14,textColor=colors.HexColor("#17335B")),
 "section": ParagraphStyle("S",fontName="Korean",fontSize=14,leading=21,spaceBefore=17,spaceAfter=9,textColor=colors.HexColor("#17335B")),
 "question": ParagraphStyle("Q",fontName="Korean",fontSize=10.7,leading=17,spaceBefore=12,spaceAfter=7,textColor=colors.HexColor("#1E293B")),
 "body": ParagraphStyle("B",fontName="Korean",fontSize=9.4,leading=15,spaceAfter=5),
 "small": ParagraphStyle("N",fontName="Korean",fontSize=8.5,leading=13,spaceAfter=6,textColor=colors.HexColor("#475569")),
}
def fmt(s):
    s=escape(s)
    s=re.sub(r"\\*\\*(.*?)\\*\\*",r"<b>\\1</b>",s)
    s=re.sub(r"`([^`]+)`",r"\\1",s)
    return s
story=[]
for raw in source.read_text(encoding="utf-8").splitlines():
    line=raw.strip()
    if not line:continue
    if line.startswith("|"):
        # Classification table remains legible as plain text.
        if set(line.replace("|","").replace("-","").replace(":","").strip())==set():continue
        line=" / ".join(c.strip() for c in line.strip("|").split("|"))
    if line.startswith("# "):style="title";line=line[2:]
    elif line.startswith("## "):style="section";line=line[3:]
    elif line.startswith("### "):style="question";line=line[4:]
    elif line.startswith(">"):style="small";line=line.lstrip("> ")
    else:style="body"
    story.append(Paragraph(fmt(line),styles[style]))
def footer(canvas,doc):
    canvas.saveState();canvas.setFont("Korean",8);canvas.setFillColor(colors.grey)
    canvas.drawRightString(A4[0]-40,27,f"{doc.page}");canvas.restoreState()
SimpleDocTemplate(str(output),pagesize=A4,rightMargin=42,leftMargin=42,topMargin=43,bottomMargin=43,title="YingYang 검진 문제집 v1.2.0").build(story,onFirstPage=footer,onLaterPages=footer)
print(output)
