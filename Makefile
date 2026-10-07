.PHONY: install demo test benchmark build
install:
	npm ci
	python -m pip install -r requirements.txt
demo:
	python -m uvicorn backend.app:app --host 0.0.0.0 --port 8000
test:
	npm run check
	npm test
	python -m pytest tests/test_python.py -q
benchmark:
	npm run benchmark
build:
	npm run build
