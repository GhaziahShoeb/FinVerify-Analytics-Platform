"""
FinVerify Analytics Engine
==========================
Financial Data Intelligence & Risk Scoring System
Built for: Digitap.ai Internship Portfolio Project
Author   : [Your Name]
Stack    : Python · Pandas · NumPy · SQLite (SQL)

Modules
-------
1. Data Ingestion & Synthetic Generation
2. Feature Engineering (Pandas + NumPy)
3. Transaction Anomaly Detection
4. Credit Risk Scoring Model
5. KYC Verification Analytics
6. SQL-Based Reporting Layer
7. Dashboard Export (JSON for frontend)
"""

import pandas as pd
import numpy as np
import sqlite3
import json
from datetime import datetime, timedelta
import warnings
warnings.filterwarnings("ignore")

np.random.seed(42)

# ─────────────────────────────────────────────────────────
# 1. SYNTHETIC DATA GENERATION
#    Mimics real fintech datasets: transactions, users, KYC
# ─────────────────────────────────────────────────────────

def generate_users(n: int = 500) -> pd.DataFrame:
    """Generate a realistic user/customer dataset."""
    age = np.random.normal(loc=38, scale=12, size=n).clip(21, 75).astype(int)
    income = np.random.lognormal(mean=10.8, sigma=0.6, size=n).clip(15000, 500000)

    data = {
        "user_id":        [f"USR{str(i).zfill(5)}" for i in range(1, n + 1)],
        "age":            age,
        "annual_income":  np.round(income, 2),
        "employment_type": np.random.choice(
            ["Salaried", "Self-Employed", "Business", "Retired"],
            size=n, p=[0.55, 0.20, 0.15, 0.10]
        ),
        "city_tier":      np.random.choice([1, 2, 3], size=n, p=[0.35, 0.40, 0.25]),
        "existing_loans": np.random.randint(0, 5, size=n),
        "kyc_status":     np.random.choice(
            ["Verified", "Pending", "Failed", "Re-KYC"],
            size=n, p=[0.72, 0.15, 0.08, 0.05]
        ),
        "account_age_days": np.random.randint(30, 3650, size=n),
        "registered_at":  [
            (datetime(2022, 1, 1) + timedelta(days=int(d))).strftime("%Y-%m-%d")
            for d in np.random.randint(0, 900, size=n)
        ],
    }
    return pd.DataFrame(data)


def generate_transactions(users_df: pd.DataFrame, n: int = 5000) -> pd.DataFrame:
    """Generate transaction records linked to users."""
    user_ids = users_df["user_id"].values
    base_date = datetime(2024, 1, 1)

    amounts = np.concatenate([
        np.random.lognormal(7.5, 1.0, int(n * 0.93)),   # normal txns
        np.random.lognormal(11.0, 0.8, int(n * 0.07)),  # large/suspicious
    ])
    np.random.shuffle(amounts)
    amounts = amounts[:n]

    data = {
        "txn_id":       [f"TXN{str(i).zfill(7)}" for i in range(1, n + 1)],
        "user_id":      np.random.choice(user_ids, size=n),
        "amount":       np.round(amounts, 2),
        "txn_type":     np.random.choice(
            ["UPI", "NEFT", "IMPS", "Card", "Wallet"],
            size=n, p=[0.40, 0.20, 0.20, 0.12, 0.08]
        ),
        "merchant_category": np.random.choice(
            ["Retail", "Food", "Travel", "Healthcare", "Investment", "Unknown"],
            size=n, p=[0.30, 0.25, 0.15, 0.10, 0.10, 0.10]
        ),
        "txn_hour":     np.random.choice(range(24), size=n,
                            p=np.array([1,1,1,1,1,2,4,6,8,8,7,7,
                                        6,6,6,7,7,8,7,6,5,4,3,2], dtype=float) / 107),
        "txn_date":     [
            (base_date + timedelta(days=int(d))).strftime("%Y-%m-%d")
            for d in np.random.randint(0, 365, size=n)
        ],
        "device_type":  np.random.choice(["Mobile", "Web", "POS"], size=n, p=[0.65, 0.25, 0.10]),
        "location_match": np.random.choice([True, False], size=n, p=[0.88, 0.12]),
        "is_international": np.random.choice([True, False], size=n, p=[0.05, 0.95]),
    }
    return pd.DataFrame(data)


# ─────────────────────────────────────────────────────────
# 2. FEATURE ENGINEERING
#    Pandas + NumPy operations for risk signals
# ─────────────────────────────────────────────────────────

def engineer_txn_features(txn_df: pd.DataFrame) -> pd.DataFrame:
    """Derive risk-relevant features from raw transactions."""
    df = txn_df.copy()
    df["txn_date"] = pd.to_datetime(df["txn_date"])

    # Amount buckets
    df["amount_bucket"] = pd.cut(
        df["amount"],
        bins=[0, 1_000, 10_000, 50_000, 1_00_000, np.inf],
        labels=["<1K", "1K-10K", "10K-50K", "50K-1L", ">1L"]
    )

    # Off-hours flag (risk signal: txn at 1am–5am)
    df["is_off_hours"] = df["txn_hour"].between(1, 5)

    # High-amount flag (top 5% threshold via NumPy percentile)
    threshold_95 = float(np.percentile(df["amount"], 95))
    df["is_high_amount"] = df["amount"] > threshold_95

    # Composite risk signal
    df["risk_signal_count"] = (
        df["is_off_hours"].astype(int)
        + (~df["location_match"]).astype(int)
        + df["is_high_amount"].astype(int)
        + df["is_international"].astype(int)
        + (df["merchant_category"] == "Unknown").astype(int)
    )

    # Anomaly flag: 2+ simultaneous risk signals
    df["is_anomaly"] = df["risk_signal_count"] >= 2

    return df


def engineer_user_features(users_df: pd.DataFrame, txn_df: pd.DataFrame) -> pd.DataFrame:
    """Build per-user aggregated features for credit scoring."""
    df = users_df.copy()

    # Aggregate transaction behaviour per user
    txn_agg = txn_df.groupby("user_id").agg(
        total_txns        = ("txn_id", "count"),
        total_spend       = ("amount", "sum"),
        avg_txn_amount    = ("amount", "mean"),
        max_txn_amount    = ("amount", "max"),
        anomaly_count     = ("is_anomaly", "sum"),
        off_hours_count   = ("is_off_hours", "sum"),
        unique_merchants  = ("merchant_category", "nunique"),
    ).reset_index()

    df = df.merge(txn_agg, on="user_id", how="left")
    df.fillna({"total_txns": 0, "total_spend": 0, "avg_txn_amount": 0,
                "max_txn_amount": 0, "anomaly_count": 0,
                "off_hours_count": 0, "unique_merchants": 0}, inplace=True)

    # Anomaly rate
    df["anomaly_rate"] = np.where(
        df["total_txns"] > 0,
        df["anomaly_count"] / df["total_txns"],
        0
    )

    return df


# ─────────────────────────────────────────────────────────
# 3. CREDIT RISK SCORING MODEL
#    Rule-based scoring engine (no ML dependency)
# ─────────────────────────────────────────────────────────

def compute_credit_score(user_features: pd.DataFrame) -> pd.DataFrame:
    """
    Compute a 300–900 credit risk score per user using a
    weighted, feature-based scoring model.
    """
    df = user_features.copy()

    # --- Component scores (each 0-100) ---

    # Income score: log-normalised
    df["score_income"] = (
        np.log1p(df["annual_income"]) / np.log1p(500_000) * 100
    ).clip(0, 100)

    # Account age score
    df["score_account_age"] = (df["account_age_days"] / 3650 * 100).clip(0, 100)

    # Loan burden score (penalise existing loans)
    df["score_loan_burden"] = (100 - df["existing_loans"] * 20).clip(0, 100)

    # Transaction activity score (engagement signal)
    df["score_activity"] = (
        np.log1p(df["total_txns"]) / np.log1p(50) * 100
    ).clip(0, 100)

    # Anomaly penalty: high anomaly rate → deduct heavily
    df["score_behavior"] = (100 - df["anomaly_rate"] * 500).clip(0, 100)

    # KYC bonus/penalty
    kyc_map = {"Verified": 10, "Pending": 0, "Re-KYC": -5, "Failed": -20}
    df["score_kyc_bonus"] = df["kyc_status"].map(kyc_map).fillna(0)

    # Weighted composite → map to 300–900 range
    weights = {
        "score_income":       0.25,
        "score_account_age":  0.15,
        "score_loan_burden":  0.20,
        "score_activity":     0.15,
        "score_behavior":     0.25,
    }

    df["raw_score"] = sum(df[col] * w for col, w in weights.items())
    df["credit_score"] = (
        300 + (df["raw_score"] / 100 * 600) + df["score_kyc_bonus"]
    ).clip(300, 900).round(0).astype(int)

    # Risk tier classification
    df["risk_tier"] = pd.cut(
        df["credit_score"],
        bins=[299, 579, 669, 739, 799, 901],
        labels=["Very High Risk", "High Risk", "Medium Risk", "Low Risk", "Very Low Risk"]
    )

    return df


# ─────────────────────────────────────────────────────────
# 4. ANOMALY DETECTION — STATISTICAL APPROACH
#    Using Z-score and IQR methods (NumPy)
# ─────────────────────────────────────────────────────────

def detect_anomalies(txn_df: pd.DataFrame) -> pd.DataFrame:
    """
    Flag transaction anomalies using:
    - Z-score (|z| > 3 → statistical outlier)
    - IQR fence method
    - Risk signal composite
    """
    df = txn_df.copy()

    # Z-score on amount
    mu, sigma = df["amount"].mean(), df["amount"].std()
    df["amount_zscore"] = (df["amount"] - mu) / sigma
    df["is_zscore_outlier"] = df["amount_zscore"].abs() > 3

    # IQR method
    Q1 = df["amount"].quantile(0.25)
    Q3 = df["amount"].quantile(0.75)
    IQR = Q3 - Q1
    lower, upper = Q1 - 1.5 * IQR, Q3 + 1.5 * IQR
    df["is_iqr_outlier"] = ~df["amount"].between(lower, upper)

    # Final anomaly: risk signal composite OR statistical outlier
    df["final_anomaly"] = (
        df["is_anomaly"] | df["is_zscore_outlier"] | df["is_iqr_outlier"]
    )

    return df


# ─────────────────────────────────────────────────────────
# 5. SQL REPORTING LAYER
#    Load data into SQLite; run analytical SQL queries
# ─────────────────────────────────────────────────────────

def build_sql_reports(users_df: pd.DataFrame, txn_df: pd.DataFrame, scored_df: pd.DataFrame) -> dict:
    """
    Write dataframes to an in-memory SQLite database and
    execute analytical SQL queries to generate reports.
    """
    conn = sqlite3.connect(":memory:")

    users_df.to_sql("users", conn, index=False, if_exists="replace")
    txn_df.to_sql("transactions", conn, index=False, if_exists="replace")
    scored_df.to_sql("credit_scores", conn, index=False, if_exists="replace")

    queries = {

        # Report 1: Risk tier distribution
        "risk_distribution": """
            SELECT risk_tier,
                   COUNT(*) AS user_count,
                   ROUND(AVG(credit_score), 1) AS avg_score,
                   ROUND(AVG(annual_income), 0) AS avg_income
            FROM credit_scores
            GROUP BY risk_tier
            ORDER BY avg_score DESC
        """,

        # Report 2: Daily transaction volume with anomaly rate
        "daily_txn_volume": """
            SELECT txn_date,
                   COUNT(*) AS total_txns,
                   ROUND(SUM(amount), 2) AS total_amount,
                   SUM(CASE WHEN final_anomaly = 1 THEN 1 ELSE 0 END) AS anomaly_count,
                   ROUND(100.0 * SUM(CASE WHEN final_anomaly = 1 THEN 1 ELSE 0 END) / COUNT(*), 2) AS anomaly_rate_pct
            FROM transactions
            GROUP BY txn_date
            ORDER BY txn_date
        """,

        # Report 3: Top merchant categories by spend and anomaly rate
        "merchant_risk": """
            SELECT merchant_category,
                   COUNT(*) AS txn_count,
                   ROUND(AVG(amount), 2) AS avg_amount,
                   ROUND(SUM(amount), 2) AS total_volume,
                   SUM(CASE WHEN final_anomaly = 1 THEN 1 ELSE 0 END) AS anomalies
            FROM transactions
            GROUP BY merchant_category
            ORDER BY anomalies DESC
        """,

        # Report 4: KYC status vs credit score
        "kyc_credit_analysis": """
            SELECT u.kyc_status,
                   COUNT(*) AS users,
                   ROUND(AVG(c.credit_score), 1) AS avg_credit_score,
                   ROUND(AVG(c.anomaly_rate * 100), 2) AS avg_anomaly_rate_pct
            FROM users u
            JOIN credit_scores c ON u.user_id = c.user_id
            GROUP BY u.kyc_status
            ORDER BY avg_credit_score DESC
        """,

        # Report 5: High-risk user watchlist
        "high_risk_watchlist": """
            SELECT c.user_id, u.kyc_status, c.credit_score, c.risk_tier,
                   c.anomaly_count, ROUND(c.anomaly_rate * 100, 1) AS anomaly_pct,
                   ROUND(c.total_spend, 2) AS total_spend
            FROM credit_scores c
            JOIN users u ON c.user_id = u.user_id
            WHERE c.risk_tier IN ('Very High Risk', 'High Risk')
            ORDER BY c.credit_score ASC
            LIMIT 20
        """,
    }

    results = {}
    for name, sql in queries.items():
        results[name] = pd.read_sql_query(sql, conn).to_dict(orient="records")

    conn.close()
    return results


# ─────────────────────────────────────────────────────────
# 6. KYC VERIFICATION ANALYTICS
# ─────────────────────────────────────────────────────────

def kyc_analytics(users_df: pd.DataFrame) -> dict:
    """Summarise KYC verification pipeline health."""
    total = len(users_df)
    status_counts = users_df["kyc_status"].value_counts().to_dict()
    verification_rate = round(status_counts.get("Verified", 0) / total * 100, 2)
    failure_rate = round(status_counts.get("Failed", 0) / total * 100, 2)

    city_kyc = (
        users_df.groupby("city_tier")["kyc_status"]
        .apply(lambda x: (x == "Verified").mean() * 100)
        .round(2)
        .to_dict()
    )

    return {
        "total_users": total,
        "status_breakdown": status_counts,
        "verification_rate_pct": verification_rate,
        "failure_rate_pct": failure_rate,
        "verified_by_city_tier": {f"Tier {k}": v for k, v in city_kyc.items()},
    }


# ─────────────────────────────────────────────────────────
# 7. PIPELINE ORCHESTRATOR
# ─────────────────────────────────────────────────────────

def run_pipeline(export_json: bool = True) -> dict:
    """
    End-to-end analytics pipeline:
    Ingest → Engineer → Score → Detect → Report → Export
    """
    print("=" * 55)
    print("  FinVerify Analytics Engine  |  Digitap.ai Project")
    print("=" * 55)

    print("\n[1/6] Generating synthetic financial dataset...")
    users_df   = generate_users(n=500)
    txn_raw_df = generate_transactions(users_df, n=5000)
    print(f"      ✓ {len(users_df)} users | {len(txn_raw_df)} transactions")

    print("\n[2/6] Engineering features...")
    txn_df   = engineer_txn_features(txn_raw_df)
    user_df  = engineer_user_features(users_df, txn_df)
    print(f"      ✓ {txn_df.columns.tolist()}")

    print("\n[3/6] Running credit risk scoring model...")
    scored_df = compute_credit_score(user_df)
    score_stats = scored_df["credit_score"].describe()
    print(f"      ✓ Mean score: {score_stats['mean']:.1f} | "
          f"Min: {score_stats['min']:.0f} | Max: {score_stats['max']:.0f}")

    print("\n[4/6] Anomaly detection (Z-score + IQR + Risk signals)...")
    txn_df = detect_anomalies(txn_df)
    n_anomalies = txn_df["final_anomaly"].sum()
    anomaly_rate = n_anomalies / len(txn_df) * 100
    print(f"      ✓ {n_anomalies} anomalies detected ({anomaly_rate:.2f}% of transactions)")

    print("\n[5/6] KYC analytics...")
    kyc = kyc_analytics(users_df)
    print(f"      ✓ Verification rate: {kyc['verification_rate_pct']}% | "
          f"Failure rate: {kyc['failure_rate_pct']}%")

    print("\n[6/6] Generating SQL reports...")
    sql_reports = build_sql_reports(users_df, txn_df, scored_df)
    print(f"      ✓ {len(sql_reports)} reports generated")

    # Build summary payload
    risk_dist = scored_df["risk_tier"].value_counts().to_dict()
    txn_type_vol = txn_df.groupby("txn_type")["amount"].sum().round(2).to_dict()

    summary = {
        "pipeline_run_at": datetime.now().isoformat(),
        "dataset": {
            "total_users":        len(users_df),
            "total_transactions": len(txn_df),
            "date_range":         f"{txn_df['txn_date'].min().date()} → {txn_df['txn_date'].max().date()}"
        },
        "credit_score_stats": {
            "mean":   round(float(scored_df["credit_score"].mean()), 1),
            "median": round(float(scored_df["credit_score"].median()), 1),
            "std":    round(float(scored_df["credit_score"].std()), 1),
        },
        "risk_tier_distribution": risk_dist,
        "anomaly_stats": {
            "total_flagged":    int(n_anomalies),
            "anomaly_rate_pct": round(anomaly_rate, 2),
        },
        "kyc_analytics":   kyc,
        "txn_volume_by_type": txn_type_vol,
        "sql_reports":     sql_reports,
    }

    if export_json:
        out_path = "finverify_output.json"
        with open(out_path, "w") as f:
            json.dump(summary, f, indent=2, default=str)
        print(f"\n✅ Pipeline complete. Output saved to: {out_path}")

    print("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print(f"  Risk tiers: {risk_dist}")
    print(f"  Anomalies flagged: {n_anomalies} / {len(txn_df)}")
    print(f"  KYC verified: {kyc['verification_rate_pct']}%")
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")

    return summary


# ─────────────────────────────────────────────────────────
# ENTRYPOINT
# ─────────────────────────────────────────────────────────

if __name__ == "__main__":
    results = run_pipeline(export_json=True)
