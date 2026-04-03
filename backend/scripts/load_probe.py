#!/usr/bin/env python3
import concurrent.futures
import json
import math
import statistics
import sys
import time
import urllib.error
import urllib.request


def percentile(values, pct):
    if not values:
        return None
    if len(values) == 1:
        return values[0]
    rank = (len(values) - 1) * pct
    lower = math.floor(rank)
    upper = math.ceil(rank)
    if lower == upper:
        return values[int(rank)]
    lower_value = values[lower]
    upper_value = values[upper]
    return lower_value + (upper_value - lower_value) * (rank - lower)


def run_once(url):
    started = time.perf_counter()
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "canopytrove-load-probe/1.0",
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            elapsed_ms = (time.perf_counter() - started) * 1000
            return {
                "ok": response.status == 200,
                "status": response.status,
                "latency_ms": elapsed_ms,
            }
    except urllib.error.HTTPError as error:
        elapsed_ms = (time.perf_counter() - started) * 1000
        return {
            "ok": False,
            "status": error.code,
            "latency_ms": elapsed_ms,
        }
    except Exception as error:  # noqa: BLE001
        elapsed_ms = (time.perf_counter() - started) * 1000
        return {
            "ok": False,
            "status": None,
            "latency_ms": elapsed_ms,
            "error": str(error),
        }


def main():
    if len(sys.argv) != 4:
      raise SystemExit("usage: load_probe.py <url> <total_requests> <concurrency>")

    url = sys.argv[1]
    total_requests = int(sys.argv[2])
    concurrency = int(sys.argv[3])

    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as executor:
        futures = [executor.submit(run_once, url) for _ in range(total_requests)]
        for future in concurrent.futures.as_completed(futures):
            results.append(future.result())

    latencies = sorted(
        entry["latency_ms"] for entry in results if entry.get("status") == 200 and entry["latency_ms"]
    )

    ok = sum(1 for entry in results if entry.get("status") == 200)
    rate_limited = sum(1 for entry in results if entry.get("status") == 429)
    other_failures = len(results) - ok - rate_limited

    payload = {
        "url": url,
        "totalRequests": total_requests,
        "concurrency": concurrency,
        "ok": ok,
        "rateLimited": rate_limited,
        "otherFailures": other_failures,
        "latencyMs": {
            "avg": round(statistics.fmean(latencies), 1) if latencies else None,
            "p50": round(percentile(latencies, 0.5), 1) if latencies else None,
            "p95": round(percentile(latencies, 0.95), 1) if latencies else None,
            "max": round(max(latencies), 1) if latencies else None,
        },
    }
    print(json.dumps(payload, separators=(",", ":")))


if __name__ == "__main__":
    main()
