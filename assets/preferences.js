(function(root){
 'use strict';
 const KEY='imposter-after-dark-setup-v1';
 const themes=['clash','minecraft','pokemon','movies','football','food','everyday','custom'];
 const modes=['classic','undercover','blitz'];
 function shortName(value){
  const text=typeof value==='string'?value:'';let result='';
  const units=typeof Intl.Segmenter==='function'?[...new Intl.Segmenter('de',{granularity:'grapheme'}).segment(text)].map(x=>x.segment):Array.from(text);
  for(const unit of units){if((result+unit).length>28)break;result+=unit}return result;
 }
 function defaults(){return{count:6,names:Array(12).fill(''),theme:'clash',mode:'classic',imposters:1,filters:{evo:true,champions:true,heroes:true},hints:true,anonymous:false,timer:180,custom:''}}
 function normalize(input){
  const out=defaults();if(!input||typeof input!=='object')return out;
  if(Number.isInteger(input.count)&&input.count>=3&&input.count<=12)out.count=input.count;
  if(Array.isArray(input.names))out.names=Array.from({length:12},(_,i)=>shortName(input.names[i]));
  if(themes.includes(input.theme))out.theme=input.theme;if(modes.includes(input.mode))out.mode=input.mode;
  if(Number.isInteger(input.imposters))out.imposters=Math.max(1,Math.min(input.imposters,Math.floor((out.count-1)/2)));
  if(input.filters&&typeof input.filters==='object')for(const key of ['evo','champions','heroes'])if(typeof input.filters[key]==='boolean')out.filters[key]=input.filters[key];
  for(const key of ['hints','anonymous'])if(typeof input[key]==='boolean')out[key]=input[key];
  if([0,60,180,300].includes(input.timer))out.timer=input.timer;
  if(typeof input.custom==='string')out.custom=input.custom.slice(0,12000);
  return out;
 }
 function load(storage){
  try{const raw=storage.getItem(KEY);const parsed=raw?JSON.parse(raw):null;return{settings:normalize(parsed),saved:!!parsed&&typeof parsed==='object',available:true}}
  catch(_){return{settings:defaults(),saved:false,available:false}}
 }
 function save(storage,settings){try{storage.setItem(KEY,JSON.stringify(normalize(settings)));return true}catch(_){return false}}
 const api={KEY,defaults,normalize,load,save};if(typeof module==='object'&&module.exports)module.exports=api;else root.ImposterPreferences=api;
})(typeof globalThis!=='undefined'?globalThis:this);
