"""Local document extraction. Ambiguous documents stop before specialist checks."""
from pathlib import Path
import re
import zipfile
import xml.etree.ElementTree as ET
try:
    from .engine import file_hash
except ImportError:
    from engine import file_hash

_ocr = None


def image_text(image):
    global _ocr
    if _ocr is None:
        from rapidocr import RapidOCR
        _ocr = RapidOCR()
    result = _ocr(image)
    texts = result.txts if result.txts is not None else []
    scores = result.scores if result.scores is not None else []
    return '\n'.join(str(t) for t, s in zip(texts, scores) if float(s) >= 0.7)


def extract_text(path):
    path = Path(path)
    if path.stat().st_size > 50 * 1024 * 1024:
        raise ValueError('Document exceeds 50 MB intake limit')
    suffix = path.suffix.lower()
    if suffix in ('.png', '.jpg', '.jpeg', '.tif', '.tiff', '.webp'):
        return image_text(str(path)), 'OCR'
    if suffix == '.pdf':
        from pypdf import PdfReader
        reader = PdfReader(path)
        if reader.is_encrypted or len(reader.pages) > 25:
            raise ValueError('Encrypted PDF or PDF over 25 pages requires separate review')
        chunks = []; used_ocr = False
        for page in reader.pages:
            text = page.extract_text() or ''
            if text.strip():
                chunks.append(text)
            else:
                used_ocr = True
                images = list(page.images)
                if len(images) > 20:
                    raise ValueError('PDF page has too many images')
                chunks.extend(image_text(image.data) for image in images)
        return '\n'.join(chunks), 'OCR' if used_ocr else 'PDF_TEXT'
    if suffix == '.docx':
        with zipfile.ZipFile(path) as archive:
            if sum(info.file_size for info in archive.infolist()) > 100 * 1024 * 1024:
                raise ValueError('Word document uncompressed size exceeds limit')
            root = ET.fromstring(archive.read('word/document.xml'))
            namespace = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
            text = '\n'.join(''.join(p.itertext()) for p in root.findall('.//w:p', namespace))
            media = [name for name in archive.namelist() if name.startswith('word/media/')]
            if not text.strip() and media:
                if len(media) > 20:
                    raise ValueError('Word document has too many images')
                return '\n'.join(image_text(archive.read(name)) for name in media), 'OCR'
            return text, 'WORD_TEXT'
    raise ValueError('Unsupported invoice format; use PDF, DOCX or a supported photo')


def parse_invoice(text, source_ref, method):
    title = re.search(r'^\s*(?:tax\s+)?invoice\s*$', text, re.I | re.M)
    numbered = re.search(r'^\s*invoice\s*(?:number|no\.?|#)\s*[:#]\s*(\S+)', text, re.I | re.M)
    if not title and not numbered:
        return {'status': 'NON_INVOICE_STOPPED', 'source_ref': source_ref, 'method': method}
    invoice = {'source_ref': source_ref, 'DOCUMENT_EXTRACTION_METHOD': method}
    labels = {'BELNR': r'Invoice ID', 'XBLNR': r'Invoice (?:Number|No\.?)', 'LIFNR': r'Vendor ID',
              'EBELN': r'PO (?:Number|No\.?)', 'WAERS': r'Currency', 'WRBTR': r'(?:Grand Total|Total)',
              'BLDAT': r'Invoice Date', 'GL_CODE': r'GL Code', 'KOSTL': r'Cost Centre',
              'BANK_ON_INV': r'Bank Account', 'GJAHR': r'Fiscal Year'}
    conflicts = []
    for field, label in labels.items():
        matches = re.findall(r'^\s*' + label + r'\s*:\s*([^\r\n]+)', text, re.I | re.M)
        unique = set(value.strip() for value in matches)
        if len(unique) == 1:
            invoice[field] = unique.pop()
        elif len(unique) > 1:
            conflicts.append(field)
    if not invoice.get('BELNR'):
        invoice['BELNR'] = invoice.get('XBLNR')
    if not invoice.get('BELNR') or conflicts:
        return {'status': 'DOCUMENT_REVIEW_REQUIRED_STOPPED', 'source_ref': source_ref,
                'method': method, 'conflicting_fields': conflicts}
    lines = []
    for number, quantity, price, unit in re.findall(
            r'Line\s*:\s*(\S+)\s*\|\s*Qty\s*:\s*(\S+)\s*\|\s*Unit Price\s*:\s*(\S+)\s*\|\s*Unit\s*:\s*(\S+)', text, re.I):
        lines.append({'EBELP': number, 'MENGE': quantity, 'NETPR': price, 'MEINS': unit,
                      'source_ref': source_ref + '::line' + str(len(lines) + 1)})
    if lines:
        invoice['LINES'] = lines
    return {'status': 'INVOICE_CANDIDATE', 'source_ref': source_ref, 'method': method, 'invoice': invoice}


def read_documents(folder):
    results = []; invoices = []; manifest = []
    for path in sorted(Path(folder).iterdir()):
        if not path.is_file():
            continue
        source_ref = path.name + '::sha256:' + file_hash(path)
        manifest.append({'path': str(path.resolve()), 'sha256': file_hash(path), 'role': 'INVOICE_DOCUMENT'})
        try:
            text, method = extract_text(path)
            result = parse_invoice(text, source_ref, method)
        except Exception as error:
            result = {'status': 'EXTRACTION_FAILED_STOPPED', 'source_ref': source_ref,
                      'error_type': type(error).__name__}
        if result.get('invoice'):
            invoices.append(result.pop('invoice'))
        results.append(result)
    return invoices, results, manifest
