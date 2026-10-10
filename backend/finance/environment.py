"""Load local credentials without printing them; importing this module does no I/O."""
import os
from pathlib import Path


def load_environment(path=None):
    directory = Path(__file__).parent
    source = Path(path) if path else directory / 'local.env'
    if path is None and not source.is_file():
        source = directory / '.env'
    if source.is_file():
        for line in source.read_text(encoding='utf-8-sig').splitlines():
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            key, separator, value = line.partition('=')
            if not separator or not key.strip().replace('_', '').isalnum():
                raise ValueError('Invalid local environment entry')
            value = value.strip()
            if len(value) >= 2 and value[0] == value[-1] and value[0] in ('"', "'"):
                value = value[1:-1]
            if value:
                os.environ.setdefault(key.strip(), value)
    for first, second in [('TELEGRAM_BOT_TOKEN', 'IA_TELEGRAM_BOT_TOKEN'),
                          ('TELEGRAM_CHAT_ID', 'IA_TELEGRAM_CHAT_ID'),
                          ('MICROSOFT_OUTLOOK_TOKEN', 'IA_GRAPH_ACCESS_TOKEN'),
                          ('OUTLOOK_RECIPIENTS', 'IA_OUTLOOK_RECIPIENTS')]:
        value = os.environ.get(first) or os.environ.get(second)
        if value:
            os.environ.setdefault(first, value)
            os.environ.setdefault(second, value)
