# build_data.py
# Excel（入力シート）から 郵便番号下5桁 -> 仕分けコード の辞書を data.json に書き出します。
#
# 使い方（例）:
#   python build_data.py "仕分け番号（中京区）_郵便番号入力済.xlsx"

import sys, json
import pandas as pd

def main(xlsx_path: str, sheet_name: str = "入力"):
    df = pd.read_excel(xlsx_path, sheet_name=sheet_name)
    df = df.rename(columns={"郵便番号":"zip7", "仕分けコード":"code", "住所":"address"})
    df = df[~df["zip7"].isna() & ~df["code"].isna()].copy()

    df["zip7"] = df["zip7"].astype(int).astype(str).str.zfill(7)
    df["last5"] = df["zip7"].str[-5:]
    df["code4"] = df["code"].astype(int).astype(str).str.zfill(4)

    mapping = {}
    for _, r in df.iterrows():
        mapping.setdefault(r["last5"], []).append({
            "address": str(r["address"]),
            "code": r["code4"],
            "zip7": r["zip7"],
        })

    for k, v in mapping.items():
        v.sort(key=lambda x: (x["code"], x["address"]))

    with open("data.json", "w", encoding="utf-8") as f:
        json.dump(mapping, f, ensure_ascii=False, separators=(",",":"))

    print(f"OK: data.json written (keys={len(mapping)})")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python build_data.py <excel_path>")
        sys.exit(1)
    main(sys.argv[1])