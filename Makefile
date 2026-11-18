.PHONY: install test web site api validate evidence all
install:   ; pip install -r requirements.txt
test:      ; python -m pytest -q && node web/parity_test.js
validate:  ; python scripts/export_web_data.py 2000
web:       ; python scripts/export_golden.py && python scripts/export_intake_golden.py && python scripts/export_web_data.py 2000
evidence:  ; python scripts/evidence_pack.py
api:       ; uvicorn api.main:app --reload --port 8000
site:      ; cd site && npm run build
all: web test
