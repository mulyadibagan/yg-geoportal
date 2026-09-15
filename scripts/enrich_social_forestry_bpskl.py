#!/usr/bin/env python3
import copy, datetime as dt, json, math, re, sys
from pathlib import Path
import openpyxl

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "source-data" / "bpskl.xlsx"
TARGET = ROOT / "data" / "social-forestry-details.json"

def clean(v):
    if v is None: return None
    if isinstance(v, float) and math.isnan(v): return None
    if isinstance(v, (dt.datetime, dt.date)): return v.date().isoformat() if isinstance(v, dt.datetime) else v.isoformat()
    if isinstance(v, str):
        v = re.sub(r"\s+", " ", v).strip()
        return v or None
    return v

def norm(v):
    return re.sub(r"[^a-z0-9]+", "", str(v or "").lower())

def decree_norm(v):
    s = norm(v)
    s = re.sub(r"^(sk|kepmen|keputusan)", "", s)
    return s

def public_person(v):
    v=clean(v)
    if not isinstance(v,str): return v
    v=re.sub(r"(?:\+?62|0)[\d\s().-]{7,}\d", "", v)
    v=re.sub(r"\b(?:NO\.?\s*(?:HP|WA)|HP|WA)\b\s*[:/-]?", "", v, flags=re.I)
    return re.sub(r"[\s,;/|-]+$", "", v).strip() or None

def first(row, *names):
    for name in names:
        vals = row.get(name.upper(), [])
        for value in vals:
            value = clean(value)
            if value is not None: return value
    return None

def values(row, *names):
    out=[]
    for name in names:
        for value in row.get(name.upper(), []):
            value=clean(value)
            if value is not None and value not in out: out.append(value)
    return out

def compact(obj):
    if isinstance(obj, dict):
        return {k: compact(v) for k,v in obj.items() if compact(v) not in (None,"",[],{})}
    if isinstance(obj, list): return [compact(v) for v in obj if compact(v) not in (None,"",[],{})]
    return obj

def merge_missing(dst, src):
    for k,v in src.items():
        if k not in dst or dst[k] in (None,"",[],{}): dst[k]=copy.deepcopy(v)
        elif isinstance(dst[k],dict) and isinstance(v,dict): merge_missing(dst[k],v)

def workbook_rows():
    wb=openpyxl.load_workbook(SOURCE,read_only=True,data_only=True)
    output=[]
    anchors={"NO","SKEMA","PROVINSI","DESA","NAMA KPS","NO SK","TGL SK","STATUS","LUAS SK (HA)"}
    sheet_regency={"Meranti":"Kepulauan Meranti","Rokan Hulu":"Rokan Hulu","Dumai":"Dumai","Rohil":"Rokan Hilir","Kampar":"Kampar","Siak":"Siak","Pelalawan":"Pelalawan","Kuantan Singingi":"Kuantan Singingi","Indragiri Hulu":"Indragiri Hulu","Indragiri Hilir (12 KPS)":"Indragiri Hilir"}
    for ws in wb:
        raw=[]; best=(-1,0,[])
        for i,row in enumerate(ws.iter_rows(values_only=True),1):
            vals=[clean(x) for x in row]
            if i<=40:
                score=sum(1 for x in vals if str(x or '').upper() in anchors)
                if score>best[0]: best=(score,i,vals)
            raw.append(vals)
        if best[0]<5: continue
        headers=[str(x or '').strip().upper() for x in best[2]]
        for vals in raw[best[1]:]:
            row={}
            for j,h in enumerate(headers):
                if h: row.setdefault(h,[]).append(vals[j] if j<len(vals) else None)
            if not first(row,"NAMA KPS"): continue
            row["__SHEET__"]=[ws.title]
            province=norm(first(row,"PROVINSI"))
            if province and province!="riau": continue
            expected=sheet_regency.get(ws.title)
            actual=first(row,"KAB / KOTA","KAB/KOTA","KABUPATEN")
            if expected and actual and norm(actual)!=norm(expected): continue
            output.append(row)
    return output

def enrichment(row):
    forest={}
    for label,headers in {
        "protectionForestHa":["HL (HA)"],"productionForestHa":["HP (HA)"],
        "limitedProductionForestHa":["HPT (HA)"],"convertibleProductionForestHa":["HPK (HA)"],
        "conservationHa":["KONSERVASI (HA)"],"otherUseAreaHa":["APL"],
    }.items():
        vals=values(row,*headers)
        if vals: forest[label]=sum(float(x) for x in vals if isinstance(x,(int,float))) if all(isinstance(x,(int,float)) for x in vals) else vals[0]
    land_cover={}
    for h,vals in row.items():
        if h.startswith("TUPLAH "):
            v=next((clean(x) for x in vals if clean(x) is not None),None)
            if v is not None: land_cover[h.replace("TUPLAH ","").replace(" (HA)","").lower().replace(" ","_")]=v
    facilitators={}
    for year in range(2019,2026):
        v=first(row,f"PENDAMPING PS {year}")
        if v is not None: facilitators[str(year)]=v
    kups_name=first(row,"NAMA KUPS")
    kups=compact({"name":kups_name,"decreeNumber":first(row,"NO SK KUPS"),"chairperson":public_person(first(row,"KETUA KUPS / NO. HP")),"class":first(row,"KELAS KUPS"),"commodity":first(row,"KOMODITI"),"commodityAreaHa":first(row,"LUAS KOMODITI (HA)"),"annualProduction":first(row,"PRODUKSI/TAHUN")})
    return compact({
        "management":{"chairperson":public_person(first(row,"KETUA PS/ NO. HP")),"forestManagementUnit":first(row,"KPH"),"independentFacilitator":first(row,"PENDAMPING MANDIRI (LSM/NGO)"),"facilitators":facilitators,"boundaryMarking":first(row,"PENANDAAN BATAS"),"rkpsStatus":first(row,"RKU/RPHD/RKPS")},
        "beneficiaries":{"male":first(row,"JML KK/PENGELOLA (LAKI-LAKI)"),"female":first(row,"JML KK/PENGELOLA (PEREMPUAN)"),"total":first(row,"TOTAL JUMLAH KK")},
        "forestAreaComposition":forest,"landCoverHa":land_cover,
        "palmOil":{"imageryHa":first(row,"SAWIT RAKYAT BY CITRA (HA)"),"decreeHa":first(row,"SAWIT RAKYAT BY SK (HA)")},
        "transformation":{"status":first(row,"TRANSFORMASI"),"previousDecree":first(row,"SK SEBELUM TRANSFORMASI")},
        "kups":[kups] if kups else [],
        "governance":{"cooperation":first(row,"KERJASAMA"),"conflict":first(row,"KONFLIK"),"overlapHa":first(row,"TUMPANG TINDIH (HA)"),"forestFunctionChangeToAplHa":first(row,"PERUBAHAN FUNGSI KAWASAN > APL (HA)"),"supervision":first(row,"PENGAWASAN"),"evaluation":first(row,"EVALUASI"),"needs":first(row,"KEBUTUHAN")},
        "bpsklProfile":{"status":first(row,"STATUS"),"skDataAvailability":first(row,"KETERSEDIAAN DATA SK"),"mapDataAvailability":first(row,"KETERSEDIAAN DATA SHP PETA"),"sourceSheet":first(row,"__SHEET__"),"updatedAt":"2026-08-29"}
    })

def main(write=False):
    details=json.loads(TARGET.read_text(encoding="utf-8")); rows=workbook_rows()
    by_dec={}
    by_name_regency={}
    for row in rows:
        d=decree_norm(first(row,"NO SK"))
        if d: by_dec.setdefault(d,[]).append(row)
        nr=(norm(first(row,"NAMA KPS")),norm(first(row,"KAB / KOTA","KAB/KOTA","KABUPATEN")))
        if all(nr): by_name_regency.setdefault(nr,[]).append(row)
    matched=ambiguous=0; changed=0; field_counts={}
    for key,detail in details.items():
        if not isinstance(detail,dict): continue
        decree=detail.get("decree") or (detail.get("skExtraction") or {}).get("decreeNumber")
        candidates=by_dec.get(decree_norm(decree),[])
        method="decree"
        if len(candidates)!=1:
            candidates=by_name_regency.get((norm(detail.get("name")),norm(detail.get("regency"))),[])
            method="name+regency"
        if len(candidates)!=1: continue
        matched+=1; before=json.dumps(detail,sort_keys=True,ensure_ascii=False)
        enrich=enrichment(candidates[0]); merge_missing(detail,enrich)
        detail.setdefault("bpsklVerification",{}).update({"status":"matched","method":method,"source":"Data Perhutanan Sosial di Provinsi Riau","sourceSheet":first(candidates[0],"__SHEET__")})
        after=json.dumps(detail,sort_keys=True,ensure_ascii=False)
        if before!=after: changed+=1
        for k,v in enrich.items():
            if v not in (None,"",[],{}): field_counts[k]=field_counts.get(k,0)+1
    result={"sourceRows":len(rows),"uniqueDecreeMatches":matched,"profilesChanged":changed,"profileCount":len(details),"enrichedGroups":field_counts}
    if write:
        TARGET.write_text(json.dumps(details,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(result,ensure_ascii=False,indent=2))

if __name__=="__main__": main("--write" in sys.argv)
