(() => {
  "use strict";

  const mandate = document.querySelector(".pokja-mandate");
  const progress = document.querySelector(".pokja-progress");
  if (!mandate) return;

  const copy = {
    id: {
      eyebrow: "TUGAS POKJA PPS",
      title: "Tugas Pokja PPS Provinsi Riau",
      intro: "Berdasarkan Diktum Kedua Keputusan Gubernur Riau Nomor Kpts.123/II/2026, Pokja PPS mempunyai tugas:",
      source: "Rumusan tugas mengikuti dokumen resmi. Dokumen lengkap dapat dibuka melalui tautan SK pada halaman ini.",
      tasks: [
        "Melakukan sosialisasi Perhutanan Sosial kepada masyarakat di Provinsi Riau dan para pihak terkait.",
        "Melakukan pencermatan spasial terhadap Peta Indikatif Areal Perhutanan Sosial (PIAPS).",
        "Membantu fasilitasi permohonan persetujuan pengelolaan Perhutanan Sosial.",
        "Membantu melakukan verifikasi teknis permohonan Persetujuan Pengelolaan Perhutanan Sosial.",
        "Melaksanakan manajemen informasi dalam pelaksanaan kegiatan Perhutanan Sosial.",
        "Membantu fasilitasi penyelesaian konflik sosial dan tenurial pengelolaan Perhutanan Sosial.",
        "Membantu fasilitasi pemenuhan hak, pelaksanaan kewajiban, dan ketaatan terhadap ketentuan dan larangan bagi pemegang Persetujuan Pengelolaan Perhutanan Sosial dan penetapan status Hutan Adat.",
        "Membantu fasilitasi penataan areal.",
        "Membantu fasilitasi penyusunan perencanaan pengelolaan Perhutanan Sosial.",
        "Membantu fasilitasi pengembangan usaha Perhutanan Sosial.",
        "Membantu pelaksanaan pembinaan dan pengendalian."
      ],
      progress: {
        eyebrow: "PEMBARUAN DATA PERHUTANAN SOSIAL",
        title: "Cakupan data yang telah dihimpun",
        status: "Pembaruan berjalan",
        date: "Status data 11 September 2026",
        intro: "Ringkasan ketersediaan data pada Direktori Perhutanan Sosial YG. Pembaruan ini mendukung tugas manajemen informasi Pokja PPS dan bukan penilaian resmi atas kinerja Pokja.",
        cards: [
          ["PROFIL PERHUTANAN SOSIAL", "profil telah tersedia dan seluruhnya tercatat berstatus SK terbit.", "181 dari 181 profil"],
          ["GEOMETRI WILAYAH", "profil telah dilengkapi geometri untuk ditampilkan pada peta.", "179 dari 181 profil · 98,9%"],
          ["DOKUMEN SK", "profil telah dilengkapi salinan dokumen persetujuan.", "163 dari 181 profil · 90,1%"],
          ["LAMPIRAN PETA", "profil telah dilengkapi lampiran peta persetujuan.", "144 dari 181 profil · 79,6%"]
        ],
        plans: "DOKUMEN PENGELOLAAN YANG TELAH TERDATA",
        planText: "<b>13</b> RKPS <i>·</i> <b>11</b> RKT <i>·</i> <b>20</b> KUPS",
        link: "Lihat rincian Direktori PS"
      }
    },
    en: {
      eyebrow: "POKJA PPS RESPONSIBILITIES",
      title: "Responsibilities of the Riau Provincial Pokja PPS",
      intro: "Under the Second Provision of Riau Governor Decree No. Kpts.123/II/2026, Pokja PPS has the following responsibilities:",
      source: "The responsibilities follow the official document. The complete decree is available through the link on this page.",
      tasks: [
        "Conduct Social Forestry outreach for communities in Riau Province and relevant stakeholders.",
        "Undertake spatial review of the Indicative Map of Social Forestry Areas (PIAPS).",
        "Help facilitate applications for Social Forestry Management Approval.",
        "Assist with technical verification of applications for Social Forestry Management Approval.",
        "Manage information supporting the implementation of Social Forestry activities.",
        "Help facilitate the resolution of social and tenure conflicts in Social Forestry management.",
        "Help facilitate the fulfilment of rights, performance of obligations, and compliance with requirements and prohibitions by holders of Social Forestry Management Approval and recognised Customary Forest status.",
        "Help facilitate area arrangement.",
        "Help facilitate the preparation of Social Forestry management plans.",
        "Help facilitate Social Forestry enterprise development.",
        "Support guidance and oversight activities."
      ],
      progress: {
        eyebrow: "SOCIAL FORESTRY DATA UPDATE",
        title: "Coverage of compiled data",
        status: "Update in progress",
        date: "Data status as of 11 September 2026",
        intro: "A summary of data availability in YG's Social Forestry Directory. This update supports Pokja PPS information management and is not an official assessment of the working group's performance.",
        cards: [
          ["SOCIAL FORESTRY PROFILES", "profiles are available and all are recorded as having issued decrees.", "181 of 181 profiles"],
          ["AREA GEOMETRY", "profiles include geometry for display on the map.", "179 of 181 profiles · 98.9%"],
          ["DECREE DOCUMENTS", "profiles include a copy of the approval decree.", "163 of 181 profiles · 90.1%"],
          ["MAP ATTACHMENTS", "profiles include the approval map attachment.", "144 of 181 profiles · 79.6%"]
        ],
        plans: "MANAGEMENT DOCUMENTS RECORDED",
        planText: "<b>13</b> RKPS <i>·</i> <b>11</b> RKT <i>·</i> <b>20</b> KUPS",
        link: "View the Social Forestry Directory"
      }
    }
  };

  function applyLanguage(language) {
    const selected = language === "en" ? copy.en : copy.id;
    mandate.querySelector(".pokja-mandate__head span").textContent = selected.eyebrow;
    mandate.querySelector(".pokja-mandate__head h2").textContent = selected.title;
    mandate.querySelector(".pokja-mandate__head p").textContent = selected.intro;
    mandate.querySelector(".pokja-mandate__source").textContent = selected.source;
    mandate.querySelectorAll(".pokja-task-list li").forEach((item, index) => {
      item.textContent = selected.tasks[index];
    });
    if (progress) {
      progress.querySelector(".pokja-progress__head span").textContent = selected.progress.eyebrow;
      progress.querySelector(".pokja-progress__head h2").textContent = selected.progress.title;
      progress.querySelector(".pokja-progress__status b").textContent = selected.progress.status;
      progress.querySelector(".pokja-progress__status small").textContent = selected.progress.date;
      progress.querySelector(".pokja-progress__intro").textContent = selected.progress.intro;
      progress.querySelectorAll(".pokja-progress-card").forEach((card, index) => {
        card.querySelector(":scope > span").textContent = selected.progress.cards[index][0];
        card.querySelector("p").textContent = selected.progress.cards[index][1];
        card.querySelector(":scope > small").textContent = selected.progress.cards[index][2];
      });
      progress.querySelector(".pokja-progress__plans > div > span").textContent = selected.progress.plans;
      progress.querySelector(".pokja-progress__plans p").innerHTML = selected.progress.planText;
      progress.querySelector(".pokja-progress__plans a").firstChild.textContent = selected.progress.link + " ";
    }
  }

  window.addEventListener("yg:languagechange", event => {
    applyLanguage(event.detail && event.detail.language);
  });

  let initialLanguage = document.documentElement.lang;
  try {
    initialLanguage = localStorage.getItem("yg-language") || initialLanguage;
  } catch (error) {
    // Continue with the document language when browser storage is unavailable.
  }
  applyLanguage(initialLanguage);
})();
