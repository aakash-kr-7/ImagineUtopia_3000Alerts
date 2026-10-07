# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim
RUN --mount=type=secret,id=proxy_ca \
    apt-get update && apt-get install -y --no-install-recommends python3 python3-venv ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=secret,id=proxy_ca \
    if [ -f /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; npm ci --strict-ssl=true --no-audit --no-fund
COPY requirements.txt ./
RUN --mount=type=secret,id=proxy_ca \
    if [ -f /run/secrets/proxy_ca ]; then export PIP_CERT=/run/secrets/proxy_ca; fi; python3 -m venv /app/.venv && /app/.venv/bin/pip install --no-cache-dir -r requirements.txt
COPY --chown=node:node . .
RUN chown node:node /app && mkdir -p runtime && chown node:node runtime
USER node
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:8000/v1/health',{signal:AbortSignal.timeout(4000)}).then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["/app/.venv/bin/python", "-m", "uvicorn", "backend.app:app", "--host", "0.0.0.0", "--port", "8000"]
