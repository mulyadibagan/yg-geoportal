(function(){
"use strict";
var rows=[],activeType="all",regencyGrid=document.getElementById("regency-summary-grid"),search=document.getElementById("profile-search"),regency=document.getElementById("regency-filter"),legalFilter=document.getElementById("legal-filter"),documentFilter=document.getElementById("document-filter"),grid=document.getElementById("profile-grid");
function text(v){return String(v==null?"":v).trim()}function esc(v){return text(v).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}function norm(v){return text(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim()}function titleCase(v){return text(v).toLowerCase().replace(/(^|\s)\S/g,function(c){return c.toUpperCase()})}function cleanRegency(v){var n=norm(v).replace(/^(kabupaten|kota)\s+/,"");var a={"kapulauan meranti":"Kepulauan Meranti","kepulauan meranti":"Kepulauan Meranti","indragiri hilir":"Indragiri Hilir","indragiri hulu":"Indragiri Hulu","kuantan singingi":"Kuantan Singingi","rokan hilir":"Rokan Hilir","rokan hulu":"Rokan Hulu"};return a[n]||titleCase(n)}function keyValue(v){if(typeof v==="number"&&Number.isInteger(v))return v.toFixed(1);return text(v)}function permitKey(p){return keyValue(p.NO_IUPHKM||p.SK||p.OBJECTID||p.ID||[p.NAMA_HKM,p.NAMA_DESA,p.NAMA_KAB].filter(Boolean).join("|")).toLowerCase()}function featureKey(p){return keyValue(p.OBJECTID||p.ID||p.NO_IUPHKM||p.SK||[p.NAMA_HKM,p.NAMA_DESA,p.NAMA_KAB].filter(Boolean).join("|")).toLowerCase()}function documentTypes(doc){var v=norm([doc&&doc.category,doc&&doc.label,doc&&doc.name].filter(Boolean).join(" ")),t=[];if(/(^|\s)sk(\s|$)|legal/.test(v))t.push("sk");if(/peta|spasial|lampiran/.test(v))t.push("map");if(/(^|\s)rkps(\s|$)/.test(v))t.push("rkps");if(/(^|\s)rkt(\s|$)/.test(v))t.push("rkt");if(/(^|\s)kups(\s|$)/.test(v))t.push("kups");return t}
function makeRow(key,type,p,d){var spatial=type==="spatial",raw=text(spatial?p.NAMA_KAB:d.regency),docs=(Array.isArray(d.documents)?d.documents:[]).filter(function(x){return x&&x.url}),process=norm(d.legalStatus).indexOf("proses")>-1||norm(d.skDocumentStatus)==="process"||norm(d.decree)==="proses";return{key:key,type:type,status:process?"process":"approved",name:text(spatial?p.NAMA_HKM:d.name)||text(d.name)||"Profil PS",village:text(spatial?p.NAMA_DESA:d.village),district:text(spatial?p.NAMA_KEC:d.district),regency:cleanRegency(raw),scheme:text(spatial?p.Ket:d.scheme)||text(d.scheme),decree:process?"":text(spatial?p.NO_IUPHKM:d.decree),areaHa:Number(d.areaHa||0),documents:process?0:docs.length,documentRecords:process?[]:docs.map(function(x){return{key:x.url,types:documentTypes(x)}}),haystack:norm([spatial?p.NAMA_HKM:d.name,d.name,spatial?p.NAMA_DESA:d.village,spatial?p.NAMA_KEC:d.district,raw,spatial?p.NO_IUPHKM:d.decree,d.decree].join(" "))}}
function hasDocument(r,t){return r.status!=="process"&&(r.documentRecords||[]).some(function(d){return(d.types||[]).indexOf(t)>-1})}function formatHa(v){return Number(v||0).toLocaleString("id-ID",{maximumFractionDigits:2})+" ha"}function canonicalScheme(v){var n=norm(v);if(/kemitraan/.test(n))return"Kemitraan Kehutanan";if(/adat/.test(n))return"Hutan Adat";if(/tanaman rakyat|\bhtr\b/.test(n))return"Hutan Tanaman Rakyat";if(/hutan desa|\bhd\b|lphd/.test(n))return"Hutan Desa";if(/kemasyarakatan|\bhkm\b/.test(n))return"Hutan Kemasyarakatan";return"Belum terklasifikasi"}
function updateStats(scope){var approved=scope.filter(function(r){return r.status==="approved"}),process=scope.filter(function(r){return r.status==="process"}),approvedArea=approved.reduce(function(s,r){return s+Number(r.areaHa||0)},0),processArea=process.reduce(function(s,r){return s+Number(r.areaHa||0)},0);document.getElementById("stat-all").textContent=scope.length;document.getElementById("stat-approved").textContent=approved.length;document.getElementById("stat-process").textContent=process.length;["sk","map","rkps","rkt","kups"].forEach(function(t){var a=approved.filter(function(r){return hasDocument(r,t)}).length;document.getElementById("stat-doc-"+t).textContent=a;document.getElementById("stat-doc-"+t+"-missing").textContent=(approved.length-a)+" profil belum"});var schemes=["Hutan Desa","Hutan Kemasyarakatan","Hutan Tanaman Rakyat","Hutan Adat","Kemitraan Kehutanan"],groups={};schemes.forEach(function(s){groups[s]={count:0,area:0}});approved.forEach(function(r){var s=canonicalScheme(r.summaryScheme||r.scheme);if(groups[s]){groups[s].count++;groups[s].area+=Number(r.areaHa||0)}});document.getElementById("stat-scheme-grid").innerHTML='<div class="psd-area-total"><strong>'+formatHa(approvedArea)+'</strong><small>Total luas · SK terbit</small><em>'+approved.length+' profil persetujuan</em></div><div class="psd-area-process"><strong>'+formatHa(processArea)+'</strong><small>Total luas · dalam proses</small><em>'+process.length+' usulan · belum menjadi luas PS definitif</em></div>'+schemes.map(function(s){return'<div><strong>'+formatHa(groups[s].area)+'</strong><small>'+s+'</small><em>'+groups[s].count+' PS</em></div>'}).join("")}
function regencyLogo(name){var files={"Bengkalis":"Lambang Kabupaten Bengkalis.png","Siak":"Lambang Kabupaten Siak.png","Pelalawan":"Pelalawan logo.png","Rokan Hilir":"Lambang Kabupaten Rokan Hilir.png","Rokan Hulu":"Rohul.png","Kampar":"Lambang Kabupaten Kampar.png","Kuantan Singingi":"Lambang Kabupaten Kuantan Singingi.PNG","Indragiri Hilir":"Logo kabupaten indragiri hilir.jpg","Indragiri Hulu":"Lambang Kab Indragiri Hulu.png","Kepulauan Meranti":"Lambang kab Kepulauan Meranti.png","Dumai":"Lambang Kota Dumai.png"};return files[name]?"https://commons.wikimedia.org/wiki/Special:FilePath/"+encodeURIComponent(files[name]):"assets/logo-yayasan-gambut.png"}
function updateRegencySummary(){var groups={};rows.filter(function(r){return r.status==="approved"&&r.regency}).forEach(function(r){var g=groups[r.regency]||(groups[r.regency]={count:0,area:0});g.count++;g.area+=Number(r.areaHa||0)});regencyGrid.innerHTML=Object.keys(groups).sort(function(a,b){return groups[b].count-groups[a].count}).map(function(name){var g=groups[name];return'<button type="button" class="psd-regency-card" data-regency-card="'+esc(name)+'"><span class="psd-regency-card__logo"><img src="'+regencyLogo(name)+'" alt="Lambang '+esc(name)+'" loading="lazy"></span><span><strong>'+esc(name)+'</strong><small>'+g.count+' PS · '+formatHa(g.area)+'</small></span></button>'}).join("")}
function render(){var q=norm(search.value),area=regency.value,legal=legalFilter.value,doc=documentFilter.value,scope=rows.filter(function(r){return!area||r.regency===area});updateStats(rows);var shown=scope.filter(function(r){var dm=doc==="all"||doc.indexOf("missing-")===0&&!hasDocument(r,doc.replace("missing-",""))||doc.indexOf("available-")===0&&hasDocument(r,doc.replace("available-",""));return(legal==="all"||r.status===legal)&&(activeType==="all"||r.type===activeType)&&dm&&(!q||r.haystack.indexOf(q)>-1)});document.getElementById("result-count").textContent=shown.length+" profil";grid.innerHTML=shown.length?shown.map(function(r){var process=r.status==="process",types=["sk","map","rkps","rkt","kups"];return'<a class="psd-card '+(process?'is-process':'')+'" href="social-forestry-profile.html?key='+encodeURIComponent(r.key)+'"><div class="psd-card__top"><span class="psd-badge '+(process?'psd-badge--nonspatial':'')+'">'+(process?'Dalam proses':(r.type==='spatial'?'SK terbit · spasial':'SK terbit'))+'</span><span class="psd-docs">'+(process?'SK belum terbit':r.documents+' dokumen')+'</span></div><h3>'+esc(r.name)+'</h3><p>'+esc([r.village,r.district,r.regency].filter(Boolean).join(" · "))+'</p><div class="psd-document-matrix">'+types.map(function(t){var a=hasDocument(r,t);return'<span class="'+(a?'is-present':'is-missing')+'">'+t.toUpperCase()+' '+(process&&t==='sk'?'proses':(a?'ada':'belum'))+'</span>'}).join("")+'</div><div class="psd-card__meta"><span>'+esc(canonicalScheme(r.scheme))+'</span>'+(r.decree?'<span>'+esc(r.decree)+'</span>':'')+'</div><span class="psd-card__action">Buka profil →</span></a>'}).join(""):'<div class="psd-empty">Tidak ada profil yang sesuai dengan filter.</div>'}
async function init(){
  try{
    var result=await Promise.all([
      fetch("data/PERHUTANAN_SOSIAL_RIAU.geojson?v=20260828-area-summary1",{cache:"no-store"}).then(function(r){return r.json()}),
      fetch("data/social-forestry-details.json?v=20260828-status3",{cache:"no-store"}).then(function(r){return r.json()}),
      fetch("data/social-forestry-summary.json?v=20260828-area-summary1",{cache:"no-store"}).then(function(r){return r.json()})
    ]),features=result[0].features||[],details=result[1]||{},summaries=result[2].profiles||[],detailKeys=Object.keys(details),byD={},byS={},used={},seen={},spatialDecrees={},spatialSignatures={};

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
    });

    var sumD={},sumS={};
    summaries.forEach(function(s){
      if(s.decreeNorm)sumD[s.decreeNorm]=s;
      if(s.signature)sumS[s.signature]=s;
    });

    rows=[];
    features.forEach(function(f,i){
      var p=f.properties||{},de=norm(p.NO_IUPHKM||p.SK),s=sig(p.NAMA_HKM,p.NAMA_DESA,p.NAMA_KAB),pk=permitKey(p),fk=featureKey(p),candidateKeys=[];
      function include(k){if(k&&details[k]&&candidateKeys.indexOf(k)<0)candidateKeys.push(k)}
      include(pk);
      include(fk);
      (byD[de]||[]).forEach(include);
      (byS[s]||[]).forEach(include);

      /* Satu SK adalah satu profil. Semua sumber pasangan ikut ditandai dan
         dokumennya digabung agar record audit tidak muncul lagi sebagai kartu
         nonspasial terpisah. */
      candidateKeys.forEach(function(k){used[k]=true});
      if(de)spatialDecrees[de]=true;
      if(s)spatialSignatures[s]=true;

      var id=de?"sk:"+de:"row:"+i;
      if(seen[id])return;
      seen[id]=true;

      var k=candidateKeys.find(function(key){return norm(key)===de})||candidateKeys.find(function(key){return key.indexOf("drive-audit:")!==0})||candidateKeys[0]||fk||pk||String(i),d=details[k]?Object.assign({},details[k]):{},documents=[],documentSeen={};
      candidateKeys.forEach(function(key){
        var source=details[key]||{};
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
      if(sm){r.areaHa=Number(sm.areaHa||r.areaHa);r.summaryScheme=sm.scheme}
      rows.push(r);
    });

    detailKeys.forEach(function(k){
      if(used[k])return;
      var d=details[k]||{},de=norm(d.decree),s=sig(d.name,d.village,d.regency);
      if(!d.name||de&&spatialDecrees[de]||s&&spatialSignatures[s])return;
      var r=makeRow(k,"nonspatial",{},d),sm=sumD[de]||sumS[s];
      if(sm&&r.status==="approved"){r.areaHa=Number(sm.areaHa||r.areaHa);r.summaryScheme=sm.scheme}
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
[search,regency,legalFilter,documentFilter].forEach(function(el){el.addEventListener(el===search?'input':'change',render)});document.querySelectorAll('[data-type]').forEach(function(b){b.addEventListener('click',function(){activeType=b.dataset.type;document.querySelectorAll('[data-type]').forEach(function(x){x.classList.toggle('is-active',x===b)});render()})});regencyGrid.addEventListener("click",function(e){var card=e.target.closest("[data-regency-card]");if(!card)return;regency.value=card.dataset.regencyCard;render();document.querySelector(".psd-content").scrollIntoView({behavior:"smooth",block:"start"})});init();
})();
