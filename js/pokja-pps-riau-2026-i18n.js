(() => {
  "use strict";

  const mandate = document.querySelector(".pokja-mandate");
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
      ]
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
      ]
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
