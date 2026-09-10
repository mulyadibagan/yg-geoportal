(function(){
"use strict";
var rows=[],mapFeatures=[],activeType="all",activeScheme="",regencyMap=null,regencyLayer=null,leafletPromise=null,regencyGrid=document.getElementById("regency-summary-grid"),schemeGrid=document.getElementById("stat-scheme-grid"),documentStats=document.querySelector(".psd-stat-grid--documents"),search=document.getElementById("profile-search"),regency=document.getElementById("regency-filter"),legalFilter=document.getElementById("legal-filter"),documentFilter=document.getElementById("document-filter"),grid=document.getElementById("profile-grid"),mapPanel=document.getElementById("regency-map-panel"),mapCanvas=document.getElementById("regency-map"),mapTitle=document.getElementById("regency-map-title"),mapStatus=document.getElementById("regency-map-status"),mapClose=document.getElementById("regency-map-close");
function text(v){return String(v==null?"":v).trim()}function esc(v){return text(v).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}function norm(v){return text(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim()}function titleCase(v){return text(v).toLowerCase().replace(/(^|\s)\S/g,function(c){return c.toUpperCase()})}function cleanRegency(v){var n=norm(v).replace(/^(kabupaten|kota)\s+/,"");var a={"kapulauan meranti":"Kepulauan Meranti","kepulauan meranti":"Kepulauan Meranti","indragiri hilir":"Indragiri Hilir","indragiri hulu":"Indragiri Hulu","kuantan singingi":"Kuantan Singingi","rokan hilir":"Rokan Hilir","rokan hulu":"Rokan Hulu"};return a[n]||titleCase(n)}function keyValue(v){if(typeof v==="number"&&Number.isInteger(v))return v.toFixed(1);return text(v)}function permitKey(p){return keyValue(p.PROFILE_KEY||p.NO_IUPHKM||p.SK||p.OBJECTID||p.ID||[p.NAMA_HKM,p.NAMA_DESA,p.NAMA_KAB].filter(Boolean).join("|")).toLowerCase()}function featureKey(p){return keyValue(p.PROFILE_KEY||p.OBJECTID||p.ID||p.NO_IUPHKM||p.SK||[p.NAMA_HKM,p.NAMA_DESA,p.NAMA_KAB].filter(Boolean).join("|")).toLowerCase()}function documentTypes(doc){var v=norm([doc&&doc.category,doc&&doc.label,doc&&doc.name].filter(Boolean).join(" ")),t=[];if(/(^|\s)sk(\s|$)|legal/.test(v))t.push("sk");if(/peta|spasial|lampiran/.test(v))t.push("map");if(/(^|\s)rkps(\s|$)/.test(v))t.push("rkps");if(/(^|\s)rkt(\s|$)/.test(v))t.push("rkt");if(/(^|\s)kups(\s|$)/.test(v))t.push("kups");return t}
function makeRow(key,type,p,d){var spatial=type==="spatial",raw=text(spatial?(d.directoryRegency||d.regency||p.NAMA_KAB):d.regency),docs=(Array.isArray(d.documents)?d.documents:[]).filter(function(x){return x&&x.url}),legal=d.skExtraction||{},detailDecree=norm(d.decree),polygonDecree=norm(p.NO_IUPHKM||p.SK),legalDecree=norm(legal.decreeNumber),verifiedLegal=Boolean(legalDecree&&(!detailDecree||legalDecree===detailDecree||legalDecree===polygonDecree)),process=norm(d.legalStatus).indexOf("proses")>-1||norm(d.skDocumentStatus)==="process"||detailDecree==="proses",fallbackScheme=spatial&&/nonspasial|belum terklasifikasi/i.test(text(d.scheme))?p.Ket:(spatial?(d.scheme||p.Ket):d.scheme),scheme=verifiedLegal&&legal.scheme?legal.scheme:fallbackScheme,decree=spatial?(d.directoryDecree||d.decree||p.NO_IUPHKM||legal.decreeNumber):(d.decree||legal.decreeNumber);return{key:key,type:type,status:process?"process":"approved",name:text(spatial?(d.directoryName||p.NAMA_HKM):d.name)||text(d.name)||"Profil PS",village:text(spatial?(d.directoryVillage||d.village||p.NAMA_DESA):d.village),district:text(spatial?(d.directoryDistrict||d.district||p.NAMA_KEC):d.district),regency:cleanRegency(raw),scheme:text(scheme),decree:process?"":text(decree),areaHa:Number(d.areaHa||0),documents:process?0:docs.length,documentRecords:process?[]:docs.map(function(x){return{key:x.url,types:documentTypes(x)}}),haystack:norm([spatial?p.NAMA_HKM:d.name,d.name,d.directoryName,spatial?p.NAMA_DESA:d.village,d.directoryVillage,spatial?p.NAMA_KEC:d.district,d.directoryDistrict,raw,spatial?p.NO_IUPHKM:d.decree,d.decree,d.directoryDecree,legal.decreeNumber].join(" "))}}
function hasDocument(r,t){return r.status!=="process"&&(r.documentRecords||[]).some(function(d){return(d.types||[]).indexOf(t)>-1})}function formatHa(v){return Number(v||0).toLocaleString("id-ID",{maximumFractionDigits:2})+" ha"}function canonicalScheme(v){var n=norm(v);if(/kemitraan/.test(n))return"Kemitraan Kehutanan";if(/adat|\bha\b/.test(n))return"Hutan Adat";if(/tanaman rakyat|\bhtr\b/.test(n))return"Hutan Tanaman Rakyat";if(/hutan desa|\bhd\b|lphd/.test(n))return"Hutan Desa";if(/kemasyarakatan|\bhkm\b/.test(n))return"Hutan Kemasyarakatan";return"Belum terklasifikasi"}
function updateStats(scope){var approved=scope.filter(function(r){return r.status==="approved"}),process=scope.filter(function(r){return r.status==="process"}),approvedArea=approved.reduce(function(s,r){return s+Number(r.areaHa||0)},0),processArea=process.reduce(function(s,r){return s+Number(r.areaHa||0)},0);document.getElementById("stat-all").textContent=scope.length;document.getElementById("stat-approved").textContent=approved.length;document.getElementById("stat-process").textContent=process.length;["sk","map","rkps","rkt","kups"].forEach(function(t){var a=approved.filter(function(r){return hasDocument(r,t)}).length;document.getElementById("stat-doc-"+t).textContent=a;document.getElementById("stat-doc-"+t+"-missing").textContent=(approved.length-a)+" profil belum"});var schemes=["Hutan Desa","Hutan Kemasyarakatan","Hutan Tanaman Rakyat","Hutan Adat","Kemitraan Kehutanan"],groups={};schemes.forEach(function(s){groups[s]={count:0,area:0}});approved.forEach(function(r){var s=canonicalScheme(r.summaryScheme||r.scheme);if(groups[s]){groups[s].count++;groups[s].area+=Number(r.areaHa||0)}});schemeGrid.innerHTML='<button type="button" class="psd-area-card psd-area-total '+(legalFilter.value==="approved"&&!activeScheme?'is-active':'')+'" data-area-action="approved" aria-pressed="'+(legalFilter.value==="approved"&&!activeScheme)+'"><strong>'+formatHa(approvedArea)+'</strong><small>Total luas · SK terbit</small><em>'+approved.length+' profil persetujuan</em></button><button type="button" class="psd-area-card psd-area-process '+(legalFilter.value==="process"?'is-active':'')+'" data-area-action="process" aria-pressed="'+(legalFilter.value==="process")+'"><strong>'+formatHa(processArea)+'</strong><small>Total luas · dalam proses</small><em>'+process.length+' usulan · belum menjadi luas PS definitif</em></button>'+schemes.map(function(s){var active=legalFilter.value==="approved"&&activeScheme===s;return'<button type="button" class="psd-area-card '+(active?'is-active':'')+'" data-area-scheme="'+esc(s)+'" aria-pressed="'+active+'"><strong>'+formatHa(groups[s].area)+'</strong><small class="notranslate" translate="no">'+s+'</small><em>'+groups[s].count+' PS</em></button>'}).join("")}
function regencyLogo(name){var files={"Bengkalis":"Lambang Kabupaten Bengkalis.png","Siak":"Lambang Kabupaten Siak.png","Pelalawan":"Pelalawan logo.png","Rokan Hilir":"Lambang Kabupaten Rokan Hilir.png","Rokan Hulu":"Rohul.png","Kampar":"Lambang Kabupaten Kampar.png","Kuantan Singingi":"Lambang Kabupaten Kuantan Singingi.PNG","Indragiri Hilir":"Logo kabupaten indragiri hilir.jpg","Indragiri Hulu":"Lambang Kab Indragiri Hulu.png","Kepulauan Meranti":"Lambang kab Kepulauan Meranti.png","Dumai":"Lambang Kota Dumai.png"};return files[name]?"https://commons.wikimedia.org/wiki/Special:FilePath/"+encodeURIComponent(files[name]):"assets/logo-yayasan-gambut.png"}
function loadLeaflet(){if(window.L)return Promise.resolve(window.L);if(leafletPromise)return leafletPromise;leafletPromise=new Promise(function(resolve,reject){var link=document.createElement("link");link.rel="stylesheet";link.href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";document.head.appendChild(link);var script=document.createElement("script");script.src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";script.onload=function(){resolve(window.L)};script.onerror=function(){leafletPromise=null;reject(new Error("Leaflet gagal dimuat"))};document.body.appendChild(script)});return leafletPromise}
function mapFeatureRegency(feature){var p=feature&&feature.properties||{};return cleanRegency(p.NAMA_KAB||p.KABUPATEN||p.regency||p.kabupaten)}
function mapFeatureIdentity(feature,index){var p=feature&&feature.properties||{};return norm(p.NO_IUPHKM||p.SK||p.PROFILE_KEY||[p.NAMA_HKM,p.NAMA_DESA,p.NAMA_KAB,index].join("|"))}
function selectMapFeatures(name){var seen={};return mapFeatures.filter(function(feature,index){if(!feature||!feature.geometry||mapFeatureRegency(feature)!==name)return false;var key=mapFeatureIdentity(feature,index);if(seen[key])return false;seen[key]=true;return true})}
function markActiveRegency(name){regencyGrid.querySelectorAll("[data-regency-card]").forEach(function(card){var active=card.dataset.regencyCard===name;card.classList.toggle("is-active",active);card.setAttribute("aria-pressed",String(active))})}
function mapPopup(feature){var p=feature&&feature.properties||{},name=text(p.NAMA_HKM||p.name)||"Wilayah Perhutanan Sosial",village=text(p.NAMA_DESA||p.village),scheme=text(p.Ket||p.SCHEME||p.scheme),decree=text(p.NO_IUPHKM||p.SK);return'<div class="psd-map-popup"><strong>'+esc(name)+'</strong>'+(village?'<span>'+esc(village)+'</span>':'')+(scheme?'<small>'+esc(scheme)+'</small>':'')+(decree?'<small>'+esc(decree)+'</small>':'')+'</div>'}
function showRegencyMap(name){if(!name)return;mapPanel.hidden=false;mapTitle.textContent="Perhutanan Sosial · "+name;mapStatus.textContent="Memuat citra satelit dan geometri PS…";markActiveRegency(name);loadLeaflet().then(function(){if(!regencyMap){regencyMap=L.map(mapCanvas,{zoomControl:true,preferCanvas:true,minZoom:5}).setView([0.55,101.7],7);L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",{maxNativeZoom:17,maxZoom:19,attribution:"Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community"}).addTo(regencyMap)}if(regencyLayer){regencyMap.removeLayer(regencyLayer);regencyLayer=null}var selected=selectMapFeatures(name);if(selected.length){regencyLayer=L.geoJSON({type:"FeatureCollection",features:selected},{style:function(){return{color:"#ffe08a",weight:2.4,opacity:1,fillColor:"#0a8a6e",fillOpacity:.38}},onEachFeature:function(feature,layer){layer.bindPopup(mapPopup(feature),{maxWidth:310})}}).addTo(regencyMap);regencyMap.fitBounds(regencyLayer.getBounds(),{padding:[28,28],maxZoom:13});mapStatus.textContent=selected.length+" wilayah PS dengan geometri ditampilkan."}else{regencyMap.setView([0.55,101.7],7);mapStatus.textContent="Belum ada geometri PS yang dapat ditampilkan untuk wilayah ini."}setTimeout(function(){regencyMap.invalidateSize()},80)}).catch(function(){mapStatus.textContent="Peta belum dapat dimuat. Silakan coba kembali."});mapPanel.scrollIntoView({behavior:"smooth",block:"start"})}
function updateRegencySummary(){var groups={};rows.filter(function(r){return r.status==="approved"&&r.regency}).forEach(function(r){var g=groups[r.regency]||(groups[r.regency]={count:0,area:0});g.count++;g.area+=Number(r.areaHa||0)});regencyGrid.innerHTML=Object.keys(groups).sort(function(a,b){return groups[b].count-groups[a].count}).map(function(name){var g=groups[name];return'<button type="button" class="psd-regency-card" data-regency-card="'+esc(name)+'"><span class="psd-regency-card__logo"><img src="'+regencyLogo(name)+'" alt="Lambang '+esc(name)+'" loading="lazy"></span><span><strong>'+esc(name)+'</strong><small>'+g.count+' PS · '+formatHa(g.area)+'</small></span></button>'}).join("")}
function render(){var q=norm(search.value),area=regency.value,legal=legalFilter.value,doc=documentFilter.value,scope=rows.filter(function(r){return!area||r.regency===area});updateStats(rows);documentStats.querySelectorAll("[data-document-filter]").forEach(function(button){var active=button.dataset.documentFilter===doc;button.classList.toggle("is-active",active);button.setAttribute("aria-pressed",String(active))});var shown=scope.filter(function(r){var dm=doc==="all"||doc.indexOf("missing-")===0&&!hasDocument(r,doc.replace("missing-",""))||doc.indexOf("available-")===0&&hasDocument(r,doc.replace("available-","")),sm=!activeScheme||canonicalScheme(r.summaryScheme||r.scheme)===activeScheme;return(legal==="all"||r.status===legal)&&(activeType==="all"||r.type===activeType)&&sm&&dm&&(!q||r.haystack.indexOf(q)>-1)}),shownApproved=shown.filter(function(r){return r.status==="approved"}).length,shownProcess=shown.filter(function(r){return r.status==="process"}).length,countText=shown.length+" profil";if(activeType==="nonspatial"&&legal==="all")countText+=" · "+shownApproved+" SK terbit · "+shownProcess+" dalam proses";document.getElementById("result-count").textContent=countText;grid.innerHTML=shown.length?shown.map(function(r){var process=r.status==="process",types=["sk","map","rkps","rkt","kups"],labels={sk:"SK",map:"Lampiran peta",rkps:"RKPS",rkt:"RKT",kups:"KUPS"},geometry=r.type==="spatial"?"geometri tersedia":"tanpa geometri";return'<a class="psd-card '+(process?'is-process':'')+'" href="social-forestry-profile.html?key='+encodeURIComponent(r.key)+'"><div class="psd-card__top"><span class="psd-badge '+(process?'psd-badge--nonspatial':'')+'">'+(process?'Dalam proses · '+geometry:'SK terbit · '+geometry)+'</span><span class="psd-docs">'+(process?'SK belum terbit':r.documents+' dokumen')+'</span></div><h3>'+esc(r.name)+'</h3><p>'+esc([r.village,r.district,r.regency].filter(Boolean).join(" · "))+'</p><div class="psd-document-matrix">'+types.map(function(t){var a=hasDocument(r,t);return'<span class="'+(a?'is-present':'is-missing')+'">'+labels[t]+' '+(process&&t==='sk'?'proses':(a?'tersedia':'belum tersedia'))+'</span>'}).join("")+'</div><div class="psd-card__meta"><span class="notranslate" translate="no">'+esc(canonicalScheme(r.summaryScheme||r.scheme))+'</span>'+(r.decree?'<span>'+esc(r.decree)+'</span>':'')+'</div><span class="psd-card__action">Buka profil →</span></a>'}).join(""):'<div class="psd-empty">Tidak ada profil yang sesuai dengan filter.</div>'}
async function init(){
  try{
    var result=await Promise.all([
      fetch("data/PERHUTANAN_SOSIAL_RIAU.geojson?v=20260828-area-summary1",{cache:"no-store"}).then(function(r){return r.json()}),
      fetch("data/social-forestry-details.json?v=20260901-official1",{cache:"no-store"}).then(function(r){return r.json()}),
      fetch("data/social-forestry-summary.json?v=20260901-official1",{cache:"no-store"}).then(function(r){return r.json()}),
      fetch("data/social-forestry-pkk-samj.geojson?v=20260831-samj-pkk1",{cache:"no-store"}).then(function(r){return r.ok?r.json():{features:[]}}).catch(function(){return{features:[]}}),
      fetch("data/social-forestry-kud-agro-lestari.geojson?v=20260831-agro1",{cache:"no-store"}).then(function(r){return r.ok?r.json():{features:[]}}).catch(function(){return{features:[]}}),
      fetch("data/social-forestry-derived-2025.geojson?v=20260831-derived1",{cache:"no-store"}).then(function(r){return r.ok?r.json():{features:[]}}).catch(function(){return{features:[]}}),
      fetch("data/social-forestry-official-2026.geojson?v=20260901-official1",{cache:"no-store"}).then(function(r){return r.ok?r.json():{features:[]}}).catch(function(){return{features:[]}})
    ]),features=(result[0].features||[]).concat(result[3].features||[],result[4].features||[],result[5].features||[],result[6].features||[]),details=result[1]||{},summaries=result[2].profiles||[],detailKeys=Object.keys(details),byD={},byS={},bySpatial={},used={},seen={},spatialDecrees={},spatialSignatures={},spatialKeyCounts={};

    mapFeatures=features.slice();

    features.forEach(function(feature){
      var p=feature&&feature.properties||{};
      if(String(p.OBJECTID||"")==="2941"){
        p.NO_IUPHKM="SK.4391/MENLHK-PSKL/PKPS/PSL.0/7/2020";
        p.TGL_IUPHKM="2020-07-08";
      }
    });

    function sig(n,v,a){return norm([n,v,cleanRegency(a)].join("|"))}
    function addIndex(index,key,value){
      if(!key)return;
      if(!index[key])index[key]=[];
      if(index[key].indexOf(value)<0)index[key].push(value);
    }

    detailKeys.forEach(function(k){
      var d=details[k]||{},de=norm(d.decree),s=sig(d.name,d.village,d.regency);
      addIndex(byD,de,k);
      addIndex(byS,s,k);
      addIndex(bySpatial,keyValue(d.spatialObjectKey).toLowerCase(),k);
      addIndex(bySpatial,norm(d.spatialObjectKey),k);
    });

    features.forEach(function(feature){
      var p=feature&&feature.properties||{};
      [p.PROFILE_KEY,p.OBJECTID,p.ID].forEach(function(value){var k=keyValue(value).toLowerCase();if(k)spatialKeyCounts[k]=(spatialKeyCounts[k]||0)+1});
    });
    /* Sumber tambahan memiliki PROFILE_KEY yang stabil dan harus menang ketika
       SK yang sama juga masih ada pada snapshot dasar. */
    features.sort(function(a,b){return Number(Boolean((b.properties||{}).PROFILE_KEY))-Number(Boolean((a.properties||{}).PROFILE_KEY))});

    var sumD={},sumS={};
    summaries.forEach(function(s){
      if(s.decreeNorm)sumD[s.decreeNorm]=s;
      if(s.signature)sumS[s.signature]=s;
    });

    rows=[];
    features.forEach(function(f,i){
      var p=f.properties||{},de=norm(p.NO_IUPHKM||p.SK),s=sig(p.NAMA_HKM,p.NAMA_DESA,p.NAMA_KAB),pk=permitKey(p),fk=featureKey(p),identityKeys=[p.PROFILE_KEY,p.OBJECTID,p.ID].map(function(value){return keyValue(value).toLowerCase()}).filter(function(value){return value&&spatialKeyCounts[value]===1}),candidateKeys=[];
      function include(k){if(k&&details[k]&&candidateKeys.indexOf(k)<0)candidateKeys.push(k)}
      include(pk);
      identityKeys.forEach(include);
      (byD[de]||[]).forEach(include);
      (byS[s]||[]).forEach(include);
      identityKeys.forEach(function(value){(bySpatial[value]||[]).forEach(include)});
      (bySpatial[de]||[]).forEach(include);

      /* Satu SK adalah satu profil. Semua sumber pasangan ikut ditandai dan
         dokumennya digabung agar record audit tidak muncul lagi sebagai kartu
         nonspasial terpisah. */
      candidateKeys.forEach(function(k){used[k]=true});
      if(de)spatialDecrees[de]=true;
      if(s)spatialSignatures[s]=true;

      var id=de?"sk:"+de:"row:"+i;
      if(seen[id])return;
      seen[id]=true;

      function detailScore(key){var source=details[key]||{},legal=source.skExtraction||{},sourceDecree=norm(source.decree),legalDecree=norm(legal.decreeNumber);return(key===pk?500:0)+(source.skDocumentStatus==="available"?200:0)+(sourceDecree&&legalDecree===sourceDecree?100:0)+(sourceDecree===de?50:0)+(legalDecree===de?25:0)+Math.min((source.documents||[]).length,9)}
      var k=candidateKeys.slice().sort(function(a,b){return detailScore(b)-detailScore(a)})[0]||fk||pk||String(i),d=details[k]?Object.assign({},details[k]):{},documents=[],documentSeen={};
      if(d.name)d.directoryName=d.name;if(d.village)d.directoryVillage=d.village;if(d.district)d.directoryDistrict=d.district;if(d.regency)d.directoryRegency=d.regency;if(d.decree)d.directoryDecree=d.decree;
      candidateKeys.forEach(function(key){
        var source=details[key]||{};
        if(source.spatialObjectKey){
          if(!d.directoryName&&source.name)d.directoryName=source.name;
          if(!d.directoryVillage&&source.village)d.directoryVillage=source.village;
          if(!d.directoryDistrict&&source.district)d.directoryDistrict=source.district;
          if(!d.directoryRegency&&source.regency)d.directoryRegency=source.regency;
          if(!d.directoryDecree&&source.decree)d.directoryDecree=source.decree;
        }
        Object.keys(source).forEach(function(prop){
          if(prop!=="documents"&&(d[prop]==null||d[prop]==="")&&source[prop]!=null)d[prop]=source[prop];
        });
        (Array.isArray(source.documents)?source.documents:[]).filter(Boolean).forEach(function(doc){
          var docKey=text(doc.url)||norm([doc.label,doc.category].join("|"));
          if(!documentSeen[docKey]){documentSeen[docKey]=true;documents.push(doc)}
        });
      });
      if(candidateKeys.length)d.documents=documents;

      var r=makeRow(k,"spatial",p,d),sm=sumD[de]||sumS[s];
      if(sm){r.key=sm.key||r.key;r.areaHa=Number(sm.areaHa||r.areaHa);r.summaryScheme=sm.scheme}
      rows.push(r);
    });

    detailKeys.forEach(function(k){
      if(used[k])return;
      var d=details[k]||{},de=norm(d.decree),s=sig(d.name,d.village,d.regency);
      if(!d.name||de&&spatialDecrees[de]||s&&spatialSignatures[s])return;
      var r=makeRow(k,"nonspatial",{},d),sm=sumD[de]||sumS[s];
      if(sm&&r.status==="approved"){r.key=sm.key||r.key;r.areaHa=Number(sm.areaHa||r.areaHa);r.summaryScheme=sm.scheme}
      rows.push(r);
    });

    rows.sort(function(a,b){return a.name.localeCompare(b.name,"id")});
    var areas=Array.from(new Set(rows.map(function(r){return r.regency}).filter(Boolean))).sort();
    regency.innerHTML='<option value="">Semua kabupaten</option>'+areas.map(function(a){return'<option>'+esc(a)+'</option>'}).join("");
    updateRegencySummary();
    render();
  }catch(e){
    console.error(e);
    grid.innerHTML='<div class="psd-empty">Direktori gagal dimuat. Silakan coba lagi.</div>';
  }
}
[search,regency,documentFilter].forEach(function(el){el.addEventListener(el===search?'input':'change',render)});regency.addEventListener("change",function(){if(!mapPanel.hidden&&regency.value)showRegencyMap(regency.value)});mapClose.addEventListener("click",function(){mapPanel.hidden=true;markActiveRegency("");document.querySelector(".psd-regency").scrollIntoView({behavior:"smooth",block:"start"})});legalFilter.addEventListener("change",function(){activeScheme="";render()});document.querySelectorAll('[data-type]').forEach(function(b){b.addEventListener('click',function(){activeType=b.dataset.type;document.querySelectorAll('[data-type]').forEach(function(x){x.classList.toggle('is-active',x===b)});render()})});documentStats.addEventListener("click",function(e){var button=e.target.closest("[data-document-filter]");if(!button)return;var selected=button.dataset.documentFilter;documentFilter.value=documentFilter.value===selected?"all":selected;legalFilter.value="approved";activeScheme="";render();document.querySelector(".psd-content").scrollIntoView({behavior:"smooth",block:"start"})});schemeGrid.addEventListener("click",function(e){var card=e.target.closest("[data-area-action],[data-area-scheme]");if(!card)return;var action=card.dataset.areaAction||"",scheme=card.dataset.areaScheme||"";if(action==="approved"){legalFilter.value="approved";activeScheme=""}else if(action==="process"){legalFilter.value="process";activeScheme=""}else if(scheme){legalFilter.value="approved";activeScheme=activeScheme===scheme?"":scheme}render();document.querySelector(".psd-content").scrollIntoView({behavior:"smooth",block:"start"})});regencyGrid.addEventListener("click",function(e){var card=e.target.closest("[data-regency-card]");if(!card)return;regency.value=card.dataset.regencyCard;render();showRegencyMap(card.dataset.regencyCard)});init();
})();
