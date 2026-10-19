"""Demo forecast JSON used to check the TypeScript engine."""

from __future__ import annotations

import json
from datetime import date, timedelta

import pandas as pd

from finsight.evaluate import evaluate
from finsight.explain import explain
from finsight.forecast import forecast
from finsight.generate import load_books
from finsight.simulate import apply_scenario


def main() -> None:
    transactions, invoices, meta = load_books()
    as_of = date.fromisoformat(meta["as_of"])
    history_start = date.fromisoformat(meta["history_start"])
    opening = float(meta["opening_cash"])
    base = forecast(
        transactions,
        invoices,
        opening=opening,
        history_start=history_start,
        as_of=as_of,
        horizon=90,
        n_sims=0,
    )
    story = explain(base, transactions)
    metrics = evaluate(
        transactions,
        invoices,
        opening=opening,
        history_start=history_start,
        as_of=as_of,
    )
    scenario = apply_scenario(
        transactions,
        invoices,
        opening=opening,
        history_start=history_start,
        as_of=as_of,
        invoice_id=meta["hero_invoice_id"],
        expected_date=as_of + timedelta(days=10),
        category="marketing",
        reduction_pct=0.5,
        horizon=90,
        n_sims=0,
    )
    recent_start = as_of - timedelta(days=90)
    recent_tx = transactions[
        (transactions["date"] >= pd.Timestamp(recent_start))
        & (transactions["date"] <= pd.Timestamp(as_of))
    ]
    invoiced = float(
        invoices.loc[
            (invoices["issue_date"] >= pd.Timestamp(recent_start))
            & (invoices["issue_date"] <= pd.Timestamp(as_of)),
            "amount",
        ].sum()
    )
    collected = float(recent_tx.loc[recent_tx["category"] == "client_payment", "amount"].sum())
    expenses = float(-recent_tx.loc[recent_tx["amount"] < 0, "amount"].sum())
    scheduled = []
    for _, row in base.scheduled.iterrows():
        scheduled.append(
            {
                "date": pd.Timestamp(row["date"]).date().isoformat(),
                "amount": float(row["amount"]),
                "category": str(row["category"]),
                "counterparty": str(row["counterparty"]),
                "invoice_id": None if "invoice_id" not in row or pd.isna(row["invoice_id"]) else str(row["invoice_id"]),
            }
        )
    payload = {
        "cash_today": base.cash_today,
        "shortfall": None if base.shortfall_date is None else base.shortfall_date.isoformat(),
        "balance": base.balance,
        "baseline": base.baseline,
        "variable_daily": base.variable_daily,
        "min_30": story["min_30"],
        "min_90": story["min_90"],
        "bullets": story["bullets"],
        "inflows": {str(key): float(value) for key, value in story["inflows"].items()},
        "outflows": {str(key): float(value) for key, value in story["outflows"].items()},
        "crossing": None
        if story["crossing"] is None
        else {
            "date": story["crossing"]["date"].isoformat(),
            "amount": story["crossing"]["amount"],
            "balance_after": story["crossing"]["balance_after"],
            "category": story["crossing"]["category"],
            "counterparty": story["crossing"]["counterparty"],
        },
        "scheduled": scheduled,
        "invoiced": invoiced,
        "collected": collected,
        "expenses": expenses,
        "metrics": {
            "model_mae": metrics["model_mae"],
            "baseline_mae": metrics["baseline_mae"],
            "model_improves_mae": bool(metrics["model_improves_mae"]),
            "model_lead_days": metrics["model_lead_days"],
            "baseline_lead_days": metrics["baseline_lead_days"],
            "shortfall_event": None if metrics["shortfall_event"] is None else metrics["shortfall_event"].isoformat(),
            "origins": metrics["origins"],
        },
        "scenario_balance": scenario.balance,
        "scenario_shortfall": None if scenario.shortfall_date is None else scenario.shortfall_date.isoformat(),
        "scenario_min_30": min(scenario.balance[:31]),
    }
    print(json.dumps(payload))


if __name__ == "__main__":
    main()
