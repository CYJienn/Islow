# Local OneDrive and Telegram flow

Edit ONEDRIVE_WORKBOOK and INVOICE_INPUT_DIR in local.env and .env to set the two paths. Config.json provides fallback paths. Windows paths in JSON need doubled backslashes, or use forward slashes:

    "workbook": "C:/Users/chuay/OneDrive/InvoiceAssurance/Input/finance_enterprise_export.xlsx",
    "invoice_input_dir": "C:/Users/chuay/OneDrive/InvoiceAssurance/Invoices"

The Windows OneDrive client syncs these folders. Make files available offline. No OneDrive token, Microsoft token or Outlook setup is needed.

1. Read finance_enterprise_export.xlsx as the comparison reference.
2. Read PDF/DOCX/photo invoices from invoice_input_dir; stop non-invoices.
3. Compare invoice identities, currencies, purchase orders and totals with the workbook, then run matching, vendor/fraud and accounting checks.
4. Review supplied invoice risk using GPT-6 Luna when OPENAI_API_KEY is configured. Test-mode samples skip live AI calls.
5. Generate results in the frontend Finance panel and an Excel report; unresolved evidence remains visible. Complete supplied invoices only enter finance_export.json.
6. Send a Telegram review/risk alert with per-invoice results and exact-report approval buttons.
7. Review the Finance panel in the existing Kaunter frontend. Use Approve report or Reject report beneath the notification in your configured private Telegram chat. Approve sends the final summary. Legacy exact /approve and /reject commands also remain supported. Only the configured private sender is accepted. Approval never clears findings or authorizes payment.

Start START.ps1 and keep the server running for Telegram replies. Only one process should poll this bot. Existing webhooks prevent getUpdates polling. Messages sent while the server is offline are ignored at next startup; send your approval again while it is running. No scheduled analysis or folder watcher is enabled.

Both local.env and .env contain TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, OPENAI_API_KEY, ONEDRIVE_ACCOUNT, ONEDRIVE_WORKBOOK and INVOICE_INPUT_DIR. The account field is a display label/email, not authentication. No weekly notifications run. Restart after changing settings.

The sample-invoice.docx in the configured invoice folder is SYNTHETIC TEST data copied from workbook header values. The current config uses document_dataset_kind=TEST to keep it out of the accepted export and avoid live AI charges. Move the sample elsewhere before using real invoices and set document_dataset_kind=SUPPLIED. Do not mix demo and real invoices in this folder.

Limits: initial parsing requires labelled fields. Extracted fields and missing lines/bank verification remain unresolved; no extraction-verification UI clears them yet. Approval is for the report only. Telegram shows per-invoice Excel comparison results separately from overall verification, and no standalone dashboard URL. Manager/orchestrator messages remain pending unless an actual dispatch capability is available.

Frontend preview: run START.ps1 in one terminal and FRONTEND.ps1 in another. Open http://localhost:8765 and click Finance. Vite also supports the Finance panel through the main FastAPI /api/v1/finance bridge when backend 8000 and the finance processor are running.

OneDrive token for manual API testing: open https://developer.microsoft.com/en-us/graph/graph-explorer in a normal browser, sign in to your personal Microsoft account, choose profile > Consent to permissions > Files.Read, grant consent, then copy the Access token tab value to ONEDRIVE_ACCESS_TOKEN in local.env and .env without Bearer. It expires and is not consumed by the local synced-folder flow. Direct OneDrive API retrieval and refresh are not implemented.

Final Results and Batch Summary in the Excel report show per-invoice reference verdicts and deduplicated suspected exposure, separating TEST from SUPPLIED. final-report.md is an immutable report artifact. A matching header is not a fully verified invoice. Confirmed fraud is not established by these checks.

After exact-report approval, Telegram sends the final summary and report.xlsx as a document. Attachment delivery is tracked separately and acknowledged attachments are not resent automatically.
