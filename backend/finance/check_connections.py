"""Read-only credential checks; never send a message or display a token."""
import argparse
import json
import os
from pathlib import Path
import sys
from urllib.request import Request, urlopen
from environment import load_environment


def main():
    load_environment()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--telegram-chats', action='store_true')
    args = parser.parse_args()
    if args.telegram_chats:
        token = os.environ.get('TELEGRAM_BOT_TOKEN', '')
        if not token:
            print('Set TELEGRAM_BOT_TOKEN in .env first.'); raise SystemExit(2)
        try:
            request = Request('https://api.telegram.org/bot' + token + '/getUpdates',
                              data=b'{"timeout":0,"limit":100}', headers={'Content-Type': 'application/json'})
            with urlopen(request, timeout=20) as response:
                result = json.load(response)
            if result.get('ok') is not True:
                raise ValueError('Telegram rejected request')
            chats = {}
            for update in result.get('result', []):
                message = update.get('message') or update.get('channel_post') or {}
                chat = message.get('chat', {})
                if 'id' in chat:
                    chats[str(chat['id'])] = chat.get('type')
            print(json.dumps({'chat_ids': chats, 'next_action': 'Set TELEGRAM_CHAT_ID to your intended chat ID'}, indent=2))
        except Exception as error:
            # HTTP exception text can include the bot token in the request URL.
            print(json.dumps({'status': 'FAILED', 'error_type': type(error).__name__,
                              'next_action': 'Check token, network and any active webhook; no message was sent'}))
            raise SystemExit(2)
    else:
        root = Path(__file__).parent / 'workbuddy/scripts'
        sys.path.insert(0, str(root))
        from notifications import validate_connections
        print(json.dumps(validate_connections(), indent=2))


if __name__ == '__main__':
    main()
