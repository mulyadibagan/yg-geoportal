window.YG_OBJECT_SCHEMA = {
  "version": "2.0",
  "api": "https://script.google.com/macros/s/AKfycbxUe4QyBvSiL9UJsL-nsJ5XrohDabwqhYYR9q5CTgLYiW1ZCfVy429iMlpU-lCDUSvvRg/exec",
  "layers": [
    {
      "id": "apo",
      "label": "Alat Pemecah Ombak (APO)",
      "category": "APO",
      "prefix": "APO",
      "include": true,
      "unit": "m",
      "url": "data/apo.geojson"
    },
    {
      "id": "area_mangrove",
      "label": "Area Penanaman Mangrove",
      "category": "Penanaman Mangrove",
      "prefix": "MANGROVE",
      "include": true,
      "unit": "ha",
      "url": "data/area_mangrove.geojson"
    },
    {
      "id": "fdrs",
      "label": "FDRS / Water Table",
      "category": "FDRS",
      "prefix": "FDRS",
      "include": true,
      "unit": "unit",
      "url": "data/fdrs.geojson"
    },
    {
      "id": "kopi",
      "label": "Distribusi Lahan Kopi",
      "category": "Agroforestri/Kopi",
      "prefix": "KOPI",
      "include": true,
      "unit": "lokasi",
      "url": "data/kopi.geojson"
    },
    {
      "id": "area_kopi",
      "label": "Wilayah Penanaman Kopi",
      "category": "Agroforestri/Kopi",
      "prefix": "KOPI-PLOT",
      "include": true,
      "unit": "ha",
      "url": "data/area_kopi.geojson"
    },
    {
      "id": "nursery_mangrove",
      "label": "Rumah Pembibitan Mangrove",
      "category": "Pembibitan Mangrove",
      "prefix": "NURSERY",
      "include": true,
      "unit": "unit",
      "url": "data/nursery_mangrove.geojson"
    },
    {
      "id": "sekat_kanal",
      "label": "Sekat Kanal",
      "category": "Sekat Kanal",
      "prefix": "SEKAT",
      "include": true,
      "unit": "unit",
      "url": "data/sekat_kanal.geojson"
    },
    {
      "id": "desa_intervensi",
      "label": "Batas Desa Intervensi",
      "category": "Administrasi",
      "prefix": "DESA",
      "include": false,
      "unit": "desa",
      "url": "data/desa_intervensi.geojson"
    },
    {
      "id": "titik_desa",
      "label": "Titik Desa Intervensi",
      "category": "Administrasi",
      "prefix": "TITIKDESA",
      "include": false,
      "unit": "desa",
      "url": "data/titik_desa.geojson"
    },
    {
      "id": "kawasan_hutan_sk_903",
      "label": "Kawasan Hutan SK 903",
      "category": "Referensi Kawasan",
      "prefix": "KH",
      "include": false,
      "unit": "polygon",
      "url": "data/kawasan_hutan_sk_903.geojson"
    }
  ],
  "aliases": {
    "objectId": [
      "Object_ID",
      "objectId",
      "OBJECTID",
      "Id",
      "No"
    ],
    "objectName": [
      "Nama_Objek",
      "Nama",
      "nama",
      "title",
      "Desa",
      "NAMA_DESA",
      "NAMOBJ"
    ],
    "village": [
      "Desa",
      "desa",
      "NAMA_DESA",
      "NAMOBJ",
      "WADMKD"
    ],
    "district": [
      "Kecamatan",
      "kecamatan",
      "NAMA_KEC",
      "WADMKC"
    ],
    "regency": [
      "Kabupaten",
      "kabupaten",
      "NAMA_KAB",
      "WADMKK"
    ],
    "year": [
      "Tahun",
      "tahun",
      "Fase",
      "Phase"
    ],
    "areaHa": [
      "Luas_Ha",
      "luas_ha",
      "Area_Ha",
      "areaHa"
    ],
    "plantedCount": [
      "Jumlah_Tanam",
      "jumlah_tanam",
      "Bibit_Tanam",
      "plantedCount"
    ],
    "lengthM": [
      "Panjang_M",
      "panjang_m",
      "Length_M",
      "lengthM"
    ]
  }
};
