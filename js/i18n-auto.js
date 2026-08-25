(function(){
  'use strict';

  if(window.YG_I18N_AUTO_READY)return;
  window.YG_I18N_AUTO_READY=true;

  var SOURCE_TEXT=new WeakMap();
  var SOURCE_ATTR=new WeakMap();
  var missing=new Set();
  var running=false;
  var observer=null;
  var pendingNodes=new Set();
  var scheduled=false;
  var ATTRS=['placeholder','title','aria-label','alt'];
  var SKIP_SELECTOR='script,style,noscript,template,svg,canvas,pre,code';
  var exact={
    'Memetakan aksi. Merekam perubahan.':'Mapping action. Tracking change.',
    'Menghubungkan lokasi, capaian, foto evidence, dan laporan program dalam satu platform.':'Connecting locations, results, evidence photos, and programme reports in one platform.',
    'Lihat Dampak Program':'View Programme Impact',
    'Perlindungan pesisir':'Coastal Protection',
    'Kelapa Pati · buka evidence →':'Kelapa Pati · view evidence →',
    'Rumah bibit Sepahat':'Sepahat Community Nursery',
    'Rumah bibit masyarakat':'Community Nursery',
    'Sekat kanal di Temiang':'Canal Block in Temiang',
    'Restorasi gambut':'Peatland Restoration',
    'Login Staf':'Staff Login',
    'Buka menu':'Open menu',
    'Navigasi utama':'Main navigation',
    'Dokumentasi lapangan terverifikasi':'Verified field documentation',
    'Ringkasan data WebGIS':'WebGIS data summary',
    'pelatihan + kegiatan lapangan':'training + field activities',
    '4 desa · lihat ringkasan program':'4 villages · view programme summary',
    '2021 - Sekarang':'2021 - Present',
    'Desa Temiang · lihat ringkasan program':'Temiang Village · view programme summary',
    'Juni 2026–Februari 2027':'June 2026–February 2027',
    'Tutup rincian program':'Close programme details',
    'RINCIAN INDIKATOR':'INDICATOR DETAILS',
    'Buka data sumber':'Open source data'
  };

  var fragments=[
    [/\bDesa\b/g,'Village'],[/\bdesa\b/g,'village'],
    [/\bKabupaten\b/g,'Regency'],[/\bKecamatan\b/g,'District'],
    [/\bProvinsi\b/g,'Province'],[/\bLokasi\b/g,'Location'],
    [/\bProgram aktif\b/g,'Active programme'],[/\bProgram selesai\b/g,'Completed programme'],
    [/\bProgram berjalan\b/g,'Ongoing programme'],[/\bSekarang\b/g,'Present'],
    [/\blihat ringkasan program\b/gi,'view programme summary'],
    [/\bbuka evidence\b/gi,'view evidence'],[/\bbuka detail\b/gi,'open details'],
    [/\bbuka data sumber\b/gi,'open source data'],[/\bdata terkini\b/gi,'current data'],
    [/\bdata terverifikasi\b/gi,'verified data'],[/\bmonitoring lapangan\b/gi,'field monitoring'],
    [/\bpelatihan\b/gi,'training'],[/\bkegiatan lapangan\b/gi,'field activities'],
    [/\brumah bibit\b/gi,'nursery'],[/\bsekat kanal\b/gi,'canal block'],
    [/\brestorasi gambut\b/gi,'peatland restoration'],[/\brestorasi mangrove\b/gi,'mangrove restoration'],
    [/\brestorasi lahan mineral\b/gi,'mineral land restoration'],
    [/\bmitra pendanaan\b/gi,'funding partner'],[/\bcapaian program\b/gi,'programme results'],
    [/\bringkasan program\b/gi,'programme summary'],[/\bwilayah program\b/gi,'programme area'],
    [/\bperiode program\b/gi,'programme period'],[/\bpeserta\b/gi,'participants'],
    [/\bbibit tertanam\b/gi,'seedlings planted'],[/\bbibit ditanam\b/gi,'seedlings planted'],
    [/\bluas restorasi\b/gi,'restoration area'],[/\bluas area\b/gi,'area'],
    [/\bunit\b/gi,'units'],[/\borang\b/gi,'people'],[/\bhektare\b/gi,'hectares'],
    [/\bbelum tersedia\b/gi,'not yet available'],[/\bbelum ada data\b/gi,'no data available'],
    [/\bmemuat data\b/gi,'loading data'],[/\bmemuat\b/gi,'loading'],
    [/\bdiperbarui\b/gi,'updated'],[/\bterhubung ke\b/gi,'connected to'],
    [/\btutup\b/gi,'close'],[/\bkembali\b/gi,'back'],[/\bsimpan\b/gi,'save'],
    [/\btambah\b/gi,'add'],[/\bhapus\b/gi,'delete'],[/\bcari\b/gi,'search'],
    [/\bsemua\b/gi,'all'],[/\bterbaru\b/gi,'latest'],[/\bterlama\b/gi,'oldest']
  ];

  var idSignals=/\b(dan|yang|untuk|dari|dengan|pada|dalam|atau|ini|itu|belum|sudah|akan|dapat|data|desa|kegiatan|program|laporan|lokasi|restorasi|pelatihan|monitoring|masyarakat|bibit|sekat|kanal|gambut|mangrove|mitra|pendanaan|capaian|wilayah|periode|peserta|luas|jumlah|buka|lihat|tutup|kembali|memuat|diperbarui)\b/i;

  function language(){
    if(window.YG_I18N&&window.YG_I18N.language)return window.YG_I18N.language;
    try{return localStorage.getItem('yg-language')==='en'?'en':'id';}catch(e){return document.documentElement.lang==='en'?'en':'id';}
  }

  function shouldSkip(node){
    var el=node&&node.nodeType===1?node:node&&node.parentElement;
    return !!(el&&el.closest&&el.closest(SKIP_SELECTOR));
  }

  function fallback(text){
    var raw=String(text==null?'':text);
    var trimmed=raw.trim();
    if(!trimmed)return raw;
    if(exact[trimmed])return raw.replace(trimmed,exact[trimmed]);
    if(!idSignals.test(trimmed))return raw;
    var out=trimmed;
    fragments.forEach(function(pair){out=out.replace(pair[0],pair[1]);});
    if(out===trimmed){
      missing.add(trimmed);
      window.YG_I18N_MISSING=Array.from(missing).sort();
      return raw;
    }
    return raw.replace(trimmed,out);
  }

  function translateValue(value){
    var source=String(value==null?'':value);
    if(language()!=='en')return source;
    if(window.YG_I18N&&typeof window.YG_I18N.t==='function'){
      var translated=window.YG_I18N.t(source.trim());
      if(translated&&translated!==source.trim())return source.replace(source.trim(),translated);
    }
    return fallback(source);
  }

  function translateTextNode(node){
    if(!node||node.nodeType!==3||shouldSkip(node))return;
    if(language()==='id'){
      if(SOURCE_TEXT.has(node))node.nodeValue=SOURCE_TEXT.get(node);
      return;
    }
    var current=node.nodeValue;
    if(!current||!current.trim())return;
    var translated=translateValue(current);
    if(translated!==current){
      if(!SOURCE_TEXT.has(node))SOURCE_TEXT.set(node,current);
      node.nodeValue=translated;
    }else if(idSignals.test(current.trim())){
      missing.add(current.trim());
      window.YG_I18N_MISSING=Array.from(missing).sort();
    }
  }

  function translateAttributes(el){
    if(!el||el.nodeType!==1||shouldSkip(el))return;
    var originals=SOURCE_ATTR.get(el)||{};
    ATTRS.forEach(function(name){
      if(!el.hasAttribute(name))return;
      if(language()==='id'){
        if(Object.prototype.hasOwnProperty.call(originals,name))el.setAttribute(name,originals[name]);
        return;
      }
      var current=el.getAttribute(name)||'';
      var translated=translateValue(current);
      if(translated!==current){
        if(!Object.prototype.hasOwnProperty.call(originals,name))originals[name]=current;
        el.setAttribute(name,translated);
      }
    });
    SOURCE_ATTR.set(el,originals);
  }

  function translateTree(root){
    if(!root||running)return;
    if(language()!=='en')return;
    running=true;
    try{
      if(root.nodeType===3){translateTextNode(root);return;}
      if(root.nodeType!==1&&root.nodeType!==9)return;
      if(root.nodeType===1&&shouldSkip(root))return;
      var walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode:function(node){return shouldSkip(node)?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT;}});
      var node;
      while((node=walker.nextNode()))translateTextNode(node);
      if(root.nodeType===1)translateAttributes(root);
      if(root.querySelectorAll)root.querySelectorAll(ATTRS.map(function(a){return '['+a+']';}).join(',')).forEach(translateAttributes);
    }finally{running=false;}
  }

  function restoreTree(root){
    if(!root)return;
    if(root.nodeType===3){translateTextNode(root);return;}
    if(root.nodeType!==1&&root.nodeType!==9)return;
    var walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,null);
    var node;
    while((node=walker.nextNode()))translateTextNode(node);
    if(root.nodeType===1)translateAttributes(root);
    if(root.querySelectorAll)root.querySelectorAll(ATTRS.map(function(a){return '['+a+']';}).join(',')).forEach(translateAttributes);
  }

  function queueNode(node){
    if(!node||shouldSkip(node))return;
    pendingNodes.add(node.nodeType===3?node.parentElement||node:node);
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(function(){
      scheduled=false;
      if(language()!=='en'){pendingNodes.clear();return;}
      var nodes=Array.from(pendingNodes);
      pendingNodes.clear();
      nodes.forEach(translateTree);
    });
  }

  function installObserver(){
    if(!document.body||observer)return;
    if(language()==='en')translateTree(document.body);
    observer=new MutationObserver(function(records){
      if(running||language()!=='en')return;
      records.forEach(function(record){
        if(record.type==='characterData')queueNode(record.target);
        if(record.type==='childList')record.addedNodes.forEach(queueNode);
      });
    });
    observer.observe(document.body,{subtree:true,childList:true,characterData:true});
  }

  function wrapApi(){
    if(!window.YG_I18N||window.YG_I18N.__autoWrapped)return;
    var api=window.YG_I18N;
    var nativeT=typeof api.t==='function'?api.t.bind(api):null;
    var nativeFor=typeof api.forLanguage==='function'?api.forLanguage.bind(api):null;
    api.t=function(text){
      var source=String(text==null?'':text);
      var result=nativeT?nativeT(source):source;
      return api.language==='en'&&result===source?fallback(source):result;
    };
    api.forLanguage=function(text,lang){
      var source=String(text==null?'':text);
      var result=nativeFor?nativeFor(source,lang):source;
      return lang==='en'&&result===source?fallback(source):result;
    };
    api.__autoWrapped=true;
    window.YG_T=function(text){return api.t(text);};
  }

  function boot(){
    wrapApi();
    installObserver();
    window.addEventListener('yg:languagechange',function(){
      wrapApi();
      if(language()==='en')requestAnimationFrame(function(){translateTree(document.body);});
      else requestAnimationFrame(function(){restoreTree(document.body);});
    });
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
