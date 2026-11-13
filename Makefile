.PHONY: install test web api validate all
install:   ; pip install -r requirements.txt
test:      ; python -m pytest -q && node web/parity_test.js
validate:  ; python scripts/export_web_data.py 2000
web:       ; python scripts/export_golden.py && python scripts/export_web_data.py 2000 && python scripts/build_web.py
api:       ; uvicorn api.main:app --reload --port 8000
all: web test
