"""Generate clearly labelled PDF, Word and photo fixtures for document intake testing."""
from decimal import Decimal
from pathlib import Path
from xml.sax.saxutils import escape
import zipfile
from engine import load_workbook


def main():
    root = Path(__file__).resolve().parent
    folder = root / 'state/demo-invoices'
    folder.mkdir(parents=True, exist_ok=True)
    data = load_workbook(root / 'inputs/finance_enterprise_export.xlsx')
    vendors = {str(v['LIFNR']) for v in data['vendors']}
    po = next(p for p in data['po_headers'] if str(p['LIFNR']) in vendors
              and any(l['EBELN'] == p['EBELN'] for l in data['po_lines']))
    line = next(l for l in data['po_lines'] if l['EBELN'] == po['EBELN'])
    price = Decimal(str(line['NETPR'])) / Decimal(str(line['PEINH']))
    labels = ['SYNTHETIC TEST - DO NOT PAY', 'INVOICE', 'Invoice Number: TEST-DOC-001',
              'Vendor ID: ' + str(po['LIFNR']), 'PO Number: ' + str(po['EBELN']),
              'Currency: ' + str(po['WAERS']), 'Total: ' + str(price),
              'Invoice Date: 2026-10-10', 'Fiscal Year: 2026',
              f"Line: {line['EBELP']} | Qty: 1 | Unit Price: {price} | Unit: {line['MEINS']}"]
    from reportlab.pdfgen.canvas import Canvas
    canvas = Canvas(str(folder / 'test-invoice.pdf'))
    canvas.setFont('Helvetica', 12)
    for index, text in enumerate(labels):
        canvas.drawString(40, 800 - index * 28, text)
    canvas.save()
    from PIL import Image, ImageDraw, ImageFont
    image = Image.new('RGB', (1600, 1000), 'white')
    font = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 32)
    draw = ImageDraw.Draw(image)
    for index, text in enumerate(labels):
        draw.text((50, 50 + index * 65), text, fill='black', font=font)
    image.save(folder / 'test-invoice-photo.png')
    types = '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'
    relationships = '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'
    body = ''.join('<w:p><w:r><w:t xml:space="preserve">' + escape(text) + '</w:t></w:r></w:p>' for text in labels)
    document = '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' + body + '<w:sectPr/></w:body></w:document>'
    with zipfile.ZipFile(folder / 'test-invoice.docx', 'w', zipfile.ZIP_DEFLATED) as archive:
        archive.writestr('[Content_Types].xml', types)
        archive.writestr('_rels/.rels', relationships)
        archive.writestr('word/document.xml', document)
    canvas = Canvas(str(folder / 'non-invoice.pdf'))
    canvas.drawString(40, 800, 'Meeting agenda: discuss next week scheduling')
    canvas.save()
    print('Synthetic test documents created in ' + str(folder))


if __name__ == '__main__':
    main()
