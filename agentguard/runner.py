
import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import requests

BASE_URL = "http://127.0.0.1:3000"
PROJECT_ROOT = Path(__file__).resolve().parent.parent
SCENARIO_FILE = PROJECT_ROOT / "scenarios" / "authorization.json"
RESULTS_DIR = PROJECT_ROOT / "results"

SECURITY_CHECKS = {
    "cross_user_read",
    "cross_user_update",
    "cross_user_delete",
}


def load_scenarios():
    with SCENARIO_FILE.open("r", encoding="utf-8") as file:
        data = json.load(file)

    scenarios = data.get("scenarios", [])
    if not scenarios:
        raise ValueError("No scenarios found in authorization.json")

    for scenario in scenarios:
        required = [
            "id",
            "name",
            "method",
            "path",
            "token",
            "expected_status",
            "security_check",
        ]
        for field in required:
            if field not in scenario:
                raise ValueError(
                    f"Scenario {scenario.get('id', 'UNKNOWN')} "
                    f"is missing field: {field}"
                )

    return scenarios



def execute_request(method, path, token, body=None):
    """Send one request and capture its response."""
    response = requests.request(
        method=method,
        url=f"{BASE_URL}{path}",
        headers={"Authorization": f"Bearer {token}"},
        json=body,
        timeout=5,
    )

    return {
        "status": response.status_code,
        "body": response.text[:1000],
    }



def read_ticket_state(ticket_id):
    """Read internal state through the local test-only endpoint."""
    response = requests.get(
        f"{BASE_URL}/__test__/tickets/{ticket_id}",
        headers={"Authorization": "Bearer admin-test-token"},
        timeout=5,
    )

    if response.status_code == 404:
        return None

    response.raise_for_status()
    return response.json()




def execute_scenario(scenario, mode):
    method = scenario["method"].upper()
    path = scenario["path"]

    result = {
        "id": scenario["id"],
        "name": scenario["name"],
        "method": method,
        "path": path,
        "security_check": scenario["security_check"],
        "mode": mode,
        "expected_status": scenario["expected_status"],
        "expected_vulnerable_status": scenario.get(
            "expected_vulnerable_status"
        ),
    }

    try:
        
        ticket_id = path.split("/")[-1]
        check = scenario["security_check"]

        before_state = None
        if check in {"cross_user_update", "cross_user_delete"}:
            before_state = read_ticket_state(ticket_id)

        response = execute_request(
            method=method,
            path=path,
            token=scenario["token"],
            body=scenario.get("body"),
        )
        actual_status = response["status"]

        after_state = None
        if check in {"cross_user_update", "cross_user_delete"}:
            after_state = read_ticket_state(ticket_id)


        result["actual_status"] = actual_status
        result["evidence"] = {
            "response_body": response["body"],
        }
        
        if check in {"cross_user_update", "cross_user_delete"}:
            result["evidence"]["before_state"] = before_state
            result["evidence"]["after_state"] = after_state

            if check == "cross_user_update":
                result["evidence"]["state_changed"] = (
                    before_state != after_state
                )

            elif check == "cross_user_delete":
                result["evidence"]["ticket_deleted"] = (
                    before_state is not None and after_state is None
                )


        check = scenario["security_check"]

        
        if mode == "protected":
            passed = actual_status == scenario["expected_status"]

            if check == "cross_user_update":
                passed = (
                    passed
                    and result["evidence"]["state_changed"] is False
                )

            elif check == "cross_user_delete":
                passed = (
                    passed
                    and result["evidence"]["ticket_deleted"] is False
                    and result["evidence"]["before_state"] is not None
                )

            result["status"] = "PASS" if passed else "FAIL"
            result["passed"] = passed

            if not passed and check in SECURITY_CHECKS:
                result["finding"] = (
                    "Unexpected authorization response or state change"
                )

        else:
            expected_vulnerable = scenario.get(
                "expected_vulnerable_status"
            )

            if expected_vulnerable is None:
                result["status"] = "ERROR"
                result["passed"] = False
                result["error"] = (
                    "Missing expected_vulnerable_status in scenario"
                )
                return result

            matched = actual_status == expected_vulnerable

            if check == "cross_user_update":
                matched = (
                    matched
                    and result["evidence"]["state_changed"] is True
                )

            elif check == "cross_user_delete":
                matched = (
                    matched
                    and result["evidence"]["ticket_deleted"] is True
                    and result["evidence"]["before_state"] is not None
                )

            if not matched:
                result["status"] = "FAIL"
                result["passed"] = False
                result["error"] = (
                    "Expected behavior or state-change evidence "
                    "did not match"
                )
            elif check in SECURITY_CHECKS:
                result["status"] = "FINDING"
                result["passed"] = True
                result["finding"] = (
                    "Unauthorized action succeeded in vulnerable mode"
                )
            else:
                result["status"] = "PASS"
                result["passed"] = True


    except requests.RequestException as error:
        result["status"] = "ERROR"
        result["passed"] = False
        result["error"] = str(error)

    return result


def main():
    parser = argparse.ArgumentParser(
        description="Run AgentGuard authorization scenarios."
    )
    parser.add_argument(
        "--mode",
        choices=["protected", "vulnerable"],
        required=True,
        help="Expected configuration of the local test API.",
    )
    args = parser.parse_args()

    RESULTS_DIR.mkdir(parents=True, exist_ok=True)

    try:
        scenarios = load_scenarios()
    except (OSError, json.JSONDecodeError, ValueError) as error:
        print(f"Could not load scenarios: {error}")
        sys.exit(2)

    results = []

    print("\nAgentGuard — Authorization Scenario Runner")
    print(f"Target: {BASE_URL}")
    print(f"Mode:   {args.mode}")
    print("-" * 65)

    for scenario in scenarios:
        result = execute_scenario(scenario, args.mode)
        results.append(result)

        print(
            f"[{result['status']}] {result['id']}: "
            f"{result['name']} "
            f"(expected={result.get('expected_vulnerable_status') if args.mode == 'vulnerable' else result['expected_status']}, "
            f"actual={result.get('actual_status')})"
        )

        if result.get("finding"):
            print(f"       Finding: {result['finding']}")

        if result.get("error"):
            print(f"       Error: {result['error']}")

    findings = sum(r["status"] == "FINDING" for r in results)
    passed = sum(r["status"] == "PASS" for r in results)
    failed = sum(r["status"] == "FAIL" for r in results)
    errors = sum(r["status"] == "ERROR" for r in results)

    report = {
        "tool": "AgentGuard",
        "report_version": "0.2",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "target": BASE_URL,
        "mode": args.mode,
        "summary": {
            "total": len(results),
            "passed": passed,
            "findings": findings,
            "failed": failed,
            "errors": errors,
        },
        "results": results,
    }

    report_path = RESULTS_DIR / f"{args.mode}-report.json"
    report_path.write_text(
        json.dumps(report, indent=2),
        encoding="utf-8",
    )

    print("-" * 65)
    print(
        f"Total: {len(results)} | Passed: {passed} "
        f"| Findings: {findings} | Failed: {failed} | Errors: {errors}"
    )
    print(f"Report saved to: {report_path}")

    if failed or errors:
        sys.exit(1)


if __name__ == "__main__":
    main()
