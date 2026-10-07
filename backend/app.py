"""Python API adapter. The TypeScript core is shared with the hosted demo.

Runtime triage accepts only the normalized alert contract. Generation and
evaluation are explicit, separate CLI commands; no label fields are accepted.
"""
from __future__ import annotations
import asyncio
import json
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
from typing import Annotated, Literal
import httpx
from fastapi import FastAPI, HTTPException, Request, Response
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

ROOT = Path(__file__).resolve().parents[1]

class Provenance(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    file_sha256: Annotated[str, Field(pattern=r"^[a-f0-9]{64}$")]
    record: Annotated[int, Field(ge=1)]
    page: Annotated[int | None, Field(ge=1)] = None
    adapter: Annotated[str, Field(max_length=80)]
    original_severity: Annotated[str, Field(max_length=100)]
    timestamp_basis: Annotated[str, Field(max_length=100)]
    warnings: Annotated[list[Annotated[str, Field(max_length=250)]], Field(max_length=20)]

class Alert(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    alert_id: Annotated[str, Field(min_length=1, max_length=100)]
    timestamp: str
    source: Literal["edr", "idp", "ids"]
    alert_type: Annotated[str, Field(min_length=1, max_length=80)]
    severity: Annotated[int, Field(ge=0, le=4)]
    entities: Annotated[list[Annotated[str, Field(pattern=r"^(user|host|ip):[^\s]{1,100}$")]], Field(max_length=8)]
    asset_criticality: Annotated[int | None, Field(ge=1, le=4)] = None
    description: Annotated[str, Field(max_length=2000)]
    raw_reference: Annotated[str | None, Field(max_length=250)] = None

    technique_ids: Annotated[list[Annotated[str, Field(pattern=r"^T\d{4}(?:\.\d{3})?$")]] | None, Field(max_length=20)] = None
    provenance: Provenance | None = None

    @field_validator("entities")
    @classmethod
    def distinct_entities(cls, values):
        if len(values) != len(set(values)):
            raise ValueError("Duplicate typed entities")
        return values

    @field_validator("timestamp")
    @classmethod
    def utc_timestamp(cls, value: str) -> str:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            raise ValueError("timestamp must include a UTC offset")
        return value

class Batch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    alerts: Annotated[list[Alert], Field(min_length=1, max_length=10000)]

    @model_validator(mode="after")
    def unique_ids(self):
        ids = [a.alert_id for a in self.alerts]
        if len(ids) != len(set(ids)):
            raise ValueError("Duplicate alert IDs")
        return self

async def bridge(payload: dict) -> dict:
    process = await asyncio.create_subprocess_exec(
        "node", "--import", "tsx", "scripts/cli.ts", cwd=ROOT,
        stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
    )
    try:
        output, error = await asyncio.wait_for(process.communicate(json.dumps(payload).encode()), timeout=45)
    except TimeoutError:
        process.kill()
        await process.wait()
        raise HTTPException(504, "Engine timed out")
    if process.returncode:
        raise HTTPException(422, "Engine rejected the input")
    return json.loads(output)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # The Node service owns the same durable SQLite store and full dashboard API.
    process = None
    async with httpx.AsyncClient(timeout=1) as client:
        try:
            existing = await client.get("http://127.0.0.1:5173/api/health")
            ready = existing.is_success and existing.json().get("config_version") == "utopia-2.0-constrained"
        except (httpx.HTTPError, ValueError):
            ready = False
    if not ready:
        process = await asyncio.create_subprocess_exec("node", "--import", "tsx", "server/local.ts", cwd=ROOT)
    async with httpx.AsyncClient() as client:
        for _ in range(100):
            try:
                if (await client.get("http://127.0.0.1:5173/api/health")).is_success:
                    break
            except httpx.ConnectError:
                pass
            await asyncio.sleep(0.1)
        else:
            if process is not None:
                process.terminate()
            raise RuntimeError("Local engine did not become ready")
    yield
    if process is not None and process.returncode is None:
        process.terminate()
        try:
            await asyncio.wait_for(process.wait(), 5)
        except TimeoutError:
            process.kill()
            await process.wait()

app = FastAPI(title="Utopia SOC", version="2.0.0", lifespan=lifespan,
              description="Transparent triage. Operational inputs contain no evaluation labels.")

@app.post("/v1/triage")
async def triage(batch: Batch):
    return await bridge({"command": "triage", "alerts": [a.model_dump(exclude_none=True) for a in batch.alerts]})

@app.get("/v1/health")
async def health():
    return {"ok": True, "config_version": "utopia-2.0-constrained", "engine": "shared TypeScript core"}

@app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def proxy(path: str, request: Request):
    payload = await request.body()
    if len(payload) > 5_000_000:
        raise HTTPException(413, "Input exceeds 5 MB")
    # Local adapter only; authenticated hosted traffic is handled by Sites.
    headers = {k: v for k, v in request.headers.items() if k.lower() not in {"host", "origin", "content-length"}}
    async with httpx.AsyncClient(timeout=60) as client:
        target = f"http://127.0.0.1:5173/{path}"
        if request.url.query:
            target += "?" + request.url.query
        try:
            response = await client.request(request.method, target, content=payload, headers=headers)
        except httpx.HTTPError:
            raise HTTPException(503, "Local engine is unavailable")
    return Response(response.content, status_code=response.status_code,
                    headers={k: v for k, v in response.headers.items() if k.lower() not in {"transfer-encoding", "content-encoding", "content-length"}})
