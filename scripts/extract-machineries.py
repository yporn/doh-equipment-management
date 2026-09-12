#!/usr/bin/env python3
"""Extract the authoritative machinery register from the supplied XLSX using stdlib only."""

import json
import re
import sys
import xml.etree.ElementTree as ET
import zipfile

NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main", "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships"}


def clean(value):
    if value is None:
        return None
    value = re.sub(r"\s+", " ", str(value).replace("\u00a0", " ")).strip()
    return value or None


def number(value, integer=False):
    if value in (None, "", "#N/A"):
        return None
    try:
        parsed = float(value)
        return int(round(parsed)) if integer else parsed
    except ValueError:
        return None


def column(reference):
    return re.match(r"[A-Z]+", reference).group(0)


def extract(source):
    with zipfile.ZipFile(source) as archive:
        shared = []
        if "xl/sharedStrings.xml" in archive.namelist():
            root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
            shared = ["".join(t.text or "" for t in item.findall(".//m:t", NS)) for item in root.findall("m:si", NS)]
        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        relationships = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        targets = {item.attrib["Id"]: item.attrib["Target"] for item in relationships}
        sheet = workbook.find(".//m:sheet", NS)
        target = targets[sheet.attrib[f"{{{NS['r']}}}id"]]
        path = target if target.startswith("xl/") else f"xl/{target}"
        root = ET.fromstring(archive.read(path))
        rows = []
        for row in root.findall(".//m:sheetData/m:row", NS):
            values = {}
            for cell in row.findall("m:c", NS):
                cell_type = cell.attrib.get("t")
                raw = cell.find("m:v", NS)
                inline = cell.find("m:is", NS)
                value = None
                if cell_type == "s" and raw is not None:
                    value = shared[int(raw.text)]
                elif cell_type == "inlineStr" and inline is not None:
                    value = "".join(t.text or "" for t in inline.findall(".//m:t", NS))
                elif raw is not None:
                    value = raw.text
                values[column(cell.attrib["r"])] = clean(value)
            if values.get("B") and re.fullmatch(r"\d{2}-\d{4}-\d{2}-\d", values["B"]):
                note = values.get("T")
                status = "INACTIVE" if note == "อนุมัติจำหน่าย" else "UNDER_REPAIR" if note == "เข้าซ่อมที่หน่วยงานอื่น" else "AVAILABLE"
                rows.append({
                    "code": values["B"], "typeCode": values.get("C"), "name": values.get("D"),
                    "brand": values.get("E"), "model": values.get("F"), "owningDepartment": values.get("G"),
                    "currentDepartment": values.get("H"), "fuelRate": number(values.get("I")), "fuelUnit": values.get("J"),
                    "purchasePrice": number(values.get("K"), True), "utilization2563": number(values.get("L")),
                    "utilization2564": number(values.get("M")), "utilization2565": number(values.get("N")),
                    "yearlyRate": number(values.get("O"), True), "monthlyRate": number(values.get("P"), True),
                    "weeklyRate": number(values.get("Q"), True), "dailyRate": number(values.get("R"), True),
                    "hourlyRate": number(values.get("S"), True), "note": note, "status": status,
                })
        return rows


if __name__ == "__main__":
    source, destination = sys.argv[1:3]
    records = extract(source)
    if len(records) != 206:
        raise SystemExit(f"Expected 206 machinery records, found {len(records)}")
    with open(destination, "w", encoding="utf-8") as output:
        json.dump(records, output, ensure_ascii=False, indent=2)
        output.write("\n")
    print(f"Extracted {len(records)} records to {destination}")
