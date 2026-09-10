(function () {
  "use strict";

  const state = { data: null, search: "", target: "", status: "linked", period: "", language: "id" };
  const EN = {"goals":["Manage natural resources responsibly and sustainably","Improve community well-being through the wise use of natural resources","Protect the environment for present and future generations"],"formalTargets":["Transparent and participatory environmental governance","Improved environmental quality: water, air, and soil","Emission reduction and sustainable waste management","Protection of conservation and coastal areas","Development of a green economy and renewable energy"],"evidence":{"Pelibatan masyarakat":"Community engagement","Program restorasi gambut":"Peatland restoration programme","Peta ekosistem gambut":"Peat ecosystem map","Karhutla & cuaca":"Fire and weather","FDRS dan sekat kanal":"FDRS and canal blocks","Peningkatan kapasitas":"Capacity building","Peta pencegahan karhutla":"Fire-prevention map","Pemantauan pesisir":"Coastal monitoring","Alat pemecah ombak":"Wave barriers","Wilayah penanaman kopi":"Coffee planting areas","Program mangrove":"Mangrove programme","Area penanaman":"Planting areas","WebGIS YG":"YG WebGIS","Biodiversitas":"Biodiversity","Pesisir dan mangrove":"Coasts and mangroves","Data pelatihan":"Training data","Peta program":"Programme map","Wilayah kopi":"Coffee areas","Program gambut":"Peatland programme","Biodiversitas mangrove":"Mangrove biodiversity","Referensi Hutan Adat":"Customary Forest reference","Data kapasitas":"Capacity data","Peta penanaman":"Planting map","WebGIS":"WebGIS","Keselarasan kebijakan":"Policy alignment","Program restorasi":"Restoration programmes"},"targets":{"sda-tersedia":{"title":"Ensuring the Availability of Natural Resources","theme":"Governance and data","actions":{"1":{"name":"Preparation of Environmental Carrying Capacity and Assimilative Capacity","rationale":"No YG evidence currently demonstrates direct involvement in preparing an environmental carrying-capacity document."},"2":{"name":"Policy on FPIC/PADIATAPA","rationale":"YG's participatory approach supports consent and community-engagement principles, but it is not evidence that YG helped prepare the policy."}}},"kerusakan-lingkungan":{"title":"Preventing Environmental Degradation","theme":"Peatlands, coasts, and prevention","actions":{"1":{"name":"Preparation of the Peat Ecosystem Protection and Management Plan (RPPEG)","rationale":"Yayasan Gambut is explicitly listed as a development partner in the RAD."},"2":{"name":"Strengthening wildfire control through prevention, response, and post-fire rehabilitation","rationale":"FDRS units, canal blocks, hotspot monitoring, and community training provide operational evidence of YG's contribution to wildfire prevention."},"3":{"name":"Increasing the role of communities and villages in wildfire prevention","rationale":"Yayasan Gambut is explicitly listed as a partner; supporting evidence includes community engagement, training, FDRS units, and canal blocks."},"4":{"name":"Policy on erosion control and coastal-zone management","rationale":"Yayasan Gambut is explicitly listed as a partner; field evidence includes wave barriers, planting, and coastal monitoring."},"5":{"name":"Policy on Sustainable Agricultural Land Protection","rationale":"Yayasan Gambut is explicitly listed as a partner. Coffee agroforestry provides evidence of implementation practice, not evidence of policy preparation."},"6":{"name":"Mangrove Rehabilitation and Restoration","rationale":"YG's planting, nursery, monitoring, and coastal-protection activities provide documented evidence of contribution, although YG is not listed in this action's partner row."},"7":{"name":"Jurisdictional facilitation for ISPO/RSPO, including STDB","rationale":"No YG evidence is currently available for jurisdictional palm-oil certification or STDB facilitation."},"8":{"name":"Waste-management policy","rationale":"No YG evidence is currently available for direct involvement in preparing a waste-management policy."},"9":{"name":"Development of waste banks and effective waste management","rationale":"No evidence of a waste-bank programme is currently available in YG's public system."}}},"nilai-ekonomi-sda":{"title":"Increasing the Economic Value of Natural Resources","theme":"Local economy and ecotourism","actions":{"1":{"name":"Mapping and development of a natural-resource database accessible to businesses","rationale":"YG WebGIS provides a public spatial database, but it does not replace an official government database."},"2":{"name":"Training and assistance for businesses, including access to finance and markets","rationale":"Product training, group-enterprise support, and livelihood activities are documented; facilitation of access to finance requires separate evidence."},"3":{"name":"Inventory of natural and cultural assets to strengthen ecotourism growth","rationale":"Yayasan Gambut is explicitly listed as a partner; the biodiversity catalogue and location data provide supporting evidence."},"4":{"name":"Capacity building and tourism-product development for community groups","rationale":"Ecotourism management training and community product-development activities are documented."}}},"pelibatan-sda":{"title":"Engaging Communities in Natural-Resource Management","theme":"Participation and institutions","actions":{"1":{"name":"Facilitation of Social Forestry and other community-managed areas","rationale":"Assistance to community groups supports area management, but YG's facilitation of formal Social Forestry licensing has not yet been demonstrated."},"2":{"name":"Development of productive non-timber forest product enterprises for communities or community groups","rationale":"Community enterprises and agroforestry are relevant, but each product's classification as a non-timber forest product requires verification."},"3":{"name":"Development of ecological fiscal-transfer incentives for the regency government","rationale":"No YG evidence is currently available for the development of an ecological fiscal-transfer policy."},"4":{"name":"Facilitating community participation in conservation, rehabilitation, and natural-resource management","rationale":"Community groups participate in planting, nurseries, patrols, monitoring, and agroforestry activities."}}},"ekonomi-nusantara":{"title":"Applying Nusantara Economy Principles","theme":"Community economy","actions":{"1":{"name":"Facilitation of community-based enterprise development and cooperation networks","rationale":"Community assistance, women's livelihoods, and training networks provide documented evidence of contribution."},"2":{"name":"Facilitation of cooperatives and MSMEs working in natural-resource management","rationale":"Enterprise groups have received assistance, but their cooperative or MSME status requires verification."},"3":{"name":"Facilitation of community programmes supporting the Nusantara economy","rationale":"Livelihood and community-enterprise programmes are thematically aligned; government indicators are required before they can be counted as delivery of the action."}}},"pendapatan-masyarakat":{"title":"Increasing Community Income","theme":"Products, enterprises, and tourism","actions":{"1":{"name":"Development of value-added agricultural, fisheries, and forestry products","rationale":"Training in creative products, processing, and community enterprises is documented."},"2":{"name":"Promotion of local products through exhibitions, festivals, and social media","rationale":"Digital visibility is available, but participation in exhibitions and festivals requires specific evidence."},"3":{"name":"Development of strong and competitive local brands","rationale":"Product development is supported, but indicators for a strong local brand are not yet available."},"4":{"name":"Encouraging cooperation with third parties to develop local products","rationale":"Collaboration with trainers and donors is documented, but product-development partnerships need to be recorded as separate evidence."},"5":{"name":"Development of integrated farming systems on peatlands","rationale":"Yayasan Gambut is explicitly listed as a partner; coffee agroforestry and community facilities provide field evidence."},"6":{"name":"Business-management, financial, and marketing training for agricultural, fisheries, and forestry enterprises","rationale":"Capacity-building and enterprise training are documented; the topics covered in each session still require activity-level verification."},"7":{"name":"Facilitation of access to business capital through credit or grants","rationale":"No evidence of access to business credit or grants is currently available in YG's public system."},"8":{"name":"Encouraging the establishment of cooperatives or joint business groups","rationale":"Active partner groups are documented, but the establishment status of cooperatives or joint business groups requires verification."},"9":{"name":"Development of agro-tourism and ecotourism, including marine ecotourism and non-timber forest products","rationale":"Mangrove ecotourism-management training and community product-development activities are documented."}}},"hak-adat-gedsi":{"title":"Restoring Indigenous Peoples' Rights and Advancing GEDSI","theme":"Rights, gender, and inclusion","actions":{"1":{"name":"Identification and documentation of customary areas, boundaries, natural resources, and sacred places","rationale":"Data from the Imbo Putuih Customary Forest provides a reference from YG's experience, but the site is in Kampar and is not counted as a Bengkalis achievement."},"2":{"name":"Supporting the adoption of a regional regulation recognising Indigenous Peoples' rights to customary areas","rationale":"No YG evidence is currently available for the adoption of a regional regulation recognising customary areas in Bengkalis."},"3":{"name":"Facilitation of customary-area registration in the national land-registration system","rationale":"No YG evidence is currently available for customary-area registration in Bengkalis."},"4":{"name":"Documentation of customary laws related to dispute resolution","rationale":"No documentation of Bengkalis customary law is currently available in YG's public system."},"5":{"name":"Preparation of GEDSI-responsive policies and programmes","rationale":"Sex- and age-disaggregated data on women and young people is available, but it is not evidence of YG's involvement in preparing a GEDSI policy."},"6":{"name":"Strengthening GEDSI capacity in natural-resource management","rationale":"Training and the participation of women and young people have been recorded using disaggregated data."}}},"kualitas-hidup":{"title":"Improving Community Quality of Life","theme":"Water, sanitation, and green space","actions":{"1":{"name":"Maintenance of drinking-water supply systems (SPAM)","rationale":"No YG evidence is currently available for the maintenance of drinking-water supply systems."},"2":{"name":"Preparation of clean-water and sanitation regulations","rationale":"No YG evidence is currently available for the preparation of clean-water and sanitation regulations."},"3":{"name":"Supporting PAMSIMAS and community-based total sanitation (STBM)","rationale":"No YG evidence is currently available for PAMSIMAS or STBM activities."},"4":{"name":"Increasing urban green open space","rationale":"YG planting and rehabilitation activities support greening, but they are not evidence of increased urban green open space."}}},"partisipasi-masyarakat":{"title":"Increasing Community Participation","theme":"Forums and collaboration","actions":{"1":{"name":"Establishment of the Bengkalis Lestari Regency Synergy Forum for civil-society organisations","rationale":"YG can provide evidence of civil-society participation, but it is not listed as a partner for this action."},"2":{"name":"Establishment of a private-sector forum to support the Bengkalis Lestari policy","rationale":"YG's donor partnerships provide relevant experience, but they do not demonstrate that a government-led forum has been established."},"3":{"name":"Circular letter on corporate support for Bengkalis Lestari, including BMP and NDPE commitments","rationale":"No evidence of a corporate circular letter or BMP/NDPE commitment is currently available in YG's public system."},"4":{"name":"Development of use or buffer zones for non-timber forest products, environmental services, and ecotourism with local community participation","rationale":"Community and ecotourism programmes are aligned, but establishing a buffer zone requires specific policy and spatial evidence."}}},"iklim-ekosistem":{"title":"Controlling Climate Change and Protecting and Restoring Ecosystems","theme":"Climate and ecosystem restoration","actions":{"1":{"name":"Preparation of the FOLU Net Sink 2030 Action Plan","rationale":"YG restoration, rehabilitation, and emission-prevention data can provide input, but it is not evidence that YG prepared the government document."},"2":{"name":"Preparation of a Coastal and Mangrove Protection Master Plan","rationale":"YG data on mangroves, erosion, wave barriers, and monitoring can provide technical input, but it is not evidence that YG prepared the master plan."}}},"kualitas-sda":{"title":"Maintaining the Quality and Availability of Natural Resources","theme":"Indicators without separate action rows","note":"The annex establishes indicators for this target but does not provide a separate action row in the Development Partner Network table.","indicators":["Area of degraded peatland","Number of fire hotspots on peatland","Greenhouse-gas emissions from peatlands","Extent of mangrove forest cover and its deforestation rate","Coastal erosion rate","Application of BMP and NDPE","Rate of land-use conversion or reduction in degraded peatland"],"actions":{}}}};
  const UI = {"id":{"locale":"id-ID","pageTitle":"RAD Bengkalis Lestari | YG GeoPortal","meta":"Dashboard kontribusi Yayasan Gambut terhadap Rencana Aksi Daerah Kabupaten Bengkalis Lestari 2026-2030.","labels":{"explicit":"Tercantum dalam RAD","verified":"Kontribusi berbukti","supporting":"Keselarasan pendukung","unmapped":"Bukti belum tersedia"},"allTargets":"Semua sasaran","linked":"Memiliki keterkaitan YG","allStatuses":"Semua 47 aksi","allPeriods":"Semua periode","periodTarget":"Periode target","theme":"Tema","details":"Lihat dasar keterkaitan dan pelaksana","lead":"Perangkat daerah pengampu","partners":"Mitra dalam RAD","rationale":"Dasar keterkaitan dengan program YG","empty":"Tidak ada aksi yang cocok.","emptyHelp":"Ubah filter atau kata pencarian.","structureNote":"Catatan struktur RAD","indicators":"Indikator","loadError":"Data RAD Bengkalis Lestari tidak dapat dimuat","unavailable":"Data belum tersedia"},"en":{"locale":"en-GB","pageTitle":"Bengkalis Lestari RAD | YG GeoPortal","meta":"Yayasan Gambut's contribution to the Bengkalis Lestari Regional Action Plan 2026-2030.","labels":{"explicit":"Listed in the RAD","verified":"Documented contribution","supporting":"Supporting alignment","unmapped":"Evidence not yet available"},"allTargets":"All targets","linked":"Actions linked to YG","allStatuses":"All 47 actions","allPeriods":"All periods","periodTarget":"Target period","theme":"Theme","details":"View alignment basis and implementing agencies","lead":"Lead government agencies","partners":"Partners listed in the RAD","rationale":"Basis of alignment with YG programmes","empty":"No matching actions.","emptyHelp":"Adjust the filters or search term.","structureNote":"RAD structure note","indicators":"Indicators","loadError":"The Bengkalis Lestari RAD data could not be loaded","unavailable":"Data is currently unavailable"}};
  const elements = {
    goals: document.getElementById("rad-goals"), formalTargets: document.getElementById("rad-formal-targets"),
    target: document.getElementById("rad-target"), status: document.getElementById("rad-status"),
    period: document.getElementById("rad-period"), search: document.getElementById("rad-search"),
    reset: document.getElementById("rad-reset"), showAll: document.getElementById("rad-show-all"),
    count: document.getElementById("rad-result-count"), groups: document.getElementById("rad-action-groups"),
    updatedAt: document.getElementById("rad-updated-at")
  };

  const escapeHtml = value => String(value == null ? "" : value)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  const lang = () => state.language === "en" ? "en" : "id";
  const copy = () => UI[lang()];
  const allActions = () => state.data.targets.flatMap(target =>
    target.actions.map(action => Object.assign({ targetId: target.id, targetNumber: target.number, targetTitle: target.title, theme: target.theme }, action))
  );
  const hasLink = action => action.status !== "unmapped";
  const enTarget = target => EN.targets[target.id] || {};
  const localTarget = target => {
    if (lang() !== "en") return target;
    const translated = enTarget(target);
    return Object.assign({}, target, {
      title: translated.title || target.title,
      theme: translated.theme || target.theme,
      note: translated.note || target.note,
      indicators: translated.indicators || target.indicators
    });
  };
  const localAction = (target, action) => {
    if (lang() !== "en") return action;
    const translated = (enTarget(target).actions || {})[action.no] || {};
    return Object.assign({}, action, {
      name: translated.name || action.name,
      rationale: translated.rationale || action.rationale,
      evidence: Array.isArray(action.evidence) ? action.evidence.map(item => Object.assign({}, item, { label: EN.evidence[item.label] || item.label })) : []
    });
  };
  const searchable = (target, action) => {
    const t = localTarget(target);
    const a = localAction(target, action);
    return [a.name, a.period, a.lead, a.partners, a.rationale, t.theme, t.title].join(" ").toLowerCase();
  };

  function setText(selector, value) {
    const node = document.querySelector(selector);
    if (node) node.textContent = value;
  }
  function applyStaticLanguage() {
    const isEn = lang() === "en";
    document.documentElement.lang = lang();
    document.title = copy().pageTitle;
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.content = copy().meta;
    const text = isEn ? {
      breadcrumb:"Policy & Commitment Alignment", eyebrow:"REGIONAL FRAMEWORK · 2026-2030",
      hero:"Yayasan Gambut's Contribution to the Bengkalis Lestari Regional Action Plan",
      heroIntro:"A transparent mapping of Yayasan Gambut's documented position and programme contributions against Bengkalis Regent Regulation No. 13 of 2026 and its action-plan annex.",
      regulation:"REGULATION",regulationTitle:"Bengkalis Regent Regulation No. 13 of 2026",regulationMeta:"6 pages · open in Google Drive →",
      annex:"ANNEX",annexTitle:"Bengkalis Lestari Regional Action Plan",annexMeta:"48 pages · open in Google Drive →",
      goals:"goals",targets:"operational targets",actions:"action-plan items",explicit:"list YG directly",linked:"linked to YG",
      hierarchy:"Policy structure: 3 goals → 5 formal targets → 11 operational targets → 47 action-plan items.",
      positionLabel:"CONTRIBUTION POSITION",positionTitle:"Official listing is distinguished from programme alignment",
      positionIntro:'The label <strong>Listed in the RAD</strong> is used only when Yayasan Gambut appears in the development-partner column. Other actions are classified using documented YG evidence or thematic alignment; this does not constitute a government mandate.',
      statusDescriptions:["Yayasan Gambut is explicitly named.","Specific public YG evidence supports the alignment.","Relevant, but does not yet demonstrate delivery of the action.","No matching public YG evidence is currently available."],
      policyLabel:"POLICY DIRECTION",policyTitle:"Goals and formal targets",policyIntro:"The regulation establishes five formal targets; the annex translates them into eleven operational targets.",
      actionLabel:"ACTION PLAN",actionTitle:"Bengkalis Lestari RAD actions",actionIntro:"The initial view shows the 34 actions linked to YG. Use the filters to review all 47 actions and the basis for each classification.",
      search:"Search actions",searchPlaceholder:"Search actions, lead agencies, partners, or themes",target:"Target",status:"Contribution status",period:"Period",
      reset:"Reset filters",showAll:"Show all 47 actions",
      methodLabel:"METHODOLOGY & SOURCE",methodTitle:"How to read this mapping",
      methodText:"This page is Yayasan Gambut's evidence-based mapping of programme alignment. It is not an official evaluation by the Bengkalis Regency Government and does not change the roles assigned in the RAD.",
      officialSource:"Official sources",methodStatus:"Classification basis",methodStatusText:"Official listing, public YG evidence, thematic alignment, or evidence not yet available.",
      updated:"Last updated",contact:"Questions or corrections",contactText:"Submit a finding through YG GeoPortal."
    } : {
      breadcrumb:"Keselarasan Kebijakan & Komitmen",eyebrow:"KERANGKA DAERAH · 2026-2030",
      hero:"Kontribusi Yayasan Gambut terhadap RAD Kabupaten Bengkalis Lestari",
      heroIntro:"Pemetaan terbuka mengenai posisi dan kontribusi program Yayasan Gambut berdasarkan Peraturan Bupati Bengkalis Nomor 13 Tahun 2026 beserta lampiran rencana aksinya.",
      regulation:"PERATURAN",regulationTitle:"Perbup Bengkalis Nomor 13 Tahun 2026",regulationMeta:"6 halaman · buka di Google Drive →",
      annex:"LAMPIRAN",annexTitle:"RAD Kabupaten Bengkalis Lestari",annexMeta:"48 halaman · buka di Google Drive →",
      goals:"tujuan",targets:"sasaran operasional",actions:"rencana aksi",explicit:"menyebut YG langsung",linked:"memiliki keterkaitan YG",
      hierarchy:"Struktur kebijakan: 3 tujuan → 5 sasaran formal → 11 sasaran operasional → 47 rencana aksi.",
      positionLabel:"POSISI KONTRIBUSI",positionTitle:"Pencantuman dalam RAD dibedakan dari keselarasan program",
      positionIntro:'Label <strong>Tercantum dalam RAD</strong> hanya digunakan ketika Yayasan Gambut disebut pada kolom mitra pembangunan. Aksi lain dikelompokkan berdasarkan bukti publik YG atau keselarasan tema; pengelompokan ini bukan mandat dari pemerintah.',
      statusDescriptions:["Nama Yayasan Gambut tercantum langsung.","Bukti publik YG mendukung keterkaitan secara spesifik.","Relevan, tetapi belum membuktikan pelaksanaan aksi.","Belum tersedia bukti publik YG yang sesuai."],
      policyLabel:"ARAH KEBIJAKAN",policyTitle:"Tujuan dan sasaran formal",policyIntro:"Perbup menetapkan lima sasaran formal; lampiran menerjemahkannya menjadi sebelas sasaran operasional.",
      actionLabel:"RENCANA AKSI",actionTitle:"Aksi RAD Bengkalis Lestari",actionIntro:"Tampilan awal memuat 34 aksi yang terkait dengan YG. Gunakan filter untuk meninjau seluruh 47 aksi dan dasar setiap klasifikasi.",
      search:"Cari aksi",searchPlaceholder:"Cari aksi, perangkat daerah, mitra, atau tema",target:"Sasaran",status:"Status kontribusi",period:"Periode",
      reset:"Reset filter",showAll:"Tampilkan seluruh 47 aksi",
      methodLabel:"METODOLOGI & SUMBER",methodTitle:"Cara membaca pemetaan ini",
      methodText:"Halaman ini merupakan pemetaan berbasis bukti oleh Yayasan Gambut, bukan evaluasi resmi Pemerintah Kabupaten Bengkalis, dan tidak mengubah pembagian peran dalam RAD.",
      officialSource:"Sumber resmi",methodStatus:"Dasar klasifikasi",methodStatusText:"Pencantuman resmi, bukti publik YG, keselarasan tema, atau bukti yang belum tersedia.",
      updated:"Terakhir diperbarui",contact:"Pertanyaan atau koreksi",contactText:"Sampaikan temuan melalui YG GeoPortal."
    };
    setText(".kkmd-breadcrumb a", text.breadcrumb);
    setText(".rad-hero .kkmd-eyebrow", text.eyebrow);
    setText(".rad-hero h1", text.hero);
    setText(".rad-hero > div:first-child p", text.heroIntro);
    const cards = document.querySelectorAll(".rad-source-list a");
    if (cards[0]) { cards[0].querySelector("span").textContent=text.regulation; cards[0].querySelector("strong").textContent=text.regulationTitle; cards[0].querySelector("small").textContent=text.regulationMeta; }
    if (cards[1]) { cards[1].querySelector("span").textContent=text.annex; cards[1].querySelector("strong").textContent=text.annexTitle; cards[1].querySelector("small").textContent=text.annexMeta; }
    const statLabels=[text.goals,text.targets,text.actions,text.explicit,text.linked];
    document.querySelectorAll(".rad-stats article span").forEach((node,index)=>{ if(statLabels[index]) node.textContent=statLabels[index]; });
    setText(".rad-hierarchy",text.hierarchy);
    setText(".rad-position .kkmd-section-label",text.positionLabel);
    setText(".rad-position h2",text.positionTitle);
    const positionIntro=document.querySelector(".rad-position > div:first-child p"); if(positionIntro) positionIntro.innerHTML=text.positionIntro;
    const badges=document.querySelectorAll(".rad-status-key .rad-badge");
    ["explicit","verified","supporting","unmapped"].forEach((key,index)=>{ if(badges[index]) badges[index].textContent=copy().labels[key]; });
    document.querySelectorAll(".rad-status-key p").forEach((node,index)=>{ if(text.statusDescriptions[index]) node.textContent=text.statusDescriptions[index]; });
    const headings=document.querySelectorAll(".kkmd-section-heading");
    if(headings[0]) { headings[0].querySelector(".kkmd-section-label").textContent=text.policyLabel; headings[0].querySelector("h2").textContent=text.policyTitle; headings[0].querySelector("p").textContent=text.policyIntro; }
    if(headings[1]) { headings[1].querySelector(".kkmd-section-label").textContent=text.actionLabel; headings[1].querySelector("h2").textContent=text.actionTitle; headings[1].querySelector("p").textContent=text.actionIntro; }
    const filterLabels=document.querySelectorAll(".rad-filters label > span");
    [text.search,text.target,text.status,text.period].forEach((value,index)=>{if(filterLabels[index])filterLabels[index].textContent=value;});
    elements.search.placeholder=text.searchPlaceholder;
    elements.reset.textContent=text.reset;
    elements.showAll.textContent=text.showAll;
    setText(".rad-methodology .kkmd-section-label",text.methodLabel); setText(".rad-methodology h2",text.methodTitle);
    setText(".rad-methodology > p",text.methodText);
    const methodCards=document.querySelectorAll(".rad-method-card");
    if(methodCards[0]) {methodCards[0].querySelector("strong").textContent=text.officialSource;}
    if(methodCards[1]) {methodCards[1].querySelector("strong").textContent=text.methodStatus;methodCards[1].querySelector("span").textContent=text.methodStatusText;}
    if(methodCards[2]) {methodCards[2].querySelector("strong").textContent=text.updated;}
    if(methodCards[3]) {methodCards[3].querySelector("strong").textContent=text.contact;methodCards[3].querySelector("a").textContent=text.contactText;}
  }

  function renderSummary() {
    const summary = state.data.summary;
    const linked = allActions().filter(hasLink).length;
    Object.entries({ goals: summary.goals, targets: summary.targets, actions: summary.actions, explicit: summary.explicit, linked }).forEach(([key, value]) => {
      const node = document.querySelector('[data-stat="' + key + '"]');
      if (node) node.textContent = Number(value).toLocaleString(copy().locale);
    });
    const goals = lang()==="en" ? EN.goals : state.data.goals;
    const formalTargets = lang()==="en" ? EN.formalTargets : state.data.formalTargets;
    elements.goals.innerHTML = goals.map((goal,index)=>'<article class="rad-goal"><span>'+(index+1)+'</span>'+escapeHtml(goal)+'</article>').join("");
    elements.formalTargets.innerHTML = formalTargets.map((target,index)=>'<article class="rad-formal-target"><strong>'+escapeHtml((lang()==="en"?"Formal target ":"Sasaran formal ")+(index+1))+'</strong>'+escapeHtml(target)+'</article>').join("");
    if(elements.updatedAt){
      const date=new Date(state.data.updatedAt+"T00:00:00");
      elements.updatedAt.textContent=date.toLocaleDateString(copy().locale,{day:"numeric",month:"long",year:"numeric"});
    }
  }

  function fillFilters() {
    elements.target.innerHTML='<option value="">'+escapeHtml(copy().allTargets)+'</option>'+state.data.targets.map(target=>{
      const t=localTarget(target); return '<option value="'+escapeHtml(target.id)+'">'+target.number+' · '+escapeHtml(t.title)+'</option>';
    }).join("");
    elements.status.innerHTML='<option value="linked">'+escapeHtml(copy().linked)+'</option><option value="">'+escapeHtml(copy().allStatuses)+'</option>'+
      ["explicit","verified","supporting","unmapped"].map(key=>'<option value="'+key+'">'+escapeHtml(copy().labels[key])+'</option>').join("");
    const periods=[...new Set(allActions().map(action=>action.period))].sort((a,b)=>a.localeCompare(b,lang(),{numeric:true}));
    elements.period.innerHTML='<option value="">'+escapeHtml(copy().allPeriods)+'</option>'+periods.map(period=>'<option value="'+escapeHtml(period)+'">'+escapeHtml(period)+'</option>').join("");
    elements.target.value=state.target; elements.status.value=state.status; elements.period.value=state.period;
  }

  function filteredTargets() {
    const query=state.search.trim().toLowerCase();
    return state.data.targets.map(target=>{
      if(state.target && state.target!==target.id)return null;
      const actions=target.actions.filter(action=>{
        if(state.status==="linked" && !hasLink(action))return false;
        if(state.status && state.status!=="linked" && action.status!==state.status)return false;
        if(state.period && action.period!==state.period)return false;
        return !query || searchable(target,action).includes(query);
      });
      if(!actions.length && target.actions.length)return null;
      if(!actions.length && (state.status || state.period || query))return null;
      return Object.assign({},target,{actions});
    }).filter(Boolean);
  }

  function renderAction(target, action) {
    const t=localTarget(target),a=localAction(target,action);
    const evidence=Array.isArray(a.evidence)?a.evidence:[];
    const links=evidence.map(item=>'<a href="'+escapeHtml(item.url)+'" target="_blank" rel="noopener">'+escapeHtml(item.label)+' ↗</a>').join("");
    return '<article class="kkmd-action rad-action">'+
      '<div class="kkmd-action-code">'+target.number+'.'+action.no+'</div>'+
      '<div class="kkmd-action-main"><h4>'+escapeHtml(a.name)+'</h4><div class="rad-action-summary"><div><strong>'+escapeHtml(copy().periodTarget)+'</strong>'+escapeHtml(action.period)+'</div><div><strong>'+escapeHtml(copy().theme)+'</strong>'+escapeHtml(t.theme)+'</div></div></div>'+
      '<div class="kkmd-action-links"><span class="rad-badge is-'+escapeHtml(action.status)+'">'+escapeHtml(copy().labels[action.status])+'</span>'+(links?'<div class="rad-evidence-links">'+links+'</div>':"")+'</div>'+
      '<details class="rad-action-details"><summary>'+escapeHtml(copy().details)+'</summary><div class="rad-action-detail-grid">'+
      '<div><strong>'+escapeHtml(copy().lead)+'</strong>'+escapeHtml(action.lead)+'</div>'+
      '<div><strong>'+escapeHtml(copy().partners)+'</strong>'+escapeHtml(action.partners)+'</div>'+
      '<div class="rad-action-rationale"><strong>'+escapeHtml(copy().rationale)+'</strong>'+escapeHtml(a.rationale)+'</div></div></details></article>';
  }

  function renderActions() {
    const targets=filteredTargets();
    const visible=targets.reduce((sum,target)=>sum+target.actions.length,0);
    elements.count.textContent=lang()==="en"?visible+" of "+state.data.summary.actions+" action-plan items displayed":visible+" dari "+state.data.summary.actions+" rencana aksi ditampilkan";
    if(!targets.length){elements.groups.innerHTML='<div class="kkmd-empty"><strong>'+escapeHtml(copy().empty)+'</strong><br>'+escapeHtml(copy().emptyHelp)+'</div>';return;}
    elements.groups.innerHTML=targets.map(target=>{
      const t=localTarget(target), linked=target.actions.filter(hasLink).length;
      const rows=target.actions.map(action=>renderAction(target,action)).join("");
      const gap=!target.actions.length && t.note?'<div class="rad-gap"><strong>'+escapeHtml(copy().structureNote)+'</strong>'+escapeHtml(t.note)+(t.indicators?'<br><small>'+escapeHtml(copy().indicators)+': '+escapeHtml(t.indicators.join("; "))+'</small>':"")+'</div>':"";
      return '<section class="kkmd-issue-group"><header class="kkmd-issue-head"><div class="kkmd-issue-title"><span class="kkmd-issue-number">'+target.number+'</span><div><small>'+escapeHtml(t.theme)+'</small><h3>'+escapeHtml(t.title)+'</h3></div></div><span class="kkmd-issue-count">'+escapeHtml(lang()==="en"?linked+" linked · "+target.actions.length+" actions":linked+" terkait · "+target.actions.length+" aksi")+'</span></header><div class="kkmd-action-list">'+rows+gap+'</div></section>';
    }).join("");
  }

  function renderAll(){applyStaticLanguage();renderSummary();fillFilters();renderActions();}
  function bindEvents(){
    elements.search.addEventListener("input",event=>{state.search=event.target.value;renderActions();});
    elements.target.addEventListener("change",event=>{state.target=event.target.value;renderActions();});
    elements.status.addEventListener("change",event=>{state.status=event.target.value;renderActions();});
    elements.period.addEventListener("change",event=>{state.period=event.target.value;renderActions();});
    elements.reset.addEventListener("click",()=>{state.search="";state.target="";state.status="linked";state.period="";elements.search.value="";renderAll();});
    elements.showAll.addEventListener("click",()=>{state.status="";elements.status.value="";renderActions();});
    window.addEventListener("yg:languagechange",event=>{state.language=event.detail && event.detail.language==="en"?"en":"id";if(state.data)renderAll();else applyStaticLanguage();});
  }

  state.language=window.YG_I18N && window.YG_I18N.language==="en"?"en":"id";
  bindEvents(); applyStaticLanguage();
  fetch("data/bengkalis-lestari.json?v=20260911-public2")
    .then(response=>{if(!response.ok)throw new Error(copy().loadError);return response.json();})
    .then(data=>{state.data=data;renderAll();})
    .catch(error=>{elements.count.textContent=copy().unavailable;elements.groups.innerHTML='<div class="kkmd-empty">'+escapeHtml(error.message)+'</div>';});
})();